const Jimp = require('jimp');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../public/friar-logo.png');
const out = path.join(__dirname, '../public');

// BFS flood-fill from all four corners: any pixel reachable from an edge
// whose R, G, and B are all > 240 is made transparent.
async function removeBackground(imagePath) {
  const image = await Jimp.read(imagePath);
  const { width, height, data } = image.bitmap;

  const visited = new Uint8Array(width * height);
  const queue = [];
  let head = 0;

  function enqueueIfBackground(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const p = idx * 4;
    if (data[p] > 240 && data[p + 1] > 240 && data[p + 2] > 240) {
      visited[idx] = 1;
      queue.push(x, y);
    }
  }

  // Seed from every pixel on the four edges
  for (let x = 0; x < width; x++) {
    enqueueIfBackground(x, 0);
    enqueueIfBackground(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueueIfBackground(0, y);
    enqueueIfBackground(width - 1, y);
  }

  while (head < queue.length) {
    const x = queue[head++];
    const y = queue[head++];
    data[(y * width + x) * 4 + 3] = 0; // make transparent
    enqueueIfBackground(x - 1, y);
    enqueueIfBackground(x + 1, y);
    enqueueIfBackground(x, y - 1);
    enqueueIfBackground(x, y + 1);
  }

  // Return raw RGBA buffer + dimensions for sharp
  return { buffer: Buffer.from(data.buffer), width, height };
}

function buildIco(pngBuf, w, h) {
  const imageOffset = 6 + 16;
  const buf = Buffer.alloc(imageOffset + pngBuf.length);
  buf.writeUInt16LE(0, 0);
  buf.writeUInt16LE(1, 2);
  buf.writeUInt16LE(1, 4);
  buf.writeUInt8(w === 256 ? 0 : w, 6);
  buf.writeUInt8(h === 256 ? 0 : h, 7);
  buf.writeUInt8(0, 8);
  buf.writeUInt8(0, 9);
  buf.writeUInt16LE(1, 10);
  buf.writeUInt16LE(32, 12);
  buf.writeUInt32LE(pngBuf.length, 14);
  buf.writeUInt32LE(imageOffset, 18);
  pngBuf.copy(buf, imageOffset);
  return buf;
}

async function main() {
  const { buffer, width, height } = await removeBackground(src);

  const base = sharp(buffer, { raw: { width, height, channels: 4 } });

  await base.clone().resize(16, 16).png().toFile(path.join(out, 'favicon-16x16.png'));
  console.log('favicon-16x16.png done');

  await base.clone().resize(32, 32).png().toFile(path.join(out, 'favicon-32x32.png'));
  console.log('favicon-32x32.png done');

  await base.clone().resize(180, 180).png().toFile(path.join(out, 'apple-touch-icon.png'));
  console.log('apple-touch-icon.png done');

  const png16 = await base.clone().resize(16, 16).png().toBuffer();
  fs.writeFileSync(path.join(out, 'favicon.ico'), buildIco(png16, 16, 16));
  console.log('favicon.ico done');
}

main().catch(err => { console.error(err); process.exit(1); });
