// Vérifications avant mise en ligne : versions identiques et fichiers hors connexion complets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const sw = read('sw.js');
const assets = [...sw.match(/const ASSETS = \[([\s\S]*?)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

test('la version est la même dans js/version.js et sw.js', () => {
  const appVersion = read('js/version.js').match(/VERSION = '([^']+)'/)[1];
  const swVersion = sw.match(/const VERSION = '([^']+)'/)[1];
  assert.equal(swVersion, appVersion, 'Changez la version aux deux endroits');
});

test('tous les fichiers listés dans sw.js existent', () => {
  for (const a of assets.filter((x) => x !== './')) {
    assert.ok(existsSync(new URL(`../${a}`, import.meta.url)), `Fichier manquant : ${a}`);
  }
});

test('tous les modules js/ sont gardés pour le hors-connexion', () => {
  for (const f of readdirSync(new URL('../js/', import.meta.url))) {
    assert.ok(assets.includes(`./js/${f}`), `Ajoutez './js/${f}' à la liste ASSETS de sw.js`);
  }
});

test('le manifeste est en mode standalone', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.display, 'standalone');
});
