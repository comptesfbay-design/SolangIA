// Petits outils d'interface : création d'éléments, fenêtres de dialogue, appui long.

const PROPS = new Set(['value', 'checked', 'open', 'selected']);

// h('button', { class: 'btn', onclick: fn }, 'Texte') → <button class="btn">Texte</button>
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (PROPS.has(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...children.flat(Infinity).filter((c) => c != null && c !== false).map((c) => (c instanceof Node ? c : String(c))));
  return el;
}

// Fenêtre qui monte du bas de l'écran. `build(close)` fournit le contenu ;
// la promesse renvoie la valeur passée à close() (null si on ferme sans choisir).
export function sheet(title, build) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'sheet' });
    let result = null;
    const close = (value = null) => { result = value; dlg.close(); };
    dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    dlg.append(h('div', { class: 'sheet-inner' },
      h('div', { class: 'sheet-head' },
        h('h2', null, title),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Fermer', onclick: () => close() }, '✕')),
      build(close)));
    document.body.append(dlg);
    dlg.showModal();
  });
}

export function askText({ title, label, value = '', placeholder = '', ok = 'Valider', multiline = false }) {
  return sheet(title, (close) => {
    const input = h(multiline ? 'textarea' : 'input', {
      class: 'field', value, placeholder, rows: multiline ? 8 : null, enterkeyhint: multiline ? null : 'done', autocomplete: 'off',
    });
    const submit = (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (v || multiline) close(v);
    };
    return h('form', { onsubmit: submit },
      h('label', { class: 'lbl' }, label ?? '', input),
      h('div', { class: 'sheet-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => close() }, 'Annuler'),
        h('button', { type: 'submit', class: 'btn primary' }, ok)));
  });
}

export async function confirmBox({ title, message, ok = 'Confirmer', cancel = 'Annuler', danger = false }) {
  const r = await sheet(title, (close) => [
    h('p', { class: 'msg' }, message),
    h('div', { class: 'sheet-actions' },
      h('button', { type: 'button', class: 'btn', onclick: () => close(false) }, cancel),
      h('button', { type: 'button', class: `btn ${danger ? 'danger' : 'primary'}`, onclick: () => close(true) }, ok)),
  ]);
  return r === true;
}

// options : [{ label, value, hint?, danger?, disabled? }]
export function choose({ title, message, options }) {
  return sheet(title, (close) => [
    message ? h('p', { class: 'msg muted' }, message) : null,
    options.map((o) => h('button', {
      type: 'button', class: `opt${o.danger ? ' danger' : ''}`, disabled: !!o.disabled, onclick: () => close(o.value),
    }, o.label, o.hint ? h('small', null, o.hint) : null)),
    options.length ? null : h('p', { class: 'muted' }, 'Aucun choix disponible.'),
  ]);
}

export function toast(message) {
  const el = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}

// Appui long (≈ 0,5 s) sur un élément, sans déclencher le clic normal ensuite.
export function longPress(el, onLong, ms = 500) {
  let timer = null;
  let start = null;
  let fired = false;
  const cancel = () => { clearTimeout(timer); timer = null; };
  el.addEventListener('pointerdown', (e) => {
    fired = false;
    start = [e.clientX, e.clientY];
    timer = setTimeout(() => { timer = null; fired = true; navigator.vibrate?.(15); onLong(); }, ms);
  });
  el.addEventListener('pointermove', (e) => {
    if (timer && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 10) cancel();
  });
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(t, cancel);
  el.addEventListener('click', (e) => {
    if (fired) { e.preventDefault(); e.stopPropagation(); fired = false; }
  }, true);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
