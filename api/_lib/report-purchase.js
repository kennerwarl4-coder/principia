const { reportOrder, buildOrderPayload } = require('./utmify');
const { sendPurchaseEvent } = require('./meta-capi');

// Reporta uma venda paga pra UTMify + Meta CAPI. Usado tanto pelo webhook da SigiloPay
// quanto pelo /api/pix/confirm (checagem feita pelo navegador quando detecta o pagamento
// via polling) — os dois caminhos convergem aqui pra não duplicar a lógica de report.
async function reportPurchase({ orderId, name, email, phone, createdAt, tracking, amount, eventId, fbp, fbc, clientIp, userAgent, eventSourceUrl }) {
  const approvedDate = new Date().toISOString();
  const numericAmount = Number(amount);

  await Promise.all([
    reportOrder(buildOrderPayload({
      orderId,
      status: 'paid',
      createdAt: createdAt || approvedDate,
      approvedDate,
      customer: { name, email, phone },
      amount: numericAmount,
      tracking: tracking || {},
    })),
    sendPurchaseEvent({
      eventId,
      value: numericAmount,
      currency: 'BRL',
      email,
      phone,
      fbp,
      fbc,
      clientIp,
      userAgent,
      eventSourceUrl,
    }),
  ]);
}

module.exports = { reportPurchase };
