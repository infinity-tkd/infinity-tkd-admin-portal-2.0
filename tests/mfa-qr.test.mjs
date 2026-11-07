import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadTs } from './load-ts.mjs';

const require = createRequire(import.meta.url);
const { getImageProps } = require('next/image');
const { totpQrImageSource } = loadTs('lib/auth-assurance.ts');
const svg = '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="208" height="208"><rect width="208" height="208" fill="#fff"/></svg>\r\n';
const rawSource = `data:image/svg+xml;utf-8,${svg}`;
const imageProps = src => getImageProps({ src, unoptimized: true, width: 208, height: 208, alt: 'Synthetic authenticator fixture' }).props;

test('Supabase multiline QR SVG is accepted by Next Image without losing its payload', () => {
  // Demonstrate the actual framework rejection reported after MFA enrollment.
  if (process.env.NODE_ENV !== 'production') {
    assert.throws(() => imageProps(rawSource), /cannot end with a space or control character/);
  }
  const source = totpQrImageSource(rawSource);
  const props = imageProps(source);
  assert.equal(props.src, source);
  assert.equal(props.srcSet, undefined);
  assert.equal(decodeURIComponent(source.slice(source.indexOf(',') + 1)), svg);
  assert.equal(source.includes('\n'), false);
  assert.equal(source.includes('#'), false);
});

test('already encoded and base64 QR data URLs are preserved', () => {
  const encoded = totpQrImageSource(rawSource);
  assert.equal(totpQrImageSource(encoded), encoded);
  const base64 = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  assert.equal(imageProps(totpQrImageSource(base64)).src, base64);
});
