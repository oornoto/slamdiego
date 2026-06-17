const sharp = require('sharp');
const path = require('path');

const src = path.join(__dirname, '../public/friar-logo.png');
const out = path.join(__dirname, '../public');

async function main() {
  await sharp(src).resize(16, 16).png().toFile(path.join(out, 'favicon-16x16.png'));
  console.log('favicon-16x16.png done');

  await sharp(src).resize(32, 32).png().toFile(path.join(out, 'favicon-32x32.png'));
  console.log('favicon-32x32.png done');

  await sharp(src).resize(180, 180).png().toFile(path.join(out, 'apple-touch-icon.png'));
  console.log('apple-touch-icon.png done');

  // ICO: embed the 16x16 PNG bytes with a minimal ICO header
  const png16 = await sharp(src).resize(16, 16).png().toBuffer();
  const ico = buildIco(png16, 16, 16);
  require('fs').writeFileSync(path.join(out, 'favicon.ico'), ico);
  console.log('favicon.ico done');
}

function buildIco(pngBuf, w, h) {
  const headerSize = 6;
  const dirEntrySize = 16;
  const imageOffset = headerSize + dirEntrySize;

  const buf = Buffer.alloc(imageOffset + pngBuf.length);

  // ICONDIR header
  buf.writeUInt16LE(0, 0);       // reserved
  buf.writeUInt16LE(1, 2);       // type: ICO
  buf.writeUInt16LE(1, 4);       // image count

  // ICONDIRENTRY
  buf.writeUInt8(w === 256 ? 0 : w, 6);
  buf.writeUInt8(h === 256 ? 0 : h, 7);
  buf.writeUInt8(0, 8);          // color count
  buf.writeUInt8(0, 9);          // reserved
  buf.writeUInt16LE(1, 10);      // color planes
  buf.writeUInt16LE(32, 12);     // bits per pixel
  buf.writeUInt32LE(pngBuf.length, 14);
  buf.writeUInt32LE(imageOffset, 18);

  pngBuf.copy(buf, imageOffset);
  return buf;
}

main().catch(err => { console.error(err); process.exit(1); });
