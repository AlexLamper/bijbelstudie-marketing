// Builds engine/render/data/map.json: the Bible lands (land, the big lakes, Nile/Jordan/Euphrates/Tigris)
// projected and simplified into compact SVG path data, plus the projection, so the reel-story map scenes
// (engine/render/templates/story.js) can project places with the same function. Run once:
//   node scripts/build-map.mjs
// Sources (pinned, fetched with curl): world-atlas 2.0.2 land (Natural Earth 1:10m), topojson-client 3.1.0,
// Natural Earth 5.1.2 lakes and rivers (1:10m). All public domain.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { ROOT } from '../engine/paths.mjs';

const SRC = {
  land: 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-10m.json',
  topojson: 'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js',
  lakes: 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_10m_lakes.geojson',
  rivers: 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_10m_rivers_lake_centerlines.geojson',
};
// The places live in lon 8..50, lat 24..44 (Rome to Susan, Egypt to the Black Sea). A reel is portrait, so a
// wide route shows far more north/south than that: the data reaches further, more coarsely, so no edge shows.
const BOX = { lonMin: -4, lonMax: 60, latMin: 12, latMax: 54 };
const CORE = { lonMin: 8, lonMax: 50, latMin: 24, latMax: 44 };
const DETAIL = { lonMin: 21, lonMax: 37.5, latMin: 29, latMax: 42 }; // Greece, Asia Minor, the Levant: zoomed in most
const LAT0 = 34;                                     // equirectangular, x scaled by cos(LAT0)
const K = 200;                                       // map units per degree of latitude (1 unit = ~550 m)
const COS = Math.cos(LAT0 * Math.PI / 180);
const project = (lon, lat) => [(lon - BOX.lonMin) * COS * K, (BOX.latMax - lat) * K];
const inside = (b, lon, lat) => lon >= b.lonMin && lon <= b.lonMax && lat >= b.latMin && lat <= b.latMax;
// simplification tolerance (map units) and smallest island kept (units^2), by region
const tol = (lon, lat) => inside(DETAIL, lon, lat) ? 0.55 : inside(CORE, lon, lat) ? 1.6 : 6;
const minArea = (lon, lat) => inside(DETAIL, lon, lat) ? 20 : inside(CORE, lon, lat) ? 120 : 1600;

// ---- fetch
const dl = mkdtempSync(join(tmpdir(), 'bible-map-'));
const get = (name, url) => { const f = join(dl, name); execFileSync('curl', ['-sSfL', '--retry', '2', '-o', f, url]); return f; };
const topoLib = { exports: {} };
vm.runInNewContext(readFileSync(get('topojson.js', SRC.topojson), 'utf8'), { exports: topoLib.exports, module: topoLib, self: {} });
const topojson = topoLib.exports;
const topo = JSON.parse(readFileSync(get('land.json', SRC.land), 'utf8'));
const lakesGeo = JSON.parse(readFileSync(get('lakes.geojson', SRC.lakes), 'utf8'));
const riversGeo = JSON.parse(readFileSync(get('rivers.geojson', SRC.rivers), 'utf8'));
rmSync(dl, { recursive: true, force: true });

// ---- geometry
/** Sutherland-Hodgman: clip a closed ring ([lon, lat][]) to BOX. */
function clipRing(ring) {
  const edges = [
    [p => p[0] >= BOX.lonMin, (a, b) => lerpAt(a, b, 0, BOX.lonMin)], [p => p[0] <= BOX.lonMax, (a, b) => lerpAt(a, b, 0, BOX.lonMax)],
    [p => p[1] >= BOX.latMin, (a, b) => lerpAt(a, b, 1, BOX.latMin)], [p => p[1] <= BOX.latMax, (a, b) => lerpAt(a, b, 1, BOX.latMax)],
  ];
  let pts = ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0, -1) : ring.slice();
  for (const [ok, cut] of edges) {
    if (!pts.length) break;
    const res = [];
    pts.forEach((cur, i) => {
      const prev = pts[(i + pts.length - 1) % pts.length];
      if (ok(cur)) { if (!ok(prev)) res.push(cut(prev, cur)); res.push(cur); } else if (ok(prev)) res.push(cut(prev, cur));
    });
    pts = res;
  }
  return pts;
}
function lerpAt(a, b, axis, v) { const k = (v - a[axis]) / (b[axis] - a[axis]); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; }
/** Clip a polyline to BOX (keeps the runs inside; good enough for rivers, which barely cross the edge). */
const clipLine = line => { const runs = []; let cur = []; for (const p of line) { if (inside(BOX, p[0], p[1])) cur.push(p); else if (cur.length) { runs.push(cur); cur = []; } } if (cur.length) runs.push(cur); return runs; };

/** Douglas-Peucker on projected points with a tolerance that depends on where the point is. */
function simplify(pts, geo, closed) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  if (closed) { // split a ring at its farthest point from the start, so both halves have distinct ends
    let far = 0, d = -1; pts.forEach((p, i) => { const q = (p[0] - pts[0][0]) ** 2 + (p[1] - pts[0][1]) ** 2; if (q > d) { d = q; far = i; } }); keep[far] = 1;
    dp(0, far); dp(far, pts.length - 1);
  } else dp(0, pts.length - 1);
  function dp(a, b) {
    if (b - a < 2) return;
    const [ax, ay] = pts[a], [bx, by] = pts[b]; const dx = bx - ax, dy = by - ay; const len = Math.hypot(dx, dy) || 1;
    let best = -1, idx = -1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len; const r = d / tol(...geo[i]); if (r > best) { best = r; idx = i; } }
    if (best > 1) { keep[idx] = 1; dp(a, idx); dp(idx, b); }
  }
  return pts.filter((_, i) => keep[i]);
}
const area = pts => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);

/** Compact SVG path data: absolute M per part, then relative integer steps. */
function encode(parts, closed) {
  const num = (n, first) => (n < 0 || first ? '' : ' ') + n;
  return parts.map(pts => {
    const r = pts.map(p => [Math.round(p[0]), Math.round(p[1])]).filter((p, i, a) => !i || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
    if (r.length < (closed ? 3 : 2)) return '';
    let s = `M${r[0][0]}${num(r[0][1])}l`; let first = true;
    for (let i = 1; i < r.length; i++) { s += num(r[i][0] - r[i - 1][0], first) + num(r[i][1] - r[i - 1][1]); first = false; }
    return s + (closed ? 'z' : '');
  }).join('');
}

function rings(geom) { return geom.type === 'Polygon' ? geom.coordinates : geom.type === 'MultiPolygon' ? geom.coordinates.flat() : []; }
function polygons(features) {
  const parts = [];
  for (const f of features) for (const ring of rings(f.geometry)) {
    const geo = clipRing(ring); if (geo.length < 3) continue;
    const pts = geo.map(p => project(...p));
    const mid = geo.reduce((m, p) => [m[0] + p[0] / geo.length, m[1] + p[1] / geo.length], [0, 0]);
    if (area(pts) < minArea(...mid)) continue;                    // drop specks too small to see
    const s = simplify(pts, geo, true); if (s.length >= 3 && area(s) > 0) parts.push(s);
  }
  return parts;
}
function lines(features) {
  const parts = [];
  for (const f of features) {
    const ls = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [];
    for (const l of ls) for (const run of clipLine(l)) if (run.length > 1) parts.push(simplify(run.map(p => project(...p)), run, false));
  }
  return parts;
}

// ---- layers
const land = topojson.feature(topo, topo.objects.land).features;
const LAKES = ['Sea of Galilee', 'Dead Sea', 'Lake Van', 'Lake Urmia', 'Lake Tuz'];
const lakes = lakesGeo.features.filter(f => LAKES.includes(f.properties.name));
const RIVERS = ['Nile', 'Rosetta Branch', 'Damietta Branch', 'Jordan', 'Euphrates', 'Firat', 'Al Furat', 'Tigris', 'Dicle', 'Shatt al Arab'];
const rivers = riversGeo.features.filter(f => RIVERS.includes(f.properties.name));

const [W, H] = project(BOX.lonMax, BOX.latMin).map(Math.round);
const map = {
  note: 'Generated by scripts/build-map.mjs (Natural Earth 1:10m via world-atlas 2.0.2 + natural-earth-vector 5.1.2, public domain). Do not edit by hand.',
  // x = (lon - lonMin) * cos(lat0) * k, y = (latMax - lat) * k, in map units; the paths use the same units.
  proj: { lonMin: BOX.lonMin, latMax: BOX.latMax, lat0: LAT0, cos: +COS.toFixed(6), k: K },
  box: BOX, size: [W, H],
  land: encode(polygons(land), true),
  lakes: encode(polygons(lakes), true),
  rivers: encode(lines(rivers), false),
  // seas, shown softly behind the places (Dutch names)
  seas: [
    { name: 'Middellandse Zee', lon: 18.6, lat: 34.2, size: 1 },
    { name: 'Egeïsche Zee', lon: 25.1, lat: 38.7, size: .8 },
    { name: 'Adriatische Zee', lon: 16.2, lat: 42.4, size: .7, rotate: -38 },
    { name: 'Zwarte Zee', lon: 34.2, lat: 43.2, size: 1 },
    { name: 'Rode Zee', lon: 37.3, lat: 23.6, size: .8, rotate: -58 },
    { name: 'Perzische Golf', lon: 51.2, lat: 27.4, size: .8, rotate: -32 },
    { name: 'Kaspische Zee', lon: 51.0, lat: 41.6, size: .8 },
  ],
};
const out = join(ROOT, 'engine', 'render', 'data', 'map.json');
writeFileSync(out, JSON.stringify(map) + '\n');
const kb = s => (s.length / 1024).toFixed(1) + ' KB';
console.log(`map.json ${kb(JSON.stringify(map))}: land ${kb(map.land)}, lakes ${kb(map.lakes)}, rivers ${kb(map.rivers)}, ${W}x${H} units`);
