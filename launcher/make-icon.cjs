// Original four-tile icon; no LG launcher artwork is repurposed.
const fs=require('fs'),zlib=require('zlib');
function crc32(data){let crc=0xffffffff;for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([len,name,data,crc]);}
const size=80,pixels=Buffer.alloc(size*(size*3+1));
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
 const tile=((x>=18&&x<36)||(x>=44&&x<62))&&((y>=18&&y<36)||(y>=44&&y<62));
 pixels.set(tile?[207,225,233]:[23,43,58],y*(size*3+1)+1+x*3);
}
const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=2;
fs.writeFileSync(__dirname+'/app/icon.png',Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]));
