const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.code === 'P2002') {
    return res.status(409).json({ error: '資料已存在' });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ error: '資料不存在' });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || '伺服器錯誤';

  res.status(statusCode).json({ error: message });
};

module.exports = errorHandler;
