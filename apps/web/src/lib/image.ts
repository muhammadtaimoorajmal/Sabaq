import { AVATAR_MAX_BYTES, AVATAR_SIZE, AVATAR_TYPES } from '@sabaq/shared';

export type ImageProblem = 'type' | 'unreadable' | 'tooLarge';

export class ImageError extends Error {
  constructor(readonly problem: ImageProblem) {
    super(`Image could not be prepared: ${problem}`);
    this.name = 'ImageError';
  }
}

/** Bytes encoded in a base64 `data:` URL. */
export const dataUrlBytes = (dataUrl: string) =>
  Math.floor(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);

/**
 * Turns a chosen photo into a small square image ready to upload: the centre is cropped to a
 * square, scaled to `AVATAR_SIZE` pixels and compressed (WebP where the browser supports it,
 * otherwise JPEG), so even a large phone photo becomes a few kilobytes.
 */
export async function squareImage(file: File, size = AVATAR_SIZE): Promise<string> {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) throw new ImageError('type');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageError('unreadable');
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context || side === 0) throw new ImageError('unreadable');
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close();

  for (const quality of [0.86, 0.72, 0.55]) {
    let url = canvas.toDataURL('image/webp', quality);
    // Browsers without WebP encoding return PNG instead.
    if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', quality);
    if (dataUrlBytes(url) <= AVATAR_MAX_BYTES) return url;
  }
  throw new ImageError('tooLarge');
}
