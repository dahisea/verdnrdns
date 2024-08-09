const https = require('https');

// Vercel function handler
module.exports = async (req, res) => {
  try {
    const targetUrl = 'https://dns.google/dns-query';

    const options = {
      method: 'POST',
      headers: {
        'Host': 'dns.google',
        'Content-Type': 'application/dns-message',
        'Accept': 'application/dns-message',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    };

    let requestData = [];
    req.on('data', chunk => {
      requestData.push(chunk);
    });

    req.on('end', () => {
      requestData = Buffer.concat(requestData);
      
      const proxyReq = https.request(targetUrl, options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (e) => {
        console.error('Proxy request error:', e);
        res.status(500).send(`Proxy request failed: ${e.message}`);
      });

      proxyReq.write(requestData);
      proxyReq.end();
    });
  } catch (error) {
    console.error('Function error:', error);
    res.status(500).send(`Function execution failed: ${error.message}`);
  }
};
