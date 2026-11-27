import { describe, expect, it } from 'vitest';
import { expectedKinds, FILE_KINDS, sniffFileKind, usualExtension } from './file-kind.js';
import { FILE_BYTES, utf8 } from '../test/file-samples.js';

const bytes = (...values: number[]) => new Uint8Array(values);
const text = utf8;

describe('sniffFileKind', () => {
  it.each(Object.entries(FILE_BYTES))('recognizes %s', (kind, sample) => {
    expect(sniffFileKind(sample)).toBe(kind);
  });

  it('treats an empty file as empty', () => {
    expect(sniffFileKind(new Uint8Array())).toBe('empty');
  });

  it('finds a PDF header after leading junk, as PDF readers do', () => {
    expect(sniffFileKind(text('\n\n  %PDF-1.4\n'))).toBe('pdf');
  });

  it('keeps an archive with folders from several Office programs a plain archive', () => {
    expect(
      sniffFileKind(new Uint8Array([...bytes(0x50, 0x4b, 0x03, 0x04), ...text('word/ xl/')])),
    ).toBe('zip');
    expect(sniffFileKind(new Uint8Array([...bytes(0x50, 0x4b, 0x05, 0x06)]))).toBe('zip');
  });

  it('reads UTF-16 text by its byte-order mark', () => {
    expect(sniffFileKind(bytes(0xff, 0xfe, 0x41, 0x00))).toBe('text');
    expect(sniffFileKind(bytes(0xfe, 0xff, 0x00, 0x41))).toBe('text');
  });

  it('accepts tabs, line breaks and form feeds in text, and UTF-8 letters', () => {
    expect(sniffFileKind(text('a\tb\r\nc\fd سبق'))).toBe('text');
  });

  it('calls bytes with NUL or many control characters binary', () => {
    expect(sniffFileKind(bytes(0x41, 0x00, 0x42))).toBe('binary');
    expect(sniffFileKind(bytes(0x01, 0x02, 0x03, 0x41))).toBe('binary');
  });

  it('needs the whole signature', () => {
    expect(sniffFileKind(text('RIFF0000WAVE'))).toBe('text');
    expect(sniffFileKind(bytes(0x89, 0x50, 0x4e, 0x00))).toBe('binary');
  });
});

describe('expectedKinds and usualExtension', () => {
  it('knows Office, image, archive and text extensions', () => {
    expect(expectedKinds('pdf')).toEqual(['pdf']);
    expect(expectedKinds('docx')).toEqual(['docx', 'zip']);
    expect(expectedKinds('zip')).toContain('docx');
    expect(expectedKinds('py')).toEqual(['text']);
    expect(expectedKinds('tar.gz')).toEqual(['gzip']);
    expect(expectedKinds('mp4')).toBeNull();
  });

  it('suggests the usual extension for each kind, when there is one', () => {
    const suggestions = Object.fromEntries(FILE_KINDS.map((kind) => [kind, usualExtension(kind)]));
    expect(suggestions).toEqual({
      pdf: 'pdf',
      docx: 'docx',
      xlsx: 'xlsx',
      pptx: 'pptx',
      odf: null,
      zip: 'zip',
      legacy_office: null,
      png: 'png',
      jpeg: 'jpg',
      gif: 'gif',
      webp: 'webp',
      rar: 'rar',
      '7z': '7z',
      gzip: 'gz',
      text: 'txt',
      binary: null,
      empty: null,
    });
  });
});
