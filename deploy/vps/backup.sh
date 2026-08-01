#!/usr/bin/env bash
#
# Backup do Postgres do Fila Virtual.
#
# Um volume Docker sem backup e perda de dados esperando acontecer, e com
# cliente pagando isso deixa de ser susto e vira processo.
#
# O que este script faz de diferente do backup que todo mundo escreve:
# ele RESTAURA o dump num banco descartavel e confere que os dados voltaram.
# Backup que nunca foi restaurado nao e backup, e esperanca — e a hora de
# descobrir que o arquivo esta corrompido nao pode ser a hora do desastre.
#
# Uso:
#   ./backup.sh                 # dump + verificacao + expurgo dos antigos
#   ./backup.sh --sem-verificar # so o dump, quando a maquina estiver apertada
#   ./backup.sh --restaurar ARQUIVO   # restaura de verdade, no banco real
#
# Agendar (crontab -e), 3h da manha:
#   0 3 * * * cd /caminho/do/fila-app && ./deploy/vps/backup.sh >> /var/log/fila-backup.log 2>&1

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DESTINO="${BACKUP_DIR:-$RAIZ/backups}"
MANTER_DIAS="${BACKUP_KEEP_DAYS:-14}"
SERVICO_DB="${BACKUP_DB_SERVICE:-postgres}"
BANCO="${POSTGRES_DB:-fila}"
USUARIO="${POSTGRES_USER:-fila}"

compose() { docker compose -f "$RAIZ/docker-compose.yml" "$@"; }

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

morrer() { log "ERRO: $*"; exit 1; }

# --------------- Restauracao no banco real ---------------

if [[ "${1:-}" == "--restaurar" ]]; then
  ARQUIVO="${2:-}"
  [[ -f "$ARQUIVO" ]] || morrer "informe um arquivo de backup existente."

  log "ATENCAO: isto substitui o banco '$BANCO' pelo conteudo de $ARQUIVO."
  read -r -p "Digite RESTAURAR para confirmar: " confirmacao
  [[ "$confirmacao" == "RESTAURAR" ]] || morrer "cancelado."

  log "restaurando..."
  gunzip -c "$ARQUIVO" | compose exec -T "$SERVICO_DB" \
    pg_restore -U "$USUARIO" -d "$BANCO" --clean --if-exists --no-owner
  log "restaurado. Reinicie o backend: docker compose restart backend"
  exit 0
fi

# --------------- Dump ---------------

mkdir -p "$DESTINO"
CARIMBO="$(date '+%Y%m%d-%H%M%S')"
ARQUIVO="$DESTINO/fila-$CARIMBO.dump.gz"

compose ps "$SERVICO_DB" --status running --quiet >/dev/null 2>&1 \
  || morrer "o servico '$SERVICO_DB' nao esta rodando."

log "gerando dump de '$BANCO'..."
# -Fc (custom) em vez de SQL puro: permite restauracao seletiva e paralela, e
# comprime melhor. O gzip por cima e para o arquivo em repouso.
compose exec -T "$SERVICO_DB" pg_dump -U "$USUARIO" -d "$BANCO" -Fc --no-owner \
  | gzip -9 > "$ARQUIVO"

TAMANHO="$(du -h "$ARQUIVO" | cut -f1)"
[[ -s "$ARQUIVO" ]] || morrer "o dump saiu vazio."
log "dump gerado: $(basename "$ARQUIVO") ($TAMANHO)"

# --------------- Verificacao por restauracao ---------------
#
# Restaura num banco descartavel e confere que as tabelas voltaram com dados.
# Sem isto, um dump truncado ou corrompido passaria despercebido por meses.

if [[ "${1:-}" != "--sem-verificar" ]]; then
  # Identificador sem aspas no Postgres nao aceita hifen; o carimbo tem.
  TESTE="verifica_backup_${CARIMBO//-/_}"
  log "verificando: restaurando em '$TESTE'..."

  limpar() {
    compose exec -T "$SERVICO_DB" psql -U "$USUARIO" -d postgres \
      -c "DROP DATABASE IF EXISTS $TESTE;" >/dev/null 2>&1 || true
  }
  trap limpar EXIT

  compose exec -T "$SERVICO_DB" psql -U "$USUARIO" -d postgres \
    -c "CREATE DATABASE $TESTE;" >/dev/null

  gunzip -c "$ARQUIVO" | compose exec -T "$SERVICO_DB" \
    pg_restore -U "$USUARIO" -d "$TESTE" --no-owner >/dev/null 2>&1 \
    || morrer "o dump NAO restaura. O arquivo esta corrompido ou incompleto."

  # Conferir que restaurou "sem erro" nao basta: um dump vazio tambem
  # restaura sem erro. O que importa e a unidade ter voltado.
  UNIDADES="$(compose exec -T "$SERVICO_DB" psql -U "$USUARIO" -d "$TESTE" \
    -tAc "SELECT count(*) FROM venues;" 2>/dev/null | tr -d '[:space:]')"

  [[ "$UNIDADES" =~ ^[0-9]+$ ]] || morrer "a tabela 'venues' nao existe no dump restaurado."
  [[ "$UNIDADES" -gt 0 ]] || morrer "o dump restaurou com ZERO unidades. Backup inutil."

  log "verificado: $UNIDADES unidade(s) voltaram do backup."
  limpar
  trap - EXIT
fi

# --------------- Expurgo ---------------

REMOVIDOS="$(find "$DESTINO" -name 'fila-*.dump.gz' -type f -mtime "+$MANTER_DIAS" -print -delete | wc -l | tr -d ' ')"
[[ "$REMOVIDOS" -gt 0 ]] && log "expurgados $REMOVIDOS backup(s) com mais de $MANTER_DIAS dias."

TOTAL="$(find "$DESTINO" -name 'fila-*.dump.gz' -type f | wc -l | tr -d ' ')"
log "pronto. $TOTAL backup(s) em $DESTINO"

# Um backup so na mesma maquina nao protege contra a maquina morrer. Copie
# para fora — outro provedor, ou um bucket:
#   rclone copy "$DESTINO" remoto:fila-backups
