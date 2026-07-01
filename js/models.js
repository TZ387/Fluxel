'use strict';

/* ================================================================
   MODEL REGISTRY
   ================================================================
   Each entry describes one theoretical model available in the
   "Model" dropdown. Each model's compute/checkValidity functions
   live in their own file under js/physics/ — this file only wires
   them together. To add a new model in future:

     1. Create js/physics/<name>.js with:
        - computeXxx(p) → { phi, abs, derived }
          `phi`/`abs` must be Float64Arrays of length nx*ny*nz, same
          voxel ordering as the existing models (ix + iy*nx + iz*nx*ny).
          `derived` is a free-form object of scalar quantities you
          want printed in the status line (see `summaryLine` below).
        - checkXxx(p, derived) → { valid, reasons }, optional — omit
          if the model has no known applicability limits.
     2. Add a <script src="js/physics/<name>.js"></script> tag in
        Example.html, before js/models.js.
     3. Add one entry below, with a `summaryLine(derived, dt)`
        function that formats that model's derived quantities for
        the status bar (each model may expose different derived
        quantities, so this isn't shared).

   The dropdown, run handler, and warning display all pick up new
   entries automatically — no other code needs to change.

   If a future model needs *different input parameters* than
   OPT_PARAMS/GRID_PARAMS (e.g. a second layer's optical properties),
   the cleanest extension is to give that model its own `extraParams`
   array in the same shape as OPT_PARAMS (see js/ui-params.js),
   rendered into a dedicated grid container that's shown/hidden based
   on the selected model. That's not needed yet since every current
   model shares the same single-layer parameter set.
   ================================================================ */
const MODELS = {
  fpw1992: {
    label: 'Farrell, Patterson & Wilson (1992) — pencil beam, semi-infinite slab',
    compute: computeDiffusion_FPW1992,
    checkValidity: checkValidity_FPW1992,
    summaryLine: (derived, dt) =>
      `Done in ${dt} ms — μ_s' = ${derived.musp.toFixed(3)} cm⁻¹ | ` +
      `D = ${derived.D.toFixed(4)} cm | μ_eff = ${derived.mueff.toFixed(4)} cm⁻¹ | ` +
      `δ = ${derived.delta.toFixed(3)} cm`,
  },

  /* Example of what a second entry will look like once implemented:
  kubelkaMunk: {
    label: 'Kubelka–Munk (1931) — two-flux, planar layer',
    compute: computeDiffusion_KubelkaMunk,
    checkValidity: checkValidity_KubelkaMunk,   // optional
    summaryLine: (derived, dt) => `Done in ${dt} ms — ...`,
  },
  */
};

function buildModelSelect() {
  const sel = document.getElementById('model-select');
  sel.innerHTML = '';
  Object.entries(MODELS).forEach(([id, m]) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = m.label;
    sel.appendChild(opt);
  });
}
