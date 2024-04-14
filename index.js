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

        // 重新打包修改后的 DNS 查询数据
        const modifiedRequestData = buildDNSMessage(dnsMessage);

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

        // 发送修改后的 DNS 查询数据
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
  // 解析 DNS 查询数据，根据 DNS 消息格式提取 EDNS 扩展
  // 这里需要根据具体的 DNS 消息格式来实现解析逻辑
  // 假设 DNS 消息格式为简化版的示例，实际需根据具体情况进行实现
  const dnsMessage = {
    header: requestData.slice(0, 12),
    question: requestData.slice(12), // 假设问题部分从第 12 字节开始
    edns: requestData.slice(20) // 假设 EDNS 选项部分从第 20 字节开始
  };

  return dnsMessage;
}

function modifyEDNSClientSubnet(dnsMessage, newSubnetIP) {
  // 修改 EDNS 扩展中的 edns_client_subnet 选项为新的子网 IP
  // 假设 edns_client_subnet 选项在 EDNS 选项部分的特定位置
  // 这里需要根据具体的 EDNS 扩展格式和选项位置进行修改

  // 假设 edns_client_subnet 选项在 EDNS 选项部分的第一个字节，长度为 8 字节
  dnsMessage.edns.write(newSubnetIP, 0, 4, 'ascii'); // 写入新的子网 IP

  // 如果子网 IP 长度固定为 4 字节，可以直接写入新 IP 地址
}

function buildDNSMessage(dnsMessage) {
  // 重新构建修改后的 DNS 查询数据
  // 假设重新构建 DNS 消息的方法，将 header、question 和 edns 部分组合起来
  const modifiedRequestData = Buffer.concat([
    dnsMessage.header,
    dnsMessage.question,
    dnsMessage.edns
  ]);

  return modifiedRequestData;
}
