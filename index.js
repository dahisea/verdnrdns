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

        // 解析 DNS 查询数据
        const dnsMessage = parseDNSMessage(requestData);

        // 修改 EDNS 扩展中的 edns_client_subnet 选项为固定值 59.172.89.64
        modifyEDNSClientSubnet(dnsMessage, '59.172.89.64');

        // 构建修改后的 DNS 查询数据
        const modifiedRequestData = buildModifiedDNSMessage(dnsMessage);

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
          proxyRes.pipe(res); // 将目标服务器的响应直接传递给客户端
        });

        proxyReq.on('error', (e) => {
          console.error('Proxy request error:', e);
          res.status(500).send('Proxy request failed');
        });

        // 发送修改后的 DNS 查询数据到目标服务器
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

  return { header, question };
}

function modifyEDNSClientSubnet(dnsMessage, newSubnetIP) {
  // 修改 EDNS 扩展中的 edns_client_subnet 选项为新的子网 IP
  // 假设 edns_client_subnet 选项在 EDNS 选项部分的特定位置
  // 这里需要根据具体的 EDNS 扩展格式和选项位置进行修改

  // 假设 edns_client_subnet 选项在 EDNS 选项部分的第一个字节，长度为 8 字节
  const ednsClientSubnetOption = Buffer.alloc(8);
  ednsClientSubnetOption.writeUInt16BE(8, 0); // Option Code: 8
  ednsClientSubnetOption.writeUInt16BE(4, 2); // Option Length: 4
  const subnetBytes = newSubnetIP.split('.').map(Number);
  ednsClientSubnetOption.writeUInt8(subnetBytes[0], 4); // Subnet IP Byte 1
  ednsClientSubnetOption.writeUInt8(subnetBytes[1], 5); // Subnet IP Byte 2
  ednsClientSubnetOption.writeUInt8(subnetBytes[2], 6); // Subnet IP Byte 3
  ednsClientSubnetOption.writeUInt8(subnetBytes[3], 7); // Subnet IP Byte 4

  // 替换 EDNS 扩展部分中的 edns_client_subnet 选项
  dnsMessage.edns = ednsClientSubnetOption;
}

function buildModifiedDNSMessage(dnsMessage) {
  // 构建修改后的 DNS 查询数据，将头部、问题部分和修改后的 EDNS 扩展组合成一个新的 DNS 消息
  const modifiedRequestData = Buffer.concat([
    dnsMessage.header,
    dnsMessage.question,
    dnsMessage.edns // 这里假设 edns 已经在 modifyEDNSClientSubnet 函数中被修改
  ]);

  return modifiedRequestData;
}
