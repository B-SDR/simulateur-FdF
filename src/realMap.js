const EARTH = 40075016.686;
const TERRARIUM_BASE = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
const ORTHO_URL =
  'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile' +
  '&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg' +
  '&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';

export const PRESETS = {
  none: { name: 'Terrain procédural' },
  clape: { name: 'Massif de la Clape', lat: 43.155, lon: 3.13, sizeKm: 10 },
  fontfroide: { name: 'Massif de Fontfroide', lat: 43.165, lon: 2.915, sizeKm: 8 },
  peyrepertuse: { name: 'Corbières — Peyrepertuse', lat: 42.872, lon: 2.636, sizeKm: 12 },
  aigoual: { name: 'Cévennes — Mont Aigoual', lat: 44.088, lon: 3.586, sizeKm: 12 },
  'sainte-victoire': { name: 'Sainte-Victoire', lat: 43.532, lon: 5.55, sizeKm: 11 },
};

export function lonToTileX(lon, zoom) {
  return ((lon + 180) / 360) * (1 << zoom);
}

export function latToTileY(lat, zoom) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * (1 << zoom);
}

export function tileToLon(tx, zoom) {
  return (tx / (1 << zoom)) * 360 - 180;
}

export function tileToLatN(ty, zoom) {
  const n = Math.PI * (1 - (2 * ty) / (1 << zoom));
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export function mercXFromLon(lon) {
  return (EARTH * lon) / 360;
}

export function lonFromMercX(mx) {
  return (mx * 360) / EARTH;
}

export function mercYFromLat(lat) {
  return Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * (EARTH / (2 * Math.PI));
}

export function latFromMercY(my) {
  return (360 * Math.atan(Math.exp((my * 2 * Math.PI) / EARTH))) / Math.PI - 90;
}

export function decodeTerrarium(r, g, b) {
  return r * 256 + g + b / 256 - 32768;
}

export function chooseZoom(mercSpan) {
  return Math.max(9, Math.min(15, Math.floor(Math.log2((6 * EARTH) / mercSpan))));
}

export const KIND = {
  UNKNOWN: 0, WATER: 1, URBAN: 2, AGRI: 3, GRASS: 4, SHRUB: 5,
  FOREST_LEAF: 6, FOREST_PINE: 7, FOREST_MIXED: 8, ROCK: 9, BURNT: 10,
};

export const KIND_COLORS = {
  [KIND.UNKNOWN]: [0.5, 0.5, 0.5],
  [KIND.WATER]: [0.13, 0.26, 0.38],
  [KIND.URBAN]: [0.75, 0.2, 0.4],
  [KIND.AGRI]: [0.92, 0.88, 0.6],
  [KIND.GRASS]: [0.8, 0.94, 0.34],
  [KIND.SHRUB]: [0.66, 0.9, 0.34],
  [KIND.FOREST_LEAF]: [0.44, 0.94, 0.2],
  [KIND.FOREST_PINE]: [0.0, 0.6, 0.15],
  [KIND.FOREST_MIXED]: [0.3, 0.94, 0.15],
  [KIND.ROCK]: [0.85, 0.85, 0.85],
  [KIND.BURNT]: [0.8, 0.95, 0.8],
};

const CLC_TABLE = [
  { c: [230, 0, 77], code: 111, kind: KIND.URBAN, fuel: 0.05 },
  { c: [255, 0, 0], code: 112, kind: KIND.URBAN, fuel: 0.05 },
  { c: [204, 204, 204], code: 121, kind: KIND.URBAN, fuel: 0.03 },
  { c: [204, 0, 0], code: 122, kind: KIND.URBAN, fuel: 0.02 },
  { c: [230, 204, 230], code: 124, kind: KIND.URBAN, fuel: 0.05 },
  { c: [166, 0, 204], code: 131, kind: KIND.URBAN, fuel: 0.02 },
  { c: [166, 77, 0], code: 132, kind: KIND.URBAN, fuel: 0.05 },
  { c: [255, 77, 255], code: 133, kind: KIND.URBAN, fuel: 0.05 },
  { c: [255, 166, 255], code: 141, kind: KIND.GRASS, fuel: 0.3 },
  { c: [255, 230, 255], code: 142, kind: KIND.GRASS, fuel: 0.3 },
  { c: [255, 255, 168], code: 211, kind: KIND.AGRI, fuel: 0.18 },
  { c: [168, 255, 0], code: 212, kind: KIND.AGRI, fuel: 0.2 },
  { c: [168, 168, 0], code: 213, kind: KIND.AGRI, fuel: 0.1 },
  { c: [230, 128, 0], code: 221, kind: KIND.AGRI, fuel: 0.12 },
  { c: [242, 166, 77], code: 222, kind: KIND.AGRI, fuel: 0.15 },
  { c: [255, 230, 168], code: 223, kind: KIND.AGRI, fuel: 0.2 },
  { c: [230, 230, 77], code: 231, kind: KIND.GRASS, fuel: 0.25 },
  { c: [255, 255, 0], code: 241, kind: KIND.AGRI, fuel: 0.2 },
  { c: [255, 230, 77], code: 242, kind: KIND.AGRI, fuel: 0.25 },
  { c: [230, 204, 77], code: 243, kind: KIND.AGRI, fuel: 0.3 },
  { c: [255, 204, 102], code: 244, kind: KIND.AGRI, fuel: 0.35 },
  { c: [128, 255, 0], code: 311, kind: KIND.FOREST_LEAF, fuel: 0.85 },
  { c: [0, 166, 0], code: 312, kind: KIND.FOREST_PINE, fuel: 0.95 },
  { c: [77, 255, 0], code: 313, kind: KIND.FOREST_MIXED, fuel: 0.9 },
  { c: [204, 242, 77], code: 321, kind: KIND.GRASS, fuel: 0.25 },
  { c: [166, 255, 128], code: 322, kind: KIND.SHRUB, fuel: 0.55 },
  { c: [166, 230, 77], code: 323, kind: KIND.SHRUB, fuel: 0.6 },
  { c: [166, 242, 0], code: 324, kind: KIND.SHRUB, fuel: 0.5 },
  { c: [230, 230, 230], code: 331, kind: KIND.ROCK, fuel: 0.02 },
  { c: [204, 204, 204], code: 332, kind: KIND.ROCK, fuel: 0.02 },
  { c: [204, 255, 204], code: 333, kind: KIND.BURNT, fuel: 0.06 },
  { c: [204, 204, 255], code: 334, kind: KIND.BURNT, fuel: 0.06 },
  { c: [166, 166, 255], code: 411, kind: KIND.WATER, fuel: 0 },
  { c: [166, 204, 255], code: 412, kind: KIND.WATER, fuel: 0 },
  { c: [0, 204, 242], code: 511, kind: KIND.WATER, fuel: 0 },
  { c: [128, 242, 230], code: 512, kind: KIND.WATER, fuel: 0 },
  { c: [255, 0, 0], code: 521, kind: KIND.WATER, fuel: 0 },
  { c: [255, 245, 245], code: 523, kind: KIND.WATER, fuel: 0 },
];

export function classifyClc(r, g, b) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < CLC_TABLE.length; i++) {
    const e = CLC_TABLE[i].c;
    const dr = e[0] - r, dg = e[1] - g, db = e[2] - b;
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) { bestD = d; best = i; }
  }
  return CLC_TABLE[best];
}

const CLC_WMS =
  'https://data.geopf.fr/wms?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&CRS=EPSG:3857' +
  '&BBOX={bbox}&WIDTH={w}&HEIGHT={h}&FORMAT=image/png&TRANSPARENT=true&STYLES=&LAYERS=LANDCOVER.CLC18';

export async function fetchWmsRaster(mercBox, width, height) {
  const url = CLC_WMS
    .replace('{bbox}', mercBox.map((v) => v.toFixed(1)).join(','))
    .replace('{w}', width)
    .replace('{h}', height);
  return fetchTileData(url);
}

export function greennessToFuel(r, g, b) {
  if (b > g && b > r && b - r > 12 && g < 180) return 0;
  const gidx = g - 0.5 * (r + b);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const dry = Math.min(1, Math.max(0, (215 - lum) / 110));
  return Math.min(1, Math.max(0, 0.18 + gidx / 38)) * dry;
}

async function fetchTileData(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} pour ${url}`);
  const blob = await res.blob();
  const bmp = await createImageBitmap(blob);
  const w = bmp.width, h = bmp.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  return { data: ctx.getImageData(0, 0, w, h).data, w, h, bmp };
}

async function fetchPool(jobs, concurrency, onProgress) {
  const results = new Array(jobs.length);
  let next = 0, done = 0;
  async function worker() {
    while (next < jobs.length) {
      const idx = next++;
      results[idx] = await jobs[idx].run();
      done++;
      onProgress(done, jobs.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  return results;
}

export async function loadRealTerrain(options = {}) {
  const lat = options.lat, lon = options.lon;
  const sizeM = options.sizeKm * 1000;
  const gridN = options.gridN || 128;
  const onProgress = options.onProgress || (() => {});
  const cos = Math.cos((lat * Math.PI) / 180);
  const mercW = sizeM / cos;
  const mercH = sizeM;
  const zoom = chooseZoom(mercW);
  const nTiles = 1 << zoom;

  const mx = mercXFromLon(lon), my = mercYFromLat(lat);
  const mx0 = mx - mercW / 2, my0 = my - mercH / 2;
  const lon0 = lonFromMercX(mx0), lon1 = lonFromMercX(mx0 + mercW);
  const latN = latFromMercY(my0 + mercH), latS = latFromMercY(my0);
  const latMin = latS, latMax = latN, latSpan = latMax - latMin;

  const tx0 = Math.max(0, Math.floor(lonToTileX(lon0, zoom)));
  const tx1 = Math.min(nTiles - 1, Math.ceil(lonToTileX(lon1, zoom)) - 1);
  const ty0 = Math.max(0, Math.floor(latToTileY(latN, zoom)));
  const ty1 = Math.min(nTiles - 1, Math.ceil(latToTileY(latS, zoom)) - 1);

  const elevTiles = new Map();
  const list = [];
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) list.push({ tx, ty });
  }

  const terrainJobs = list.map(({ tx, ty }) => ({
    run: async () => {
      const t = await fetchTileData(`${TERRARIUM_BASE}/${zoom}/${tx}/${ty}.png`);
      elevTiles.set(`${tx}_${ty}`, t);
    },
  }));
  await fetchPool(terrainJobs, 6, (d, t) => onProgress(d, t * 2, 'relief'));
  if (!elevTiles.size) throw new Error('aucune tuile de relief téléchargée');

  const sampleElev = (lonP, latP) => {
    const fx = lonToTileX(lonP, zoom);
    const fy = latToTileY(latP, zoom);
    const tx = Math.max(tx0, Math.min(tx1, Math.floor(fx)));
    const ty = Math.max(ty0, Math.min(ty1, Math.floor(fy)));
    const tile = elevTiles.get(`${tx}_${ty}`);
    if (!tile) return 0;
    const u = Math.min(tile.w - 1, Math.max(0, (fx - tx) * tile.w));
    const v = Math.min(tile.h - 1, Math.max(0, (fy - ty) * tile.h));
    const x0 = Math.floor(u), y0 = Math.floor(v);
    const x1 = Math.min(tile.w - 1, x0 + 1), y1 = Math.min(tile.h - 1, y0 + 1);
    const du = u - x0, dv = v - y0;
    const d = tile.data;
    const at = (x, y) =>
      decodeTerrarium(d[(y * tile.w + x) * 4], d[(y * tile.w + x) * 4 + 1], d[(y * tile.w + x) * 4 + 2]);
    return (
      at(x0, y0) * (1 - du) * (1 - dv) + at(x1, y0) * du * (1 - dv) +
      at(x0, y1) * (1 - du) * dv + at(x1, y1) * du * dv
    );
  };

  const heightsM = new Float32Array(gridN * gridN);
  let elevMin = Infinity, elevMax = -Infinity;
  for (let j = 0; j < gridN; j++) {
    const latJ = latFromMercY(my0 + ((j + 0.5) / gridN) * mercH);
    for (let i = 0; i < gridN; i++) {
      const lonI = lonFromMercX(mx0 + ((i + 0.5) / gridN) * mercW);
      const e = sampleElev(lonI, latJ);
      heightsM[j * gridN + i] = e;
      if (e < elevMin) elevMin = e;
      if (e > elevMax) elevMax = e;
    }
  }

  const S = gridN * 4;
  const texCanvas = document.createElement('canvas');
  texCanvas.width = S;
  texCanvas.height = S;
  const tctx = texCanvas.getContext('2d', { willReadFrequently: true });
  tctx.fillStyle = '#888';
  tctx.fillRect(0, 0, S, S);

  const drawFlipped = (img, dx, dy, dw, dh) => {
    tctx.save();
    tctx.translate(dx, dy + dh);
    tctx.scale(1, -1);
    tctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, dw, dh);
    tctx.restore();
  };

  let orthoOk = 0;
  const orthoJobs = list.map(({ tx, ty }) => ({
    run: async () => {
      try {
        const t = await fetchTileData(
          ORTHO_URL.replace('{z}', zoom).replace('{y}', ty).replace('{x}', tx)
        );
        const south = tileToLatN(ty + 1, zoom);
        const north = tileToLatN(ty, zoom);
        const west = tileToLon(tx, zoom);
        const east = tileToLon(tx + 1, zoom);
        const dx = ((mercXFromLon(west) - mx0) / mercW) * S;
        const dw = ((mercXFromLon(east) - mx0) / mercW) * S - dx;
        const dy = ((south - latMin) / latSpan) * S;
        const dh = ((north - latMin) / latSpan) * S - dy;
        drawFlipped(t.bmp, dx, dy, dw, dh);
        orthoOk++;
      } catch (err) {
        console.warn('tuile ortho manquante:', tx, ty);
      }
    },
  }));
  await fetchPool(orthoJobs, 6, (d, t) =>
    onProgress(terrainJobs.length + d, terrainJobs.length + t, 'orthophotos')
  );

  let clcData = null;
  try {
    clcData = await fetchWmsRaster(
      [mx0, my0, mx0 + mercW, my0 + mercH], gridN * 2, gridN * 2
    );
  } catch (err) {
    console.warn('CLC indisponible, repli sur orthophoto uniquement:', err.message);
  }
  const CS = clcData ? clcData.w : 0;

  const texData = tctx.getImageData(0, 0, S, S).data;
  const fuels = new Float32Array(gridN * gridN);
  const water = new Uint8Array(gridN * gridN);
  const landKind = new Uint8Array(gridN * gridN);
  let clcCells = 0, orthoCells = 0;
  for (let j = 0; j < gridN; j++) {
    for (let i = 0; i < gridN; i++) {
      const k = j * gridN + i;
      let r = 0, g = 0, b = 0;
      const cx = Math.min(S - 1, Math.round(((i + 0.5) / gridN) * S));
      const cy = Math.min(S - 1, Math.round(((j + 0.5) / gridN) * S));
      let n = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const px = Math.min(S - 1, Math.max(0, cx + ox));
          const py = Math.min(S - 1, Math.max(0, cy + oy));
          const o = (py * S + px) * 4;
          r += texData[o]; g += texData[o + 1]; b += texData[o + 2];
          n++;
        }
      }
      r /= n; g /= n; b /= n;
      const elev = heightsM[k];
      let entry = null;
      if (clcData) {
        const cqx = Math.min(CS - 1, Math.round(((i + 0.5) / gridN) * CS));
        const cqy = Math.min(CS - 1, Math.round(((j + 0.5) / gridN) * CS));
        const co = (cqy * CS + cqx) * 4;
        if (clcData.data[co + 3] > 10) {
          entry = classifyClc(clcData.data[co], clcData.data[co + 1], clcData.data[co + 2]);
          if (entry.code === 112 && elev < 1) entry = { code: 521, kind: KIND.WATER, fuel: 0 };
          clcCells++;
        }
      }
      if (entry) {
        landKind[k] = entry.kind;
        fuels[k] = entry.fuel;
        if (entry.kind === KIND.WATER) water[k] = 1;
      } else {
        const isWater = elev < 0;
        if (isWater) water[k] = 1;
        landKind[k] = isWater ? KIND.WATER : KIND.UNKNOWN;
        fuels[k] = isWater ? 0 : greennessToFuel(r, g, b);
        orthoCells++;
      }
    }
  }

  for (const t of elevTiles.values()) t.bmp && t.bmp.close && t.bmp.close();

  onProgress(1, 1, 'prêt');
  return {
    heightsM,
    fuels,
    water,
    landKind,
    landCoverSource: { clcCells, orthoCells },
    elevationMin: elevMin,
    elevationMax: elevMax,
    zoom,
    textureCanvas: texCanvas,
    orthoTiles: orthoOk,
    bbox: { latMin, latMax, lonMin: lon0, lonMax: lon1, sizeM },
  };
}
