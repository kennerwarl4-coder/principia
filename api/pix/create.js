const crypto = require('node:crypto');
const QRCode = require('qrcode');
const { createPixCharge } = require('../_lib/sigilopay');
const { validateOrderInput } = require('../_lib/validate');
const { reportOrder, buildOrderPayload } = require('../_lib/utmify');

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0].trim();
  return req.socket && req.socket.remoteAddress;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  try {
    const validationError = validateOrderInput(req.body);
    if (validationError) {
      res.status(400).json({ message: validationError });
      return;
    }

    const { amount, client, products, shippingFee, tracking, meta } = req.body;
    const identifier = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const trackingData = tracking && typeof tracking === 'object' ? tracking : {};
    const metaData = meta && typeof meta === 'object' ? meta : {};

    const customer = {
      name: String(client.name).trim(),
      email: String(client.email).trim(),
      phone: client.phone,
      document: client.document,
    };

    const payload = {
      identifier,
      amount,
      client: customer,
      metadata: {
        provider: 'Checkout',
        orderId: identifier,
      },
    };

    // A SigiloPay valida que amount = soma dos products + shippingFee + extraFee - discount.
    // Sem informar o shippingFee separadamente, um amount que já embute o frete é rejeitado
    // ("Preço da transação inválido").
    if (Number(shippingFee) > 0) {
      payload.shippingFee = Number(shippingFee);
    }

    // A SigiloPay rejeita callbackUrl apontando para localhost/rede interna (proteção
    // anti-SSRF). Só envie o webhook quando o servidor tiver uma URL pública real; em
    // dev local o frontend já confirma o pagamento via polling em /api/pix/status, mas
    // sem o webhook a venda aprovada não é reportada à UTMify/Meta CAPI.
    //
    // As functions da Vercel não têm estado entre chamadas, então o pedido inteiro
    // (cliente, tracking de UTM, ids do Meta) viaja na própria querystring do callback
    // para o webhook saber o que reportar quando o pagamento confirmar.
    const publicBaseUrl = process.env.PUBLIC_BASE_URL;
    if (publicBaseUrl && !/localhost|127\.0\.0\.1/i.test(publicBaseUrl)) {
      const webhookParams = new URLSearchParams({
        orderId: identifier,
        name: customer.name,
        email: customer.email,
        phone: customer.phone || '',
        amount: String(amount),
        createdAt,
      });
      Object.entries(trackingData).forEach(([key, value]) => {
        if (value) webhookParams.set(key, String(value));
      });
      if (metaData.eventId) webhookParams.set('meta_event_id', String(metaData.eventId));
      if (metaData.fbp) webhookParams.set('meta_fbp', String(metaData.fbp));
      if (metaData.fbc) webhookParams.set('meta_fbc', String(metaData.fbc));
      webhookParams.set('meta_ua', req.headers['user-agent'] || '');
      webhookParams.set('meta_ip', getClientIp(req) || '');
      payload.callbackUrl = `${publicBaseUrl}/api/pix/webhook?${webhookParams.toString()}`;
    }

    if (Array.isArray(products) && products.length > 0) {
      payload.products = products.slice(0, 20).map((item, index) => ({
        id: String(item.id || index),
        name: String(item.name || 'Produto').slice(0, 200),
        quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
        price: Number(item.price) > 0 ? Number(item.price) : amount,
      }));
    }

    const charge = await createPixCharge(payload);
    const qrImage = await QRCode.toDataURL(charge.pix.code, { margin: 1, width: 320 });

    await reportOrder(buildOrderPayload({
      orderId: identifier,
      status: 'waiting_payment',
      createdAt,
      approvedDate: null,
      customer,
      amount,
      tracking: trackingData,
    }));

    res.status(201).json({
      transactionId: charge.transactionId,
      identifier,
      status: charge.status,
      amount,
      pix: {
        code: charge.pix.code,
        qrImage,
      },
    });
  } catch (error) {
    console.error('Erro ao criar cobrança PIX:', error.details || error.message);
    res.status(error.status || 500).json({
      message: error.message || 'Erro interno ao criar cobrança PIX.',
    });
  }
};
