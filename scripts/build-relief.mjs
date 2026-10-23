// Builds engine/render/data/relief.png: the elevation of the Bible lands for the 3D map (engine/render/3d/map3d.js).
// Source: ETOPO1 (NOAA NCEI, public domain), via NOAA's ERDDAP server, on a 0.05 degree grid over the same box as
// map.json (lon -4..60, lat 12..54), north up. One grey byte per point: 255 * sqrt(max(0, metres) / 5800), so the
// low land keeps its detail; the sea and land below sea level are 0 (map.json's coast decides what is sea). Run once:
//   node scripts/build-relief.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { ROOT } from '../engine/paths.mjs';

const BOX = { lonMin: -4, lonMax: 60, latMin: 12, latMax: 54 }, STEP = 3, MAX = 5800;   // ETOPO1 is 1 arc minute: every 3rd = 0.05 degree
const URL = `https://coastwatch.pfeg.noaa.gov/erddap/griddap/etopo180.esriAscii?altitude%5B(${BOX.latMin}):${STEP}:(${BOX.latMax})%5D%5B(${BOX.lonMin}):${STEP}:(${BOX.lonMax})%5D`;

const dl = mkdtempSync(join(tmpdir(), 'bible-relief-'));
const file = join(dl, 'etopo.asc');
execFileSync('curl', ['-sSfL', '--retry', '2', '-o', file, URL]);
const tokens = readFileSync(file, 'utf8').trim().split(/\s+/);
rmSync(dl, { recursive: true, force: true });

// ESRI ASCII grid: a header of key/value pairs, then the rows from north to south
const head = {}; let i = 0;
while (isNaN(+tokens[i])) { head[tokens[i].toLowerCase()] = +tokens[i + 1]; i += 2; }
const w = head.ncols, h = head.nrows, values = tokens.slice(i).map(Number);
if (values.length !== w * h) throw new Error(`expected ${w * h} values, got ${values.length}`);
const grey = Buffer.alloc(w * h);
values.forEach((m, k) => { grey[k] = Math.min(255, Math.round(255 * Math.sqrt(Math.max(0, m) / MAX))); });

// a minimal 8-bit greyscale PNG
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const raw = Buffer.alloc((w + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w + 1)] = 0; grey.copy(raw, y * (w + 1) + 1, y * w, (y + 1) * w); }
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
const out = join(ROOT, 'engine', 'render', 'data', 'relief.png');
writeFileSync(out, png);
console.log(`relief.png: ${w} x ${h}, ${(png.length / 1024).toFixed(0)} KB (max ${values.reduce((a, b) => Math.max(a, b), 0)} m)`);
