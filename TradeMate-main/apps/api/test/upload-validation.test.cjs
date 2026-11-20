const test = require('node:test');
const assert = require('node:assert/strict');
const {
  decodeProfileImageDataUrl,
  hasMatchingUploadSignature,
  PROFILE_IMAGE_MAX_BYTES,
} = require('../dist/upload-validation');

const samples = [
  ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00])],
  ['image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  ['image/webp', Buffer.from('RIFF0000WEBP')],
  ['image/gif', Buffer.from('GIF89a')],
  ['application/pdf', Buffer.from('%PDF-1.7')],
  ['audio/webm', Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00])],
  ['audio/ogg', Buffer.from('OggS0000')],
  ['audio/mp4', Buffer.from('0000ftypM4A ')],
  ['audio/mpeg', Buffer.from('ID3\x04\x00\x00')],
  ['audio/wav', Buffer.from('RIFF0000WAVE')],
];

test('upload signature validation accepts matching supported content types', () => {
  for (const [mime, bytes] of samples) {
    assert.equal(hasMatchingUploadSignature(mime, bytes), true, mime);
  }
});

test('upload signature validation rejects mismatched, truncated, and unsupported content', () => {
  assert.equal(hasMatchingUploadSignature('application/pdf', Buffer.from('not a PDF')), false);
  assert.equal(hasMatchingUploadSignature('image/png', Buffer.from([0x89, 0x50])), false);
  assert.equal(hasMatchingUploadSignature('image/jpeg', Buffer.from('GIF89a')), false);
  assert.equal(hasMatchingUploadSignature('application/x-executable', Buffer.from('MZ')), false);
});

test('profile image decoder accepts canonical data URLs with matching image signatures', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const dataUrl = 'data:image/jpeg;base64,' + jpeg.toString('base64');
  assert.deepEqual(decodeProfileImageDataUrl(dataUrl), jpeg);
});

test('profile image decoder rejects spoofed MIME, malformed base64, and oversized content', () => {
  const text = Buffer.from('not an image').toString('base64');
  assert.equal(decodeProfileImageDataUrl('data:image/jpeg;base64,' + text), null);
  assert.equal(decodeProfileImageDataUrl('data:image/png;base64,%%%='), null);
  const oversized = Buffer.alloc(PROFILE_IMAGE_MAX_BYTES + 1);
  oversized.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(
    decodeProfileImageDataUrl('data:image/png;base64,' + oversized.toString('base64')),
    null,
  );
});
