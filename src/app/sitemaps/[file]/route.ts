import { staticSitemap, dealChunks, dealsSitemap, XML_HEADERS } from '@/lib/seo/sitemaps';

// Child sitemaps of the /sitemap.xml index: static.xml + deals-N.xml (1-based).
export const revalidate = 3600;

export async function GET(_req: Request, { params }: { params: { file: string } }) {
  const { file } = params;

  if (file === 'static.xml') {
    return new Response(staticSitemap(), { headers: XML_HEADERS });
  }

  const m = /^deals-(\d{1,4})\.xml$/.exec(file);
  if (m) {
    const chunks = await dealChunks();
    const idx = Number(m[1]) - 1;
    if (idx >= 0 && idx < chunks.length) {
      return new Response(dealsSitemap(chunks[idx]), { headers: XML_HEADERS });
    }
  }

  return new Response('not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
}
