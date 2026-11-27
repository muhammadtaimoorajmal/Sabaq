import { type FileKind, SNIFF_BYTES, sniffFileKind } from '@sabaq/shared';

/**
 * What a file really is, read from its first bytes on this device. Nothing is uploaded.
 * Resolves `undefined` when the browser cannot read the file (the content check is skipped).
 */
export async function readFileKind(file: Blob): Promise<FileKind | undefined> {
  try {
    const start = await file.slice(0, SNIFF_BYTES).arrayBuffer();
    return sniffFileKind(new Uint8Array(start));
  } catch {
    return undefined;
  }
}

const KB = 1024;
const MB = KB * 1024;

/** A file size people can read: "640 KB", "2.4 MB". */
export function formatSize(bytes: number, language: string): string {
  const [value, unit] =
    bytes >= MB
      ? [bytes / MB, 'megabyte']
      : bytes >= KB
        ? [bytes / KB, 'kilobyte']
        : [bytes, 'byte'];
  return new Intl.NumberFormat(language, {
    style: 'unit',
    unit,
    unitDisplay: unit === 'byte' ? 'long' : 'short',
    maximumFractionDigits: value < 10 && unit !== 'byte' ? 1 : 0,
  }).format(value);
}

/** A limit given in megabytes, as people read it ("10 MB"). */
export const formatMegabytes = (megabytes: number, language: string) =>
  formatSize(megabytes * MB, language);
