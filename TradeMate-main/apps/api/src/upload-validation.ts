import { Buffer } from 'node:buffer';

export const PROFILE_IMAGE_MAX_BYTES = 650 * 1024;

const signatures: Record<string, (bytes: Buffer) => boolean> = {
  'image/jpeg': (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  'image/png': (bytes) => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (bytes) => bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP',
  'image/gif': (bytes) => bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6)),
  'application/pdf': (bytes) => bytes.length >= 5 && bytes.toString('ascii', 0, 5) === '%PDF-',
  'audio/webm': (bytes) => bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
  'audio/ogg': (bytes) => bytes.length >= 4 && bytes.toString('ascii', 0, 4) === 'OggS',
  'audio/mp4': (bytes) => bytes.length >= 12 && bytes.toString('ascii', 4, 8) === 'ftyp',
  'audio/mpeg': (bytes) => bytes.length >= 3 && (
    bytes.toString('ascii', 0, 3) === 'ID3' ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  ),
  'audio/wav': (bytes) => bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE',
};

export function hasMatchingUploadSignature(mimeType: string, bytes: Buffer): boolean {
  return signatures[mimeType]?.(bytes) ?? false;
}

export function decodeProfileImageDataUrl(value: string): Buffer | null {
  const match = /^data:image\/(jpeg|png|webp);base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=))$/.exec(value);
  if (!match) return null;
  const mimeType = `image/${match[1]}`;
  const encoded = match[2];
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length || bytes.length > PROFILE_IMAGE_MAX_BYTES || bytes.toString('base64') !== encoded) return null;
  return hasMatchingUploadSignature(mimeType, bytes) ? bytes : null;
}
