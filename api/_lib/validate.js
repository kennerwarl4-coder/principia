function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function onlyDigits(value) {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

function validateOrderInput(body) {
  const { amount, client } = body || {};

  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return 'Valor da transação inválido.';
  }
  if (!client || typeof client !== 'object') {
    return 'Dados do cliente ausentes.';
  }

  const name = String(client.name || '').trim();
  const email = String(client.email || '').trim();
  const phoneDigits = onlyDigits(client.phone);
  const documentDigits = onlyDigits(client.document);

  if (name.length < 3) return 'Informe o nome completo.';
  if (!isValidEmail(email)) return 'Informe um e-mail válido.';
  if (phoneDigits.length < 10 || phoneDigits.length > 11) return 'Informe um telefone válido com DDD.';
  if (documentDigits.length !== 11 && documentDigits.length !== 14) return 'Informe um CPF ou CNPJ válido.';

  return null;
}

module.exports = { isValidEmail, onlyDigits, validateOrderInput };
