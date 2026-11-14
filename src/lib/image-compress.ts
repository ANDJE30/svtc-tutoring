/**
 * Compression des images chargées (liste de contrôle : images compressées).
 * web : logo affiché sur le site → WebP, 960 px de large au plus. pdf : bandeau des documents → JPEG (format lu par le moteur PDF, transparence aplatie sur blanc), 2400 px au plus.
 * L'image d'origine est conservée si la compression échoue ou ne réduit pas sa taille.
 */
export async function optimizeImage(buf: Buffer, mime: string, target: 'web' | 'pdf'): Promise<{ buf: Buffer; mime: string }> {
  try {
    const sharp = (await import('sharp')).default;
    const img = sharp(buf, { failOn: 'error' }).rotate();
    const resized = img.resize({ width: target === 'web' ? 960 : 2400, withoutEnlargement: true });
    let out: Buffer;
    let outMime: string;
    if (target === 'web') {
      out = await resized.webp({ quality: 82, alphaQuality: 90, effort: 5 }).toBuffer();
      outMime = 'image/webp';
    } else {
      // Bandeau des PDF : posé sur une page blanche, la transparence est aplatie sur du blanc puis compressée en JPEG
      out = await resized.flatten({ background: '#ffffff' }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
      outMime = 'image/jpeg';
    }
    return out.length < buf.length ? { buf: out, mime: outMime } : { buf, mime };
  } catch {
    return { buf, mime };
  }
}

