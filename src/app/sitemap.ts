import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  
  const routes = [
    '',
    '/products',
    '/brands',
    '/services',
    '/about',
    '/contact',
    '/faq',
    '/delivery',
    '/privacy',
    '/terms',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1.0 : 0.8,
  }));

  return routes;
}
