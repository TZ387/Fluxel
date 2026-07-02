'use strict';

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
   RESPONSIVE CANVAS RESIZE
   ================================================================
   The plot canvases are sized in JS (cv.width/height) to match their
   rendered CSS pixel size, so they stay crisp at any zoom level. That
   sizing previously only ran right after a compute or while dragging
   an axis slider — so browser zoom (which fires a 'resize' event but
   touches neither of those) left the canvases stale: blurry, wrongly
   proportioned, or misaligned with their container. This listener
   re-applies that sizing and redraws whenever the viewport changes,
   which covers window resizing as well as zooming in/out.
   ================================================================ */
let resizeTimer = null;
window.addEventListener('resize', () => {
  if (!Simulation.hasData()) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    ['cv-phi', 'cv-abs'].forEach(id => {
      const cv = document.getElementById(id);
      cv.width  = cv.offsetWidth  || 400;
      cv.height = cv.offsetHeight || 400;
    });
    redraw('phi');
    redraw('abs');
  }, 120);
});

/* ================================================================
   MAIN RUN HANDLER
   ================================================================ */
document.getElementById('run-btn').addEventListener('click', () => {
  const p   = getParams();   // reads whatever controls the current model's paramGroups produced
  const btn = document.getElementById('run-btn');
  const st  = document.getElementById('status');

  btn.disabled    = true;
  st.textContent  = 'Computing…';

  /* Yield to browser for status paint, then compute */
  setTimeout(() => {
    const model = MODELS[document.getElementById('model-select').value];

    const t0        = performance.now();
    const { phi, abs, derived } = model.compute(p);
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

    const summary = model.summaryLine(derived, dt);

    const validity = model.checkValidity
      ? model.checkValidity(p, derived)
      : { valid: true, reasons: [] };

    st.textContent = '';
    st.appendChild(document.createTextNode(summary));

    if (!validity.valid) {
      const warn = document.createElement('div');
      warn.className = 'status-warn';
      warn.textContent =
        '⚠ Results may not be accurate — diffusion approximation is weakly justified here: ' +
        validity.reasons.join('; ') + '.';
      st.appendChild(warn);
    }

    btn.disabled = false;
  }, 20);
});

/* ================================================================
   MODEL SWITCHING
   ================================================================
   Each model owns its own paramGroups (schema + defaults — see
   models.js), so switching models means tearing down and rebuilding
   the whole parameter panel, not just resetting values. Any plots
   from a previous model are hidden since they'd correspond to a
   different (or no longer valid) set of inputs.
   ================================================================ */
function onModelChange() {
  const model = MODELS[document.getElementById('model-select').value];
  buildModelParams(model, 'param-panels');
  document.getElementById('plots').style.display = 'none';
  document.getElementById('status').textContent = 'Adjust parameters and click Compute.';
}

/* ================================================================
   INIT
   ================================================================ */
buildModelSelect();
document.getElementById('model-select').addEventListener('change', onModelChange);
onModelChange();
