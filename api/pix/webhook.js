const { reportOrder, buildOrderPayload } = require('../_lib/utmify');
const { sendPurchaseEvent } = require('../_lib/meta-capi');

const PAID_STATUSES = new Set(['COMPLETED', 'PAID', 'paid', 'completed']);

module.exports = async (req, res) => {
  console.log('[SigiloPay webhook]', JSON.stringify(req.body), JSON.stringify(req.query));

  try {
    const body = req.body || {};
    const status = body.status;

    // O pedido inteiro viaja dentro de "metadata" (ecoado de volta pela SigiloPay a partir
    // do que mandamos em /api/pix/create) — a callbackUrl agora é sempre a mesma string fixa,
    // então não dá mais pra usar query string por pedido (ver comentário em create.js).
    // Mantém req.query como fallback, caso a SigiloPay não devolva "metadata" como esperado.
    const metadata = (body.metadata && typeof body.metadata === 'object') ? body.metadata : {};
    const queryFallback = req.query || {};

    const orderId = metadata.orderId || queryFallback.orderId;
    const name = metadata.name || queryFallback.name;
    const email = metadata.email || queryFallback.email;
    const phone = metadata.phone || queryFallback.phone;
    const createdAt = metadata.createdAt || queryFallback.createdAt;
    const eventId = metadata.meta_event_id || queryFallback.meta_event_id;
    const fbp = metadata.meta_fbp || queryFallback.meta_fbp;
    const fbc = metadata.meta_fbc || queryFallback.meta_fbc;
    const userAgent = metadata.meta_ua || queryFallback.meta_ua;
    const clientIp = metadata.meta_ip || queryFallback.meta_ip;
    const tracking = (metadata.tracking && typeof metadata.tracking === 'object')
      ? metadata.tracking
      : queryFallback;
    const amount = body.amount || queryFallback.amount;

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
