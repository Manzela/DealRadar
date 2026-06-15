import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Provider CDNs vary per network; tighten this list once live feeds are on.
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },        // mock images
      { protocol: 'https', hostname: '**.kelkoogroup.net' },
      { protocol: 'https', hostname: '**.awin1.com' },
      { protocol: 'https', hostname: '**.tradedoubler.com' },
    ],
  },
};

export default withNextIntl(nextConfig);
