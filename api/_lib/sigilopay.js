const SIGILOPAY_BASE_URL = 'https://app.sigilopay.com.br/api/v1/gateway';

function authHeaders() {
  const publicKey = process.env.SIGILOPAY_PUBLIC_KEY;
  const secretKey = process.env.SIGILOPAY_SECRET_KEY;

  if (!publicKey || !secretKey) {
    throw new Error('Credenciais da SigiloPay não configuradas (SIGILOPAY_PUBLIC_KEY / SIGILOPAY_SECRET_KEY).');
  }

  return {
    'Content-Type': 'application/json',
    'x-public-key': publicKey,
    'x-secret-key': secretKey,
  };
}

async function parseJsonResponse(response, fallbackMessage) {
  const rawText = await response.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    const error = new Error(`Resposta inesperada da SigiloPay (HTTP ${response.status}).`);
    error.status = 502;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(data.message || fallbackMessage);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

async function createPixCharge(payload) {
  const response = await fetch(`${SIGILOPAY_BASE_URL}/pix/receive`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(response, 'Falha ao criar cobrança PIX na SigiloPay.');
}

async function getTransaction({ id, clientIdentifier }) {
  const params = new URLSearchParams();
  if (id) params.set('id', id);
  if (clientIdentifier) params.set('clientIdentifier', clientIdentifier);

  const response = await fetch(`${SIGILOPAY_BASE_URL}/transactions?${params.toString()}`, {
    method: 'GET',
    headers: authHeaders(),
  });

  return parseJsonResponse(response, 'Falha ao consultar transação na SigiloPay.');
}

module.exports = { createPixCharge, getTransaction };
