/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/tm/index.html' },
        { source: '/auth', destination: '/tm/index.html' },
      ],
      afterFiles: [
        { source: '/app', destination: '/tm/index.html' },
        { source: '/app/', destination: '/tm/index.html' },
      ],
      fallback: [],
    };
  },
};
export default nextConfig;
