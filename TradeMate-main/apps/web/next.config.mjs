/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      { source: '/app', destination: '/tm/index.html' },
      { source: '/app/', destination: '/tm/index.html' },
    ];
  },
};
export default nextConfig;
