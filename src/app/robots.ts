import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const site = (process.env.APP_URL || 'https://svtc-tutoring.onrender.com').replace(/\/$/, '');
  return {
    rules: [{ userAgent: '*', allow: ['/', '/confidentialite'], disallow: ['/admin', '/encadreur', '/parent', '/api', '/installation', '/verifier/'] }],
    sitemap: `${site}/sitemap.xml`,
  };
}
