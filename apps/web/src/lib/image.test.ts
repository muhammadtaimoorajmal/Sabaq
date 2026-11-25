import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiAsset } from '../api/client';
import { dataUrlBytes, ImageError, squareImage } from './image';

describe('squareImage', () => {
  it('refuses types other than JPEG, PNG and WebP before reading them', async () => {
    const gif = new File(['GIF89a'], 'cat.gif', { type: 'image/gif' });
    await expect(squareImage(gif)).rejects.toEqual(new ImageError('type'));
  });

  it('reports images the browser cannot open', async () => {
    const broken = new File(['not an image'], 'me.png', { type: 'image/png' });
    await expect(squareImage(broken)).rejects.toMatchObject({ problem: 'unreadable' });
  });
});

describe('squareImage with a browser canvas', () => {
  const draw = vi.fn();
  /** Pretends to be a browser that encodes images as `encode` returns them. */
  function fakeCanvas(encode: (type: string, quality: number) => string) {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.resolve({ width: 400, height: 300, close: vi.fn() })),
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: draw,
      imageSmoothingQuality: 'low',
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(
      (type = 'image/png', quality = 1) => encode(type, Number(quality)),
    );
  }
  const photo = new File(['x'], 'me.jpg', { type: 'image/jpeg' });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    draw.mockClear();
  });

  it('crops the centre square, scales it and prefers WebP', async () => {
    fakeCanvas((type) => `data:${type};base64,AAAA`);
    expect(await squareImage(photo, 256)).toBe('data:image/webp;base64,AAAA');
    expect(draw).toHaveBeenCalledWith(expect.anything(), 50, 0, 300, 300, 0, 0, 256, 256);
  });

  it('falls back to JPEG where the browser cannot encode WebP', async () => {
    fakeCanvas((type) =>
      type === 'image/webp' ? 'data:image/png;base64,AAAA' : `data:${type};base64,AAAA`,
    );
    expect(await squareImage(photo)).toBe('data:image/jpeg;base64,AAAA');
  });

  it('lowers the quality until the photo is small enough, then gives up', async () => {
    const big = 'A'.repeat(200_000);
    fakeCanvas((type, quality) => `data:${type};base64,${quality < 0.6 ? 'AAAA' : big}`);
    expect(await squareImage(photo)).toBe('data:image/webp;base64,AAAA');
    fakeCanvas((type) => `data:${type};base64,${big}`);
    await expect(squareImage(photo)).rejects.toMatchObject({ problem: 'tooLarge' });
  });
});

describe('dataUrlBytes', () => {
  it('counts the decoded bytes of a base64 data URL', () => {
    expect(dataUrlBytes('data:image/png;base64,AAAA')).toBe(3);
  });
});

describe('apiAsset', () => {
  it('keeps API paths on the API and leaves other addresses alone', () => {
    expect(apiAsset('/api/users/1/avatar/v')).toBe('/api/users/1/avatar/v');
    expect(apiAsset('https://images.example.com/a.png')).toBe('https://images.example.com/a.png');
    expect(apiAsset(null)).toBeNull();
  });
});
