const { getTransaction } = require('../_lib/sigilopay');
const { reportPurchase } = require('../_lib/report-purchase');

const PAID_STATUSES = new Set(['COMPLETED', 'PAID', 'paid', 'completed']);

// Chamado pelo navegador assim que ele mesmo detecta (via polling em /api/pix/status) que
// o pagamento foi confirmado — cobre o caso comum em que o cliente fica na tela esperando,
// sem depender do webhook da SigiloPay (hoje desativado, ver comentário em create.js).
// NUNCA confia no "está pago" que o cliente alega: reconsulta a transação na SigiloPay antes
// de reportar qualquer coisa pra UTMify/Meta.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  try {
    const { transactionId, orderId, name, email, phone, createdAt, tracking, amount, eventId, fbp, fbc } = req.body || {};

    if (!transactionId || typeof transactionId !== 'string') {
      res.status(400).json({ message: 'transactionId ausente.' });
      return;
    }

    const transaction = await getTransaction({ id: transactionId });
    const status = transaction && transaction.status;

    if (!PAID_STATUSES.has(status)) {
      res.status(200).json({ reported: false, status: status || 'unknown' });
      return;
    }

    const verifiedAmount = transaction.amount != null ? transaction.amount : amount;
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp = (typeof forwarded === 'string' && forwarded.length > 0)
      ? forwarded.split(',')[0].trim()
      : (req.socket && req.socket.remoteAddress);

    await reportPurchase({
      orderId: orderId || transactionId,
      name,
      email,
      phone,
      createdAt,
      tracking,
      amount: verifiedAmount,
      eventId,
      fbp,
      fbc,
      clientIp,
      userAgent: req.headers['user-agent'] || '',
      eventSourceUrl: `${process.env.PUBLIC_BASE_URL || ''}/checkout/obrigado.html`,
    });

    res.status(200).json({ reported: true, status });
  } catch (error) {
    console.error('[confirm] Erro ao confirmar/reportar compra:', error.details || error.message);
    res.status(error.status || 500).json({
      message: error.message || 'Erro interno ao confirmar pagamento.',
    });
  }
};
