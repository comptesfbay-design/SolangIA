import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CATALOGUE, progress, moveItem, nextOrder, newTask, newLot, structureForNewRoom,
  setStatus, toggleDone, copyStructure, makeBackup, validateBackup, normalizeBackup, daysSince, backupFileName,
  syncParent, applyStatusChange, parseNotes, fitSize, mediaStats, inPeriod, filePath,
} from '../js/model.js';

const task = (id, status = 'todo', extra = {}) => ({ id, status, parentId: null, ...extra });

test('avancement : liste vide = 0 %', () => {
  assert.deepEqual(progress([]), { done: 0, total: 0, pct: 0 });
});

test('avancement : compte les tâches faites', () => {
  assert.deepEqual(progress([task('a', 'done'), task('b'), task('c', 'blocked'), task('d', 'done')]), { done: 2, total: 4, pct: 50 });
});

test('avancement : une tâche avec sous-tâches est remplacée par ses sous-tâches', () => {
  const tasks = [task('p', 'done'), task('c1', 'done', { parentId: 'p' }), task('c2', 'todo', { parentId: 'p' }), task('x', 'todo')];
  assert.deepEqual(progress(tasks), { done: 1, total: 3, pct: 33 });
});

test('avancement : 100 % seulement si tout est fait', () => {
  const tasks = Array.from({ length: 200 }, (_, i) => task(String(i), i === 0 ? 'todo' : 'done'));
  assert.equal(progress(tasks).pct, 99);
});

test('cocher / décocher met à jour la date « fait le »', () => {
  const now = new Date('2026-10-08T10:00:00Z');
  const t = newTask({ lotId: 'l', roomId: 'r', title: ' Gaines tirées ' });
  assert.equal(t.title, 'Gaines tirées');
  const done = toggleDone(t, now);
  assert.equal(done.status, 'done');
  assert.equal(done.doneAt, now.toISOString());
  const undone = toggleDone(done, now);
  assert.equal(undone.status, 'todo');
  assert.equal(undone.doneAt, null);
});

test('repasser « fait » sur une tâche déjà faite garde la date d’origine', () => {
  const t = { ...newTask({ lotId: 'l', roomId: 'r', title: 'x' }), status: 'done', doneAt: '2026-01-01T00:00:00.000Z' };
  assert.equal(setStatus(t, 'done').doneAt, '2026-01-01T00:00:00.000Z');
  assert.throws(() => setStatus(t, 'inconnu'));
});

test('modèle par défaut : 8 lots auto dans l’ordre du chantier, 3 à 6 tâches chacun', () => {
  const auto = DEFAULT_CATALOGUE.filter((e) => e.auto);
  assert.equal(auto.length, 8);
  assert.match(auto[0].name, /^Électricité/);
  assert.equal(auto[7].name, 'Finition électricité');
  for (const e of DEFAULT_CATALOGUE) assert.ok(e.tasks.length >= 3 && e.tasks.length <= 6, e.name);
  assert.equal(new Set(DEFAULT_CATALOGUE.map((e) => e.key)).size, DEFAULT_CATALOGUE.length);
});

test('nouvelle pièce : seuls les lots auto sont ajoutés, reliés à la pièce', () => {
  const { lots, tasks } = structureForNewRoom('room1', DEFAULT_CATALOGUE);
  assert.equal(lots.length, 8);
  assert.deepEqual(lots.map((l) => l.order), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.ok(lots.every((l) => l.roomId === 'room1'));
  const lotIds = new Set(lots.map((l) => l.id));
  assert.ok(tasks.every((t) => t.roomId === 'room1' && lotIds.has(t.lotId) && t.status === 'todo'));
});

test('déplacer : échange avec le voisin et ne renvoie que ce qui change', () => {
  const items = [{ id: 'a', order: 0 }, { id: 'b', order: 1 }, { id: 'c', order: 2 }];
  assert.deepEqual(moveItem(items, 'c', -1), [{ id: 'c', order: 1 }, { id: 'b', order: 2 }]);
  assert.deepEqual(moveItem(items, 'a', -1), []);
  assert.deepEqual(moveItem(items, 'c', 1), []);
  assert.equal(nextOrder(items), 3);
  assert.equal(nextOrder([]), 0);
});

test('copier la structure : ajoute ce qui manque, sans doublon ni suppression', () => {
  const sLot1 = newLot({ roomId: 'src', name: 'Bandes', order: 0 });
  const sLot2 = newLot({ roomId: 'src', name: 'VMC', order: 1 });
  const parent = { ...newTask({ lotId: sLot1.id, roomId: 'src', title: 'Ponçage', order: 1 }), status: 'done' };
  const source = {
    lots: [sLot1, sLot2],
    tasks: [
      newTask({ lotId: sLot1.id, roomId: 'src', title: 'Bandes posées', order: 0 }),
      parent,
      newTask({ lotId: sLot1.id, roomId: 'src', title: 'Grain 120', parentId: parent.id }),
      newTask({ lotId: sLot2.id, roomId: 'src', title: 'Bouches posées' }),
    ],
  };
  const tLot = newLot({ roomId: 'dst', name: 'bandes ', order: 0 });
  const target = { roomId: 'dst', lots: [tLot], tasks: [newTask({ lotId: tLot.id, roomId: 'dst', title: 'Bandes posées' })] };

  const res = copyStructure({ source, target });
  assert.deepEqual(res.lots.map((l) => [l.name, l.roomId, l.order]), [['VMC', 'dst', 1]]);
  assert.deepEqual(res.tasks.map((t) => t.title), ['Ponçage', 'Grain 120', 'Bouches posées']);
  assert.ok(res.tasks.every((t) => t.status === 'todo' && t.roomId === 'dst'));
  const copiedParent = res.tasks.find((t) => t.title === 'Ponçage');
  assert.equal(copiedParent.lotId, tLot.id);
  assert.equal(res.tasks.find((t) => t.title === 'Grain 120').parentId, copiedParent.id);
});

function sampleData() {
  const level = { id: 'L1', name: 'RDC', order: 0 };
  const room = { id: 'R1', levelId: 'L1', name: 'Séjour', order: 0 };
  const lot = { id: 'T1', roomId: 'R1', name: 'Bandes', order: 0 };
  const t = newTask({ lotId: 'T1', roomId: 'R1', title: 'Bandes posées' });
  return { levels: [level], rooms: [room], lots: [lot], tasks: [t], meta: [{ key: 'seeded', value: true }], photos: [], files: [] };
}

test('sauvegarde : un ancien fichier V0 (format 1, sans photos) reste accepté', () => {
  const { photos, files, ...v0data } = sampleData();
  const old = { ...makeBackup(v0data, '0.1.0'), format: 1 };
  assert.equal(validateBackup(old).ok, false);
  const r = validateBackup(normalizeBackup(old));
  assert.deepEqual(r, { ok: true, errors: [] });
});

test('sauvegarde : un fichier produit par l’app est accepté', () => {
  const b = JSON.parse(JSON.stringify(makeBackup(sampleData(), '0.1.0')));
  assert.deepEqual(validateBackup(b), { ok: true, errors: [] });
});

test('sauvegarde : fichiers invalides refusés avec un message', () => {
  assert.equal(validateBackup(null).ok, false);
  assert.equal(validateBackup({ ...makeBackup(sampleData(), '0.1.0'), app: 'autre' }).ok, false);
  assert.equal(validateBackup({ ...makeBackup(sampleData(), '0.1.0'), format: 99 }).ok, false);
  const missing = makeBackup({ ...sampleData(), tasks: undefined }, '0.1.0');
  assert.match(validateBackup(missing).errors.join(), /tasks/);
  const broken = sampleData();
  broken.tasks[0].lotId = 'inexistant';
  const r = validateBackup(makeBackup(broken, '0.1.0'));
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /1 tâche/);
});

test('rappel de sauvegarde : nombre de jours écoulés', () => {
  const now = new Date('2026-10-08T12:00:00Z');
  assert.equal(daysSince('2026-10-01T12:00:00Z', now), 7);
  assert.equal(daysSince('2026-09-30T11:00:00Z', now), 8);
  assert.equal(daysSince(null, now), Infinity);
});

test('nom du fichier de sauvegarde', () => {
  assert.equal(backupFileName(new Date(2026, 9, 8, 7, 5)), 'suivi-chantier-2026-10-08-07h05.zip');
  assert.equal(backupFileName(new Date(2026, 9, 8, 7, 5), 'json'), 'suivi-chantier-2026-10-08-07h05.json');
});

// ---------- Sous-tâches ----------

function family() {
  const parent = newTask({ lotId: 'L', roomId: 'R', title: 'Ponçage' });
  const a = newTask({ lotId: 'L', roomId: 'R', title: 'Grain 80', parentId: parent.id });
  const b = newTask({ lotId: 'L', roomId: 'R', title: 'Grain 120', parentId: parent.id });
  const other = newTask({ lotId: 'L', roomId: 'R', title: 'Autre' });
  return { parent, a, b, other, all: [parent, a, b, other] };
}

test('sous-tâche : cocher la dernière coche aussi la tâche principale', () => {
  const f = family();
  const step1 = applyStatusChange(f.a, f.all, 'done');
  assert.deepEqual(step1.map((t) => [t.title, t.status]), [['Grain 80', 'done']]);
  const all2 = f.all.map((t) => step1.find((x) => x.id === t.id) ?? t);
  const step2 = applyStatusChange(f.b, all2, 'done');
  assert.deepEqual(step2.map((t) => [t.title, t.status]), [['Grain 120', 'done'], ['Ponçage', 'done']]);
});

test('sous-tâche : décocher une sous-tâche décoche la tâche principale', () => {
  const f = family();
  const done = f.all.map((t) => (t.id === f.other.id ? t : setStatus(t, 'done')));
  const res = applyStatusChange(done[1], done, 'todo');
  assert.deepEqual(res.map((t) => [t.title, t.status]), [['Grain 80', 'todo'], ['Ponçage', 'todo']]);
});

test('tâche principale : cocher coche toutes ses sous-tâches, décocher les décoche', () => {
  const f = family();
  const res = applyStatusChange(f.parent, f.all, 'done');
  assert.deepEqual(res.map((t) => t.status), ['done', 'done', 'done']);
  const after = f.all.map((t) => res.find((x) => x.id === t.id) ?? t);
  const back = applyStatusChange(after[0], after, 'todo');
  assert.deepEqual(back.map((t) => t.status), ['todo', 'todo', 'todo']);
  assert.equal(applyStatusChange(f.parent, f.all, 'blocked').length, 1);
});

test('tâche sans sous-tâche : changement simple', () => {
  const f = family();
  const res = applyStatusChange(f.other, f.all, 'doing');
  assert.deepEqual(res.map((t) => [t.title, t.status]), [['Autre', 'doing']]);
  assert.equal(syncParent(f.other, []), f.other);
});

// ---------- Notes, photos, galerie ----------

test('notes : titres, listes et paragraphes', () => {
  assert.deepEqual(parseNotes('# Prises\n- 2 doubles\n- 1 RJ45\n\nVoir plan\n## Éclairage\n* spots'), [
    { type: 'title', text: 'Prises' },
    { type: 'list', items: ['2 doubles', '1 RJ45'] },
    { type: 'text', text: 'Voir plan' },
    { type: 'title', text: 'Éclairage' },
    { type: 'list', items: ['spots'] },
  ]);
  assert.deepEqual(parseNotes(''), []);
  assert.deepEqual(parseNotes(undefined), []);
});

test('photos : réduction au côté long, jamais d’agrandissement', () => {
  assert.deepEqual(fitSize(4032, 3024, 1600), { width: 1600, height: 1200 });
  assert.deepEqual(fitSize(3024, 4032, 1600), { width: 1200, height: 1600 });
  assert.deepEqual(fitSize(800, 600, 1600), { width: 800, height: 600 });
  assert.deepEqual(fitSize(1600, 1200, 300), { width: 300, height: 225 });
});

test('photos : poids total', () => {
  assert.deepEqual(mediaStats([{ size: 300, thumbSize: 20 }, { size: 100 }]), { count: 2, bytes: 420 });
});

test('galerie : filtre de dates', () => {
  const now = new Date('2026-10-08T12:00:00');
  assert.equal(inPeriod('2026-10-02T12:00:00', '', now), true);
  assert.equal(inPeriod('2026-10-02T12:00:00', '7', now), true);
  assert.equal(inPeriod('2026-09-20T12:00:00', '7', now), false);
  assert.equal(inPeriod('2026-09-20T12:00:00', '30', now), true);
  assert.equal(inPeriod('2026-09-20T12:00:00', 'm:2026-09', now), true);
  assert.equal(inPeriod('2026-10-01T12:00:00', 'm:2026-09', now), false);
});

test('pièces jointes : nom de fichier sans caractères interdits', () => {
  assert.equal(filePath({ id: 'x1', name: 'Plan RDC: v2/final?.pdf' }), 'fichiers/x1-Plan RDC_ v2_final_.pdf');
});
