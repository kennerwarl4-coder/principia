const { reportOrder, buildOrderPayload } = require('../_lib/utmify');
const { sendPurchaseEvent } = require('../_lib/meta-capi');

const PAID_STATUSES = new Set(['COMPLETED', 'PAID', 'paid', 'completed']);

module.exports = async (req, res) => {
  console.log('[SigiloPay webhook]', JSON.stringify(req.body), JSON.stringify(req.query));

  try {
    const status = req.body && req.body.status;
    const {
      orderId, name, email, phone, amount, createdAt,
      meta_event_id: eventId, meta_fbp: fbp, meta_fbc: fbc, meta_ua: userAgent, meta_ip: clientIp,
      ...tracking
    } = req.query || {};

    if (orderId && amount && PAID_STATUSES.has(status)) {
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
          tracking,
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
          eventSourceUrl: `${process.env.PUBLIC_BASE_URL || ''}/checkout/`,
        }),
      ]);
    }
  } catch (error) {
    console.error('[webhook] Erro ao processar callback:', error.message);
  }

  res.status(200).end();
};
