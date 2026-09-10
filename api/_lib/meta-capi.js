const crypto = require('node:crypto');

function hashValue(value) {
  if (!value) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return undefined;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function hashPhone(value) {
  if (!value) return undefined;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return undefined;
  // Meta espera E.164 sem "+". Assume Brasil (55) quando o número não tiver DDI.
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return crypto.createHash('sha256').update(withCountry).digest('hex');
}

// Envia o evento de Purchase pelo lado do servidor (server-to-server), redundante ao
// pixel do navegador. É o mecanismo que a própria Meta recomenda para garantir que
// vendas aprovadas sejam contabilizadas mesmo quando o pixel do cliente falha (bloqueador
// de anúncios, cookies bloqueados, aba fechada antes do evento disparar, etc). Usa o
// mesmo eventId do pixel do navegador para a Meta deduplicar os dois envios.
async function sendPurchaseEvent({ eventId, value, currency, email, phone, fbp, fbc, clientIp, userAgent, eventSourceUrl }) {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    console.warn('[meta-capi] META_PIXEL_ID / META_CAPI_ACCESS_TOKEN não configurados — evento não enviado.');
    return;
  }

  const userData = {
    em: hashValue(email) ? [hashValue(email)] : undefined,
    ph: hashPhone(phone) ? [hashPhone(phone)] : undefined,
    client_ip_address: clientIp || undefined,
    client_user_agent: userAgent || undefined,
    fbp: fbp || undefined,
    fbc: fbc || undefined,
  };

  const payload = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        event_source_url: eventSourceUrl,
        user_data: userData,
        custom_data: {
          value,
          currency: currency || 'BRL',
        },
      },
    ],
  };

  // Definir META_TEST_EVENT_CODE (Gerenciador de Eventos > Testar Eventos) faz o evento
  // aparecer só na aba de teste, sem contar como conversão real na conta de anúncios.
  if (process.env.META_TEST_EVENT_CODE) {
    payload.test_event_code = process.env.META_TEST_EVENT_CODE;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    if (!response.ok) {
      console.error('[meta-capi] Falha ao enviar Purchase:', response.status, text);
    } else {
      console.log('[meta-capi] Purchase enviado:', text);
    }
  } catch (error) {
    console.error('[meta-capi] Erro ao chamar Graph API:', error.message);
  }
}

module.exports = { sendPurchaseEvent };
