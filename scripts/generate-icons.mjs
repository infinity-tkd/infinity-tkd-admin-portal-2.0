import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const SVG_SOURCE = path.resolve('Logo/Frame 24.svg');
const PUBLIC_DIR = path.resolve('public');
const ICONS_DIR = path.resolve('public/icons');

function createIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + count * dirEntrySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(count, 4); // Number of images

  const dirEntries = [];
  for (const img of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2); // Palette colors (0 = no palette)
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // Size of image data
    entry.writeUInt32LE(offset, 12); // Offset of image data
    dirEntries.push(entry);
    offset += img.buffer.length;
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers.map(img => img.buffer)]);
}

async function run() {
  if (!fs.existsSync(SVG_SOURCE)) {
    console.error('Source SVG file not found:', SVG_SOURCE);
    process.exit(1);
  }

  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  const svgContent = fs.readFileSync(SVG_SOURCE, 'utf8');

  // 1. Copy vector SVG to destinations
  fs.writeFileSync(path.join(ICONS_DIR, 'logo.svg'), svgContent);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'logo.svg'), svgContent);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.svg'), svgContent);
  console.log('✓ Vector SVG copied to public/icons/logo.svg, public/logo.svg, and public/favicon.svg');

  // 2. icon-192x192.png (Transparent)
  await sharp(Buffer.from(svgContent))
    .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(ICONS_DIR, 'icon-192x192.png'));
  console.log('✓ Generated public/icons/icon-192x192.png');

  // 3. icon-512x512.png (Transparent)
  await sharp(Buffer.from(svgContent))
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(ICONS_DIR, 'icon-512x512.png'));
  console.log('✓ Generated public/icons/icon-512x512.png');

  // 4. maskable-icon-512x512.png (Solid brand #0f172a background, safe-zone scaled 75%)
  const innerSize512 = Math.round(512 * 0.75); // 384x384
  const innerBuffer512 = await sharp(Buffer.from(svgContent))
    .resize(innerSize512, innerSize512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const topOffset512 = Math.round((512 - innerSize512) / 2);
  const leftOffset512 = Math.round((512 - innerSize512) / 2);

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: '#0f172a',
    },
  })
    .composite([{ input: innerBuffer512, top: topOffset512, left: leftOffset512 }])
    .png()
    .toFile(path.join(ICONS_DIR, 'maskable-icon-512x512.png'));
  console.log('✓ Generated public/icons/maskable-icon-512x512.png');

  // 5. apple-touch-icon.png (180x180, Solid brand #0f172a background, 80% safe inner)
  const innerSize180 = Math.round(180 * 0.8); // 144x144
  const innerBuffer180 = await sharp(Buffer.from(svgContent))
    .resize(innerSize180, innerSize180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const topOffset180 = Math.round((180 - innerSize180) / 2);
  const leftOffset180 = Math.round((180 - innerSize180) / 2);

  const appleTouchIconBuffer = await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: '#0f172a',
    },
  })
    .composite([{ input: innerBuffer180, top: topOffset180, left: leftOffset180 }])
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(ICONS_DIR, 'apple-touch-icon.png'), appleTouchIconBuffer);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), appleTouchIconBuffer);
  console.log('✓ Generated public/icons/apple-touch-icon.png and public/apple-touch-icon.png');

  // 6. favicon.ico (Multi-resolution 32x32 and 48x48)
  const png32 = await sharp(Buffer.from(svgContent))
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const png48 = await sharp(Buffer.from(svgContent))
    .resize(48, 48, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const icoBuffer = createIco([
    { width: 32, height: 32, buffer: png32 },
    { width: 48, height: 48, buffer: png48 },
  ]);

  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuffer);
  fs.writeFileSync(path.join(ICONS_DIR, 'favicon.ico'), icoBuffer);
  console.log('✓ Generated public/favicon.ico and public/icons/favicon.ico (32x32, 48x48)');

  console.log('\nAll PWA and browser icon assets generated successfully!');
}

run().catch(err => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
