// Sauvegarde (export) et restauration (import) d'un fichier .json.
import { exportAll, replaceAll, saveSnapshot, setMeta } from './db.js';
import { makeBackup, validateBackup, backupFileName } from './model.js';
import { VERSION } from './version.js';

export async function prepareExport() {
  const now = new Date();
  const data = await exportAll();
  const json = JSON.stringify(makeBackup(data, VERSION, now));
  const name = backupFileName(now);
  return {
    file: new File([json], name, { type: 'application/json' }),
    size: json.length,
    counts: { rooms: data.rooms.length, tasks: data.tasks.length },
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

export const markBackupDone = () => setMeta('lastBackupAt', new Date().toISOString());

export async function readBackupFile(file) {
  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    return { ok: false, errors: ['Ce fichier n’est pas un fichier de sauvegarde lisible (JSON invalide).'] };
  }
  return { ...validateBackup(backup), backup };
}

export async function applyBackup(backup) {
  await saveSnapshot('Avant import d’une sauvegarde');
  await replaceAll(backup.data);
  await setMeta('lastBackupAt', backup.exportedAt);
}
