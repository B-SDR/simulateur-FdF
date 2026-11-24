export const State = { UNBURNED: 0, BURNING: 1, BURNED: 2 };

const MOORE = [
  [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
  [-1, -1, 0.7071], [1, -1, 0.7071], [-1, 1, 0.7071], [1, 1, 0.7071],
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function valueNoiseLayer(rng, gridN) {
  const g = new Float32Array(gridN * gridN);
  for (let i = 0; i < g.length; i++) g[i] = rng();
  const max = gridN - 1;
  return (x, y) => {
    const gx = Math.min(max, Math.max(0, x * max));
    const gy = Math.min(max, Math.max(0, y * max));
    const x0 = Math.min(max - 1, Math.floor(gx));
    const y0 = Math.min(max - 1, Math.floor(gy));
    const tx = smooth(gx - x0);
    const ty = smooth(gy - y0);
    const i00 = y0 * gridN + x0;
    const a = g[i00], b = g[i00 + 1], c = g[i00 + gridN], d = g[i00 + gridN + 1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}

function fbm(rng, octaves, baseN) {
  const layers = [];
  let ampSum = 0;
  for (let o = 0; o < octaves; o++) {
    layers.push({ n: valueNoiseLayer(rng, baseN << o), amp: 1 / (o + 1) });
    ampSum += 1 / (o + 1);
  }
  return (x, y) => {
    let v = 0;
    for (const l of layers) v += l.n(x, y) * l.amp;
    return v / ampSum;
  };
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class FireSimulation {
  constructor(options = {}) {
    this.size = options.size ?? 128;
    this.heightScale = options.heightScale ?? 14;
    this.pBase = options.pBase ?? 0.06;
    this.burnRate = options.burnRate ?? 0.085;
    this.windMax = 80;
    this.setSlopeGain(options.slopeGain ?? 0.5);
    this.setHumidity(options.humidity ?? 0.38);
    this.setWind(options.windDirection ?? 0, options.windSpeed ?? 15);
    this.vegetation = options.vegetation ?? 0.75;
    this._rng = mulberry32(options.seed ?? 1337);
    this._generate(options.seed ?? 1337, {
      heightM: options.realHeightM || null,
      fuel: options.realFuel || null,
      water: options.realWater || null,
    });
  }

  get cells() {
    return this.size * this.size;
  }

  setWind(directionDeg, speedKmh) {
    this.windDirection = directionDeg;
    this.windSpeed = speedKmh;
    const a = (directionDeg * Math.PI) / 180;
    const s = Math.min(speedKmh, this.windMax) / this.windMax;
    this._wx = Math.cos(a) * s;
    this._wy = Math.sin(a) * s;
  }

  setHumidity(h) {
    this.moistureBase = clamp01(h);
    if (this.moisture) this._applyMoisture();
  }

  setSlopeGain(g) {
    this.slopeGain = clamp01(g);
  }

  setVegetation(v) {
    this.vegetation = clamp01(v);
    if (!this.fuel0) return;
    const S = this.cells;
    for (let k = 0; k < S; k++) {
      const f = clamp01(this.fuelNoise[k] * this.vegetation * 1.35);
      this.fuel0[k] = f;
      if (this.state[k] === State.UNBURNED) this.fuel[k] = f;
    }
  }

  _generate(seed, real = {}) {
    const N = this.size;
    const S = N * N;
    this.height = new Float32Array(S);
    this.fuelNoise = new Float32Array(S);
    this.fuel0 = new Float32Array(S);
    this.fuel = new Float32Array(S);
    this.state = new Uint8Array(S);
    this.moisture = new Float32Array(S);
    this.burnLeft = new Int16Array(S);
    this._prob = new Float32Array(S);
    this.burningCells = [];
    if (real.heightM) {
      let hMin = Infinity, hMax = -Infinity;
      for (let k = 0; k < S; k++) {
        hMin = Math.min(hMin, real.heightM[k]);
        hMax = Math.max(hMax, real.heightM[k]);
      }
      this.elevationRange = Math.max(1, hMax - hMin);
      this.water = real.water || new Uint8Array(S);
      for (let k = 0; k < S; k++) {
        this.height[k] = (real.heightM[k] - hMin) / this.elevationRange;
        this.fuelNoise[k] = real.fuel ? real.fuel[k] : this.water[k] ? 0 : 0.6;
      }
    } else {
      this.elevationRange = 1;
      this.water = null;
      const rng = mulberry32(seed ^ 0x9e3779b9);
      const hN = fbm(rng, 5, 4);
      const vN = fbm(rng, 3, 6);
      const mN = fbm(rng, 3, 5);
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const k = j * N + i;
          const u = i / (N - 1), v = j / (N - 1);
          const edge = Math.min(1, Math.min(u, v, 1 - u, 1 - v) * 8);
          let h = Math.pow(hN(u, v), 1.3);
          h = (h * 0.25 + h * edge) / 1.25;
          this.height[k] = clamp01(h);
          this.fuelNoise[k] = clamp01(Math.pow(vN(u, v), 0.85) + 0.42);
        }
      }
    }
    this._applyMoisture();
    for (let k = 0; k < S; k++) {
      this.fuel0[k] = clamp01(this.fuelNoise[k] * this.vegetation * 1.35);
    }
    this.fuel.set(this.fuel0);
  }

  _applyMoisture() {
    const S = this.cells;
    const m = this.moistureBase;
    for (let k = 0; k < S; k++) {
      const h = this.height[k];
      this.moisture[k] = clamp01(m * (1.45 - h * 0.75));
    }
  }

  resetFire() {
    const S = this.cells;
    this.state.fill(State.UNBURNED);
    this.burnLeft.fill(0);
    this.fuel.set(this.fuel0);
    this.burningCells.length = 0;
    this.tickIndex = 0;
    this.stats = { burning: 0, burned: 0, ignited: 0 };
  }

  ignite(i, j) {
    const N = this.size;
    if (i < 0 || j < 0 || i >= N || j >= N) return false;
    const k = j * N + i;
    if (this.state[k] !== State.UNBURNED || this.fuel[k] < 0.08) return false;
    this.state[k] = State.BURNING;
    this.burnLeft[k] = Math.round(6 + this.fuel[k] * 14);
    this.burningCells.push(k);
    return true;
  }

  igniteArea(i, j, radius) {
    let n = 0;
    for (let dj = -radius; dj <= radius; dj++) {
      for (let di = -radius; di <= radius; di++) {
        if (di * di + dj * dj <= radius * radius) n += this.ignite(i + di, j + dj) ? 1 : 0;
      }
    }
    return n;
  }

  tick() {
    const N = this.size;
    const S = N * N;
    const { state, fuel, moisture, burnLeft, _prob: prob, height, burningCells } = this;
    const wx = this._wx, wy = this._wy;
    const wSpeed = Math.min(1, Math.hypot(wx, wy));
    const wStretch = 2.3 * wSpeed;
    const heightScale = this.heightScale;
    const slopeCoef = this.slopeGain * 1.6;
    const pBase = this.pBase;
    prob.fill(0);

    for (let idx = burningCells.length - 1; idx >= 0; idx--) {
      const k = burningCells[idx];
      if (state[k] !== State.BURNING) {
        burningCells[idx] = burningCells[burningCells.length - 1];
        burningCells.pop();
        continue;
      }
      const si = k % N, sj = (k / N) | 0;
      const hs = height[k];
      for (let n = 0; n < 8; n++) {
        const ti = si + MOORE[n][0], tj = sj + MOORE[n][1];
        if (ti < 0 || tj < 0 || ti >= N || tj >= N) continue;
        const t = tj * N + ti;
        if (state[t] !== State.UNBURNED) continue;
        const f = fuel[t];
        if (f < 0.08) continue;
        const dryness = 1.15 - moisture[t] * 1.15;
        if (dryness <= 0.01) continue;
        const dx = MOORE[n][0], dy = MOORE[n][1];
        const dist = MOORE[n][2];
        const align = (dx * wx + dy * wy) / dist;
        const windF = Math.max(0.05, 1 + align * wStretch);
        const slopeF = Math.max(0.05, Math.min(4, 1 + ((height[t] - hs) * heightScale * slopeCoef) / dist));
        let p = pBase * Math.min(1, f * 1.35) * dryness * windF * slopeF * dist;
        if (p > 0.9) p = 0.9;
        prob[t] += p;
      }
    }

    let ignitions = 0;
    for (let t = 0; t < S; t++) {
      const p = prob[t];
      if (p > 0 && state[t] === State.UNBURNED && this._rng() < p) {
        state[t] = State.BURNING;
        burnLeft[t] = Math.round(6 + fuel[t] * 14);
        burningCells.push(t);
        ignitions++;
      }
    }

    let burnedDelta = 0;
    for (let idx = 0; idx < burningCells.length; idx++) {
      const k = burningCells[idx];
      fuel[k] -= this.burnRate;
      burnLeft[k]--;
      if (fuel[k] <= 0 || burnLeft[k] <= 0) {
        fuel[k] = 0;
        state[k] = State.BURNED;
        burnedDelta++;
      }
    }

    this.tickIndex++;
    this.stats = {
      burning: burningCells.length,
      burned: (this.stats?.burned ?? 0) + burnedDelta,
      ignitions,
    };
    return this.stats;
  }

  countState(target) {
    const S = this.cells;
    let c = 0;
    const st = this.state;
    for (let k = 0; k < S; k++) if (st[k] === target) c++;
    return c;
  }
}
