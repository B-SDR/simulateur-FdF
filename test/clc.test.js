import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyClc, KIND, KIND_COLORS, greennessToFuel } from '../src/realMap.js';

test('classification CLC : classes forestières de la palette officielle', () => {
  assert.equal(classifyClc(128, 255, 0).code, 311, 'feuillus');
  assert.equal(classifyClc(0, 166, 0).code, 312, 'conifères');
  assert.equal(classifyClc(77, 255, 0).code, 313, 'mixtes');
  assert.equal(classifyClc(166, 242, 0).code, 324, 'mutation');
});

test('classification CLC : garrigue et autres postes observés sur la Clape', () => {
  assert.equal(classifyClc(166, 230, 77).code, 323, 'sclérophylle (garrigue)');
  assert.equal(classifyClc(204, 242, 77).code, 321, 'pelouses');
  assert.equal(classifyClc(230, 128, 0).code, 221, 'vignobles');
  assert.equal(classifyClc(204, 204, 255).code, 334, 'zones brûlées');
  assert.equal(classifyClc(0, 204, 242).code, 511, 'cours d eau');
});

test('classification CLC : robustesse aux variations d anticrénelage', () => {
  for (const c of [
    [165, 231, 78],
    [164, 233, 79],
    [165, 232, 78],
    [0, 165, 0],
    [0, 167, 0],
  ]) {
    const e = classifyClc(...c);
    assert.ok([323, 321, 312].includes(e.code), c.join(',') + ' → ' + e.code);
  }
});

test('niveaux de combustible cohérents avec l inflammabilité', () => {
  const pine = classifyClc(0, 166, 0);
  const leaf = classifyClc(128, 255, 0);
  const garrigue = classifyClc(166, 230, 77);
  const vine = classifyClc(230, 128, 0);
  const city = classifyClc(230, 0, 77);
  const water = classifyClc(0, 204, 242);
  assert.ok(pine.fuel > leaf.fuel, 'résineux plus inflammables que feuillus');
  assert.ok(leaf.fuel > garrigue.fuel, 'forêt dense > garrigue');
  assert.ok(garrigue.fuel > vine.fuel, 'garrigue > vignoble');
  assert.ok(vine.fuel < 0.2, 'vigne peu combustible');
  assert.ok(city.fuel < 0.1, 'urbain quasi incombustible');
  assert.equal(water.fuel, 0, 'eau non combustible');
  assert.equal(water.kind, KIND.WATER);
});

test('couleurs de rendu définies pour chaque type de couvert', () => {
  for (const k of Object.values(KIND)) {
    assert.ok(KIND_COLORS[k], 'couleur manquante pour kind ' + k);
    assert.equal(KIND_COLORS[k].length, 3);
  }
});
