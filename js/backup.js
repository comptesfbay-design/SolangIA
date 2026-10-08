// Sauvegarde complète (.zip avec photos et pièces jointes) et restauration (.zip ou ancien .json).
import * as db from './db.js';
import { backupFileName, normalizeBackup, validateBackup } from './model.js';
import { buildBackupZip, readBackupZip } from './zip.js';
import { VERSION } from './version.js';

// JSZip (copie locale dans vendor/, gardée hors connexion) n'est chargé qu'au besoin.
let jszipPromise = null;
function loadJSZip() {
  jszipPromise ??= new Promise((resolve, reject) => {
    if (window.JSZip) return resolve(window.JSZip);
    const s = document.createElement('script');
    s.src = 'vendor/jszip.min.js';
    s.onload = () => resolve(window.JSZip);
    s.onerror = () => { jszipPromise = null; reject(new Error('Impossible de charger l’outil de création de .zip.')); };
    document.head.append(s);
  });
  return jszipPromise;
}

export async function prepareExport(onProgress) {
  const JSZip = await loadJSZip();
  const now = new Date();
  const [data, photoList, fileList] = await Promise.all([db.exportAll(), db.activeMedia('photos'), db.activeMedia('files')]);
  const photos = [];
  for (const { thumb, ...meta } of photoList) {
    const blob = await db.getBlob(meta.id);
    if (blob) photos.push({ meta, blob, thumb });
  }
  const files = [];
  for (const meta of fileList) {
    const blob = await db.getBlob(meta.id);
    if (blob) files.push({ meta, blob });
  }
  const zip = buildBackupZip(JSZip, { data, photos, files, appVersion: VERSION, now });
  // Les photos sont déjà compressées : on les range sans recompresser (plus rapide).
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, (m) => onProgress?.(Math.round(m.percent)));
  const name = backupFileName(now, 'zip');
  return {
    file: new File([blob], name, { type: 'application/zip' }),
    size: blob.size,
    counts: { rooms: data.rooms.length, tasks: data.tasks.length, photos: photos.length, files: files.length },
  };
}

// À appeler directement dans le clic, sans `await` avant :
// iOS refuse d'ouvrir la feuille de partage si on a attendu autre chose avant.
export async function deliverFile(file) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
      // autre erreur : on se rabat sur le téléchargement
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}

export const markBackupDone = () => db.setMeta('lastBackupAt', new Date().toISOString());

// Accepte le .zip (V1 et suivantes) et l'ancien .json (V0, sans photos).
export async function readBackupFile(file) {
  const isJson = file.name.toLowerCase().endsWith('.json') || file.type === 'application/json';
  if (!isJson) return readBackupZip(await loadJSZip(), file);
  let backup;
  try {
    backup = normalizeBackup(JSON.parse(await file.text()));
  } catch {
    return { ok: false, errors: ['Ce fichier n’est pas un fichier de sauvegarde lisible (JSON invalide).'] };
  }
  const v = validateBackup(backup);
  return v.ok ? { ...v, backup, photos: [], files: [], missing: [] } : v;
}

// Remplace les données par celles de la sauvegarde. Avant : copie de sécurité de la
// structure, et les photos / pièces jointes actuelles absentes de la sauvegarde vont à la corbeille.
export async function applyBackup({ backup, photos, files }) {
  await db.saveSnapshot('Avant import d’une sauvegarde');
  await db.replaceAll(backup.data);
  const imported = new Set([...photos, ...files].map((x) => x.meta.id));
  const [curPhotos, curFiles] = await Promise.all([db.activeMedia('photos'), db.activeMedia('files')]);
  const reason = 'Remplacée lors d’un import';
  await db.trashMedia('photos', curPhotos.filter((x) => !imported.has(x.id)), reason);
  await db.trashMedia('files', curFiles.filter((x) => !imported.has(x.id)), reason);
  for (const p of photos) {
    const { deletedAt, deletedReason, ...meta } = p.meta;
    await db.saveMedia([{ store: 'photos', meta: { ...meta, thumb: p.thumb ?? null }, blob: p.blob }]);
  }
  for (const f of files) {
    const { deletedAt, deletedReason, ...meta } = f.meta;
    await db.saveMedia([{ store: 'files', meta, blob: f.blob }]);
  }
  await db.setMeta('lastBackupAt', backup.exportedAt);
}

// Nombre de photos / pièces jointes actuelles qui iraient à la corbeille avec cet import.
export async function countReplacedMedia({ photos, files }) {
  const imported = new Set([...photos, ...files].map((x) => x.meta.id));
  const [curPhotos, curFiles] = await Promise.all([db.activeMedia('photos'), db.activeMedia('files')]);
  return [...curPhotos, ...curFiles].filter((x) => !imported.has(x.id)).length;
}
