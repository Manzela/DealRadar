import { sitemapIndex, XML_HEADERS } from '@/lib/seo/sitemaps';

// Deals ingest hourly out-of-band; regenerate so new chunks appear without a
// deploy. The index is tiny (one <sitemap> entry per 500 deals).
export const revalidate = 3600;

export async function GET() {
  return new Response(await sitemapIndex(), { headers: XML_HEADERS });
}
