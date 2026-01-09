module.exports = (req, res) => {
  res.status(200).json({ message: 'TKC Social Content API', endpoints: ['/api/health', '/api/generate-plan', '/api/create-content-plan'] });
};
