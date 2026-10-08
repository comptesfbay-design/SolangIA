// Fonctions « pures » : aucune dépendance au navigateur, testables avec `npm test`.

export const STATUSES = ['todo', 'doing', 'done', 'blocked'];
export const STATUS_LABELS = { todo: 'À faire', doing: 'En cours', done: 'Fait', blocked: 'Bloqué' };
export const STATUS_ICONS = { todo: '○', doing: '◐', done: '✓', blocked: '⛔' };

export const BACKUP_APP_ID = 'suivi-chantier-solange';
export const BACKUP_FORMAT = 1;
export const DATA_STORES = ['levels', 'rooms', 'lots', 'tasks', 'meta'];

// Modèle de lots : `auto: true` = ajouté automatiquement à chaque nouvelle pièce.
// L'ordre des lots suit l'ordre logique du chantier.
export const DEFAULT_CATALOGUE = [
  {
    key: 'elec-reseaux', name: 'Électricité — gaines et boîtes', auto: true,
    tasks: ['Emplacements et hauteurs validés', 'Boîtes d’encastrement posées', 'Gaines tirées', 'Photo des réseaux avant fermeture'],
  },
  {
    key: 'plomberie', name: 'Plomberie', auto: true,
    tasks: ['Alimentations posées', 'Évacuations posées', 'Test d’étanchéité / mise en pression', 'Photo des réseaux avant fermeture'],
  },
  {
    key: 'cloisons', name: 'Cloisons / doublages', auto: true,
    tasks: ['Ossatures posées', 'Isolant posé', 'Renforts posés (meubles, sanitaires)', 'Plaques posées'],
  },
  {
    key: 'plafonds', name: 'Plafonds', auto: true,
    tasks: ['Suspentes et ossature posées', 'Isolant posé', 'Réservations spots / trappes', 'Plaques posées'],
  },
  {
    key: 'bandes', name: 'Bandes', auto: true,
    tasks: ['Bandes posées', 'Angles et cornières', 'Ponçage'],
  },
  {
    key: 'enduit', name: 'Enduit', auto: true,
    tasks: ['Première passe', 'Deuxième passe / lissage', 'Ponçage final', 'Dépoussiérage'],
  },
  {
    key: 'peinture', name: 'Peinture', auto: true,
    tasks: ['Protections sols et menuiseries', 'Sous-couche', 'Première couche', 'Deuxième couche', 'Retouches'],
  },
  {
    key: 'elec-finition', name: 'Finition électricité', auto: true,
    tasks: ['Appareillage posé (prises, interrupteurs)', 'Luminaires raccordés', 'Repérage au tableau', 'Tests de fonctionnement'],
  },
  {
    key: 'vmc', name: 'VMC', auto: false,
    tasks: ['Bouches posées', 'Gaines raccordées', 'Test de fonctionnement'],
  },
  {
    key: 'menuiseries', name: 'Menuiseries', auto: false,
    tasks: ['Dépose de l’existant', 'Pose', 'Calfeutrement / étanchéité', 'Réglages'],
  },
  {
    key: 'sol', name: 'Sol / ragréage', auto: false,
    tasks: ['Préparation du support', 'Primaire', 'Ragréage', 'Revêtement posé'],
  },
];

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

// Avancement : on compte les tâches « feuilles » (une tâche qui a des sous-tâches
// est représentée par ses sous-tâches). Arrondi vers le bas : 100 % = tout est fait.
export function progress(tasks) {
  const parents = new Set(tasks.map((t) => t.parentId).filter(Boolean));
  const leaves = tasks.filter((t) => !parents.has(t.id));
  const done = leaves.filter((t) => t.status === 'done').length;
  const total = leaves.length;
  return { done, total, pct: total ? Math.floor((done / total) * 100) : 0 };
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
    status: 'todo', comment: '', doneAt: null, milestone: null, dependsOn: [],
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

export function setStatus(task, status, now = new Date()) {
  if (!STATUSES.includes(status)) throw new Error(`Statut inconnu : ${status}`);
  let doneAt = null;
  if (status === 'done') doneAt = task.status === 'done' && task.doneAt ? task.doneAt : now.toISOString();
  return { ...task, status, doneAt };
}

export function toggleDone(task, now = new Date()) {
  return setStatus(task, task.status === 'done' ? 'todo' : 'done', now);
}

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

export function validateBackup(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') return { ok: false, errors: ['Le fichier ne contient pas de données lisibles.'] };
  if (obj.app !== BACKUP_APP_ID) errors.push('Ce fichier n’est pas une sauvegarde de cette application.');
  if (typeof obj.format !== 'number' || obj.format > BACKUP_FORMAT) {
    errors.push(`Format de sauvegarde non pris en charge (${obj.format}). Mettez l’application à jour.`);
  }
  const d = obj.data;
  if (!d || typeof d !== 'object') errors.push('Le fichier ne contient pas de données (section « data » absente).');
  else for (const s of DATA_STORES) if (!Array.isArray(d[s])) errors.push(`Liste « ${s} » absente ou invalide.`);
  if (errors.length) return { ok: false, errors };

  for (const s of ['levels', 'rooms', 'lots', 'tasks']) {
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

export function backupFileName(now = new Date()) {
  const d = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `suivi-chantier-${d}-${pad(now.getHours())}h${pad(now.getMinutes())}.json`;
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
