/** @type {import('next').NextConfig} */
const nextConfig = {
  // 优化字体加载
  optimizeFonts: true,
  // 添加字体预加载配置
  async headers() {
    return [
      {
        source: '/_next/static/media/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig 