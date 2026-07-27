import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://autospare-eastafrica.com';
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/account/', '/checkout/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
