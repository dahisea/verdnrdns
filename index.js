// 导入必要的模块
const http = require('http');

// Vercel 函数处理程序
module.exports = async (req, res) => {
  try {
    // 客户端子网 IP 地址，这里使用 1.8.9.0
    const clientSubnetIP = '1.8.9.0';

    // 提取原始请求的相关信息
    const { method, url, headers } = req;

    // 设置向目标服务器发出请求的选项
    const options = {
      method,
      headers: {
        ...headers,
        'X-Forwarded-For': clientSubnetIP, // 将 X-Forwarded-For 头部设置为客户端子网 IP 地址
      },
    };

    // 目标服务器的 URL
    const targetUrl = 'https://162.14.21.56/dns-query';

    // 发出代理请求
    const proxyReq = http.request(targetUrl, options, (proxyRes) => {
      // 将目标服务器的响应转发回客户端
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    // 捕获代理请求错误
    proxyReq.on('error', (err) => {
      console.error('Proxy request error:', err);
      res.status(500).send('Proxy request failed');
    });

    // 将原始请求正文传递给代理请求（如果有的话）
    req.pipe(proxyReq, { end: true });
  } catch (error) {
    console.error('Function error:', error);
    res.status(500).send('Function execution failed');
  }
};
