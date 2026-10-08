// Génère les icônes PNG de l'app (sans dépendance) : node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [245, 165, 36];   // orange chantier
const HOUSE = [23, 27, 33];  // gris très foncé
const CHECK = [245, 165, 36];
const SCALE = 0.82;          // marge pour les icônes « maskable » (zone sûre)

// Formes en coordonnées 0..1, centrées puis réduites par SCALE.
const shrink = ([x, y]) => [0.5 + (x - 0.5) * SCALE, 0.5 + (y - 0.5) * SCALE];
const roof = [[0.5, 0.14], [0.1, 0.5], [0.9, 0.5]].map(shrink);
const body = [[0.2, 0.46], [0.8, 0.86]].map(shrink);
const check = [[0.33, 0.66], [0.46, 0.78], [0.68, 0.55]].map(shrink);
const checkWidth = 0.075 * SCALE;

function inTriangle([px, py], [a, b, c]) {
  const s = (p1, p2) => (px - p2[0]) * (p1[1] - p2[1]) - (p1[0] - p2[0]) * (py - p2[1]);
  const d1 = s(a, b), d2 = s(b, c), d3 = s(c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

function distToSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function colorAt(p) {
  const onCheck = distToSegment(p, check[0], check[1]) < checkWidth / 2 || distToSegment(p, check[1], check[2]) < checkWidth / 2;
  if (onCheck) return CHECK;
  const inBody = p[0] >= body[0][0] && p[0] <= body[1][0] && p[1] >= body[0][1] && p[1] <= body[1][1];
  if (inBody || inTriangle(p, roof)) return HOUSE;
  return BG;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const SS = 4; // sur-échantillonnage pour lisser les bords
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = colorAt([(x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size]);
          acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
        }
      }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(acc[i] / (SS * SS));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8 bits, RVB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = new URL('../icons/', import.meta.url);
mkdirSync(dir, { recursive: true });
for (const size of [180, 192, 512]) {
  writeFileSync(new URL(`icon-${size}.png`, dir), png(size));
  console.log(`icons/icon-${size}.png`);
}
