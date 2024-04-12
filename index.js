// 导入必要的模块
const https = require('https');

// Vercel 函数处理程序
module.exports = async (req, res) => {
  try {
    // 客户端子网 IP 地址，这里使用 1.8.9.0
    const clientSubnetIP = '1.8.9.0';

    // 提取原始请求的相关信息
    const { method, url, headers } = req;

    // 解析目标服务器的 URL
    const targetUrl = 'https://162.14.21.56/dns-query';

    // 设置向目标服务器发出请求的选项
    const options = {
      method,
      headers: {
        ...headers,
        'X-Forwarded-For': clientSubnetIP, // 将 X-Forwarded-For 头部设置为客户端子网 IP 地址
      },
    };

    // 发出代理请求
    const proxyReq = https.request(targetUrl, options, (proxyRes) => {
      // 直接将源服务器的响应转发回客户端
      proxyRes.pipe(res);
    });

    // 将原始请求正文传递给代理请求（如果有的话）
    req.pipe(proxyReq);

    // 结束代理请求
    req.on('end', () => {
      proxyReq.end();
    });
  } catch (error) {
    console.error('Function error:', error);
    res.status(500).send('Function execution failed');
  }
};
