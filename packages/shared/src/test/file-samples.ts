import type { FileKind } from '../domain/file-kind.js';

/** UTF-8 bytes of a string (the shared package has no DOM or Node types). */
export const utf8 = (text: string) =>
  new Uint8Array(
    Array.from(encodeURIComponent(text).matchAll(/%([\dA-F]{2})|[^%]/gu), (match) =>
      match[1] ? Number.parseInt(match[1], 16) : match[0].charCodeAt(0),
    ),
  );
const ascii = (text: string) => Array.from(text, (character) => character.charCodeAt(0));
const zipEntry = (name: string) => [
  0x50,
  0x4b,
  0x03,
  0x04,
  0x14,
  0x00,
  0x06,
  0x00,
  0x08,
  0x00,
  ...new Array<number>(18).fill(0),
  name.length,
  0x00,
  0x00,
  0x00,
  ...ascii(name),
  ...ascii('compressed-data'),
];
const office = (...names: string[]) => new Uint8Array(names.flatMap(zipEntry));

/**
 * The first bytes of real files of each kind, as the Submission Checker reads them. Office
 * samples follow the layout Word, Excel and PowerPoint write: a ZIP local-file header followed
 * by the name of the first entry, then more entries in the same folder.
 */
export const FILE_BYTES: Record<Exclude<FileKind, 'empty'>, Uint8Array> = {
  pdf: new Uint8Array(ascii('%PDF-1.7\n%âãÏÓ\n1 0 obj')),
  docx: office('[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml'),
  xlsx: office('[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml'),
  pptx: office(
    '[Content_Types].xml',
    '_rels/.rels',
    'ppt/presentation.xml',
    'ppt/slides/slide1.xml',
  ),
  odf: new Uint8Array([
    ...zipEntry('mimetype').slice(0, -ascii('compressed-data').length),
    ...ascii('application/vnd.oasis.opendocument.text'),
  ]),
  zip: office('src/', 'src/Main.java', 'README.md'),
  legacy_office: new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]),
  png: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]),
  jpeg: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...ascii('JFIF')]),
  gif: new Uint8Array(ascii('GIF89a\u0001\u0000')),
  webp: new Uint8Array([...ascii('RIFF'), 0x24, 0, 0, 0, ...ascii('WEBPVP8 ')]),
  rar: new Uint8Array([...ascii('Rar!'), 0x1a, 0x07, 0x01, 0x00]),
  '7z': new Uint8Array([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x04]),
  gzip: new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0, 0, 0, 0]),
  text: utf8('public class Main {\n  // سبق\n  public static void main() {}\n}\n'),
  binary: new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00]),
};
