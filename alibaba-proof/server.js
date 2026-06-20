const http = require('http');
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<h1>🤖 RefactorBot Agent Society is LIVE on Alibaba Cloud!</h1><p><b>Track 3:</b> Agent Society</p><p>Backend successfully deployed and integrated with Qwen Cloud.</p>');
});
const PORT = process.env.PORT || 9000;
server.listen(PORT, '0.0.0.0', () => console.log('Server running on port ' + PORT));