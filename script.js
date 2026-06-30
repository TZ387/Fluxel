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

buildParamGrid(OPT_PARAMS, 'opt-grid');
buildParamGrid(GRID_PARAMS, 'grid-grid');

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

/* ================================================================
   DIFFUSION APPROXIMATION — pencil beam, two-source method
   ================================================================
   Reference: Farrell, Patterson & Wilson, Med. Phys. 19(4) 1992.

   Reduced scattering coefficient:  μ_s' = μ_s (1 - g)
   Diffusion coefficient:           D  = 1 / (3 (μ_a + μ_s'))
   Effective attenuation:           μ_eff = sqrt(3 μ_a (μ_a + μ_s'))
   Real point source depth:         z_0 = 1 / (μ_a + μ_s')   (transport MFP)
   Extrapolated boundary distance:  z_b = 2 A D
     where A = (1 + r_eff) / (1 - r_eff),  r_eff ≈ -1.440/n² + 0.710/n + 0.668 + 0.0636 n
   Image source depth:              z_img = -(z_0 + 2 z_b)

   Green's function (infinite medium):
     G(r) = exp(-μ_eff r) / (4π D r)

   Fluence at position (x,y,z):
     Φ = P₀ [ G(r_real) − G(r_image) ]
     where r_real = sqrt((x-xs)²+(y-ys)²+(z-z_0)²)
           r_img  = sqrt((x-xs)²+(y-ys)²+(z-z_img)²)
           xs, ys = beam entry point (centre of top face)

   Absorption rate density:
     A = μ_a · Φ
   ================================================================ */
function computeDiffusion(p) {
  const { mua, mus, g, n, p0, lx, ly, lz, nx, ny, nz } = p;

  const musp  = mus * (1.0 - g);
  const mut   = mua + musp;
  const D     = 1.0 / (3.0 * mut);
  const mueff = Math.sqrt(3.0 * mua * mut);
  const z0    = 1.0 / mut;

  /* Fresnel reflection parameter (Groenhuis et al. approximation) */
  const reff = -1.440 / (n * n) + 0.710 / n + 0.668 + 0.0636 * n;
  const A    = (1.0 + reff) / (1.0 - reff);
  const zb   = 2.0 * A * D;

  const zs_real =  z0;
  const zs_img  = -(z0 + 2.0 * zb);

  /* Beam enters at centre of the top face (z = 0) */
  const xs = lx / 2.0;
  const ys = ly / 2.0;

  const dx = lx / nx;
  const dy = ly / ny;
  const dz = lz / nz;

  const phi = new Float64Array(nx * ny * nz);
  const abs = new Float64Array(nx * ny * nz);

  for (let ix = 0; ix < nx; ix++) {
    const x   = (ix + 0.5) * dx;
    const dx2 = (x - xs) * (x - xs);

    for (let iy = 0; iy < ny; iy++) {
      const y    = (iy + 0.5) * dy;
      const rxy2 = dx2 + (y - ys) * (y - ys);

      for (let iz = 0; iz < nz; iz++) {
        const z = (iz + 0.5) * dz;

        const r1 = Math.sqrt(rxy2 + (z - zs_real) * (z - zs_real));
        const r2 = Math.sqrt(rxy2 + (z - zs_img)  * (z - zs_img));

        const eps = 1e-9;
        const G1  = r1 > eps ? Math.exp(-mueff * r1) / (4.0 * Math.PI * D * r1) : 0.0;
        const G2  = r2 > eps ? Math.exp(-mueff * r2) / (4.0 * Math.PI * D * r2) : 0.0;

        const val = p0 * Math.max(0.0, G1 - G2);
        const idx = ix + iy * nx + iz * nx * ny;
        phi[idx] = val;
        abs[idx] = mua * val;
      }
    }
  }

  return {
    phi, abs,
    /* Derived quantities, handed back so callers (e.g. the status line)
       don't need to recompute them from p a second time. */
    derived: {
      musp,
      D,
      mueff,
      delta: 1.0 / mueff,   /* penetration depth */
    },
  };
}

/* ================================================================
   COLORMAP  (deep-blue → cyan → green → yellow → red)
   ================================================================ */
const CMAP_STOPS = [
  [0.00, [10,  10,  35 ]],
  [0.15, [20,  40, 160 ]],
  [0.35, [10, 160, 200 ]],
  [0.55, [20, 200,  80 ]],
  [0.72, [230, 220,  20 ]],
  [0.88, [240, 100,  10 ]],
  [1.00, [180,  10,  10 ]],
];

function colormap(t) {
  t = Math.max(0.0, Math.min(1.0, t));
  let lo = CMAP_STOPS[0], hi = CMAP_STOPS[CMAP_STOPS.length - 1];
  for (let i = 0; i < CMAP_STOPS.length - 1; i++) {
    if (t >= CMAP_STOPS[i][0] && t <= CMAP_STOPS[i + 1][0]) {
      lo = CMAP_STOPS[i]; hi = CMAP_STOPS[i + 1]; break;
    }
  }
  const f = (t - lo[0]) / (hi[0] - lo[0] + 1e-15);
  return lo[1].map((v, i) => Math.round(v + (hi[1][i] - v) * f));
}

/* ================================================================
   COLORBAR
   ================================================================ */
function drawColorbar(cvId, hiId, midId, loId, vmin, vmax) {
  const cv  = document.getElementById(cvId);
  const h   = 90;
  cv.height = h;
  cv.width  = 14;
  const ctx = cv.getContext('2d');
  for (let i = 0; i < h; i++) {
    const [r, g, b] = colormap(1 - i / h);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, i, 14, 1);
  }
  const fmtSci = v => {
    if (v === 0 || !isFinite(v)) return '0';
    const e = Math.floor(Math.log10(Math.abs(v)));
    const m = v / Math.pow(10, e);
    return `${m.toFixed(1)}e${e >= 0 ? '+' : ''}${e}`;
  };
  document.getElementById(hiId).textContent  = fmtSci(vmax);
  document.getElementById(midId).textContent = fmtSci((vmax + vmin) / 2);
  document.getElementById(loId).textContent  = fmtSci(vmin);
}

/* ================================================================
   3-SLICE RENDERER
   ================================================================
   Draws three orthogonal cross-sections onto a single square canvas:
     top-left:  YZ plane at voxel index ix  (axes: y horizontal, z vertical)
     top-right: XZ plane at voxel index iy  (axes: x horizontal, z vertical)
     bottom-left: XY plane at voxel index iz (axes: x horizontal, y vertical)
   ================================================================ */
function drawSlices(cvId, vol, nx, ny, nz, ix, iy, iz, vmin, vmax) {
  const cv  = document.getElementById(cvId);
  const W   = cv.width  || cv.offsetWidth || 400;
  const H   = cv.height || cv.offsetHeight || 400;
  cv.width  = W;
  cv.height = H;

  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#080c14';
  ctx.fillRect(0, 0, W, H);

  const PAD  = 6;
  const HALF = Math.floor((W - 3 * PAD) / 2);
  const VHALF = Math.floor((H - 3 * PAD) / 2);

  /* Clamp slice indices */
  ix = Math.max(0, Math.min(nx - 1, ix));
  iy = Math.max(0, Math.min(ny - 1, iy));
  iz = Math.max(0, Math.min(nz - 1, iz));

  const range = vmax - vmin + 1e-30;

  function getVoxel(x, y, z) {
    if (x < 0 || x >= nx || y < 0 || y >= ny || z < 0 || z >= nz) return vmin;
    return vol[x + y * nx + z * nx * ny];
  }

  /**
   * fillRect2D — rasterise one 2D slice into an ImageData region.
   * @param {number} ox, oy  — canvas offset of top-left corner
   * @param {number} rw, rh  — pixel dimensions on canvas
   * @param {function} sampleFn  — (col, row) → voxel value, col∈[0,cols-1], row∈[0,rows-1]
   * @param {number} cols, rows  — voxel dimensions of this slice
   */
  function fillRect2D(ox, oy, rw, rh, sampleFn, cols, rows) {
    const img = ctx.createImageData(rw, rh);
    const d   = img.data;
    for (let py = 0; py < rh; py++) {
      const vc = Math.min(rows - 1, Math.floor(py * rows / rh));
      for (let px = 0; px < rw; px++) {
        const uc = Math.min(cols - 1, Math.floor(px * cols / rw));
        const t  = (sampleFn(uc, vc) - vmin) / range;
        const [r, g, b] = colormap(t);
        const i = (py * rw + px) * 4;
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, ox, oy);

    /* thin border */
    ctx.strokeStyle = 'rgba(100,130,160,0.35)';
    ctx.lineWidth   = 0.75;
    ctx.strokeRect(ox + 0.5, oy + 0.5, rw - 1, rh - 1);
  }

  /* Top-left: YZ slice at ix — horizontal=y, vertical=z */
  const tlX = PAD, tlY = PAD;
  fillRect2D(tlX, tlY, HALF, VHALF,
    (c, r) => getVoxel(ix, c, r), ny, nz);

  /* Top-right: XZ slice at iy — horizontal=x, vertical=z */
  const trX = PAD * 2 + HALF, trY = PAD;
  fillRect2D(trX, trY, HALF, VHALF,
    (c, r) => getVoxel(c, iy, r), nx, nz);

  /* Bottom-left: XY slice at iz — horizontal=x, vertical=y */
  const blX = PAD, blY = PAD * 2 + VHALF;
  fillRect2D(blX, blY, HALF, VHALF,
    (c, r) => getVoxel(c, r, iz), nx, ny);

  /* Slice labels */
  ctx.font      = '10px monospace';
  ctx.fillStyle = 'rgba(180,200,220,0.65)';
  ctx.fillText(`YZ  x = ${ix}`, tlX + 4, tlY + 12);
  ctx.fillText(`XZ  y = ${iy}`, trX + 4, trY + 12);
  ctx.fillText(`XY  z = ${iz}`, blX + 4, blY + 12);
}

/* ================================================================
   SIMULATION STATE
   ================================================================
   Holds the most recent computed volumes plus the grid dimensions
   they were computed on. Wrapped in an object (rather than loose
   globals) so the fields it owns and the ways it can be mutated
   are explicit and in one place.
   ================================================================ */
const Simulation = {
  nx: 40, ny: 40, nz: 40,
  phi: null,
  abs: null,

  /** Store a freshly computed result and remember the grid it used. */
  set(nx, ny, nz, phi, abs) {
    this.nx = nx; this.ny = ny; this.nz = nz;
    this.phi = phi; this.abs = abs;
  },

  /** 'phi' | 'abs' → the matching Float64Array, or null if not yet computed. */
  volume(suffix) {
    return suffix === 'phi' ? this.phi : this.abs;
  },

  hasData() {
    return this.phi !== null;
  },
};

/* ================================================================
   AXIS SLIDERS FOR EACH PLOT
   ================================================================ */
function buildAxisSliders(containerId, suffix) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  ['x', 'y', 'z'].forEach(ax => {
    const dim  = ax === 'x' ? Simulation.nx : ax === 'y' ? Simulation.ny : Simulation.nz;
    const defV = Math.floor(dim / 2);
    const row  = document.createElement('div');
    row.className = 'axis-row';
    row.innerHTML = `
      <span class="axis-lbl">${ax}</span>
      <input type="range" id="s${ax}-${suffix}" min="0" max="${dim - 1}" step="1" value="${defV}">
      <span class="axis-val" id="s${ax}-${suffix}-v">${defV}</span>`;
    container.appendChild(row);

    const el  = row.querySelector('input');
    const out = row.querySelector('.axis-val');
    el.addEventListener('input', () => {
      out.textContent = el.value;
      redraw(suffix);
    });
  });
}

function getSlice(suffix) {
  return {
    ix: +document.getElementById(`sx-${suffix}`).value,
    iy: +document.getElementById(`sy-${suffix}`).value,
    iz: +document.getElementById(`sz-${suffix}`).value,
  };
}

function redraw(suffix) {
  const vol = Simulation.volume(suffix);
  if (!vol) return;
  const { ix, iy, iz } = getSlice(suffix);

  let vmin = Infinity, vmax = -Infinity;
  for (let i = 0; i < vol.length; i++) {
    if (vol[i] > vmax) vmax = vol[i];
    if (vol[i] < vmin) vmin = vol[i];
  }

  /* Use log scale for colormap normalisation — better shows dynamic range */
  const logVol = new Float64Array(vol.length);
  const logMin = vmin > 0 ? Math.log10(vmin) : Math.log10(Math.max(vmax * 1e-6, 1e-30));
  const logMax = vmax > 0 ? Math.log10(vmax) : 0;
  for (let i = 0; i < vol.length; i++) {
    logVol[i] = vol[i] > 0 ? Math.log10(vol[i]) : logMin;
  }

  drawSlices(`cv-${suffix}`, logVol, Simulation.nx, Simulation.ny, Simulation.nz, ix, iy, iz, logMin, logMax);
  drawColorbar(
    `cbar-${suffix}`,
    `clbl-${suffix}-hi`, `clbl-${suffix}-mid`, `clbl-${suffix}-lo`,
    vmin, vmax
  );
}

/* ================================================================
   MAIN RUN HANDLER
   ================================================================ */
document.getElementById('run-btn').addEventListener('click', () => {
  const p   = getParams();
  const btn = document.getElementById('run-btn');
  const st  = document.getElementById('status');

  btn.disabled    = true;
  st.textContent  = 'Computing…';

  /* Yield to browser for status paint, then compute */
  setTimeout(() => {
    const t0        = performance.now();
    const { phi, abs, derived } = computeDiffusion(p);
    const dt        = (performance.now() - t0).toFixed(1);

    Simulation.set(p.nx, p.ny, p.nz, phi, abs);

    /* Show plots section */
    document.getElementById('plots').style.display = '';

    /* Rebuild sliders with correct max values */
    buildAxisSliders('sl-phi', 'phi');
    buildAxisSliders('sl-abs', 'abs');

    /* Resize canvases to match their rendered pixel width */
    ['cv-phi', 'cv-abs'].forEach(id => {
      const cv = document.getElementById(id);
      cv.width  = cv.offsetWidth  || 400;
      cv.height = cv.offsetHeight || 400;
    });

    redraw('phi');
    redraw('abs');

    const { musp, D, mueff, delta } = derived;

    st.textContent =
      `Done in ${dt} ms — μ_s' = ${musp.toFixed(2)} cm⁻¹ | ` +
      `D = ${D.toFixed(4)} cm | μ_eff = ${mueff.toFixed(4)} cm⁻¹ | δ = ${delta.toFixed(3)} cm`;

    btn.disabled = false;
  }, 20);
});