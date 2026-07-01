'use strict';

/* ================================================================
   PARAMETER DEFINITIONS
   ================================================================ */
const OPT_PARAMS = [
  { id: 'mua', label: 'μ_a  absorption [cm⁻¹]',   min: 0.01, max: 5,    step: 0.001, def: 0.1,  fmt: v => v.toFixed(3) },
  { id: 'mus', label: 'μ_s  scattering [cm⁻¹]',    min: 1,    max: 300,  step: 0.001, def: 100,  fmt: v => v.toFixed(3) },
  { id: 'g',   label: 'g    anisotropy factor',     min: 0,    max: 0.99, step: 0.001, def: 0.9,  fmt: v => v.toFixed(3) },
  { id: 'n',   label: 'n    refractive index',      min: 1.0,  max: 1.7,  step: 0.001, def: 1.4,  fmt: v => v.toFixed(3) },
  { id: 'p0',  label: 'P₀   input power [W]',       min: 0.01, max: 10,   step: 0.001, def: 1.0,  fmt: v => v.toFixed(3) },
];

const GRID_PARAMS = [
  { id: 'lx', label: 'L_x  [cm]',    min: 0.5, max: 6, step: 0.001, def: 2, fmt: v => v.toFixed(3) },
  { id: 'ly', label: 'L_y  [cm]',    min: 0.5, max: 6, step: 0.001, def: 2, fmt: v => v.toFixed(3) },
  { id: 'lz', label: 'L_z  [cm]',    min: 0.5, max: 6, step: 0.001, def: 2, fmt: v => v.toFixed(3) },
  { id: 'nx', label: 'N_x  voxels',  min: 10,  max: 80, step: 1,  def: 40, fmt: v => v.toFixed(0) },
  { id: 'ny', label: 'N_y  voxels',  min: 10,  max: 80, step: 1,  def: 40, fmt: v => v.toFixed(0) },
  { id: 'nz', label: 'N_z  voxels',  min: 10,  max: 80, step: 1,  def: 40, fmt: v => v.toFixed(0) },
];

/* ================================================================
   BUILD PARAMETER UI
   ================================================================
   Each parameter row renders:
     [min box] ——— slider ——— [max box]   [value box]

   All three number inputs are directly editable:
   - Editing the value box moves the slider and clamps to [min,max]
     if within range, or extends the range silently if outside it.
   - Editing a bound box re-ranges the slider; if the current value
     falls outside the new bound it is clamped to the bound.
   - Dragging the slider updates the value box.
   ================================================================ */
function buildParamGrid(params, containerId) {
  const grid = document.getElementById(containerId);

  params.forEach(p => {
    const row = document.createElement('div');
    row.className = 'param-row';
    row.innerHTML = `
      <div class="param-label">${p.label}</div>
      <div class="param-ctrl">
        <input type="number" class="p-bound" id="${p.id}-min" value="${p.min}" step="${p.step}" title="Slider minimum">
        <input type="range"  id="${p.id}"     min="${p.min}" max="${p.max}" step="${p.step}" value="${p.def}">
        <input type="number" class="p-bound" id="${p.id}-max" value="${p.max}" step="${p.step}" title="Slider maximum">
        <input type="number" class="p-val"   id="${p.id}-v"   value="${p.fmt(p.def)}"        step="${p.step}" title="Current value",  readonly>
      </div>`;
    grid.appendChild(row);

    const slider  = row.querySelector(`#${p.id}`);
    const minBox  = row.querySelector(`#${p.id}-min`);
    const maxBox  = row.querySelector(`#${p.id}-max`);
    const valBox  = row.querySelector(`#${p.id}-v`);

    /* slider → value box */
    slider.addEventListener('input', () => {
      valBox.value = p.fmt(+slider.value);
    });

    /* value box → slider (extend range if needed) */
    valBox.addEventListener('change', () => {
      let v = +valBox.value;
      if (!isFinite(v)) { valBox.value = p.fmt(+slider.value); return; }
      /* auto-extend bounds if user typed outside them */
      if (v < +minBox.value) { minBox.value = p.fmt(v); slider.min = v; }
      if (v > +maxBox.value) { maxBox.value = p.fmt(v); slider.max = v; }
      slider.value = v;
      valBox.value = p.fmt(v);
    });

    /* min box → slider range (clamp current value if needed) */
    minBox.addEventListener('change', () => {
      const lo = +minBox.value;
      slider.min = lo;
      if (+slider.value < lo) {
        slider.value = lo;
        valBox.value = p.fmt(lo);
      }
    });

    /* max box → slider range (clamp current value if needed) */
    maxBox.addEventListener('change', () => {
      const hi = +maxBox.value;
      slider.max = hi;
      if (+slider.value > hi) {
        slider.value = hi;
        valBox.value = p.fmt(hi);
      }
    });
  });
}

function getParams() {
  const r = {};
  [...OPT_PARAMS, ...GRID_PARAMS].forEach(p => {
    /* prefer the editable value box; fall back to the slider */
    const vbox = document.getElementById(`${p.id}-v`);
    r[p.id] = vbox ? +vbox.value : +document.getElementById(p.id).value;
  });
  r.nx = r.nx | 0; r.ny = r.ny | 0; r.nz = r.nz | 0;
  return r;
}
