# Marketing — vídeo, conteúdo e campanha local

O produto já se explica sozinho no cadastro; o material abaixo existe para levar
gente até lá. Tudo escrito para Manaus primeiro.

## Vídeo demo de 60 segundos

Grave com celular, luz natural, sem locução profissional. O que convence é ver
funcionando de verdade — não capriche na produção, capriche no realismo.

| Tempo | Imagem | Áudio / legenda |
|---|---|---|
| 0–6s | Recepção cheia, pessoas em pé, câmera na altura do olho | "Toda clínica conhece essa cena." |
| 6–12s | Close no cartaz do balcão com o QR | "Agora o cliente aponta a câmera aqui." |
| 12–22s | Tela do celular: digita o primeiro nome, toca em entrar, aparece M-014 | "Digita o nome. Pronto — está na fila." |
| 22–32s | Pessoa sai, senta na padaria, olha o celular mostrando posição | "E vai esperar onde quiser." |
| 32–42s | Painel do operador: recepcionista toca em "chamar próximo" | "Na recepção, um toque chama o próximo." |
| 42–50s | Celular vibra: "É a sua vez — balcão 1" | "O celular avisa na hora." |
| 50–60s | Recepção vazia, cartaz no balcão, logo | "Sem totem, sem app, sem obra. Crie a sua em um minuto." |

**Última tela:** o endereço do site e "14 dias grátis".

Corte também uma versão de 15s (0–6s + 12–22s + 42–50s) para anúncio.

## Três conteúdos de lançamento

**1 — O problema (carrossel ou reel)**
> Título: "A sala de espera cheia não é culpa do atendimento."
> Desenvolvimento: quando a pessoa precisa ficar de pé para não perder a vez, a
> recepção vira gargalo. O problema não é a demora, é a **incerteza** — ninguém
> sabe quanto falta. Fecha com: "E se ela pudesse ver a fila pelo celular?"

**2 — A solução em 4 imagens**
> QR no balcão → nome no celular → posição ao vivo → chamada.
> Uma frase por imagem, sem jargão. Termina com o cartaz impresso, que é o que o
> dono precisa visualizar para acreditar que é simples.

**3 — Prova (depois do piloto)**
> Foto real da recepção do cliente + número concreto ("de 12 pessoas em pé para
> 3"). Marque o estabelecimento. Este é o post que mais converte — segure o
> lançamento até ter um piloto para citar.

**Google Business Profile:** crie o perfil, poste o vídeo de 60s e responda toda
avaliação. Para busca local, o perfil pesa mais que o Instagram.

## Campanha Google Ads local

Comece com **R$ 20/dia** em Manaus, raio de 25 km. Um único objetivo: cliques no
`/cadastro.html`, que é onde a pessoa se serve sozinha.

### Estrutura

| Grupo de anúncios | Palavras-chave (correspondência de frase) |
|---|---|
| Fila genérica | "fila virtual", "sistema de fila", "gerenciador de fila", "fila por qr code" |
| Senha / totem | "senha eletrônica", "painel de senha", "totem de senha", "chamador de senha" |
| Por segmento | "fila clínica", "fila laboratório", "fila cartório", "organizar fila consultório" |

**Negativas obrigatórias** (sem elas o orçamento evapora): `grátis`, `download`,
`apk`, `excel`, `planilha`, `curso`, `emprego`, `vaga`, `banco`, `senha wifi`.

### Títulos (30 caracteres)

```
Fila virtual por QR code
Acabe com a fila na porta
Sem totem. Sem aplicativo.
Teste grátis por 14 dias
Fila no celular do cliente
```

### Descrições (90 caracteres)

```
O cliente escaneia o QR, entra na fila e espera onde quiser. Configure em minutos.
Substitua o totem de senha por um QR code impresso. R$ 99/mês por unidade.
Veja a fila ao vivo, chame pelo painel e reduza a sala de espera. Teste grátis.
```

### Extensões

- **Sitelinks:** Planos · Como funciona · Criar minha fila · Privacidade
- **Frase de destaque:** Sem fidelidade · Sem instalação · Suporte por WhatsApp

### O que medir

O backend registra `lead_captured`, `venue_created` e `premium_started`
(`GET /api/funnel`, autenticado). A conta a acompanhar é simples:

```
custo da campanha ÷ venue_created = custo por clínica cadastrada
```

Se esse número passar de R$ 99 (uma mensalidade), pause e reveja os criativos
antes de aumentar o orçamento.

## Ordem sugerida

1. Vídeo de 60s gravado (sem ele, nada mais rende).
2. Google Business Profile + os dois primeiros posts.
3. Campanha no ar com R$ 20/dia por duas semanas.
4. Piloto rodando → grave o conteúdo de prova → só então aumente o orçamento.
