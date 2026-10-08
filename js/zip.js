// Fabrication et lecture de la sauvegarde .zip. JSZip est passé en paramètre :
// ce fichier ne dépend pas du navigateur et peut être testé avec `npm test`.
//
// Contenu du .zip :
//   sauvegarde.json            toutes les données (pièces, tâches, réglages, infos des photos…)
//   photos/<id>.jpg            les photos
//   photos/miniatures/<id>.jpg les miniatures
//   fichiers/<id>-<nom>        les pièces jointes (PDF, plans…)
import { makeBackup, normalizeBackup, validateBackup, photoPath, thumbPath, filePath } from './model.js';

export const BACKUP_ENTRY = 'sauvegarde.json';

// photos : [{ meta, blob, thumb }]   files : [{ meta, blob }]
export function buildBackupZip(JSZip, { data, photos, files, appVersion, now = new Date() }) {
  const zip = new JSZip();
  const backup = makeBackup({ ...data, photos: photos.map((p) => p.meta), files: files.map((f) => f.meta) }, appVersion, now);
  zip.file(BACKUP_ENTRY, JSON.stringify(backup), { compression: 'DEFLATE' });
  for (const p of photos) {
    zip.file(photoPath(p.meta.id), p.blob);
    if (p.thumb) zip.file(thumbPath(p.meta.id), p.thumb);
  }
  for (const f of files) zip.file(filePath(f.meta), f.blob);
  return zip;
}

// blobType : 'blob' dans le navigateur, 'uint8array' dans les tests.
export async function readBackupZip(JSZip, input, blobType = 'blob') {
  let zip;
  try {
    zip = await JSZip.loadAsync(input);
  } catch {
    return { ok: false, errors: ['Ce fichier n’est pas un .zip lisible.'] };
  }
  const entry = zip.file(BACKUP_ENTRY);
  if (!entry) return { ok: false, errors: ['Ce .zip ne contient pas de sauvegarde de l’application (sauvegarde.json absent).'] };
  let backup;
  try {
    backup = normalizeBackup(JSON.parse(await entry.async('string')));
  } catch {
    return { ok: false, errors: ['Le fichier sauvegarde.json est illisible.'] };
  }
  const v = validateBackup(backup);
  if (!v.ok) return v;

  const read = async (path, type) => {
    const f = zip.file(path);
    if (!f) return null;
    const content = await f.async(blobType);
    return blobType === 'blob' ? new Blob([content], { type }) : content;
  };
  const missing = [];
  const photos = [];
  for (const meta of backup.data.photos) {
    const blob = await read(photoPath(meta.id), 'image/jpeg');
    if (!blob) { missing.push(meta.caption || meta.id); continue; }
    photos.push({ meta, blob, thumb: await read(thumbPath(meta.id), 'image/jpeg') });
  }
  const files = [];
  for (const meta of backup.data.files) {
    const blob = await read(filePath(meta), meta.type);
    if (!blob) { missing.push(meta.name); continue; }
    files.push({ meta, blob });
  }
  return { ok: true, errors: [], backup, photos, files, missing };
}
