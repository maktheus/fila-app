// Validacao de CNPJ com digitos verificadores. Funcao pura.
//
// Recusamos CPF de proposito: a prospeccao so trabalha com empresa. Um CPF
// aceito aqui viraria dado pessoal guardado sem base legal, e isso e o erro
// que este modulo existe para evitar.

const PESOS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function digitoVerificador(base, pesos) {
  const soma = base.reduce((acc, d, i) => acc + d * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function normalizar(entrada) {
  return String(entrada == null ? '' : entrada).replace(/\D/g, '');
}

// Retorna { valido, cnpj, motivo }. `cnpj` vem so com digitos quando valido.
function validarCnpj(entrada) {
  const digitos = normalizar(entrada);

  if (digitos.length === 11) {
    return { valido: false, cnpj: null, motivo: 'CPF nao e aceito: a prospeccao so trabalha com empresas' };
  }
  if (digitos.length !== 14) {
    return { valido: false, cnpj: null, motivo: 'CNPJ precisa ter 14 digitos' };
  }
  if (/^(\d)\1{13}$/.test(digitos)) {
    return { valido: false, cnpj: null, motivo: 'CNPJ com todos os digitos iguais' };
  }

  const nums = digitos.split('').map(Number);
  const d1 = digitoVerificador(nums.slice(0, 12), PESOS_1);
  const d2 = digitoVerificador(nums.slice(0, 12).concat(d1), PESOS_2);
  if (nums[12] !== d1 || nums[13] !== d2) {
    return { valido: false, cnpj: null, motivo: 'digito verificador do CNPJ nao confere' };
  }

  return { valido: true, cnpj: digitos, motivo: null };
}

module.exports = { validarCnpj };
