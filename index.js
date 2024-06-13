const https = require('https');

// Helper function to add EDNS0 client subnet option
function addEdnsClientSubnet(dnsQuery, subnet) {
  // Convert the subnet (e.g., '59.172.89.64/32') to the appropriate DNS format
  const [ip, prefixLength] = subnet.split('/');
  const ipParts = ip.split('.').map(part => parseInt(part, 10));
  
  // EDNS(0) client subnet option format
  const edns0Option = Buffer.from([
    0x00, 0x08, // OPTION-CODE: CLIENT-SUBNET
    0x00, 0x08, // OPTION-LENGTH: 8 bytes
    0x00, 0x01, // FAMILY: IPv4
    parseInt(prefixLength, 10), // SOURCE PREFIX-LENGTH
    0x00,       // SCOPE PREFIX-LENGTH
    ...ipParts  // ADDRESS
  ]);

  // EDNS(0) OPT pseudo-record
  const optPseudoRecord = Buffer.concat([
    Buffer.from([0x00]), // NAME: (root)
    Buffer.from([0x00, 0x29]), // TYPE: OPT
    Buffer.from([0x10, 0x00]), // CLASS: 4096
    Buffer.from([0x00, 0x00, 0x00, 0x00]), // TTL: 0
    Buffer.from([0x00, edns0Option.length]), // RDLENGTH
    edns0Option // RDATA
  ]);

  // Append the OPT pseudo-record to the DNS query
  return Buffer.concat([dnsQuery, optPseudoRecord]);
}

// Vercel function handler
module.exports = async (req, res) => {
  try {
    const targetUrl = 'https://dns.google/dns-query';
    const subnet = '59.172.89.64/32';

    const options = {
      method: 'POST',
      headers: {
        'Host': 'dns.google',
        'Content-Type': 'application/dns-message',
        'Accept': 'application/dns-message',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'x-forwarded-for': '59.172.89.64',
        'x-real-ip': '59.172.89.64',
        'x-subnet': '59.172.89.64/32'
      }
    };

    let requestData = [];
    req.on('data', chunk => {
      requestData.push(chunk);
    });

    req.on('end', () => {
      requestData = Buffer.concat(requestData);
      
      // Add EDNS0 client subnet option to the DNS query
      const modifiedRequestData = addEdnsClientSubnet(requestData, subnet);
      
      const proxyReq = https.request(targetUrl, options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (e) => {
        console.error('Proxy request error:', e);
        res.status(500).send(`Proxy request failed: ${e.message}`);
      });

      proxyReq.write(modifiedRequestData);
      proxyReq.end();
    });
  } catch (error) {
    console.error('Function error:', error);
    res.status(500).send(`Function execution failed: ${error.message}`);
  }
};
