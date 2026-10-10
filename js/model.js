// Fonctions « pures » : aucune dépendance au navigateur, testables avec `npm test`.

export const STATUSES = ['todo', 'doing', 'done', 'blocked'];
export const STATUS_LABELS = { todo: 'À faire', doing: 'En cours', done: 'Fait', blocked: 'Bloqué' };
export const STATUS_ICONS = { todo: '○', doing: '◐', done: '✓', blocked: '⛔' };

export const BACKUP_APP_ID = 'suivi-chantier-solange';
export const BACKUP_FORMAT = 3;
// Données « structure » (légères) : copiées dans les copies de sécurité automatiques.
// needs = articles à acheter (courses), stock = ce qu'on a déjà.
export const DATA_STORES = ['levels', 'rooms', 'lots', 'tasks', 'meta', 'needs', 'stock'];
// Photos et pièces jointes (lourdes) : protégées par la corbeille plutôt que par les copies.
export const MEDIA_STORES = ['photos', 'files'];

export const PHOTO_PHASES = { initial: 'État initial', encours: 'En cours', fini: 'Fini' };
export const DEFAULT_PHOTO_SETTINGS = { maxSide: 1600, quality: 0.7, thumbSide: 300 };

// Article de la bibliothèque d'un lot : nom, unité, quantité habituelle (facultative).
const A = (name, unit, qty = null) => ({ name, unit, qty });

// Modèle de lots : `auto: true` = ajouté automatiquement à chaque nouvelle pièce.
// L'ordre des lots suit l'ordre logique du chantier. `articles` = bibliothèque de courses du lot.
export const DEFAULT_CATALOGUE = [
  {
    key: 'elec-reseaux', name: 'Électricité — gaines et boîtes', auto: true,
    tasks: ['Emplacements et hauteurs validés', 'Boîtes d’encastrement posées', 'Gaines tirées', 'Photo des réseaux avant fermeture'],
    articles: [
      A('Gaine ICTA Ø20', 'm', 100), A('Gaine ICTA Ø16', 'm', 100), A('Boîte d’encastrement placo Ø67', 'u'),
      A('Boîte d’encastrement maçonnerie Ø67', 'u'), A('Boîte de dérivation', 'u'), A('Câble R2V 3G2,5', 'm'),
      A('Câble R2V 3G1,5', 'm'), A('Fil H07V-U 2,5 mm²', 'm'), A('Tire-fil', 'u', 1),
    ],
  },
  {
    key: 'plomberie', name: 'Plomberie', auto: true,
    tasks: ['Alimentations posées', 'Évacuations posées', 'Test d’étanchéité / mise en pression', 'Photo des réseaux avant fermeture'],
    articles: [
      A('Tube multicouche Ø16', 'm'), A('Tube PER Ø16 gainé', 'm'), A('Raccords à sertir Ø16', 'u'),
      A('Tube PVC Ø40', 'm'), A('Tube PVC Ø100', 'm'), A('Coudes PVC Ø40', 'u'), A('Colle PVC', 'u', 1),
      A('Colliers de fixation', 'u'), A('Vanne d’arrêt', 'u'),
    ],
  },
  {
    key: 'cloisons', name: 'Cloisons / doublages', auto: true,
    tasks: ['Ossatures posées', 'Isolant posé', 'Renforts posés (meubles, sanitaires)', 'Plaques posées'],
    articles: [
      A('Plaque BA13', 'u'), A('Plaque BA13 hydro', 'u'), A('Rail R48', 'u'), A('Montant M48', 'u'),
      A('Fourrure F530', 'u'), A('Appui intermédiaire', 'u'), A('Laine minérale 45 mm', 'm²'),
      A('Vis TTPC 25', 'boîte', 1), A('Bande résiliente', 'rouleau'),
    ],
  },
  {
    key: 'plafonds', name: 'Plafonds', auto: true,
    tasks: ['Suspentes et ossature posées', 'Isolant posé', 'Réservations spots / trappes', 'Plaques posées'],
    articles: [
      A('Plaque BA13', 'u'), A('Fourrure F530', 'u'), A('Suspente pivot', 'u'), A('Cornière de rive', 'u'),
      A('Laine minérale en rouleau', 'm²'), A('Vis TTPC 25', 'boîte', 1), A('Cheville à frapper', 'boîte', 1),
    ],
  },
  {
    key: 'bandes', name: 'Bandes', auto: true,
    tasks: ['Bandes posées', 'Angles et cornières', 'Ponçage'],
    articles: [A('Bande à joint papier', 'rouleau'), A('Enduit à joint', 'sac'), A('Cornière d’angle', 'u'), A('Abrasif grain 120', 'paquet', 1)],
  },
  {
    key: 'enduit', name: 'Enduit', auto: true,
    tasks: ['Première passe', 'Deuxième passe / lissage', 'Ponçage final', 'Dépoussiérage'],
    articles: [A('Enduit de lissage', 'sac'), A('Enduit de rebouchage', 'sac'), A('Abrasif grain 180', 'paquet', 1), A('Couteau à enduire', 'u', 1)],
  },
  {
    key: 'peinture', name: 'Peinture', auto: true,
    tasks: ['Protections sols et menuiseries', 'Sous-couche', 'Première couche', 'Deuxième couche', 'Retouches'],
    articles: [
      A('Sous-couche', 'L'), A('Peinture murs', 'L'), A('Peinture plafond', 'L'), A('Rouleau', 'u', 1),
      A('Pinceau à rechampir', 'u', 1), A('Bâche de protection', 'u'), A('Ruban de masquage', 'rouleau'),
    ],
  },
  {
    key: 'elec-finition', name: 'Finition électricité', auto: true,
    tasks: ['Appareillage posé (prises, interrupteurs)', 'Luminaires raccordés', 'Repérage au tableau', 'Tests de fonctionnement'],
    articles: [
      A('Prise de courant 16 A', 'u'), A('Interrupteur va-et-vient', 'u'), A('Plaque de finition', 'u'),
      A('Douille DCL', 'u'), A('Prise RJ45', 'u'), A('Bornes de connexion à levier', 'boîte', 1),
    ],
  },
  {
    key: 'vmc', name: 'VMC', auto: false,
    tasks: ['Bouches posées', 'Gaines raccordées', 'Test de fonctionnement'],
    articles: [A('Bouche d’extraction', 'u'), A('Gaine souple Ø80', 'm'), A('Collier de serrage', 'u'), A('Manchette', 'u')],
  },
  {
    key: 'menuiseries', name: 'Menuiseries', auto: false,
    tasks: ['Dépose de l’existant', 'Pose', 'Calfeutrement / étanchéité', 'Réglages'],
    articles: [A('Mousse expansive', 'u'), A('Mastic acrylique', 'u'), A('Vis de fixation', 'boîte', 1), A('Cales de réglage', 'paquet', 1), A('Joint compriband', 'rouleau')],
  },
  {
    key: 'sol', name: 'Sol / ragréage', auto: false,
    tasks: ['Préparation du support', 'Primaire', 'Ragréage', 'Revêtement posé'],
    articles: [A('Primaire d’accrochage', 'L'), A('Ragréage', 'sac'), A('Bande périphérique', 'rouleau'), A('Revêtement de sol', 'm²')],
  },
];

export const DEFAULT_UNITS = ['u', 'm', 'm²', 'm³', 'kg', 'L', 'sac', 'rouleau', 'boîte', 'paquet', 'lot'];

export const DEFAULT_FINISHES = ['A', 'B', 'C'];

export const SEED_LEVELS = [
  { name: 'Sous-sol', rooms: ['Local technique (TGBT)', 'Escalier sous-sol'] },
  {
    name: 'RDC',
    rooms: ['Séjour', 'Salon', 'Cuisine / salle à manger', 'Suite parentale', 'Salle d’eau suite parentale', 'Entrée / circulation', 'Escalier'],
  },
  { name: 'R+1', rooms: ['Chambre 1', 'Chambre 2', 'Chambre 3', 'Circulation', 'Salle d’eau (à confirmer)'] },
  { name: 'Combles', rooms: [] },
];

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export const groupBy = (items, key) => items.reduce((acc, x) => ((acc[x[key]] ??= []).push(x), acc), {});

export const PROGRESS_STEPS = [0, 25, 50, 75, 100];

// Part réalisée d'une tâche, entre 0 et 1 : 1 si faite, sinon son avancement en %.
export function taskValue(t) {
  if (t.status === 'done') return 1;
  return Math.min(100, Math.max(0, t.progress ?? 0)) / 100;
}

// Avancement : on compte les tâches « feuilles » (une tâche qui a des sous-tâches
// est représentée par ses sous-tâches) ; une tâche à 50 % compte pour moitié.
// Arrondi vers le bas : 100 % = tout est fait.
export function progress(tasks) {
  const parents = new Set(tasks.map((t) => t.parentId).filter(Boolean));
  const leaves = tasks.filter((t) => !parents.has(t.id));
  const done = leaves.filter((t) => t.status === 'done').length;
  const total = leaves.length;
  const sum = leaves.reduce((s, t) => s + taskValue(t), 0);
  return { done, total, pct: total ? Math.floor((sum / total) * 100 + 1e-9) : 0 };
}

export function sortByOrder(items) {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function nextOrder(items) {
  return items.reduce((max, x) => Math.max(max, x.order ?? -1), -1) + 1;
}

// Déplace un élément d'un cran (dir = -1 ou +1) et renvoie uniquement les éléments
// dont l'ordre a changé (à réenregistrer).
export function moveItem(items, id, dir) {
  const sorted = sortByOrder(items);
  const i = sorted.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sorted.length) return [];
  [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  return sorted.map((x, order) => (x.order === order ? null : { ...x, order })).filter(Boolean);
}

export function newRoom({ levelId, name, order = 0 }) {
  return { id: uid(), levelId, name: name.trim(), order, finish: '', notes: '' };
}

export function newLot({ roomId, name, templateKey = null, order = 0 }) {
  return { id: uid(), roomId, name: name.trim(), templateKey, order };
}

export function newTask({ lotId, roomId, title, order = 0, parentId = null }, now = new Date()) {
  return {
    id: uid(), lotId, roomId, parentId, title: title.trim(),
    status: 'todo', progress: 0, comment: '', doneAt: null, milestone: null, dependsOn: [],
    order, createdAt: now.toISOString(),
  };
}

export function lotFromTemplate(roomId, entry, order = 0) {
  const lot = newLot({ roomId, name: entry.name, templateKey: entry.key, order });
  const tasks = entry.tasks.map((title, i) => newTask({ lotId: lot.id, roomId, title, order: i }));
  return { lot, tasks };
}

export function structureForNewRoom(roomId, catalogue) {
  const lots = [];
  const tasks = [];
  catalogue.filter((e) => e.auto).forEach((entry, i) => {
    const s = lotFromTemplate(roomId, entry, i);
    lots.push(s.lot);
    tasks.push(...s.tasks);
  });
  return { lots, tasks };
}

// Fait = 100 %, à faire = 0 %. En cours / bloqué gardent l'avancement
// (sauf en quittant « fait » : on repart de 0).
export function setStatus(task, status, now = new Date()) {
  if (!STATUSES.includes(status)) throw new Error(`Statut inconnu : ${status}`);
  let doneAt = null;
  if (status === 'done') doneAt = task.status === 'done' && task.doneAt ? task.doneAt : now.toISOString();
  let progress = task.progress ?? 0;
  if (status === 'done') progress = 100;
  else if (status === 'todo' || task.status === 'done') progress = 0;
  return { ...task, status, doneAt, progress };
}

// Règle l'avancement en % et en déduit le statut : 0 → à faire, 1-99 → en cours, 100 → fait.
// Une tâche bloquée reste bloquée tant qu'elle n'atteint pas 100 %.
export function setProgress(task, pct, now = new Date()) {
  const p = Math.min(100, Math.max(0, Math.round(Number(pct) || 0)));
  if (p === 100) return setStatus(task, 'done', now);
  let status = task.status;
  if (status === 'done' || status === 'todo' || status === 'doing') status = p > 0 ? 'doing' : 'todo';
  return { ...task, status, doneAt: null, progress: p };
}

export function toggleDone(task, now = new Date()) {
  return setStatus(task, task.status === 'done' ? 'todo' : 'done', now);
}

// Une tâche qui a des sous-tâches est « faite » quand toutes ses sous-tâches le sont.
export function syncParent(parent, children, now = new Date()) {
  if (!children.length) return parent;
  const allDone = children.every((c) => c.status === 'done');
  if (allDone && parent.status !== 'done') return setStatus(parent, 'done', now);
  if (!allDone && parent.status === 'done') return setStatus(parent, 'todo', now);
  return parent;
}

// Change le statut d'une tâche principale en répercutant sur ses sous-tâches :
// « fait » coche toutes les sous-tâches, décocher une tâche faite les décoche toutes.
// Renvoie la tâche et les sous-tâches modifiées.
export function cascadeStatus(parent, children, status, now = new Date()) {
  if (!children.length) return { parent: setStatus(parent, status, now), children: [] };
  let changed = [];
  if (status === 'done') changed = children.filter((c) => c.status !== 'done').map((c) => setStatus(c, 'done', now));
  else if (status === 'todo' && parent.status === 'done') changed = children.filter((c) => c.status === 'done').map((c) => setStatus(c, 'todo', now));
  const merged = children.map((c) => changed.find((x) => x.id === c.id) ?? c);
  return { parent: syncParent(setStatus(parent, status, now), merged, now), children: changed };
}

// Change le statut d'une tâche (principale ou sous-tâche) et renvoie toutes les tâches
// à réenregistrer. lotTasks = les tâches du même lot (pour trouver parent et sous-tâches).
export function applyStatusChange(task, lotTasks, status, now = new Date()) {
  if (task.parentId) return withParentSync(setStatus(task, status, now), lotTasks, now);
  const res = cascadeStatus(task, lotTasks.filter((x) => x.parentId === task.id), status, now);
  return [res.parent, ...res.children];
}

// Même chose pour un avancement en % (tâche sans sous-tâches, ou sous-tâche).
export function applyProgressChange(task, lotTasks, pct, now = new Date()) {
  const updated = setProgress(task, pct, now);
  return task.parentId ? withParentSync(updated, lotTasks, now) : [updated];
}

function withParentSync(updated, lotTasks, now) {
  const parent = lotTasks.find((x) => x.id === updated.parentId);
  if (!parent) return [updated];
  const siblings = lotTasks.filter((x) => x.parentId === updated.parentId).map((x) => (x.id === updated.id ? updated : x));
  const synced = syncParent(parent, siblings, now);
  return synced === parent ? [updated] : [updated, synced];
}

// Filtre de date de la galerie : '' (tout), '7' / '30' (derniers jours), 'm:2026-10' (un mois).
export function inPeriod(iso, period, now = new Date()) {
  if (!period) return true;
  if (period.startsWith('m:')) return dayKey(iso).startsWith(period.slice(2));
  return now - new Date(iso) <= Number(period) * 86_400_000;
}

// Notes de pièce : « # Titre », « - élément de liste », sinon paragraphe.
export function parseNotes(text) {
  const blocks = [];
  let list = null;
  for (const raw of (text ?? '').split('\n')) {
    const line = raw.trim();
    const item = line.match(/^[-*•]\s+(.*)$/);
    if (item) {
      if (!list) blocks.push((list = { type: 'list', items: [] }));
      list.items.push(item[1]);
      continue;
    }
    list = null;
    if (!line) continue;
    const title = line.match(/^#{1,3}\s+(.*)$/);
    blocks.push(title ? { type: 'title', text: title[1] } : { type: 'text', text: line });
  }
  return blocks;
}

// Dimensions réduites pour que le plus grand côté ne dépasse pas `max` (jamais agrandi).
export function fitSize(width, height, max) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function mediaStats(items) {
  return { count: items.length, bytes: items.reduce((s, x) => s + (x.size ?? 0) + (x.thumbSize ?? 0), 0) };
}

const safeName = (name) => String(name).replace(/[\\/:*?"<>|]+/g, '_');
export const photoPath = (id) => `photos/${id}.jpg`;
export const thumbPath = (id) => `photos/miniatures/${id}.jpg`;
export const filePath = (meta) => `fichiers/${meta.id}-${safeName(meta.name)}`;

// Copie les lots et tâches d'une pièce vers une autre. N'ajoute que ce qui manque
// (comparaison sur le nom), ne supprime rien, remet les statuts à « à faire ».
export function copyStructure({ source, target }) {
  const norm = (s) => s.trim().toLowerCase();
  const lots = [];
  const tasks = [];
  let lotOrder = nextOrder(target.lots);
  for (const sLot of sortByOrder(source.lots)) {
    let tLot = target.lots.find((l) => norm(l.name) === norm(sLot.name));
    if (!tLot) {
      tLot = newLot({ roomId: target.roomId, name: sLot.name, templateKey: sLot.templateKey ?? null, order: lotOrder++ });
      lots.push(tLot);
    }
    const tTop = target.tasks.filter((t) => t.lotId === tLot.id && !t.parentId);
    const existing = new Set(tTop.map((t) => norm(t.title)));
    let taskOrder = nextOrder(tTop);
    for (const st of sortByOrder(source.tasks.filter((t) => t.lotId === sLot.id && !t.parentId))) {
      if (existing.has(norm(st.title))) continue;
      const nt = { ...newTask({ lotId: tLot.id, roomId: target.roomId, title: st.title, order: taskOrder++ }), milestone: st.milestone ?? null };
      tasks.push(nt);
      sortByOrder(source.tasks.filter((c) => c.parentId === st.id)).forEach((c, i) => {
        tasks.push(newTask({ lotId: tLot.id, roomId: target.roomId, title: c.title, order: i, parentId: nt.id }));
      });
    }
  }
  return { lots, tasks };
}

export function makeBackup(data, appVersion, now = new Date()) {
  return { app: BACKUP_APP_ID, format: BACKUP_FORMAT, appVersion, exportedAt: now.toISOString(), data };
}

// Anciennes sauvegardes : format 1 (V0) sans photos ni pièces jointes,
// formats 1 et 2 sans courses ni stock.
export function normalizeBackup(obj) {
  if (!obj?.data || typeof obj.data !== 'object' || !(obj.format < 3)) return obj;
  const d = { ...obj.data, needs: obj.data.needs ?? [], stock: obj.data.stock ?? [] };
  if (obj.format === 1) Object.assign(d, { photos: obj.data.photos ?? [], files: obj.data.files ?? [] });
  return { ...obj, data: d };
}

export function validateBackup(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') return { ok: false, errors: ['Le fichier ne contient pas de données lisibles.'] };
  if (obj.app !== BACKUP_APP_ID) errors.push('Ce fichier n’est pas une sauvegarde de cette application.');
  if (typeof obj.format !== 'number' || obj.format > BACKUP_FORMAT) {
    errors.push(`Format de sauvegarde non pris en charge (${obj.format}). Mettez l’application à jour.`);
  }
  const d = obj.data;
  if (!d || typeof d !== 'object') errors.push('Le fichier ne contient pas de données (section « data » absente).');
  else for (const s of [...DATA_STORES, ...MEDIA_STORES]) if (!Array.isArray(d[s])) errors.push(`Liste « ${s} » absente ou invalide.`);
  if (errors.length) return { ok: false, errors };

  for (const s of ['levels', 'rooms', 'lots', 'tasks', 'needs', 'stock', ...MEDIA_STORES]) {
    if (d[s].some((x) => !x || typeof x.id !== 'string')) errors.push(`Élément sans identifiant dans « ${s} ».`);
  }
  if (d.meta.some((x) => !x || typeof x.key !== 'string')) errors.push('Réglage sans clé dans « meta ».');
  const ids = (list) => new Set(list.map((x) => x.id));
  const levelIds = ids(d.levels);
  const roomIds = ids(d.rooms);
  const lotIds = ids(d.lots);
  const broken = (list, field, valid) => list.filter((x) => !valid.has(x[field])).length;
  const checks = [
    [broken(d.rooms, 'levelId', levelIds), 'pièce(s) rattachée(s) à un niveau inexistant'],
    [broken(d.lots, 'roomId', roomIds), 'lot(s) rattaché(s) à une pièce inexistante'],
    [broken(d.tasks, 'lotId', lotIds), 'tâche(s) rattachée(s) à un lot inexistant'],
  ];
  for (const [n, msg] of checks) if (n) errors.push(`${n} ${msg}.`);
  return { ok: !errors.length, errors };
}

const pad = (n) => String(n).padStart(2, '0');

export function backupFileName(now = new Date(), ext = 'zip') {
  const d = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `suivi-chantier-${d}-${pad(now.getHours())}h${pad(now.getMinutes())}.${ext}`;
}

export function dayKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDay(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function daysSince(iso, now = new Date()) {
  if (!iso) return Infinity;
  return Math.floor((now - new Date(iso)) / 86_400_000);
}

export function formatDate(iso) {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatBytes(n) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} Ko`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} Mo`;
  return `${(n / 1024 ** 3).toFixed(1)} Go`;
}

// ---------- Courses et stock ----------

// « Plaque BA13 » et « plaque  ba13 » désignent le même article (accents et casse ignorés).
const normText = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
export const articleKey = (name, unit) => `${normText(name)}|${normText(unit)}`;

const round2 = (n) => Math.round(n * 100) / 100;

// « 2,5 » → 2.5 ; vide ou invalide → null.
export function parseQty(value) {
  const n = parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? round2(n) : null;
}

export const formatQty = (n) => String(round2(Number(n) || 0)).replace('.', ',');
export const qtyLabel = (qty, unit) => `${formatQty(qty)}${unit ? ` ${unit}` : ''}`;

export function newNeed({ roomId = null, lotId = null, category = null, name, qty = 1, unit = '' }, now = new Date()) {
  return { id: uid(), roomId, lotId, category, name: name.trim(), qty: qty ?? 1, unit: (unit ?? '').trim(), note: '', createdAt: now.toISOString(), boughtAt: null };
}

// Synthèse de toutes les pièces : besoins non achetés regroupés par article (nom + unité),
// moins ce qu'il y a en stock. categoryOf(need) donne la catégorie (le nom du lot en général).
export function shoppingSummary(needs, stock, categoryOf) {
  const inStock = new Map();
  for (const s of stock) {
    const k = articleKey(s.name, s.unit);
    inStock.set(k, (inStock.get(k) ?? 0) + (Number(s.qty) || 0));
  }
  const groups = new Map();
  for (const n of needs.filter((x) => !x.boughtAt)) {
    const k = articleKey(n.name, n.unit);
    if (!groups.has(k)) groups.set(k, { key: k, name: n.name.trim(), unit: (n.unit ?? '').trim(), needed: 0, needs: [], cats: new Map() });
    const g = groups.get(k);
    g.needed += Number(n.qty) || 0;
    g.needs.push(n);
    const c = categoryOf(n);
    g.cats.set(c, (g.cats.get(c) ?? 0) + 1);
  }
  return [...groups.values()].map(({ cats, ...g }) => {
    const have = round2(inStock.get(g.key) ?? 0);
    return {
      ...g,
      needed: round2(g.needed),
      inStock: have,
      toBuy: Math.max(0, round2(g.needed - have)),
      category: [...cats].sort((a, b) => b[1] - a[1])[0][0],
    };
  }).sort((a, b) => a.category.localeCompare(b.category, 'fr')
    || Number(a.toBuy === 0) - Number(b.toBuy === 0)
    || a.name.localeCompare(b.name, 'fr'));
}

// Liste à partager (SMS, Notes…) : uniquement ce qui reste à acheter.
export function shoppingText(summary, now = new Date()) {
  const lines = [`🛒 Courses chantier — ${now.toLocaleDateString('fr-FR')}`];
  let category = null;
  for (const a of summary.filter((x) => x.toBuy > 0)) {
    if (a.category !== category) {
      category = a.category;
      lines.push('', category.toUpperCase());
    }
    lines.push(`☐ ${a.name} : ${qtyLabel(a.toBuy, a.unit)}`);
  }
  if (lines.length === 1) lines.push('', 'Rien à acheter 🎉');
  return lines.join('\n');
}

// Bibliothèque d'articles d'un lot, éditée sous forme de texte : « Nom ; unité ; quantité ».
export function parseArticles(text) {
  return String(text ?? '').split('\n').map((line) => {
    const [name, unit = '', qty = ''] = line.split(';').map((s) => s.trim());
    return name ? { name, unit, qty: parseQty(qty) } : null;
  }).filter(Boolean);
}

export function formatArticles(articles) {
  return (articles ?? []).map((a) => [a.name, a.unit ?? '', a.qty != null ? formatQty(a.qty) : ''].join(' ; ').replace(/( ; )+$/, '')).join('\n');
}
