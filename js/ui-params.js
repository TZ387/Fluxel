'use strict';

/* ================================================================
   GENERIC PARAMETER PANEL BUILDER
   ================================================================
   Renders whatever `paramGroups` the currently-selected model
   declares (see models.js for the schema shape). This file knows
   nothing about any specific model's parameters — it only knows how
   to turn a group's `params` array into rows, and how to repeat that
   for groups marked `repeat` (e.g. one block of controls per tissue
   layer, with add/remove buttons since the layer count varies from
   case to case).

   Each parameter row renders:
     [min box] ——— slider ——— [max box]   [value box]

   All three number inputs are directly editable:
   - Editing the value box moves the slider and clamps to [min,max]
     if within range, or extends the range silently if outside it.
   - Editing a bound box re-ranges the slider; if the current value
     falls outside the new bound it is clamped to the bound.
   - Dragging the slider updates the value box.
   ================================================================ */

/* Model whose panel is currently on screen, and (for repeat groups)
   how many instances of each are currently rendered. Both are reset
   each time buildModelParams() runs, i.e. on init and on model switch. */
let currentGroups = [];
let repeatCounts  = {};

/* ── one param-grid's worth of rows ────────────────────────────
   `prefix` namespaces element ids so repeated instances (layer 0,
   layer 1, ...) don't collide, e.g. "layers0-mua", "layers1-mua". */
function buildParamGrid(params, container, prefix = '') {
  params.forEach(p => {
    const uid = prefix + p.id;
    const row = document.createElement('div');
    row.className = 'param-row';
    row.innerHTML = `
      <div class="param-label">${p.label}</div>
      <div class="param-ctrl">
        <input type="number" class="p-bound" id="${uid}-min" value="${p.min}" step="${p.step}" title="Slider minimum">
        <input type="range"  id="${uid}"     min="${p.min}" max="${p.max}" step="${p.step}" value="${p.def}">
        <input type="number" class="p-bound" id="${uid}-max" value="${p.max}" step="${p.step}" title="Slider maximum">
        <input type="number" class="p-val"   id="${uid}-v"   value="${p.fmt(p.def)}" step="${p.step}" title="Current value" readonly>
      </div>`;
    container.appendChild(row);

    const slider = row.querySelector(`#${CSS.escape(uid)}`);
    const minBox = row.querySelector(`#${CSS.escape(uid)}-min`);
    const maxBox = row.querySelector(`#${CSS.escape(uid)}-max`);
    const valBox = row.querySelector(`#${CSS.escape(uid)}-v`);

    /* slider → value box */
    slider.addEventListener('input', () => {
      valBox.value = p.fmt(+slider.value);
    });

    /* value box → slider (extend range if needed) */
    valBox.addEventListener('change', () => {
      let v = +valBox.value;
      if (!isFinite(v)) { valBox.value = p.fmt(+slider.value); return; }
      if (v < +minBox.value) { minBox.value = p.fmt(v); slider.min = v; }
      if (v > +maxBox.value) { maxBox.value = p.fmt(v); slider.max = v; }
      slider.value = v;
      valBox.value = p.fmt(v);
    });

    /* min box → slider range (clamp current value if needed) */
    minBox.addEventListener('change', () => {
      const lo = +minBox.value;
      slider.min = lo;
      if (+slider.value < lo) { slider.value = lo; valBox.value = p.fmt(lo); }
    });

    /* max box → slider range (clamp current value if needed) */
    maxBox.addEventListener('change', () => {
      const hi = +maxBox.value;
      slider.max = hi;
      if (+slider.value > hi) { slider.value = hi; valBox.value = p.fmt(hi); }
    });
  });
}

function readParamGrid(params, prefix = '') {
  const r = {};
  params.forEach(p => {
    const vbox   = document.getElementById(`${prefix}${p.id}-v`);
    const slider = document.getElementById(`${prefix}${p.id}`);
    r[p.id] = vbox ? +vbox.value : +slider.value;
  });
  return r;
}

/* ── repeating groups: N instances + add/remove-instance buttons ─ */
function renderRepeatGroup(group, container) {
  const count = repeatCounts[group.id] ?? group.repeat.def;
  repeatCounts[group.id] = count;

  container.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const inst = document.createElement('div');
    inst.className = 'repeat-instance';
    inst.innerHTML = `
      <div class="repeat-instance-hdr">
        <span>${group.title} ${i + 1}</span>
        <button type="button" class="repeat-remove-btn" ${count <= group.repeat.min ? 'disabled' : ''}>&times; Remove</button>
      </div>`;
    const grid = document.createElement('div');
    grid.className = 'param-grid';
    inst.appendChild(grid);
    buildParamGrid(group.params, grid, `${group.id}${i}-`);
    container.appendChild(inst);

    inst.querySelector('.repeat-remove-btn').addEventListener('click', () => {
      if (repeatCounts[group.id] <= group.repeat.min) return;
      repeatCounts[group.id]--;
      renderRepeatGroup(group, container);
    });
  }

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'repeat-add-btn';
  addBtn.textContent = `+ Add ${group.title.toLowerCase()}`;
  addBtn.disabled = count >= group.repeat.max;
  addBtn.addEventListener('click', () => {
    if (repeatCounts[group.id] >= group.repeat.max) return;
    repeatCounts[group.id]++;
    renderRepeatGroup(group, container);
  });
  container.appendChild(addBtn);
}

/* ── top-level: (re)build the whole param panel for a model ────── */
function buildModelParams(model, containerId) {
  const root = document.getElementById(containerId);
  root.innerHTML = '';
  currentGroups = model.paramGroups;
  repeatCounts  = {};

  model.paramGroups.forEach(group => {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `<div class="panel-title">${group.title}</div>`;
    root.appendChild(panel);

    if (group.repeat) {
      const wrap = document.createElement('div');
      wrap.className = 'repeat-group';
      panel.appendChild(wrap);
      renderRepeatGroup(group, wrap);
    } else {
      const grid = document.createElement('div');
      grid.className = 'param-grid';
      panel.appendChild(grid);
      buildParamGrid(group.params, grid);
    }
  });
}

/* ── read every current control back into a plain params object ─
   Plain groups merge flat (p.mua, p.lx, ...). Repeat groups come
   back as an array under their own group id (p.layers = [...]). */
function getParams() {
  const r = {};
  currentGroups.forEach(group => {
    if (group.repeat) {
      const n = repeatCounts[group.id] ?? group.repeat.def;
      const instances = [];
      for (let i = 0; i < n; i++) instances.push(readParamGrid(group.params, `${group.id}${i}-`));
      r[group.id] = instances;
    } else {
      Object.assign(r, readParamGrid(group.params));
    }
  });
  if ('nx' in r) r.nx = r.nx | 0;
  if ('ny' in r) r.ny = r.ny | 0;
  if ('nz' in r) r.nz = r.nz | 0;
  return r;
}
