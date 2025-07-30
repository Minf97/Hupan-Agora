import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'imgse.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 's21.ax1x.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;
