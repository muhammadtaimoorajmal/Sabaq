/**
 * Recognizes what a file really is from its first bytes, so the Submission Checker can catch a
 * Word document renamed to `.pdf` (renaming never changes a file's format, and a renamed file
 * often cannot be opened by whoever marks it).
 *
 * Only the beginning of the file is needed: {@link SNIFF_BYTES} bytes are enough for every format
 * recognized here. Recognition is deliberately cautious: when a format cannot be told for sure,
 * the result is a broader kind (`zip`, `binary`) that never causes a false alarm.
 */

/** How many bytes from the start of a file {@link sniffFileKind} looks at. */
export const SNIFF_BYTES = 64 * 1024;

export const FILE_KINDS = [
  'pdf',
  'docx',
  'xlsx',
  'pptx',
  'odf',
  'zip',
  'legacy_office',
  'png',
  'jpeg',
  'gif',
  'webp',
  'rar',
  '7z',
  'gzip',
  'text',
  'binary',
  'empty',
] as const;
export type FileKind = (typeof FILE_KINDS)[number];

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  bytes.length >= offset + signature.length &&
  signature.every((value, index) => bytes[offset + index] === value);

const ascii = (text: string) => Array.from(text, (character) => character.charCodeAt(0));

/** Finds ASCII text anywhere in the bytes. */
function contains(bytes: Uint8Array, text: string): boolean {
  const needle = ascii(text);
  const last = bytes.length - needle.length;
  outer: for (let index = 0; index <= last; index += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (bytes[index + offset] !== needle[offset]) continue outer;
    }
    return true;
  }
  return false;
}

/** Office documents are ZIP archives; the folder names inside tell which application made them. */
function zipKind(bytes: Uint8Array): FileKind {
  if (contains(bytes, 'mimetypeapplication/vnd.oasis.opendocument')) return 'odf';
  const word = contains(bytes, 'word/');
  const excel = contains(bytes, 'xl/');
  const powerPoint = contains(bytes, 'ppt/');
  // Exactly one application's folder: anything else (or none) stays a plain archive.
  if (word && !excel && !powerPoint) return 'docx';
  if (excel && !word && !powerPoint) return 'xlsx';
  if (powerPoint && !word && !excel) return 'pptx';
  return 'zip';
}

/** Text has no NUL bytes and few control characters; UTF-16 text starts with a byte-order mark. */
function looksLikeText(bytes: Uint8Array): boolean {
  if (startsWith(bytes, [0xff, 0xfe]) || startsWith(bytes, [0xfe, 0xff])) return true;
  let control = 0;
  for (const byte of bytes) {
    if (byte === 0) return false;
    // Tab, line feed, form feed and carriage return are normal in text.
    if (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0c && byte !== 0x0d) {
      control += 1;
    }
  }
  return control / bytes.length < 0.02;
}

/** What the file really is, judged from its first bytes. */
export function sniffFileKind(bytes: Uint8Array): FileKind {
  if (bytes.length === 0) return 'empty';
  // Readers accept a PDF header anywhere in the first kilobyte.
  if (contains(bytes.subarray(0, 1024), '%PDF-')) return 'pdf';
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06])) {
    return zipKind(bytes);
  }
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'legacy_office';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(bytes, ascii('GIF87a')) || startsWith(bytes, ascii('GIF89a'))) return 'gif';
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return 'webp';
  if (startsWith(bytes, ascii('Rar!\u001a\u0007'))) return 'rar';
  if (startsWith(bytes, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return '7z';
  if (startsWith(bytes, [0x1f, 0x8b])) return 'gzip';
  return looksLikeText(bytes) ? 'text' : 'binary';
}

/** Extensions for plain-text files: source code, data and notes. */
const TEXT_EXTENSIONS = [
  'txt',
  'md',
  'csv',
  'tsv',
  'json',
  'ipynb',
  'xml',
  'yaml',
  'yml',
  'html',
  'htm',
  'css',
  'js',
  'jsx',
  'ts',
  'tsx',
  'py',
  'java',
  'c',
  'h',
  'cpp',
  'hpp',
  'cc',
  'cs',
  'go',
  'rs',
  'kt',
  'swift',
  'php',
  'rb',
  'r',
  'm',
  'sql',
  'sh',
  'tex',
] as const;

const ZIP_FAMILY: readonly FileKind[] = ['zip', 'docx', 'xlsx', 'pptx', 'odf'];

/**
 * The kinds of content each extension may contain. An Office extension also accepts a plain
 * archive, because not every program lays its files out the same way.
 */
const EXPECTED_KINDS: Record<string, readonly FileKind[]> = {
  pdf: ['pdf'],
  docx: ['docx', 'zip'],
  xlsx: ['xlsx', 'zip'],
  pptx: ['pptx', 'zip'],
  odt: ['odf', 'zip'],
  ods: ['odf', 'zip'],
  odp: ['odf', 'zip'],
  zip: ZIP_FAMILY,
  doc: ['legacy_office'],
  xls: ['legacy_office'],
  ppt: ['legacy_office'],
  png: ['png'],
  jpg: ['jpeg'],
  jpeg: ['jpeg'],
  gif: ['gif'],
  webp: ['webp'],
  rar: ['rar'],
  '7z': ['7z'],
  gz: ['gzip'],
  tgz: ['gzip'],
  'tar.gz': ['gzip'],
  ...Object.fromEntries(TEXT_EXTENSIONS.map((extension) => [extension, ['text'] as const])),
};

/** The kinds a file with this extension may contain, or `null` when Sabaq does not know it. */
export function expectedKinds(extension: string): readonly FileKind[] | null {
  return EXPECTED_KINDS[extension] ?? null;
}

/** The extension a file of this kind normally has, to suggest the right one. */
export function usualExtension(kind: FileKind): string | null {
  switch (kind) {
    case 'pdf':
    case 'docx':
    case 'xlsx':
    case 'pptx':
    case 'zip':
    case 'png':
    case 'gif':
    case 'webp':
    case 'rar':
    case '7z':
      return kind;
    case 'jpeg':
      return 'jpg';
    case 'gzip':
      return 'gz';
    case 'text':
      return 'txt';
    default:
      // Old Office, OpenDocument and unknown binaries have several possible extensions.
      return null;
  }
}
