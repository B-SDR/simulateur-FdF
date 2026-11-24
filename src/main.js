import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { FireSimulation, State } from './simulation.js';

const N = 128;
const WORLD = 140;
const CELL = WORLD / N;
const TICKS_PER_SEC_DEFAULT = 20;
const TICK_MINUTES = 2;
const FIRE_PARTICLES_PER_CELL = 3;
const FIRE_CAP = 24000;
const SMOKE_CAP = 8000;

const params = {
  humidite: 38,
  ventVitesse: 15,
  ventDirection: 0,
  vegetation: 75,
  effetPente: 50,
  vitesse: TICKS_PER_SEC_DEFAULT,
  pause: false,
  seed: 1337,
};

const statsEl = document.getElementById('stats');
const hintEl = document.getElementById('hint');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9db8d2);
scene.fog = new THREE.Fog(0x9db8d2, 220, 620);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 1500);
camera.position.set(100, 85, 100);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 8, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = 1.48;
controls.minDistance = 15;
controls.maxDistance = 450;

scene.add(new THREE.HemisphereLight(0xbdd3ee, 0x4a4436, 0.85));
const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
sun.position.set(120, 160, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -WORLD;
sun.shadow.camera.right = WORLD;
sun.shadow.camera.top = WORLD;
sun.shadow.camera.bottom = -WORLD;
sun.shadow.camera.far = 600;
sun.shadow.bias = -0.0004;
scene.add(sun);

const fireLight = new THREE.PointLight(0xff6a1a, 0, 300, 1.8);
scene.add(fireLight);

let sim = new FireSimulation({
  size: N,
  seed: params.seed,
  humidity: params.humidite / 100,
  windSpeed: params.ventVitesse,
  windDirection: params.ventDirection,
  vegetation: params.vegetation / 100,
  slopeGain: params.effetPente / 100,
});

const half = WORLD / 2;
const cellWorld = (i, j) => [-half + (i + 0.5) * CELL, -half + (j + 0.5) * CELL];
const cellAt = (x, z) => [Math.floor((x + half) / CELL), Math.floor((z + half) / CELL)];

const terrainGeo = new THREE.PlaneGeometry(WORLD, WORLD, N - 1, N - 1);
terrainGeo.rotateX(-Math.PI / 2);
const terrainPos = terrainGeo.attributes.position;
const terrainColors = new Float32Array(N * N * 3);
terrainGeo.setAttribute('color', new THREE.BufferAttribute(terrainColors, 3));
const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
const terrain = new THREE.Mesh(terrainGeo, terrainMat);
terrain.receiveShadow = true;
scene.add(terrain);

const cellHash = new Float32Array(N * N);
for (let k = 0; k < N * N; k++) cellHash[k] = (Math.imul(k + 1, 2654435761) >>> 0) / 4294967296;

function applyHeights() {
  for (let k = 0; k < N * N; k++) terrainPos.setY(k, sim.height[k] * sim.heightScale);
  terrainPos.needsUpdate = true;
  terrainGeo.computeVertexNormals();
}

const treeGeo = new THREE.ConeGeometry(0.62, 2.4, 6);
treeGeo.translate(0, 1.2, 0);
const treeMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
const TREE_CAP = 14000;
const trees = new THREE.InstancedMesh(treeGeo, treeMat, TREE_CAP);
trees.castShadow = true;
trees.count = 0;
scene.add(trees);

const treeCell = new Int32Array(TREE_CAP);
const treeBase = new Float32Array(TREE_CAP * 3);
const treeColor = new Float32Array(TREE_CAP * 3);
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();

function buildTrees() {
  let n = 0;
  const rngSeed = params.seed;
  let s = rngSeed >>> 0;
  const rand = () => {
    s = (Math.imul(s, 1597334677) + 12345) >>> 0;
    return s / 4294967296;
  };
  for (let j = 0; j < N && n < TREE_CAP; j++) {
    for (let i = 0; i < N && n < TREE_CAP; i++) {
      const k = j * N + i;
      if (sim.fuel0[k] < 0.4 || rand() > 0.8) continue;
      const [x, z] = cellWorld(i, j);
      const scale = 0.7 + sim.fuel0[k] * 0.25 + rand() * 0.5;
      _p.set(x + (rand() - 0.5) * CELL * 1.2, sim.height[k] * sim.heightScale - 0.1, z + (rand() - 0.5) * CELL * 1.2);
      _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
      _s.setScalar(scale);
      trees.setMatrixAt(n, _m4.compose(_p, _q, _s));
      treeCell[n] = k;
      const g = 0.5 + rand() * 0.5;
      treeBase[n * 3] = 0.10 * g;
      treeBase[n * 3 + 1] = 0.38 * g;
      treeBase[n * 3 + 2] = 0.13 * g;
      treeColor[n * 3] = treeBase[n * 3];
      treeColor[n * 3 + 1] = treeBase[n * 3 + 1];
      treeColor[n * 3 + 2] = treeBase[n * 3 + 2];
      n++;
    }
  }
  trees.count = n;
  trees.instanceMatrix.needsUpdate = true;
  trees.instanceColor = new THREE.InstancedBufferAttribute(treeColor, 3);
  trees.instanceColor.needsUpdate = true;
}

applyHeights();
buildTrees();

const fireGeometry = new THREE.BufferGeometry();
const firePos = new Float32Array(FIRE_CAP * 3);
const fireCol = new Float32Array(FIRE_CAP * 3);
const fireSize = new Float32Array(FIRE_CAP);
fireGeometry.setAttribute('position', new THREE.BufferAttribute(firePos, 3).setUsage(THREE.DynamicDrawUsage));
fireGeometry.setAttribute('aColor', new THREE.BufferAttribute(fireCol, 3).setUsage(THREE.DynamicDrawUsage));
fireGeometry.setAttribute('aSize', new THREE.BufferAttribute(fireSize, 1).setUsage(THREE.DynamicDrawUsage));
fireGeometry.setDrawRange(0, 0);

const fireMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: `
    attribute float aSize;
    attribute vec3 aColor;
    varying vec3 vColor;
    void main() {
      vColor = aColor;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * (800.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    varying vec3 vColor;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.04, d);
      gl_FragColor = vec4(vColor * a, a);
    }`,
});
const firePoints = new THREE.Points(fireGeometry, fireMat);
firePoints.frustumCulled = false;
scene.add(firePoints);

const smokeGeometry = new THREE.BufferGeometry();
const smokePos = new Float32Array(SMOKE_CAP * 3);
const smokeAlpha = new Float32Array(SMOKE_CAP);
const smokeSize = new Float32Array(SMOKE_CAP);
smokeGeometry.setAttribute('position', new THREE.BufferAttribute(smokePos, 3).setUsage(THREE.DynamicDrawUsage));
smokeGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(smokeAlpha, 1).setUsage(THREE.DynamicDrawUsage));
smokeGeometry.setAttribute('aSize', new THREE.BufferAttribute(smokeSize, 1).setUsage(THREE.DynamicDrawUsage));
smokeGeometry.setDrawRange(0, 0);

const smokeMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  vertexShader: `
    attribute float aSize;
    attribute float aAlpha;
    varying float vAlpha;
    void main() {
      vAlpha = aAlpha;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * (800.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d) * vAlpha;
      gl_FragColor = vec4(vec3(0.16), a);
    }`,
});
const smokePoints = new THREE.Points(smokeGeometry, smokeMat);
smokePoints.frustumCulled = false;
scene.add(smokePoints);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downX = 0, downY = 0, downT = 0;

renderer.domElement.addEventListener('pointerdown', (e) => {
  downX = e.clientX;
  downY = e.clientY;
  downT = performance.now();
});

renderer.domElement.addEventListener('pointerup', (e) => {
  const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
  if (moved > 6 || performance.now() - downT > 600) return;
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(terrain, false)[0];
  if (!hit) return;
  const [i, j] = cellAt(hit.point.x, hit.point.z);
  const n = sim.igniteArea(i, j, 1);
  if (n > 0) {
    hintEl.classList.add('hidden');
    flashStats('Feu allumé !');
  } else {
    flashStats('Végétation trop clairsemée ou mouillée ici');
  }
});

let flashTimer = null;
function flashStats(msg) {
  statsEl.dataset.flash = msg;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => delete statsEl.dataset.flash, 2500);
}

let burnedCellCount = 0;

function updateTerrainColors(time) {
  const st = sim.state;
  const fuel = sim.fuel;
  let burned = 0;
  for (let k = 0, c = 0; k < N * N; k++, c += 3) {
    const s = st[k];
    if (s === State.BURNING) {
      const flick = 0.5 + 0.5 * Math.sin(time * 21 + cellHash[k] * 40);
      terrainColors[c] = 0.55 + flick * 0.45;
      terrainColors[c + 1] = 0.14 + flick * 0.5;
      terrainColors[c + 2] = 0.02 + flick * 0.25;
    } else if (s === State.BURNED) {
      burned++;
      const v = 0.055 + cellHash[k] * 0.05;
      terrainColors[c] = v * 1.4;
      terrainColors[c + 1] = v;
      terrainColors[c + 2] = v * 0.9;
    } else {
      const f = Math.min(1, fuel[k] * 1.5);
      const g = 0.5 + 0.5 * Math.sin(k * 0.37);
      terrainColors[c] = 0.5 * (1 - f) + (0.10 + g * 0.05) * f;
      terrainColors[c + 1] = 0.46 * (1 - f) + (0.36 + g * 0.08) * f;
      terrainColors[c + 2] = 0.33 * (1 - f) + (0.09 + g * 0.04) * f;
    }
  }
  burnedCellCount = burned;
  terrainGeo.attributes.color.needsUpdate = true;
}

function updateTreeColors(time) {
  const st = sim.state;
  const n = trees.count;
  for (let t = 0; t < n; t++) {
    const k = treeCell[t];
    const s = st[k];
    let r = treeBase[t * 3], g = treeBase[t * 3 + 1], b = treeBase[t * 3 + 2];
    if (s === State.BURNING) {
      const flick = 0.5 + 0.5 * Math.sin(time * 16 + cellHash[k] * 50);
      r = 0.9;
      g = 0.18 + flick * 0.3;
      b = 0.02;
    } else if (s === State.BURNED) {
      r = 0.08;
      g = 0.07;
      b = 0.06;
    }
    treeColor[t * 3] = r;
    treeColor[t * 3 + 1] = g;
    treeColor[t * 3 + 2] = b;
  }
  trees.instanceColor.needsUpdate = true;
}

function updateParticles(time) {
  const list = sim.burningCells;
  const wx = sim._wx, wy = sim._wy;
  const wNorm = Math.min(1, Math.hypot(wx, wy));

  let fCount = Math.min(list.length * FIRE_PARTICLES_PER_CELL, FIRE_CAP);
  const cellsF = Math.min(list.length, Math.floor(FIRE_CAP / FIRE_PARTICLES_PER_CELL));
  for (let c = 0; c < cellsF; c++) {
    const k = list[c];
    const i = k % N, j = (k / N) | 0;
    const hx = cellHash[k];
    const [x, z] = cellWorld(i, j);
    const baseY = sim.height[k] * sim.heightScale;
    const rise = 1.4 + sim.fuel0[k] * 2.6;
    for (let q = 0; q < FIRE_PARTICLES_PER_CELL; q++) {
      const idx = c * FIRE_PARTICLES_PER_CELL + q;
      if (idx >= FIRE_CAP) break;
      const life = ((time * 0.9 + hx * 7.13 + q * 2.39) % 1);
      const wob = life * (3.0 + hx * 2.0);
      const jx = Math.sin(hx * 43.7 + time * 7 + q * 2.1) * 0.25 + wx * wob;
      const jz = Math.cos(hx * 29.3 + time * 6 + q * 1.7) * 0.25 + wy * wob;
      firePos[idx * 3] = x + jx;
      firePos[idx * 3 + 1] = baseY + 0.4 + life * rise;
      firePos[idx * 3 + 2] = z + jz;
      const cool = life;
      fireCol[idx * 3] = 1.0;
      fireCol[idx * 3 + 1] = 0.75 - cool * 0.6;
      fireCol[idx * 3 + 2] = 0.25 * (1 - cool) * (1 - cool);
      fireSize[idx] = (1.4 + hx * 1.2) * (1 - life * 0.25);
    }
  }
  fireGeometry.setDrawRange(0, fCount);
  fireGeometry.attributes.position.needsUpdate = true;
  fireGeometry.attributes.aColor.needsUpdate = true;
  fireGeometry.attributes.aSize.needsUpdate = true;

  let cellsS = Math.min(list.length, SMOKE_CAP);
  for (let c = 0; c < cellsS; c++) {
    const k = list[c];
    const i = k % N, j = (k / N) | 0;
    const hx = cellHash[k];
    const [x, z] = cellWorld(i, j);
    const baseY = sim.height[k] * sim.heightScale;
    const life = (time * 0.28 + hx * 5.31) % 1;
    const drift = life * (6 + wNorm * 16);
    smokePos[c * 3] = x + wx * drift + Math.sin(hx * 17 + time + life * 5) * life * 1.5;
    smokePos[c * 3 + 1] = baseY + 2 + life * 14;
    smokePos[c * 3 + 2] = z + wy * drift + Math.cos(hx * 23 + time + life * 5) * life * 1.5;
    smokeAlpha[c] = (1 - life) * Math.min(1, life * 8) * 0.25;
    smokeSize[c] = 3 + life * 14;
  }
  smokeGeometry.setDrawRange(0, cellsS);
  smokeGeometry.attributes.position.needsUpdate = true;
  smokeGeometry.attributes.aAlpha.needsUpdate = true;
  smokeGeometry.attributes.aSize.needsUpdate = true;

  if (list.length > 0) {
    let cx = 0, cy = 0, cz = 0;
    const step = Math.max(1, Math.floor(list.length / 200));
    let cnt = 0;
    for (let c = 0; c < list.length; c += step) {
      const k = list[c];
      const [x, z] = cellWorld(k % N, (k / N) | 0);
      cx += x;
      cy += sim.height[k] * sim.heightScale;
      cz += z;
      cnt++;
    }
    fireLight.position.set(cx / cnt, cy / cnt + 6, cz / cnt);
    fireLight.intensity = Math.min(1, list.length / 120) * 900;
  } else {
    fireLight.intensity = 0;
  }
}

const gui = new GUI({ title: 'Simulateur de feux de forêt' });
const fConditions = gui.addFolder('Conditions météo');
fConditions.add(params, 'humidite', 0, 100, 1).name('Hygrométrie (%)').onChange((v) => sim.setHumidity(v / 100));
fConditions.add(params, 'ventVitesse', 0, 80, 1).name('Vent (km/h)').onChange((v) => sim.setWind(params.ventDirection, v));
fConditions.add(params, 'ventDirection', 0, 360, 5).name('Direction du vent (°)').onChange((v) => sim.setWind(v, params.ventVitesse));
const fTerrain = gui.addFolder('Terrain & végétation');
fTerrain.add(params, 'vegetation', 0, 100, 1).name('Densité végétation (%)').onChange((v) => sim.setVegetation(v / 100));
fTerrain.add(params, 'effetPente', 0, 100, 1).name('Effet de la pente (%)').onChange((v) => sim.setSlopeGain(v / 100));
const fSim = gui.addFolder('Simulation');
fSim.add(params, 'vitesse', 0, 60, 1).name('Vitesse (ticks/s)');
fSim.add(params, 'pause').name('Pause');
fSim.add({ reset: () => { sim.resetFire(); } }, 'reset').name('Réinitialiser le feu');
fSim.add({ regen: () => regen(params.seed + 1) }, 'regen').name('Nouveau terrain');
fSim.add({ ignite: () => sim.igniteArea(N / 2, N / 2, 2) }, 'ignite').name('Feu au centre');
fConditions.close();
fTerrain.close();

function regen(seed) {
  params.seed = seed;
  sim = new FireSimulation({
    size: N,
    seed,
    humidity: params.humidite / 100,
    windSpeed: params.ventVitesse,
    windDirection: params.ventDirection,
    vegetation: params.vegetation / 100,
    slopeGain: params.effetPente / 100,
  });
  applyHeights();
  buildTrees();
  updateTerrainColors(0);
  flashStats('Nouveau terrain généré');
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
let tickAccumulator = 0;
let statTimer = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  const time = clock.elapsedTime;
  if (!params.pause) {
    tickAccumulator += dt * params.vitesse;
    let guard = 0;
    while (tickAccumulator >= 1 && guard < 6) {
      sim.tick();
      tickAccumulator -= 1;
      guard++;
    }
    if (tickAccumulator > 1) tickAccumulator = 0;
  }
  updateTerrainColors(time);
  updateTreeColors(time);
  updateParticles(time);
  controls.update();
  renderer.render(scene, camera);
  statTimer += dt;
  if (statTimer > 0.25) {
    statTimer = 0;
    const total = sim.cells;
    const burnedPct = (burnedCellCount / total * 100);
    const minutes = sim.tickIndex * TICK_MINUTES;
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    statsEl.innerHTML =
      `Surface brûlée : <b>${burnedPct.toFixed(1)} %</b><br>` +
      `Foyers actifs : <b>${sim.burningCells.length}</b><br>` +
      `Temps simulé : <b>${hh}:${mm}</b>`;
  }
}

animate();
