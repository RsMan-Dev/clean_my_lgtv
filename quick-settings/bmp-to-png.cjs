// Lossless conversion of webOS compositor's uncompressed 24-bit BMP capture.
const fs = require('fs'), zlib = require('zlib');
const b = fs.readFileSync(process.argv[2]);
if (b.toString('ascii',0,2) !== 'BM' || b.readUInt16LE(28) !== 24 || b.readUInt32LE(30) !== 0) throw Error('Unsupported BMP');
const w = b.readInt32LE(18), signedH = b.readInt32LE(22), h = Math.abs(signedH), offset = b.readUInt32LE(10);
const stride = Math.ceil(w * 3 / 4) * 4, raw = Buffer.alloc(h * (w * 3 + 1));
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const from = offset + (signedH > 0 ? h - y - 1 : y) * stride + x * 3;
  const to = y * (w * 3 + 1) + 1 + x * 3;
  raw[to] = b[from+2]; raw[to+1] = b[from+1]; raw[to+2] = b[from];
}
function chunk(name, data) {
  const label = Buffer.from(name), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length); let crc = 0xffffffff;
  for (const byte of Buffer.concat([label,data])) {
    crc ^= byte;
    for (let i=0;i<8;i++) crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  checksum.writeUInt32BE((crc^0xffffffff)>>>0);
  return Buffer.concat([length,label,data,checksum]);
}
const header = Buffer.alloc(13); header.writeUInt32BE(w); header.writeUInt32BE(h,4); header[8]=8; header[9]=2;
fs.writeFileSync(process.argv[3],Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
