import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const site = (process.env.APP_URL || 'https://svtc-tutoring.onrender.com').replace(/\/$/, '');
  const now = new Date();
  return [
    { url: `${site}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${site}/connexion`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${site}/confidentialite`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
