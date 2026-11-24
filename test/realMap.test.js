import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lonToTileX,
  latToTileY,
  tileToLon,
  tileToLatN,
  mercXFromLon,
  lonFromMercX,
  mercYFromLat,
  latFromMercY,
  decodeTerrarium,
  chooseZoom,
  greennessToFuel,
} from '../src/realMap.js';

test('projection Mercator : aller-retour latitude/longitude', () => {
  for (const lat of [43.155, 44.088, 0, -30, 60]) {
    const my = mercYFromLat(lat);
    assert.ok(Math.abs(latFromMercY(my) - lat) < 1e-9, 'lat ' + lat);
  }
  for (const lon of [3.13, -2.9, 0, 170]) {
    assert.ok(Math.abs(lonFromMercX(mercXFromLon(lon)) - lon) < 1e-9);
  }
});

test('coordonnées de tuiles connues pour la Clape (z13)', () => {
  const tx = lonToTileX(3.13, 13);
  const ty = latToTileY(43.16, 13);
  assert.ok(Math.abs(tx - 4167.2249) < 0.001, 'tx=' + tx);
  assert.ok(Math.abs(ty - 3005.4) < 0.5, 'ty=' + ty);
  assert.ok(Math.floor(tx) === 4167 && Math.floor(ty) === 3005);
});

test('latitudes de tuiles : cohérence avec latToTileY', () => {
  const z = 13;
  for (const ty of [3004, 3005, 3006]) {
    const lat = tileToLatN(ty, z);
    assert.ok(Math.abs(latToTileY(lat, z) - ty) < 1e-9, 'tuile ' + ty);
  }
});

test('décode Terrarium : formule validée', () => {
  assert.equal(decodeTerrarium(0, 0, 0), -32768);
  assert.equal(decodeTerrarium(128, 0, 0), 0);
  assert.equal(decodeTerrarium(136, 0, 0), 2048);
  assert.equal(decodeTerrarium(0, 128, 0), -32640);
  assert.equal(decodeTerrarium(128, 128, 0), 128);
  assert.ok(Math.abs(decodeTerrarium(128, 128, 128) - 128.5) < 1e-9);
  assert.ok(Math.abs(decodeTerrarium(0, 0, 128) - (-32767.5)) < 1e-9);
});

test('choix du niveau de zoom selon la taille de zone', () => {
  assert.equal(chooseZoom(13691), 14);
  assert.equal(chooseZoom(200000), 10);
  assert.equal(chooseZoom(10000000), 9);
  assert.equal(chooseZoom(500), 15);
});

test('estimation du combustible par couleur : catégories', () => {
  const sea = greennessToFuel(30, 70, 110);
  assert.equal(sea, 0, 'la mer ne doit pas brûler');
  const forest = greennessToFuel(60, 85, 55);
  assert.ok(forest > 0.6, 'forêt dense : ' + forest);
  const garrigue = greennessToFuel(85, 92, 70);
  assert.ok(garrigue > 0.35 && garrigue < 0.75, 'garrigue : ' + garrigue);
  const rock = greennessToFuel(150, 148, 140);
  assert.ok(rock < 0.3, 'roche claire : ' + rock);
  const city = greennessToFuel(175, 175, 170);
  assert.ok(city < 0.2, 'zone urbaine : ' + city);
});
