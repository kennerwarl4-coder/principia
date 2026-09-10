const UTMIFY_ORDERS_URL = 'https://api.utmify.com.br/api-credentials/orders';

// A UTMify exige "YYYY-MM-DD HH:MM:SS" em UTC — não aceita ISO 8601 (com "T"/"Z").
function formatUtmifyDate(date) {
  const d = date || new Date();
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// Best-effort: nunca deve derrubar o fluxo de pagamento por causa de um erro na UTMify.
async function reportOrder(order) {
  const apiToken = process.env.UTMIFY_API_TOKEN;
  if (!apiToken) {
    console.warn('[utmify] UTMIFY_API_TOKEN não configurado — pedido não reportado.');
    return;
  }

  try {
    const response = await fetch(UTMIFY_ORDERS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': apiToken,
      },
      body: JSON.stringify(order),
    });

    const text = await response.text();
    if (!response.ok) {
      console.error('[utmify] Falha ao reportar pedido:', response.status, text);
    } else {
      console.log('[utmify] Pedido reportado:', order.orderId, order.status);
    }
  } catch (error) {
    console.error('[utmify] Erro ao chamar API:', error.message);
  }
}

function buildOrderPayload({ orderId, status, createdAt, approvedDate, customer, amount, tracking }) {
  const amountCents = Math.round(amount * 100);

  return {
    orderId,
    platform: 'PrincipiaCheckout',
    paymentMethod: 'pix',
    status,
    createdAt: formatUtmifyDate(createdAt ? new Date(createdAt) : new Date()),
    approvedDate: approvedDate ? formatUtmifyDate(new Date(approvedDate)) : null,
    refundedAt: null,
    customer: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone || null,
      document: customer.document || null,
      country: 'BR',
    },
    products: [
      {
        id: '1',
        name: 'Kit Rotina Anti Melasma',
        planId: null,
        planName: null,
        quantity: 1,
        priceInCents: amountCents,
      },
    ],
    trackingParameters: {
      src: (tracking && tracking.src) || null,
      sck: (tracking && tracking.sck) || null,
      utm_source: (tracking && tracking.utm_source) || null,
      utm_campaign: (tracking && tracking.utm_campaign) || null,
      utm_medium: (tracking && tracking.utm_medium) || null,
      utm_content: (tracking && tracking.utm_content) || null,
      utm_term: (tracking && tracking.utm_term) || null,
    },
    commission: {
      totalPriceInCents: amountCents,
      gatewayFeeInCents: 0,
      userCommissionInCents: amountCents,
      currency: 'BRL',
    },
  };
}

module.exports = { reportOrder, buildOrderPayload };
