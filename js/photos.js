// Photos : compression, ajout (appareil photo ou photothèque), miniatures, visionneuse plein écran.
import * as db from './db.js';
import { h, askText, confirmBox, toast } from './ui.js';
import { uid, fitSize, formatDate, DEFAULT_PHOTO_SETTINGS } from './model.js';
import { deliverFile } from './backup.js';

export async function photoSettings() {
  return { ...DEFAULT_PHOTO_SETTINGS, ...(await db.getMeta('photoSettings', {})) };
}

// Réduit l'image (côté long ≤ maxSide), la convertit en JPEG et fabrique une miniature.
export async function compressImage(file, { maxSide, quality, thumbSide }) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const full = drawScaled(img, img.naturalWidth, img.naturalHeight, maxSide);
    const blob = await toJpeg(full, quality);
    const mini = drawScaled(full, full.width, full.height, thumbSide);
    const thumb = await toJpeg(mini, 0.7);
    const result = { blob, thumb, width: full.width, height: full.height };
    full.width = full.height = mini.width = mini.height = 0; // libère la mémoire (important sur iPhone)
    return result;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawScaled(source, width, height, max) {
  const size = fitSize(width, height, max);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, size.width, size.height);
  return canvas;
}

const toJpeg = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Compression impossible'))), 'image/jpeg', quality);
});

// target : { roomId, taskId?, lotId?, phase? }
export async function addPhotos(files, target) {
  const settings = await photoSettings();
  let added = 0;
  for (const [i, file] of files.entries()) {
    if (files.length > 1) toast(`Photo ${i + 1} / ${files.length}…`);
    try {
      const { blob, thumb, width, height } = await compressImage(file, settings);
      const meta = {
        id: uid(), roomId: target.roomId, taskId: target.taskId ?? null, lotId: target.lotId ?? null, phase: target.phase ?? null,
        caption: '', createdAt: new Date().toISOString(), width, height, type: 'image/jpeg', size: blob.size, thumbSize: thumb.size, thumb,
      };
      await db.saveMedia([{ store: 'photos', meta, blob }]);
      added++;
    } catch (e) {
      console.error(e);
      toast(`Image ${file.name} illisible`);
    }
  }
  if (added) toast(added > 1 ? `${added} photos ajoutées` : 'Photo ajoutée');
  return added;
}

// Deux boutons : appareil photo (capture directe) et photothèque (plusieurs à la fois).
export function photoButtons(target, onAdded) {
  const input = (capture) => h('input', {
    type: 'file', accept: 'image/*', capture: capture ? 'environment' : null, multiple: !capture, hidden: true,
    onchange: async (e) => {
      const files = [...e.target.files];
      e.target.value = '';
      if (files.length && (await addPhotos(files, target))) onAdded?.();
    },
  });
  const camera = input(true);
  const library = input(false);
  return h('div', { class: 'photo-btns' },
    h('button', { type: 'button', class: 'btn', onclick: () => camera.click() }, '📷 Prendre une photo'),
    h('button', { type: 'button', class: 'btn', onclick: () => library.click() }, '🖼️ Photothèque'),
    camera, library);
}

// Adresses des miniatures, gardées pendant la session (les miniatures ne changent jamais).
const thumbUrls = new Map();
function thumbUrl(photo) {
  if (!photo.thumb) return '';
  if (!thumbUrls.has(photo.id)) thumbUrls.set(photo.id, URL.createObjectURL(photo.thumb));
  return thumbUrls.get(photo.id);
}

export function thumbGrid(photos, onOpen) {
  if (!photos.length) return h('p', { class: 'muted small' }, 'Aucune photo.');
  return h('div', { class: 'thumbs' }, photos.map((p, i) => {
    const img = h('img', { src: thumbUrl(p) || null, alt: p.caption || 'Photo', loading: 'lazy' });
    if (!p.thumb) db.getBlob(p.id).then((b) => { if (b) img.src = URL.createObjectURL(b); });
    return h('button', { type: 'button', class: 'thumb', 'aria-label': p.caption || `Photo ${i + 1}`, onclick: () => onOpen(i) }, img);
  }));
}

// Visionneuse plein écran : on glisse le doigt pour passer d'une photo à l'autre.
// describe(photo) donne le contexte (pièce, tâche…). La promesse renvoie true si
// une photo a été modifiée ou supprimée.
export function openViewer(photos, start = 0, describe = () => '') {
  return new Promise((resolve) => {
    let list = [...photos];
    let changed = false;
    let index = start;
    const fullUrls = [];
    const counter = h('span', { class: 'viewer-count' });
    const caption = h('div', { class: 'viewer-caption' });
    const slides = list.map((p) => h('div', { class: 'slide' }, h('img', { src: thumbUrl(p) || null, alt: p.caption || 'Photo' })));
    const track = h('div', { class: 'viewer-track' }, slides);
    const dlg = h('dialog', { class: 'viewer' },
      h('div', { class: 'viewer-bar' },
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Fermer', onclick: () => dlg.close() }, '✕'),
        counter,
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Partager', onclick: share }, '📤'),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Modifier la légende', onclick: editCaption }, '✏️'),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Supprimer', onclick: remove }, '🗑')),
      track, caption);

    // Chargement de la photo en grand quand elle approche de l'écran.
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting || e.target.dataset.loaded) continue;
        e.target.dataset.loaded = '1';
        const p = list[slides.indexOf(e.target)];
        if (!p) continue;
        db.getBlob(p.id).then((b) => {
          if (!b) return;
          const url = URL.createObjectURL(b);
          fullUrls.push(url);
          e.target.querySelector('img').src = url;
        });
      }
    }, { root: track, rootMargin: '0px 100%' });
    slides.forEach((s) => observer.observe(s));

    function update() {
      const p = list[index];
      if (!p) return;
      counter.textContent = `${index + 1} / ${list.length}`;
      caption.replaceChildren(...[
        p.caption ? h('strong', null, p.caption) : null,
        h('div', null, [describe(p), formatDate(p.createdAt)].filter(Boolean).join(' · ')),
      ].filter(Boolean));
    }
    function go(i) {
      track.scrollLeft = i * track.clientWidth;
    }
    track.addEventListener('scroll', () => {
      const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      if (i !== index && i >= 0 && i < list.length) { index = i; update(); }
    }, { passive: true });

    async function share() {
      const p = list[index];
      const blob = await db.getBlob(p.id);
      if (blob) await deliverFile(new File([blob], `${(p.caption || 'photo').replace(/[\\/:*?"<>|]+/g, '_')}.jpg`, { type: 'image/jpeg' }));
    }
    async function editCaption() {
      const p = list[index];
      const text = await askText({ title: 'Légende', label: 'Légende de la photo', value: p.caption ?? '', multiline: false });
      if (text == null) return;
      const updated = { ...p, caption: text };
      await db.put('photos', updated);
      list[index] = updated;
      changed = true;
      update();
    }
    async function remove() {
      const p = list[index];
      const ok = await confirmBox({ title: 'Supprimer la photo ?', message: 'Elle ira dans la corbeille (Réglages → Corbeille), d’où vous pourrez la récupérer.', ok: 'Supprimer', danger: true });
      if (!ok) return;
      await db.trashMedia('photos', [p], 'Supprimée depuis la visionneuse');
      changed = true;
      slides[index].remove();
      slides.splice(index, 1);
      list.splice(index, 1);
      if (!list.length) { dlg.close(); return; }
      index = Math.min(index, list.length - 1);
      go(index);
      update();
    }

    dlg.addEventListener('close', () => {
      observer.disconnect();
      fullUrls.forEach((u) => URL.revokeObjectURL(u));
      dlg.remove();
      resolve(changed);
    });
    document.body.append(dlg);
    dlg.showModal();
    update();
    requestAnimationFrame(() => go(index));
  });
}

// Pièce jointe : image → visionneuse simple, PDF → affichage intégré + bouton partager.
export async function openAttachment(file) {
  const blob = await db.getBlob(file.id);
  if (!blob) { toast('Fichier introuvable'); return; }
  const url = URL.createObjectURL(blob);
  const isPdf = file.type === 'application/pdf';
  const dlg = h('dialog', { class: 'viewer' },
    h('div', { class: 'viewer-bar' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Fermer', onclick: () => dlg.close() }, '✕'),
      h('span', { class: 'viewer-count' }, file.name),
      h('button', {
        type: 'button', class: 'icon-btn', 'aria-label': 'Partager ou ouvrir avec…',
        onclick: () => deliverFile(new File([blob], file.name, { type: file.type })),
      }, '📤')),
    isPdf
      ? h('iframe', { class: 'viewer-doc', src: url, title: file.name })
      : h('div', { class: 'viewer-track' }, h('div', { class: 'slide' }, h('img', { src: url, alt: file.name }))),
    isPdf ? h('div', { class: 'viewer-caption' }, 'Si le PDF s’affiche mal, touchez 📤 puis « Enregistrer dans Fichiers » ou une app de lecture.') : null);
  dlg.addEventListener('close', () => { URL.revokeObjectURL(url); dlg.remove(); });
  document.body.append(dlg);
  dlg.showModal();
}

export async function addAttachments(files, roomId) {
  const items = [];
  for (const f of files) {
    const type = f.type || 'application/octet-stream';
    // Copie du contenu : sur iPhone, le fichier choisi n'est qu'un fichier temporaire.
    const blob = new Blob([await f.arrayBuffer()], { type });
    items.push({ store: 'files', meta: { id: uid(), roomId, name: f.name, type, size: blob.size, createdAt: new Date().toISOString() }, blob });
  }
  await db.saveMedia(items);
  toast(items.length > 1 ? `${items.length} fichiers ajoutés` : 'Fichier ajouté');
}
