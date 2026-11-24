import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FireSimulation, State } from '../src/simulation.js';

function extent(sim, wasmAxis) {
  const N = sim.size;
  let min = Infinity, max = -Infinity;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      if (sim.state[j * N + i] !== State.UNBURNED) {
        const pos = wasmAxis === 'x' ? i : j;
        if (pos < min) min = pos;
        if (pos > max) max = pos;
      }
    }
  }
  return { min, max };
}

test('le terrain est généré avec du relief et du combustible', () => {
  const sim = new FireSimulation({ seed: 42 });
  assert.equal(sim.cells, 128 * 128);
  let hMin = Infinity, hMax = -Infinity, fuelAvg = 0;
  for (let k = 0; k < sim.cells; k++) {
    hMin = Math.min(hMin, sim.height[k]);
    hMax = Math.max(hMax, sim.height[k]);
    fuelAvg += sim.fuel[k];
  }
  assert.ok(hMax - hMin > 0.25, 'relief trop plat');
  assert.ok(fuelAvg / sim.cells > 0.3, 'combustible moyen trop faible');
});

test('un feu au centre se propage de manière réaliste', () => {
  const sim = new FireSimulation({ seed: 7, humidity: 0.35, windSpeed: 15, vegetation: 0.75 });
  const ok = sim.igniteArea(64, 64, 1);
  assert.ok(ok > 0, "l'allumage doit réussir");
  for (let t = 0; t < 300; t++) sim.tick();
  const burned = sim.countState(State.BURNED);
  const burning = sim.countState(State.BURNING);
  const total = burned + burning;
  assert.ok(total > sim.cells * 0.03, `feu trop faible: ${(total / sim.cells * 100).toFixed(1)}%`);
  assert.ok(total < sim.cells * 0.6, `feu trop rapide: ${(total / sim.cells * 100).toFixed(1)}%`);
});

test('le vent étire le front vers le bas-vent', () => {
  const base = { seed: 7, humidity: 0.3, vegetation: 0.8, windDirection: 0 };
  const withWind = new FireSimulation({ ...base, windSpeed: 70 });
  withWind.igniteArea(64, 64, 1);
  for (let t = 0; t < 220; t++) withWind.tick();
  const ex = extent(withWind, 'x');
  const down = ex.max - 64;
  const up = 64 - ex.min;
  assert.ok(down > up + 2, `front non étiré par le vent: down=${down} up=${up}`);
});

test('très forte humidité: le feu s\'éteint rapidement', () => {
  const sim = new FireSimulation({ seed: 7, humidity: 1, windSpeed: 0, vegetation: 0.7 });
  sim.igniteArea(64, 64, 2);
  for (let t = 0; t < 200; t++) sim.tick();
  assert.equal(sim.burningCells.length, 0, 'des cellules brûlent encore');
  const burned = sim.countState(State.BURNED);
  assert.ok(burned < sim.cells * 0.01, `trop de surface brûlée: ${burned}`);
});

test('resetFire restaure l\'état initial', () => {
  const sim = new FireSimulation({ seed: 7, humidity: 0.35, windSpeed: 15 });
  sim.igniteArea(64, 64, 1);
  for (let t = 0; t < 100; t++) sim.tick();
  assert.ok(sim.countState(State.BURNED) > 0);
  sim.resetFire();
  assert.equal(sim.countState(State.BURNING), 0);
  assert.equal(sim.countState(State.BURNED), 0);
  let fuelOk = true;
  for (let k = 0; k < sim.cells; k++) fuelOk = fuelOk && Math.abs(sim.fuel[k] - sim.fuel0[k]) < 1e-6;
  assert.ok(fuelOk);
});

test('la végétation zéro supprime le combustible', () => {
  const sim = new FireSimulation({ seed: 7, vegetation: 0 });
  sim.setVegetation(0);
  let anyFuel = false;
  for (let k = 0; k < sim.cells; k++) if (sim.fuel[k] > 0.01) anyFuel = true;
  assert.ok(!anyFuel);
});
