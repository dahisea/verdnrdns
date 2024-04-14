const https = require('https');

module.exports = async (req, res) => {
  try {
    const { method, headers } = req;
    const targetUrl = 'https://dns.google/dns-query';

    let requestData = [];
    req.on('data', chunk => {
      requestData.push(chunk);
    });

    req.on('end', async () => {
      try {
        requestData = Buffer.concat(requestData);
        const dnsMessage = parseDNSMessage(requestData);
        const modifiedRequestData = modifyEDNSClientSubnet(dnsMessage, '59.172.89.64');

        const options = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/dns-message',
            'Accept': 'application/dns-message',
            'Content-Length': modifiedRequestData.length.toString(),
            'x-forwarded-for': headers['cf-connecting-ip'] || headers['true-client-ip'] || '',
            'x-real-ip': headers['cf-connecting-ip'] || headers['true-client-ip'] || ''
          }
        };

        const proxyReq = https.request(targetUrl, options, (proxyRes) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res);
        });

        proxyReq.on('error', (e) => {
          console.error('Proxy request error:', e);
          res.status(500).send('Proxy request failed');
        });

        proxyReq.write(modifiedRequestData);
        proxyReq.end();
      } catch (error) {
        console.error('Error processing DNS request:', error);
        res.status(500).send('Failed to process DNS request');
      }
    });
  } catch (error) {
    console.error('Function error:', error);
    res.status(500).send('Function execution failed');
  }
};

function parseDNSMessage(requestData) {
  // 解析 DNS 查询数据，提取 DNS 消息的头部和问题部分
  const header = requestData.slice(0, 12);
  const question = requestData.slice(12);

  return { header, question, length: requestData.length };
}

function modifyEDNSClientSubnet(dnsMessage, newSubnetIP) {
  // Locate the EDNS section in the DNS message
  const EDNS_SECTION_START = dnsMessage.question.length + 12; // Assuming no Answer/Authority/Additional sections
  const EDNS_SECTION_END = dnsMessage.length;
  const ednsSection = dnsMessage.slice(EDNS_SECTION_START, EDNS_SECTION_END);

  let index = 0;
  while (index < ednsSection.length) {
    const optionCode = ednsSection.readUInt16BE(index);
    const optionLength = ednsSection.readUInt16BE(index + 2);
    if (optionCode === 8) {
      const subnetBytes = newSubnetIP.split('.').map(Number);
      ednsSection.writeUInt8(subnetBytes[0], index + 4);
      ednsSection.writeUInt8(subnetBytes[1], index + 5);
      ednsSection.writeUInt8(subnetBytes[2], index + 6);
      ednsSection.writeUInt8(subnetBytes[3], index + 7);
      break;
    }
    index += optionLength + 4;
  }

  return Buffer.concat([
    dnsMessage.header,
    dnsMessage.question,
    ednsSection,
    dnsMessage.slice(EDNS_SECTION_END)
  ]);
}
