// 导入必要的模块
const https = require('https');

// Vercel 函数处理程序
module.exports = async (req, res) => {
  try {
    // 提取原始请求的相关信息
    const { method, headers } = req;

    // 解析目标服务器的 URL
    const targetUrl = 'https://dns.google/dns-query';

    // 构建向目标服务器发出请求的选项
    const options = {
      method: 'POST', // 使用 POST 方法发送 DNS 查询
      headers: {
        ...headers,
        'accept': 'application/dns-json',
        'x-forwarded-for': headers['cf-connecting-ip'] || headers['true-client-ip'] || '',
        'x-real-ip': headers['cf-connecting-ip'] || headers['true-client-ip'] || '',
        'x-subnet': '59.172.89.64/32'
      }
    };

    // 删除可能会泄露敏感信息或导致目标服务器拒绝请求的头部
    delete options.headers.host;
    delete options.headers['accept-encoding'];

    // 从原始请求中读取 DNS 查询内容
    let requestData = [];
    req.on('data', chunk => {
      requestData.push(chunk);
    });

    req.on('end', () => {
      requestData = Buffer.concat(requestData);
      
      // 发出代理请求
      const proxyReq = https.request(targetUrl, options, (proxyRes) => {
        // 设置响应头部
        res.writeHead(proxyRes.statusCode, proxyRes.headers);

        // 将 DNS 响应直接传递给客户端响应
        proxyRes.pipe(res);
      });

      // 处理代理请求错误
      proxyReq.on('error', (e) => {
        console.error('Proxy request error:', e);
        res.status(500).send('Proxy request failed');
      });

      // 将原始请求正文传递给代理请求
      proxyReq.write(requestData);
      proxyReq.end();
    });
  } catch (error) {
    console.error('Function error:', error);
    res.status(500).send('Function execution failed');
  }
};
