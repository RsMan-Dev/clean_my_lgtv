// Original procedural icon: three mint sliders on a dark background.
const fs = require('fs');
const zlib = require('zlib');
const size = 80;
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const label = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([label, data])));
  return Buffer.concat([length, label, data, crc]);
}
const pixels = Buffer.alloc(size * (1 + size * 3));
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  const slider = [22, 40, 58].some((row, i) =>
    (Math.abs(y - row) <= 1 && x >= 17 && x <= 63) ||
    (Math.abs(y - row) <= 5 && Math.abs(x - [30, 51, 38][i]) <= 4));
  const color = slider ? [145, 239, 208] : [22, 28, 38];
  const offset = y * (1 + size * 3) + 1 + x * 3;
  pixels.set(color, offset);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
fs.writeFileSync(__dirname + '/app/quick-settings.png', Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
  chunk('IDAT', zlib.deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))
]));
