// Point d'entrée de l'application : écrans, navigation et actions.
import * as db from './db.js';
import {
  DEFAULT_CATALOGUE, DEFAULT_FINISHES, DEFAULT_PHOTO_SETTINGS, SEED_LEVELS, STATUSES, STATUS_LABELS, STATUS_ICONS, PHOTO_PHASES,
  uid, groupBy, progress, sortByOrder, nextOrder, moveItem, newRoom, newLot, newTask, lotFromTemplate,
  structureForNewRoom, setStatus, syncParent, applyStatusChange, copyStructure, parseNotes, mediaStats, inPeriod,
  daysSince, dayKey, formatDate, formatDay, formatBytes,
} from './model.js';
import { h, sheet, askText, confirmBox, choose, toast, longPress } from './ui.js';
import { prepareExport, deliverFile, markBackupDone, readBackupFile, applyBackup, countReplacedMedia } from './backup.js';
import { photoButtons, thumbGrid, openViewer, openAttachment, addAttachments } from './photos.js';
import { VERSION } from './version.js';

const APP_NAME = 'Suivi chantier';
const BACKUP_REMINDER_DAYS = 7;

const $ = (id) => document.getElementById(id);
const main = $('main');
const ui = {
  organise: false, openLots: new Map(), back: null, updating: false,
  roomPhase: 'initial', editNotes: null, gallery: { room: '', lot: '', period: '' },
};
let swRegistration = null;
let waitingWorker = null;

start();

async function start() {
  applyTheme(readTheme());
  $('back').addEventListener('click', () => go(ui.back ?? '#/'));
  window.addEventListener('hashchange', () => render());
  try {
    await seedIfEmpty();
  } catch (e) {
    showError(e);
    return;
  }
  requestPersistentStorage();
  registerServiceWorker();
  render();
}

// ---------- Navigation ----------

let renderSeq = 0;

async function render({ keepScroll = false } = {}) {
  const seq = ++renderSeq;
  const [, view, id] = (location.hash || '#/').split('/');
  let page;
  try {
    if (view === 'piece' && id) page = await viewRoom(decodeURIComponent(id));
    else if (view === 'photos') page = await viewGallery();
    else if (view === 'reglages') page = await viewSettings();
    else page = await viewHome();
  } catch (e) {
    console.error(e);
    page = errorPage(e);
  }
  if (seq !== renderSeq) return; // un autre affichage a été demandé entre-temps
  const scroller = $('scroller');
  const y = scroller.scrollTop;
  $('title').textContent = page.title;
  document.title = page.title === APP_NAME ? APP_NAME : `${page.title} · ${APP_NAME}`;
  ui.back = page.back ?? null;
  $('back').hidden = !page.back;
  $('hdr-actions').replaceChildren(...(page.actions ?? []));
  main.replaceChildren(...page.nodes.flat(Infinity).filter((n) => n instanceof Node));
  scroller.scrollTop = keepScroll ? y : 0;
  const tab = { reglages: 'settings', photos: 'photos' }[view] ?? 'home';
  for (const a of document.querySelectorAll('.tabbar a')) {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  renderBanners();
}

const refresh = () => render({ keepScroll: true });

function go(hash) {
  if ((location.hash || '#/') === hash) refresh();
  else location.hash = hash;
}

function errorPage(e) {
  return {
    title: 'Erreur', back: '#/', nodes: [h('section', { class: 'card' },
      h('h2', null, 'Un problème est survenu'),
      h('p', null, String(e?.message ?? e)),
      h('p', { class: 'muted' }, 'Vos données ne sont pas effacées. Fermez puis rouvrez l’application.'))],
  };
}

function showError(e) {
  const p = errorPage(e);
  $('title').textContent = p.title;
  main.replaceChildren(...p.nodes);
}

async function renderBanners() {
  const nodes = [];
  if (waitingWorker) {
    nodes.push(h('div', { class: 'banner info' },
      h('span', null, '🔄 Nouvelle version disponible.'),
      h('button', { class: 'btn small primary', onclick: applyUpdate }, 'Mettre à jour')));
  }
  if (isIOS() && !isStandalone()) {
    nodes.push(h('div', { class: 'banner info' },
      h('span', null, '📲 Pour installer l’app : bouton Partager de Safari, puis « Sur l’écran d’accueil ».')));
  }
  const [last, created] = await Promise.all([db.getMeta('lastBackupAt', null), db.getMeta('createdAt', null)]);
  const days = daysSince(last ?? created);
  if (days > BACKUP_REMINDER_DAYS) {
    nodes.push(h('div', { class: 'banner warn' },
      h('span', null, last ? `⚠️ Dernière sauvegarde il y a ${days} jours.` : '⚠️ Aucune sauvegarde faite pour l’instant.'),
      h('a', { class: 'btn small', href: '#/reglages' }, 'Sauvegarder')));
  }
  $('banners').replaceChildren(...nodes);
}

// ---------- Premier lancement ----------

async function seedIfEmpty() {
  if (await db.getMeta('seeded', false)) return;
  const catalogue = JSON.parse(JSON.stringify(DEFAULT_CATALOGUE));
  const ops = [];
  SEED_LEVELS.forEach((lv, li) => {
    const level = { id: uid(), name: lv.name, order: li };
    ops.push({ store: 'levels', put: level });
    lv.rooms.forEach((name, ri) => {
      const room = newRoom({ levelId: level.id, name, order: ri });
      const s = structureForNewRoom(room.id, catalogue);
      ops.push({ store: 'rooms', put: room }, ...db.putOps('lots', s.lots), ...db.putOps('tasks', s.tasks));
    });
  });
  const meta = { catalogue, finishes: [...DEFAULT_FINISHES], createdAt: new Date().toISOString(), seeded: true };
  ops.push(...Object.entries(meta).map(([key, value]) => ({ store: 'meta', put: { key, value } })));
  await db.write(ops);
}

async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch { /* non disponible */ }
}

// ---------- Écran Accueil ----------

async function viewHome() {
  const [levels, rooms, tasks] = await Promise.all([db.all('levels'), db.all('rooms'), db.all('tasks')]);
  const sortedLevels = sortByOrder(levels);
  const roomsByLevel = groupBy(rooms, 'levelId');
  const tasksByRoom = groupBy(tasks, 'roomId');
  const roomName = Object.fromEntries(rooms.map((r) => [r.id, r.name]));
  const total = progress(tasks);
  const blocked = tasks.filter((t) => t.status === 'blocked');

  return {
    title: APP_NAME,
    actions: [h('button', {
      class: `btn small${ui.organise ? ' primary' : ''}`,
      onclick: () => { ui.organise = !ui.organise; refresh(); },
    }, ui.organise ? 'Terminé' : 'Organiser')],
    nodes: [
      h('section', { class: 'card hero' },
        h('div', { class: 'hero-pct' }, `${total.pct} %`),
        bar(total.pct),
        h('p', { class: 'muted' }, `${total.done} tâche(s) faite(s) sur ${total.total}`)),
      blocked.length ? h('section', { class: 'card' },
        h('h2', null, `⛔ Tâches bloquées (${blocked.length})`),
        h('ul', { class: 'list' }, blocked.map((t) => h('li', null,
          h('a', { class: 'row-link', href: `#/piece/${t.roomId}` },
            h('span', null, t.title), h('span', { class: 'muted' }, roomName[t.roomId] ?? '?')))))) : null,
      ui.organise ? h('p', { class: 'muted' }, 'Mode organisation : déplacez (↑ ↓), renommez (✏️) ou supprimez (🗑) les niveaux et les pièces.') : null,
      sortedLevels.map((level) => levelSection(level, roomsByLevel[level.id] ?? [], tasksByRoom, levels)),
      ui.organise ? h('button', { class: 'btn block', onclick: () => addLevel(levels) }, '+ Ajouter un niveau') : null,
    ],
  };
}

function levelSection(level, rooms, tasksByRoom, levels) {
  const p = progress(rooms.flatMap((r) => tasksByRoom[r.id] ?? []));
  return h('section', { class: 'card' },
    h('div', { class: 'level-head' }, h('h2', null, level.name), h('span', { class: 'pct' }, `${p.pct} %`)),
    bar(p.pct),
    ui.organise ? h('div', { class: 'tools' },
      toolBtn('↑', 'Monter le niveau', () => move('levels', levels, level.id, -1)),
      toolBtn('↓', 'Descendre le niveau', () => move('levels', levels, level.id, 1)),
      toolBtn('✏️', 'Renommer le niveau', () => renameItem('levels', level, 'Renommer le niveau')),
      toolBtn('🗑', 'Supprimer le niveau', () => deleteLevel(level, rooms))) : null,
    rooms.length
      ? h('ul', { class: 'list' }, sortByOrder(rooms).map((room) => roomRow(room, tasksByRoom[room.id] ?? [], rooms)))
      : h('p', { class: 'muted' }, ui.organise ? 'Aucune pièce.' : 'Aucune pièce. Touchez « Organiser » pour en ajouter.'),
    ui.organise ? h('button', { class: 'btn block', onclick: () => addRoom(level, rooms) }, '+ Ajouter une pièce') : null);
}

function roomRow(room, tasks, siblings) {
  if (ui.organise) {
    return h('li', { class: 'row wrap' },
      h('span', { class: 'grow' }, room.name),
      toolBtn('↑', 'Monter', () => move('rooms', siblings, room.id, -1)),
      toolBtn('↓', 'Descendre', () => move('rooms', siblings, room.id, 1)),
      toolBtn('✏️', 'Renommer', () => renameItem('rooms', room, 'Renommer la pièce')),
      toolBtn('🗑', 'Supprimer', () => deleteRoom(room)));
  }
  const p = progress(tasks);
  return h('li', null, h('a', { class: 'row-link', href: `#/piece/${room.id}` },
    h('span', null, room.name, room.finish ? h('span', { class: 'badge finish' }, `Finition ${room.finish}`) : null),
    h('span', { class: 'pct' }, `${p.pct} %`),
    bar(p.pct, 'thin')));
}

async function addLevel(levels) {
  const name = await askText({ title: 'Nouveau niveau', label: 'Nom (ex. Combles, Garage…)' });
  if (!name) return;
  await db.put('levels', { id: uid(), name, order: nextOrder(levels) });
  refresh();
}

async function addRoom(level, rooms) {
  const name = await askText({ title: `Nouvelle pièce — ${level.name}`, label: 'Nom de la pièce' });
  if (!name) return;
  const catalogue = await db.getMeta('catalogue', []);
  const room = newRoom({ levelId: level.id, name, order: nextOrder(rooms) });
  const s = structureForNewRoom(room.id, catalogue);
  await db.write([{ store: 'rooms', put: room }, ...db.putOps('lots', s.lots), ...db.putOps('tasks', s.tasks)]);
  toast(`Pièce créée avec ${s.lots.length} lot(s)`);
  refresh();
}

// Met à la corbeille les photos et pièces jointes des pièces supprimées.
async function trashRoomsMedia(roomIds, reason) {
  const [photos, files] = await Promise.all([db.activeMedia('photos'), db.activeMedia('files')]);
  await db.trashMedia('photos', photos.filter((p) => roomIds.has(p.roomId)), reason);
  await db.trashMedia('files', files.filter((f) => roomIds.has(f.roomId)), reason);
}

async function deleteLevel(level, rooms) {
  const roomIds = new Set(rooms.map((r) => r.id));
  const [lots, tasks] = await Promise.all([db.all('lots'), db.all('tasks')]);
  const lotsToDelete = lots.filter((l) => roomIds.has(l.roomId));
  const tasksToDelete = tasks.filter((t) => roomIds.has(t.roomId));
  const ok = await confirmBox({
    title: 'Supprimer le niveau ?',
    message: `« ${level.name} » sera supprimé avec ses ${rooms.length} pièce(s) et ${tasksToDelete.length} tâche(s).\n\nUne copie de sécurité automatique est faite avant (Réglages → Copies de sécurité). Les photos vont à la corbeille.`,
    ok: 'Supprimer', danger: true,
  });
  if (!ok) return;
  await db.saveSnapshot(`Avant suppression du niveau « ${level.name} »`);
  await trashRoomsMedia(roomIds, `Niveau supprimé : ${level.name}`);
  await db.write([{ store: 'levels', del: level.id }, ...db.delOps('rooms', rooms), ...db.delOps('lots', lotsToDelete), ...db.delOps('tasks', tasksToDelete)]);
  toast('Niveau supprimé');
  refresh();
}

async function deleteRoom(room) {
  const [lots, tasks] = await Promise.all([db.byIndex('lots', 'roomId', room.id), db.byIndex('tasks', 'roomId', room.id)]);
  const ok = await confirmBox({
    title: 'Supprimer la pièce ?',
    message: `« ${room.name} » sera supprimée avec ses ${lots.length} lot(s) et ${tasks.length} tâche(s).\n\nUne copie de sécurité automatique est faite avant (Réglages → Copies de sécurité). Les photos vont à la corbeille.`,
    ok: 'Supprimer', danger: true,
  });
  if (!ok) return;
  await db.saveSnapshot(`Avant suppression de la pièce « ${room.name} »`);
  await trashRoomsMedia(new Set([room.id]), `Pièce supprimée : ${room.name}`);
  await db.write([{ store: 'rooms', del: room.id }, ...db.delOps('lots', lots), ...db.delOps('tasks', tasks)]);
  toast('Pièce supprimée');
  go('#/');
}

// Supprime des tâches (avec copie de sécurité) et met leurs photos à la corbeille.
async function deleteTasks(tasks, label) {
  if (!tasks.length) return;
  const ids = new Set(tasks.map((t) => t.id));
  const photos = (await db.activeMedia('photos', 'roomId', tasks[0].roomId)).filter((p) => ids.has(p.taskId));
  await db.saveSnapshot(`Avant suppression de ${label}`);
  await db.trashMedia('photos', photos, `Supprimée avec ${label}`);
  await db.write(db.delOps('tasks', tasks));
}

// ---------- Écran Pièce ----------

async function viewRoom(id) {
  const room = await db.get('rooms', id);
  if (!room) return { title: 'Pièce introuvable', back: '#/', nodes: [h('p', { class: 'card' }, 'Cette pièce n’existe plus.')] };
  const [level, lots, tasks, catalogue, finishes, photos, files] = await Promise.all([
    db.get('levels', room.levelId), db.byIndex('lots', 'roomId', id), db.byIndex('tasks', 'roomId', id),
    db.getMeta('catalogue', []), db.getMeta('finishes', DEFAULT_FINISHES),
    db.activeMedia('photos', 'roomId', id), db.activeMedia('files', 'roomId', id),
  ]);
  const sortedLots = sortByOrder(lots);
  const tasksByLot = groupBy(tasks, 'lotId');
  const photosByTask = groupBy(photos.filter((p) => p.taskId), 'taskId');
  const firstUnfinished = sortedLots.find((l) => progress(tasksByLot[l.id] ?? []).pct < 100);
  const p = progress(tasks);

  const finishSelect = h('select', {
    class: 'field', 'aria-label': 'Finition peinture',
    onchange: (e) => updateRecord('rooms', room.id, (r) => ({ ...r, finish: e.target.value })),
  }, h('option', { value: '' }, '—'), [...new Set([...finishes, room.finish].filter(Boolean))].map((f) => h('option', { value: f }, f)));
  finishSelect.value = room.finish ?? '';

  return {
    title: room.name,
    back: '#/',
    nodes: [
      h('section', { class: 'card' },
        h('div', { class: 'level-head' }, h('span', { class: 'muted' }, level?.name ?? ''), h('span', { class: 'pct' }, `${p.pct} %`)),
        bar(p.pct),
        h('p', { class: 'muted small' }, `${p.done} / ${p.total} tâche(s) faite(s) · appui long sur une tâche pour changer son statut`),
        h('label', { class: 'inline-field' }, 'Finition peinture', finishSelect)),
      sortedLots.map((lot) => lotSection(lot, tasksByLot[lot.id] ?? [], sortedLots, lot === firstUnfinished, photosByTask)),
      lots.length ? null : h('p', { class: 'card muted' }, 'Aucun lot dans cette pièce.'),
      h('div', { class: 'stack' },
        h('button', { class: 'btn block', onclick: () => addLotToRoom(room, lots, catalogue) }, '+ Ajouter un lot'),
        h('button', { class: 'btn block', onclick: () => copyRoomStructure(room, lots, tasks) }, '⧉ Copier la structure vers une autre pièce')),
      roomPhotosSection(room, photos, tasks),
      attachmentsSection(room, files),
      notesSection(room),
      h('div', { class: 'stack' },
        h('button', { class: 'btn block', onclick: () => renameItem('rooms', room, 'Renommer la pièce') }, 'Renommer la pièce'),
        h('button', { class: 'btn block danger', onclick: () => deleteRoom(room) }, 'Supprimer la pièce')),
    ],
  };
}

function lotSection(lot, tasks, sortedLots, openByDefault, photosByTask) {
  const p = progress(tasks);
  const open = ui.openLots.has(lot.id) ? ui.openLots.get(lot.id) : openByDefault;
  const top = sortByOrder(tasks.filter((t) => !t.parentId));
  const childrenOf = groupBy(tasks.filter((t) => t.parentId), 'parentId');
  const details = h('details', { class: 'card lot', open },
    h('summary', null,
      h('span', { class: 'lot-name' }, lot.name),
      h('span', { class: 'lot-count' }, `${p.done}/${p.total}`),
      bar(p.pct, 'thin')),
    h('div', { class: 'lot-body' },
      h('form', {
        class: 'quick-add',
        onsubmit: async (e) => {
          e.preventDefault();
          const title = e.target.elements.title.value.trim();
          if (!title) return;
          await db.put('tasks', newTask({ lotId: lot.id, roomId: lot.roomId, title, order: nextOrder(top) }));
          refresh();
        },
      },
      h('input', { class: 'field', name: 'title', placeholder: 'Nouvelle tâche…', enterkeyhint: 'done', autocomplete: 'off' }),
      h('button', { class: 'btn primary', type: 'submit', 'aria-label': 'Ajouter la tâche' }, '+')),
      h('ul', { class: 'tasks' }, top.map((t) => {
        const children = sortByOrder(childrenOf[t.id] ?? []);
        return [
          taskRow(t, { children, photoCount: photosByTask[t.id]?.length ?? 0 }),
          children.map((c) => taskRow(c, { sub: true, photoCount: photosByTask[c.id]?.length ?? 0 })),
        ];
      })),
      h('button', { class: 'btn small ghost', onclick: () => lotMenu(lot, sortedLots, tasks) }, '⋯ Options du lot')));
  details.addEventListener('toggle', () => ui.openLots.set(lot.id, details.open));
  return details;
}

function taskRow(t, { children = [], photoCount = 0, sub = false } = {}) {
  const done = t.status === 'done';
  const sp = children.length ? progress(children) : null;
  const li = h('li', { class: `task st-${t.status}${sub ? ' sub' : ''}` },
    h('button', {
      class: 'check', role: 'checkbox', 'aria-checked': String(done), 'aria-label': `Fait : ${t.title}`,
      onclick: () => changeStatus(t.id, done ? 'todo' : 'done'),
    }, h('span', { class: 'box' }, done ? '✓' : '')),
    h('button', { class: 'task-main', onclick: () => openTask(t.id) },
      h('span', { class: 'task-title' }, t.title),
      sp ? h('span', { class: 'badge count' }, `${sp.done}/${sp.total}`) : null,
      t.status === 'doing' || t.status === 'blocked'
        ? h('span', { class: `badge st-${t.status}` }, `${STATUS_ICONS[t.status]} ${STATUS_LABELS[t.status]}`) : null,
      photoCount ? h('span', { class: 'task-note' }, `📷 ${photoCount}`) : null,
      t.comment ? h('span', { class: 'task-note', 'aria-label': 'Commentaire' }, '💬') : null));
  longPress(li, () => quickStatus(t));
  return li;
}

async function changeStatus(taskId, status, { quiet = false } = {}) {
  const task = await db.get('tasks', taskId);
  if (!task) return;
  const lotTasks = await db.byIndex('tasks', 'lotId', task.lotId);
  await db.write(db.putOps('tasks', applyStatusChange(task, lotTasks, status)));
  if (!quiet) refresh();
}

async function quickStatus(t) {
  const status = await choose({
    title: t.title,
    options: STATUSES.map((s) => ({ label: `${STATUS_ICONS[s]}  ${STATUS_LABELS[s]}`, value: s, hint: s === t.status ? 'statut actuel' : null })),
  });
  if (status) await changeStatus(t.id, status);
}

async function openTask(id) {
  const t = await db.get('tasks', id);
  if (!t) return;
  const res = await sheet(t.parentId ? 'Sous-tâche' : 'Tâche', (close) => {
    let status = null; // null = statut non modifié dans cette fiche
    const title = h('input', { class: 'field', value: t.title, autocomplete: 'off' });
    const comment = h('textarea', { class: 'field', rows: 3, value: t.comment ?? '', placeholder: 'Commentaire…' });
    const seg = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Statut' }, STATUSES.map((s) => h('button', {
      type: 'button', class: `seg st-${s}`, role: 'radio', 'data-status': s,
      onclick: () => { status = s; showStatus(s); },
    }, `${STATUS_ICONS[s]} ${STATUS_LABELS[s]}`)));
    const showStatus = (s) => { for (const b of seg.children) b.setAttribute('aria-checked', String(b.dataset.status === s)); };
    showStatus(t.status);

    // Sous-tâches (enregistrées tout de suite, sans attendre « Enregistrer »)
    const subBox = h('div');
    const loadSubs = async () => {
      const lotTasks = await db.byIndex('tasks', 'lotId', t.lotId);
      const kids = sortByOrder(lotTasks.filter((x) => x.parentId === t.id));
      const current = lotTasks.find((x) => x.id === t.id);
      if (status === null && current) showStatus(current.status);
      const input = h('input', { class: 'field', placeholder: 'Nouvelle sous-tâche…', enterkeyhint: 'done', autocomplete: 'off' });
      const add = async () => {
        const text = input.value.trim();
        if (!text) return;
        const child = newTask({ lotId: t.lotId, roomId: t.roomId, title: text, order: nextOrder(kids), parentId: t.id });
        const parent = syncParent(current ?? t, [...kids, child]);
        await db.write(db.putOps('tasks', [child, parent]));
        await loadSubs();
        refresh();
      };
      subBox.replaceChildren(
        h('ul', { class: 'tasks' }, kids.map((k) => h('li', { class: `task st-${k.status}` },
          h('button', {
            type: 'button', class: 'check', role: 'checkbox', 'aria-checked': String(k.status === 'done'), 'aria-label': `Fait : ${k.title}`,
            onclick: async () => { await changeStatus(k.id, k.status === 'done' ? 'todo' : 'done'); loadSubs(); },
          }, h('span', { class: 'box' }, k.status === 'done' ? '✓' : '')),
          h('span', { class: 'task-main' }, h('span', { class: 'task-title' }, k.title)),
          toolBtn('🗑', `Supprimer « ${k.title} »`, async () => {
            if (!(await confirmBox({ title: 'Supprimer la sous-tâche ?', message: `« ${k.title} »`, ok: 'Supprimer', danger: true }))) return;
            await deleteTasks([k], `la sous-tâche « ${k.title} »`);
            const rest = kids.filter((x) => x.id !== k.id);
            const fresh = await db.get('tasks', t.id);
            if (fresh) await db.put('tasks', syncParent(fresh, rest));
            await loadSubs();
            refresh();
          })))),
        h('div', { class: 'quick-add' }, input, h('button', { type: 'button', class: 'btn primary', 'aria-label': 'Ajouter la sous-tâche', onclick: add }, '+')));
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    };

    // Photos de la tâche
    const photoBox = h('div');
    const loadPhotos = async () => {
      const photos = (await db.activeMedia('photos', 'taskId', t.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      photoBox.replaceChildren(thumbGrid(photos, async (i) => { if (await openViewer(photos, i)) { loadPhotos(); refresh(); } }));
    };
    const afterAdd = () => { loadPhotos(); refresh(); };

    if (!t.parentId) loadSubs();
    loadPhotos();
    return h('form', {
      onsubmit: (e) => {
        e.preventDefault();
        close({ action: 'save', title: title.value.trim() || t.title, status, comment: comment.value });
      },
    },
    h('label', { class: 'lbl' }, 'Intitulé', title),
    h('div', { class: 'lbl' }, 'Statut'), seg,
    t.doneAt ? h('p', { class: 'muted small' }, `Fait le ${formatDate(t.doneAt)}`) : null,
    h('label', { class: 'lbl' }, 'Commentaire', comment),
    t.parentId ? null : [h('div', { class: 'lbl' }, 'Sous-tâches'), subBox],
    h('div', { class: 'lbl' }, 'Photos'), photoBox,
    photoButtons({ roomId: t.roomId, lotId: t.lotId, taskId: t.id }, afterAdd),
    h('div', { class: 'sheet-actions' },
      h('button', { type: 'button', class: 'btn danger', onclick: () => close({ action: 'delete' }) }, 'Supprimer'),
      h('button', { type: 'submit', class: 'btn primary' }, 'Enregistrer')));
  });
  if (!res) return;
  const current = await db.get('tasks', id);
  if (!current) return;
  if (res.action === 'delete') {
    const children = (await db.byIndex('tasks', 'lotId', current.lotId)).filter((x) => x.parentId === current.id);
    const extra = children.length ? ` et ses ${children.length} sous-tâche(s)` : '';
    const ok = await confirmBox({ title: 'Supprimer la tâche ?', message: `« ${current.title} »${extra}.\nSes photos iront dans la corbeille.`, ok: 'Supprimer', danger: true });
    if (!ok) return;
    await deleteTasks([current, ...children], `la tâche « ${current.title} »`);
    if (current.parentId) {
      const siblings = (await db.byIndex('tasks', 'lotId', current.lotId)).filter((x) => x.parentId === current.parentId);
      const parent = await db.get('tasks', current.parentId);
      if (parent) await db.put('tasks', syncParent(parent, siblings));
    }
    toast('Tâche supprimée');
  } else {
    await db.put('tasks', { ...current, title: res.title, comment: res.comment });
    if (res.status && res.status !== current.status) await changeStatus(id, res.status, { quiet: true });
  }
  refresh();
}

function roomPhotosSection(room, photos, tasks) {
  const phase = ui.roomPhase;
  const byPhase = groupBy(photos.filter((p) => p.phase), 'phase');
  const list = (byPhase[phase] ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const taskTitle = Object.fromEntries(tasks.map((t) => [t.id, t.title]));
  const describe = (p) => (p.taskId ? taskTitle[p.taskId] : PHOTO_PHASES[p.phase]) ?? '';
  return h('section', { class: 'card' },
    h('div', { class: 'level-head' },
      h('h2', null, '📷 Photos de la pièce'),
      h('button', { class: 'btn small ghost', onclick: () => { ui.gallery = { room: room.id, lot: '', period: '' }; go('#/photos'); } }, `Toutes (${photos.length})`)),
    h('div', { class: 'segmented three' }, Object.entries(PHOTO_PHASES).map(([key, label]) => h('button', {
      type: 'button', class: 'seg small', 'aria-pressed': String(phase === key), onclick: () => { ui.roomPhase = key; refresh(); },
    }, `${label} (${byPhase[key]?.length ?? 0})`))),
    h('div', { class: 'gap' }, thumbGrid(list, async (i) => { if (await openViewer(list, i, describe)) refresh(); })),
    photoButtons({ roomId: room.id, phase }, refresh));
}

function attachmentsSection(room, files) {
  const input = h('input', {
    type: 'file', accept: 'application/pdf,image/*', multiple: true, hidden: true,
    onchange: async (e) => {
      const list = [...e.target.files];
      e.target.value = '';
      if (list.length) { await addAttachments(list, room.id); refresh(); }
    },
  });
  const sorted = [...files].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return h('section', { class: 'card' },
    h('h2', null, '📎 Pièces jointes (plans, PDF)'),
    sorted.length
      ? h('ul', { class: 'list' }, sorted.map((f) => h('li', { class: 'row' },
        h('button', { class: 'row-btn grow', onclick: () => openAttachment(f) },
          h('span', null, `${f.type === 'application/pdf' ? '📄' : '🖼️'} ${f.name}`),
          h('small', { class: 'muted' }, `${formatBytes(f.size)} · ${formatDate(f.createdAt)}`)),
        toolBtn('🗑', `Supprimer ${f.name}`, async () => {
          if (!(await confirmBox({ title: 'Supprimer la pièce jointe ?', message: `« ${f.name} » ira dans la corbeille.`, ok: 'Supprimer', danger: true }))) return;
          await db.trashMedia('files', [f], `Supprimée de la pièce « ${room.name} »`);
          refresh();
        }))))
      : h('p', { class: 'muted small' }, 'Aucune pièce jointe.'),
    input,
    h('button', { class: 'btn block', onclick: () => input.click() }, '+ Ajouter un PDF ou une image'));
}

function notesSection(room) {
  if (ui.editNotes === room.id) {
    const ta = h('textarea', { class: 'field', rows: 8, value: room.notes ?? '', placeholder: '# Titre\n- élément de liste\nTexte libre…' });
    return h('section', { class: 'card' },
      h('h2', null, '📝 Notes'),
      h('p', { class: 'muted small' }, 'Astuce : « # » en début de ligne pour un titre, « - » pour une liste.'),
      ta,
      h('div', { class: 'sheet-actions' },
        h('button', { class: 'btn', onclick: () => { ui.editNotes = null; refresh(); } }, 'Annuler'),
        h('button', {
          class: 'btn primary',
          onclick: () => { ui.editNotes = null; updateRecord('rooms', room.id, (r) => ({ ...r, notes: ta.value })); },
        }, 'Enregistrer')));
  }
  const blocks = parseNotes(room.notes);
  return h('section', { class: 'card' },
    h('div', { class: 'level-head' },
      h('h2', null, '📝 Notes'),
      h('button', { class: 'btn small', onclick: () => { ui.editNotes = room.id; refresh(); } }, blocks.length ? 'Modifier' : 'Écrire')),
    blocks.length
      ? h('div', { class: 'notes' }, blocks.map((b) => {
        if (b.type === 'title') return h('h3', null, b.text);
        if (b.type === 'list') return h('ul', null, b.items.map((i) => h('li', null, i)));
        return h('p', null, b.text);
      }))
      : h('p', { class: 'muted small' }, 'Aucune note.'));
}

async function lotMenu(lot, sortedLots, tasks) {
  const action = await choose({
    title: lot.name,
    options: [
      { label: '✏️  Renommer', value: 'rename' },
      { label: '↑  Monter', value: 'up' },
      { label: '↓  Descendre', value: 'down' },
      { label: '🗑  Retirer ce lot de la pièce', value: 'remove', danger: true },
    ],
  });
  if (action === 'rename') return renameItem('lots', lot, 'Renommer le lot');
  if (action === 'up' || action === 'down') return move('lots', sortedLots, lot.id, action === 'up' ? -1 : 1);
  if (action !== 'remove') return;
  const ok = await confirmBox({
    title: 'Retirer le lot ?',
    message: `Le lot « ${lot.name} » et ses ${tasks.length} tâche(s) seront retirés de cette pièce.\n\nUne copie de sécurité automatique est faite avant. Les photos des tâches vont à la corbeille.`,
    ok: 'Retirer', danger: true,
  });
  if (!ok) return;
  if (tasks.length) await deleteTasks(tasks, `le lot « ${lot.name} »`);
  else await db.saveSnapshot(`Avant retrait du lot « ${lot.name} »`);
  await db.write([{ store: 'lots', del: lot.id }]);
  toast('Lot retiré');
  refresh();
}

async function addLotToRoom(room, lots, catalogue) {
  const present = new Set(lots.map((l) => l.templateKey).filter(Boolean));
  const value = await choose({
    title: 'Ajouter un lot',
    options: [
      ...catalogue.map((e) => ({
        label: e.name, value: e.key, disabled: present.has(e.key),
        hint: present.has(e.key) ? 'déjà dans la pièce' : `${e.tasks.length} tâche(s) proposée(s)`,
      })),
      { label: '✚  Catégorie libre…', value: '__free', hint: 'un lot vide, avec le nom de votre choix' },
    ],
  });
  if (!value) return;
  if (value === '__free') {
    const name = await askText({ title: 'Nouvelle catégorie', label: 'Nom (ex. VMC, Menuiseries…)' });
    if (!name) return;
    const addToCatalogue = await confirmBox({
      title: 'Modèle de lots',
      message: `Ajouter aussi « ${name} » au modèle de lots, pour pouvoir l’utiliser dans d’autres pièces ?`,
      ok: 'Oui, ajouter', cancel: 'Non, ici seulement',
    });
    let templateKey = null;
    if (addToCatalogue) {
      templateKey = uid();
      await db.setMeta('catalogue', [...catalogue, { key: templateKey, name, auto: false, tasks: [] }]);
    }
    const lot = newLot({ roomId: room.id, name, templateKey, order: nextOrder(lots) });
    await db.put('lots', lot);
    ui.openLots.set(lot.id, true);
  } else {
    const s = lotFromTemplate(room.id, catalogue.find((e) => e.key === value), nextOrder(lots));
    await db.write([{ store: 'lots', put: s.lot }, ...db.putOps('tasks', s.tasks)]);
    ui.openLots.set(s.lot.id, true);
  }
  refresh();
}

async function copyRoomStructure(room, lots, tasks) {
  const [levels, rooms] = await Promise.all([db.all('levels'), db.all('rooms')]);
  const options = sortByOrder(levels).flatMap((l) => sortByOrder(rooms.filter((r) => r.levelId === l.id && r.id !== room.id))
    .map((r) => ({ label: `${l.name} — ${r.name}`, value: r.id })));
  const targetId = await choose({
    title: 'Copier la structure vers…',
    message: 'Les lots et tâches (et sous-tâches) qui manquent dans la pièce choisie y seront ajoutés, au statut « à faire ». Rien n’est supprimé.',
    options,
  });
  if (!targetId) return;
  const [tLots, tTasks] = await Promise.all([db.byIndex('lots', 'roomId', targetId), db.byIndex('tasks', 'roomId', targetId)]);
  const res = copyStructure({ source: { lots, tasks }, target: { roomId: targetId, lots: tLots, tasks: tTasks } });
  await db.write([...db.putOps('lots', res.lots), ...db.putOps('tasks', res.tasks)]);
  toast(`${res.lots.length} lot(s) et ${res.tasks.length} tâche(s) ajoutés`);
}

// ---------- Écran Galerie ----------

async function viewGallery() {
  const [photos, levels, rooms, lots, tasks] = await Promise.all([
    db.activeMedia('photos'), db.all('levels'), db.all('rooms'), db.all('lots'), db.all('tasks'),
  ]);
  const f = ui.gallery;
  const roomById = Object.fromEntries(rooms.map((r) => [r.id, r]));
  const lotById = Object.fromEntries(lots.map((l) => [l.id, l]));
  const taskById = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const lotName = (p) => (p.phase ? '__room' : lotById[p.lotId]?.name ?? '');
  const list = photos
    .filter((p) => (!f.room || p.roomId === f.room) && (!f.lot || lotName(p) === f.lot) && inPeriod(p.createdAt, f.period))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const describe = (p) => [
    roomById[p.roomId]?.name ?? 'Pièce supprimée',
    p.taskId ? taskById[p.taskId]?.title : PHOTO_PHASES[p.phase],
  ].filter(Boolean).join(' — ');

  const setFilter = (key) => (value) => { ui.gallery = { ...ui.gallery, [key]: value }; refresh(); };
  const lotNames = [...new Set(photos.map(lotName).filter((n) => n && n !== '__room'))].sort((a, b) => a.localeCompare(b, 'fr'));
  const months = [...new Set(photos.map((p) => dayKey(p.createdAt).slice(0, 7)))].sort().reverse();
  const stats = mediaStats(photos);

  // Regroupement par jour ; chaque groupe ouvre la visionneuse sur toute la liste filtrée.
  const groups = [];
  list.forEach((p, i) => {
    const key = dayKey(p.createdAt);
    if (groups.at(-1)?.key !== key) groups.push({ key, start: i, photos: [] });
    groups.at(-1).photos.push(p);
  });

  return {
    title: 'Photos',
    nodes: [
      h('section', { class: 'card' },
        h('p', { class: 'muted small' }, `${stats.count} photo(s) au total · ${formatBytes(stats.bytes)}`),
        selectField('Pièce', f.room, [
          { value: '', label: 'Toutes les pièces' },
          ...sortByOrder(levels).map((l) => ({
            group: l.name,
            options: sortByOrder(rooms.filter((r) => r.levelId === l.id)).map((r) => ({ value: r.id, label: r.name })),
          })),
        ], setFilter('room')),
        selectField('Lot', f.lot, [
          { value: '', label: 'Tous les lots' },
          { value: '__room', label: 'Photos de pièce (état initial, en cours, fini)' },
          ...lotNames.map((n) => ({ value: n, label: n })),
        ], setFilter('lot')),
        selectField('Date', f.period, [
          { value: '', label: 'Toutes les dates' },
          { value: '7', label: '7 derniers jours' },
          { value: '30', label: '30 derniers jours' },
          ...months.map((m) => ({ value: `m:${m}`, label: new Date(`${m}-15T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) })),
        ], setFilter('period')),
        f.room || f.lot || f.period
          ? h('button', { class: 'btn small ghost', onclick: () => { ui.gallery = { room: '', lot: '', period: '' }; refresh(); } }, 'Effacer les filtres')
          : null),
      list.length ? null : h('p', { class: 'card muted' }, photos.length ? 'Aucune photo pour ces filtres.' : 'Aucune photo pour l’instant. Ajoutez-en depuis une tâche ou une pièce.'),
      groups.map((g) => h('section', { class: 'card' },
        h('h2', { class: 'day' }, `${formatDay(g.photos[0].createdAt)} (${g.photos.length})`),
        thumbGrid(g.photos, async (i) => { if (await openViewer(list, g.start + i, describe)) refresh(); }))),
    ],
  };
}

// options : [{ value, label }] ou [{ group, options: [...] }]
function selectField(label, value, options, onchange) {
  const opt = (o) => h('option', { value: o.value }, o.label);
  const sel = h('select', { class: 'field', onchange: (e) => onchange(e.target.value) },
    options.map((o) => (o.group ? h('optgroup', { label: o.group }, o.options.map(opt)) : opt(o))));
  sel.value = value;
  if (sel.value !== value) sel.value = '';
  return h('label', { class: 'lbl' }, label, sel);
}

// ---------- Écran Réglages ----------

async function viewSettings() {
  const [catalogue, finishes, lastBackupAt, snapshots, storage, photos, files, trash, photoCfg] = await Promise.all([
    db.getMeta('catalogue', []), db.getMeta('finishes', DEFAULT_FINISHES), db.getMeta('lastBackupAt', null),
    db.listSnapshots().catch(() => []), storageInfo(),
    db.activeMedia('photos'), db.activeMedia('files'), db.listTrash(), db.getMeta('photoSettings', {}),
  ]);
  const settings = { ...DEFAULT_PHOTO_SETTINGS, ...photoCfg };
  const photoStats = mediaStats(photos);
  const fileStats = mediaStats(files);
  const trashItems = [...trash.photos, ...trash.files].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  const trashStats = mediaStats(trashItems);
  const fileInput = h('input', {
    type: 'file', accept: '.zip,.json,application/zip,application/json', hidden: true,
    onchange: (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (f) importBackup(f);
    },
  });
  const theme = readTheme();
  const savePhotoSetting = (key) => async (value) => {
    await db.setMeta('photoSettings', { ...photoCfg, [key]: Number(value) });
    toast('Réglage enregistré (pour les prochaines photos)');
    refresh();
  };

  return {
    title: 'Réglages',
    nodes: [
      h('section', { class: 'card' },
        h('h2', null, '💾 Sauvegarde'),
        h('p', null, 'Dernière sauvegarde : ', h('strong', null, lastBackupAt ? formatDate(lastBackupAt) : 'jamais')),
        h('p', { class: 'muted' }, 'Vos données sont uniquement dans cet appareil. La sauvegarde (.zip) contient tout : tâches, notes, photos et pièces jointes. Rangez-la dans iCloud Drive, Google Drive ou OneDrive (app Fichiers).'),
        h('div', { class: 'stack' },
          h('button', { class: 'btn primary block', onclick: exportBackup }, '📤 Exporter une sauvegarde (.zip)'),
          h('button', { class: 'btn block', onclick: () => fileInput.click() }, '📥 Importer une sauvegarde'),
          fileInput)),

      h('section', { class: 'card' },
        h('h2', null, '📷 Photos'),
        kv('Photos', `${photoStats.count} · ${formatBytes(photoStats.bytes)}`),
        kv('Pièces jointes', `${fileStats.count} · ${formatBytes(fileStats.bytes)}`),
        selectField('Taille des photos (côté le plus long)', String(settings.maxSide), [
          { value: '1200', label: '1200 px — légère' },
          { value: '1600', label: '1600 px — conseillée' },
          { value: '2048', label: '2048 px — détaillée (plus lourde)' },
        ], savePhotoSetting('maxSide')),
        selectField('Qualité JPEG', String(settings.quality), [
          { value: '0.6', label: '0,6 — compacte' },
          { value: '0.7', label: '0,7 — conseillée' },
          { value: '0.8', label: '0,8 — haute' },
          { value: '0.9', label: '0,9 — très haute (plus lourde)' },
        ], savePhotoSetting('quality')),
        h('p', { class: 'muted small' }, 'S’applique aux nouvelles photos. Une photo de 1600 px à 0,7 pèse environ 200 à 400 Ko.')),

      h('section', { class: 'card' },
        h('h2', null, `🗑 Corbeille (${trashItems.length})`),
        h('p', { class: 'muted' }, `Photos et pièces jointes supprimées · ${formatBytes(trashStats.bytes)}. Rien n’est effacé définitivement tant que vous ne videz pas la corbeille.`),
        trashItems.length ? h('ul', { class: 'list' }, trashItems.slice(0, 30).map((x) => h('li', { class: 'row' },
          h('div', { class: 'grow' },
            h('div', null, x.store === 'photos' ? `📷 ${x.caption || 'Photo'}` : `📎 ${x.name}`),
            h('small', { class: 'muted' }, `${x.deletedReason ?? ''} · ${formatDate(x.deletedAt)}`)),
          h('button', { class: 'btn small', onclick: async () => { await db.restoreMedia([x]); toast('Restauré ✓'); refresh(); } }, 'Restaurer')))) : null,
        trashItems.length > 30 ? h('p', { class: 'muted small' }, `… et ${trashItems.length - 30} autre(s).`) : null,
        trashItems.length ? h('div', { class: 'stack' },
          h('button', { class: 'btn block', onclick: async () => { await db.restoreMedia(trashItems); toast('Tout est restauré ✓'); refresh(); } }, 'Tout restaurer'),
          h('button', { class: 'btn block danger', onclick: emptyTrash }, 'Vider la corbeille')) : null),

      h('section', { class: 'card' },
        h('h2', null, '🛟 Copies de sécurité automatiques'),
        h('p', { class: 'muted' }, 'Faites automatiquement avant chaque suppression, import ou mise à jour de la base. Les 10 dernières sont gardées dans l’appareil. Elles ne remplacent pas une vraie sauvegarde.'),
        snapshots.length
          ? h('ul', { class: 'list' }, snapshots.map((s) => h('li', { class: 'row' },
            h('div', { class: 'grow' }, h('div', null, s.reason),
              h('small', { class: 'muted' }, `${formatDate(s.at)} · ${s.counts.rooms} pièces, ${s.counts.tasks} tâches`)),
            h('button', { class: 'btn small', onclick: () => restoreSnapshot(s) }, 'Restaurer'))))
          : h('p', { class: 'muted' }, 'Aucune copie pour l’instant.')),

      h('section', { class: 'card' },
        h('h2', null, '🧱 Modèle de lots'),
        h('p', { class: 'muted' }, 'Les lots « auto » sont ajoutés à chaque nouvelle pièce. Les autres s’ajoutent à la main depuis une pièce. Les pièces existantes ne sont pas modifiées.'),
        h('ul', { class: 'list' }, catalogue.map((e, i) => h('li', { class: 'row' },
          h('button', { class: 'row-btn grow', onclick: () => editCatalogueEntry(catalogue, i) },
            h('span', null, e.name), h('small', { class: 'muted' }, `${e.tasks.length} tâche(s) · ${e.auto ? 'auto' : 'à la main'}`)),
          toolBtn('↑', 'Monter', () => moveCatalogue(catalogue, i, -1)),
          toolBtn('↓', 'Descendre', () => moveCatalogue(catalogue, i, 1))))),
        h('button', { class: 'btn block', onclick: () => editCatalogueEntry(catalogue, -1) }, '+ Nouveau lot / catégorie')),

      h('section', { class: 'card' },
        h('h2', null, '🎨 Finitions peinture'),
        h('p', null, finishes.join(' · ') || '—'),
        h('button', { class: 'btn block', onclick: () => editFinishes(finishes) }, 'Modifier la liste')),

      h('section', { class: 'card' },
        h('h2', null, '📦 Stockage'),
        kv('Stockage persistant', storage.persisted === true ? '✅ oui' : storage.persisted === false ? '❌ non' : 'inconnu'),
        kv('Utilisé', storage.usage != null ? formatBytes(storage.usage) : 'inconnu'),
        kv('Quota disponible', storage.quota != null ? formatBytes(storage.quota) : 'inconnu'),
        storage.persisted === false ? h('p', { class: 'muted' }, 'Sur iPhone, utiliser l’app depuis l’icône de l’écran d’accueil améliore la conservation des données.') : null,
        storage.persisted === false ? h('button', {
          class: 'btn block',
          onclick: async () => {
            const ok = await navigator.storage.persist();
            toast(ok ? 'Stockage persistant activé' : 'Refusé par le navigateur');
            refresh();
          },
        }, 'Demander le stockage persistant') : null),

      h('section', { class: 'card' },
        h('h2', null, '🌓 Thème'),
        h('div', { class: 'segmented three' }, [['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']].map(([v, label]) => h('button', {
          type: 'button', class: 'seg', 'aria-pressed': String(theme === v), onclick: () => { saveTheme(v); refresh(); },
        }, label)))),

      h('section', { class: 'card' },
        h('h2', null, 'ℹ️ Application'),
        kv('Version', VERSION),
        kv('Ouverte depuis l’écran d’accueil', isStandalone() ? '✅ oui' : '❌ non'),
        h('div', { class: 'stack' },
          h('button', { class: 'btn block', onclick: checkForUpdate }, '🔄 Rechercher une mise à jour'),
          waitingWorker ? h('button', { class: 'btn primary block', onclick: applyUpdate }, 'Installer la nouvelle version') : null),
        h('p', { class: 'muted' }, 'Une mise à jour de l’application ne touche pas à vos données.')),
    ],
  };
}

async function exportBackup() {
  const result = await sheet('Sauvegarde', (close) => {
    const status = h('p', null, 'Préparation… 0 %');
    const body = h('div', null, status);
    prepareExport((pct) => { status.textContent = `Préparation… ${pct} %`; })
      .then((prep) => {
        const c = prep.counts;
        body.replaceChildren(
          h('p', null, `${c.rooms} pièces, ${c.tasks} tâches, ${c.photos} photo(s), ${c.files} pièce(s) jointe(s) · ${formatBytes(prep.size)}`),
          h('p', { class: 'muted' }, 'Sur iPhone : choisissez « Enregistrer dans Fichiers », puis iCloud Drive (ou Google Drive, OneDrive…).'),
          h('button', {
            class: 'btn primary block',
            onclick: async () => {
              const r = await deliverFile(prep.file);
              if (r !== 'cancelled') close(r);
            },
          }, '📤 Enregistrer / partager le fichier'));
      })
      .catch((e) => { status.textContent = `Échec de la préparation : ${e.message}`; });
    return body;
  });
  if (!result) return;
  await markBackupDone();
  toast('Sauvegarde faite ✓');
  refresh();
}

async function importBackup(file) {
  toast('Lecture de la sauvegarde…');
  const r = await readBackupFile(file);
  if (!r.ok) {
    await sheet('Import impossible', (close) => [
      h('ul', null, r.errors.map((e) => h('li', null, e))),
      h('button', { class: 'btn block', onclick: () => close() }, 'OK'),
    ]);
    return;
  }
  const d = r.backup.data;
  const replaced = await countReplacedMedia(r);
  const lines = [
    `Sauvegarde du ${formatDate(r.backup.exportedAt)} : ${d.rooms.length} pièces, ${d.tasks.length} tâches, ${r.photos.length} photo(s), ${r.files.length} pièce(s) jointe(s).`,
    r.missing.length ? `⚠️ ${r.missing.length} fichier(s) manquant(s) dans la sauvegarde.` : '',
    'Toutes les données actuelles seront remplacées. Une copie de sécurité automatique est faite avant.',
    replaced ? `${replaced} photo(s) / pièce(s) jointe(s) actuelle(s) iront dans la corbeille.` : '',
  ];
  const ok = await confirmBox({ title: 'Restaurer cette sauvegarde ?', message: lines.filter(Boolean).join('\n\n'), ok: 'Remplacer mes données', danger: true });
  if (!ok) return;
  toast('Restauration en cours…');
  await applyBackup(r);
  toast('Sauvegarde restaurée ✓');
  go('#/');
}

async function restoreSnapshot(s) {
  const ok = await confirmBox({
    title: 'Restaurer cette copie ?',
    message: `${s.reason}\n${formatDate(s.at)} · ${s.counts.rooms} pièces, ${s.counts.tasks} tâches.\n\nLes données actuelles seront remplacées (elles-mêmes copiées avant). Les photos supprimées depuis cette date reviennent aussi.`,
    ok: 'Restaurer', danger: true,
  });
  if (!ok) return;
  await db.restoreSnapshot(s.id);
  toast('Copie restaurée ✓');
  go('#/');
}

async function emptyTrash() {
  const ok = await confirmBox({
    title: 'Vider la corbeille ?',
    message: 'Les photos et pièces jointes de la corbeille seront effacées DÉFINITIVEMENT.\n\nConseil : exportez d’abord une sauvegarde si vous avez un doute.',
    ok: 'Effacer définitivement', danger: true,
  });
  if (!ok) return;
  const n = await db.purgeTrash();
  toast(`${n} élément(s) effacé(s)`);
  refresh();
}

async function editCatalogueEntry(catalogue, index) {
  const entry = index >= 0 ? catalogue[index] : { key: uid(), name: '', auto: false, tasks: [] };
  const res = await sheet(index >= 0 ? 'Modifier le lot' : 'Nouveau lot', (close) => {
    const name = h('input', { class: 'field', value: entry.name, placeholder: 'ex. VMC', autocomplete: 'off' });
    const auto = h('input', { type: 'checkbox', class: 'chk', checked: entry.auto });
    const tasks = h('textarea', { class: 'field', rows: 7, value: entry.tasks.join('\n'), placeholder: 'Une tâche par ligne' });
    return h('form', {
      onsubmit: (e) => {
        e.preventDefault();
        const n = name.value.trim();
        if (!n) return;
        close({ action: 'save', entry: { ...entry, name: n, auto: auto.checked, tasks: tasks.value.split('\n').map((s) => s.trim()).filter(Boolean) } });
      },
    },
    h('label', { class: 'lbl' }, 'Nom du lot', name),
    h('label', { class: 'check-line' }, auto, 'Ajouter automatiquement aux nouvelles pièces'),
    h('label', { class: 'lbl' }, 'Tâches proposées (une par ligne)', tasks),
    h('div', { class: 'sheet-actions' },
      index >= 0 ? h('button', { type: 'button', class: 'btn danger', onclick: () => close({ action: 'delete' }) }, 'Supprimer') : null,
      h('button', { type: 'submit', class: 'btn primary' }, 'Enregistrer')));
  });
  if (!res) return;
  const next = [...catalogue];
  if (res.action === 'delete') {
    const ok = await confirmBox({
      title: 'Supprimer du modèle ?',
      message: `« ${entry.name} » ne sera plus proposé. Les pièces qui ont déjà ce lot le gardent.`,
      ok: 'Supprimer', danger: true,
    });
    if (!ok) return;
    await db.saveSnapshot(`Avant suppression du lot « ${entry.name} » du modèle`);
    next.splice(index, 1);
  } else if (index >= 0) {
    next[index] = res.entry;
  } else {
    next.push(res.entry);
  }
  await db.setMeta('catalogue', next);
  refresh();
}

async function moveCatalogue(catalogue, i, dir) {
  const j = i + dir;
  if (j < 0 || j >= catalogue.length) return;
  const next = [...catalogue];
  [next[i], next[j]] = [next[j], next[i]];
  await db.setMeta('catalogue', next);
  refresh();
}

async function editFinishes(finishes) {
  const text = await askText({ title: 'Finitions peinture', label: 'Une valeur par ligne', value: finishes.join('\n'), multiline: true });
  if (text == null) return;
  await db.setMeta('finishes', [...new Set(text.split('\n').map((s) => s.trim()).filter(Boolean))]);
  refresh();
}

async function storageInfo() {
  const out = { persisted: null, usage: null, quota: null };
  try { if (navigator.storage?.persisted) out.persisted = await navigator.storage.persisted(); } catch { /* inconnu */ }
  try {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      out.usage = e.usage ?? null;
      out.quota = e.quota ?? null;
    }
  } catch { /* inconnu */ }
  return out;
}

// ---------- Actions communes ----------

async function updateRecord(store, id, fn) {
  const current = await db.get(store, id);
  if (!current) return;
  await db.put(store, fn(current));
  refresh();
}

async function renameItem(store, item, title) {
  const name = await askText({ title, label: 'Nom', value: item.name });
  if (name) await updateRecord(store, item.id, (x) => ({ ...x, name }));
}

async function move(store, siblings, id, dir) {
  const changed = moveItem(siblings, id, dir);
  if (!changed.length) return;
  await db.write(db.putOps(store, changed));
  refresh();
}

function bar(pct, extra = '') {
  return h('div', {
    class: `bar ${extra}${pct >= 100 ? ' full' : ''}`, role: 'progressbar',
    'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100,
  }, h('span', { style: `width:${pct}%` }));
}

const toolBtn = (icon, label, onclick) => h('button', { type: 'button', class: 'icon-btn', 'aria-label': label, title: label, onclick }, icon);
const kv = (k, v) => h('div', { class: 'kv' }, h('span', null, k), h('strong', null, v));

// ---------- Thème ----------

function readTheme() {
  try { return localStorage.getItem('theme') || 'auto'; } catch { return 'auto'; }
}

function saveTheme(t) {
  try { localStorage.setItem('theme', t); } catch { /* navigation privée */ }
  applyTheme(t);
}

function applyTheme(t) {
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

// ---------- Installation et mises à jour ----------

const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    swRegistration = reg;
    if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) setWaiting(w);
      });
    });
  }).catch((e) => console.warn('Service worker non enregistré', e));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (ui.updating) location.reload();
  });
}

function setWaiting(worker) {
  waitingWorker = worker;
  renderBanners();
}

function applyUpdate() {
  if (!waitingWorker) return;
  ui.updating = true;
  waitingWorker.postMessage('skipWaiting');
}

async function checkForUpdate() {
  if (!swRegistration) {
    toast('Mises à jour indisponibles ici');
    return;
  }
  try {
    await swRegistration.update();
  } catch {
    toast('Pas de connexion ?');
    return;
  }
  const w = swRegistration.installing;
  if (w) {
    await new Promise((resolve) => {
      const onChange = () => {
        if (['installed', 'activated', 'redundant'].includes(w.state)) {
          w.removeEventListener('statechange', onChange);
          resolve();
        }
      };
      w.addEventListener('statechange', onChange);
    });
  }
  toast(waitingWorker ? 'Nouvelle version disponible' : 'Vous avez la dernière version');
  refresh();
}
