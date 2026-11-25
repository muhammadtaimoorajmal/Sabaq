import { describe, expect, it } from 'vitest';
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
