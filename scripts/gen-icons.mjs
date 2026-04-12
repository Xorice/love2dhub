/**
 * 生成 Tauri 所需的占位图标文件
 * 运行：node scripts/gen-icons.mjs
 */
import { mkdirSync, writeFileSync } from "fs";
import { deflateSync } from "zlib";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "src-tauri", "icons");
mkdirSync(iconsDir, { recursive: true });

// ── CRC32 (PNG 规范要求) ───────────────────────────────────
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ── PNG 编码器 ────────────────────────────────────────────
function pngChunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

function createPNG(w, h, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB

  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    row[0] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      row[1 + x * 3] = r;
      row[2 + x * 3] = g;
      row[3 + x * 3] = b;
    }
    rows.push(row);
  }

  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── ICO 编码器（内嵌 PNG，Vista+ 支持）────────────────────
function createICO(pngData) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: ICO
  header.writeUInt16LE(1, 4); // 1 image

  const entry = Buffer.alloc(16);
  entry[0] = 0;  // width=0 表示 256
  entry[1] = 0;  // height=0 表示 256
  entry[2] = 0;  // palette count
  entry[3] = 0;  // reserved
  entry.writeUInt16LE(1, 4);  // planes
  entry.writeUInt16LE(32, 6); // bit depth
  entry.writeUInt32LE(pngData.length, 8);
  entry.writeUInt32LE(22, 12); // offset = 6+16

  return Buffer.concat([header, entry, pngData]);
}

// ── ICNS 编码器（macOS 图标）──────────────────────────────
function createICNS(png32, png128, png256) {
  function entry(type, data) {
    const t = Buffer.from(type, "ascii");
    const s = Buffer.alloc(4);
    s.writeUInt32BE(8 + data.length);
    return Buffer.concat([t, s, data]);
  }
  const body = Buffer.concat([
    entry("icp5", png32),   // 32x32
    entry("ic07", png128),  // 128x128
    entry("ic08", png256),  // 256x256
  ]);
  const totalSize = Buffer.alloc(4);
  totalSize.writeUInt32BE(8 + body.length);
  return Buffer.concat([Buffer.from("icns"), totalSize, body]);
}

// ── 生成 ──────────────────────────────────────────────────
// Love2D 粉 #e8639a
const [R, G, B] = [0xe8, 0x63, 0x9a];

const png32  = createPNG(32, 32, R, G, B);
const png128 = createPNG(128, 128, R, G, B);
const png256 = createPNG(256, 256, R, G, B);

writeFileSync(join(iconsDir, "32x32.png"), png32);
writeFileSync(join(iconsDir, "128x128.png"), png128);
writeFileSync(join(iconsDir, "128x128@2x.png"), png256);
writeFileSync(join(iconsDir, "icon.ico"), createICO(png256));
writeFileSync(join(iconsDir, "icon.icns"), createICNS(png32, png128, png256));

console.log("✓ 图标已生成至 src-tauri/icons/");
console.log("  - 32x32.png");
console.log("  - 128x128.png");
console.log("  - 128x128@2x.png");
console.log("  - icon.ico");
console.log("  - icon.icns");
