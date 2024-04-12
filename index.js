// 导入必要的模块
const https = require('https');

// Vercel 函数处理程序
module.exports = async (req, res) => {
  try {
    // 提取原始请求的相关信息
    const { method, headers } = req;

    // 解析目标服务器的 URL
    // 建议使用域名而不是IP地址
    const targetUrl = 'https://dns.pub/dns-query';

    // 设置向目标服务器发出请求的选项
    const options = {
      method,
      headers: {
        ...headers,
        'x-real-ip': headers['cf-connecting-ip'] || headers['true-client-ip'] || headers['x-forwarded-for'] || headers['x-real-ip'] || '',
        'x-forwarded-for': headers['cf-connecting-ip'] || headers['true-client-ip'] || headers['x-forwarded-for'] || headers['x-real-ip'] || '',
        'true-client-ip': headers['cf-connecting-ip'] || headers['true-client-ip'] || headers['x-forwarded-for'] || headers['x-real-ip'] || ''
      },
    };

    // 删除可能会泄露敏感信息或导致目标服务器拒绝请求的头部
    // 'host' 头部通常包含请求的目标主机名或IP地址
    // 'accept-encoding' 头部通常包含客户端支持的内容编码列表
    delete options.headers.host;
    delete options.headers['accept-encoding'];

    // 发出代理请求
    const proxyReq = https.request(targetUrl, options, (proxyRes) => {
      // 设置响应头部
      res.writeHead(proxyRes.statusCode, proxyRes.headers);

      // 直接将源服务器的响应转发回客户端
      proxyRes.pipe(res);
    });

    // 处理请求错误
    proxyReq.on('error', (e) => {
      console.error('Proxy request error:', e);
      res.status(500).send('Proxy request failed');
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
