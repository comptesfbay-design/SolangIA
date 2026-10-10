import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildBackupZip, readBackupZip } from '../js/zip.js';
import { newTask, makeBackup } from '../js/model.js';

const JSZip = createRequire(import.meta.url)('../vendor/jszip.min.js');
const bytes = (...n) => new Uint8Array(n);

function sample() {
  const data = {
    levels: [{ id: 'L1', name: 'RDC', order: 0 }],
    rooms: [{ id: 'R1', levelId: 'L1', name: 'Séjour', order: 0 }],
    lots: [{ id: 'T1', roomId: 'R1', name: 'Électricité', order: 0 }],
    tasks: [newTask({ lotId: 'T1', roomId: 'R1', title: 'Gaines tirées' })],
    meta: [{ key: 'seeded', value: true }],
    needs: [{ id: 'N1', roomId: 'R1', lotId: 'T1', name: 'Gaine ICTA Ø20', qty: 50, unit: 'm', boughtAt: null }],
    stock: [{ id: 'S1', name: 'Gaine ICTA Ø20', qty: 20, unit: 'm' }],
  };
  const photos = [{ meta: { id: 'P1', roomId: 'R1', taskId: data.tasks[0].id, caption: 'Gaines', createdAt: '2026-10-08T10:00:00Z', size: 3, thumbSize: 1 }, blob: bytes(1, 2, 3), thumb: bytes(9) }];
  const files = [{ meta: { id: 'F1', roomId: 'R1', name: 'plan RDC.pdf', type: 'application/pdf', size: 2 }, blob: bytes(7, 7) }];
  return { data, photos, files };
}

test('sauvegarde .zip : aller-retour complet (données, photos, miniatures, pièces jointes)', async () => {
  const { data, photos, files } = sample();
  const zip = buildBackupZip(JSZip, { data, photos, files, appVersion: '0.2.0' });
  const raw = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
  const r = await readBackupZip(JSZip, raw, 'uint8array');
  assert.equal(r.ok, true, r.errors?.join());
  assert.equal(r.backup.data.tasks[0].title, 'Gaines tirées');
  assert.equal(r.backup.data.needs[0].qty, 50);
  assert.equal(r.backup.data.stock[0].name, 'Gaine ICTA Ø20');
  assert.deepEqual([...r.photos[0].blob], [1, 2, 3]);
  assert.deepEqual([...r.photos[0].thumb], [9]);
  assert.equal(r.photos[0].meta.caption, 'Gaines');
  assert.deepEqual([...r.files[0].blob], [7, 7]);
  assert.deepEqual(r.missing, []);
});

test('sauvegarde .zip : photo manquante signalée, le reste est restauré', async () => {
  const { data, photos, files } = sample();
  const zip = buildBackupZip(JSZip, { data, photos, files, appVersion: '0.2.0' });
  zip.remove('photos/P1.jpg');
  const r = await readBackupZip(JSZip, await zip.generateAsync({ type: 'uint8array' }), 'uint8array');
  assert.equal(r.ok, true);
  assert.equal(r.photos.length, 0);
  assert.deepEqual(r.missing, ['Gaines']);
});

test('sauvegarde .zip : fichiers refusés avec un message clair', async () => {
  assert.match((await readBackupZip(JSZip, bytes(1, 2, 3), 'uint8array')).errors[0], /pas un \.zip/);
  const empty = await new JSZip().file('autre.txt', 'x').generateAsync({ type: 'uint8array' });
  assert.match((await readBackupZip(JSZip, empty, 'uint8array')).errors[0], /sauvegarde\.json absent/);
  const foreign = new JSZip().file('sauvegarde.json', JSON.stringify({ ...makeBackup(sample().data, '0'), app: 'autre' }));
  const r = await readBackupZip(JSZip, await foreign.generateAsync({ type: 'uint8array' }), 'uint8array');
  assert.equal(r.ok, false);
});
