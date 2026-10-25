import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@hulul/shared'],
  // Las ventanas de Google, Outlook y Facebook se sirven desde hululec.com
  // (ver authDomain en packages/shared/src/firebase.ts).
  async rewrites() {
    return [
      { source: '/__/auth/:path*', destination: 'https://hulul-59081.firebaseapp.com/__/auth/:path*' },
      { source: '/__/firebase/:path*', destination: 'https://hulul-59081.firebaseapp.com/__/firebase/:path*' },
    ];
  },
};

export default nextConfig;
