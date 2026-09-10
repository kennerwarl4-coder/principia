const { getTransaction } = require('../../_lib/sigilopay');

module.exports = async (req, res) => {
  try {
    const { id } = req.query;
    const transaction = await getTransaction({ id });
    res.status(200).json({
      status: transaction.status,
      payedAt: transaction.payedAt || null,
    });
  } catch (error) {
    console.error('Erro ao consultar transação PIX:', error.details || error.message);
    res.status(error.status || 500).json({
      message: error.message || 'Erro interno ao consultar transação PIX.',
    });
  }
};
