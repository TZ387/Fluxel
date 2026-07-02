'use strict';

/* ================================================================
   MODEL REGISTRY
   ================================================================
   Each entry describes one theoretical model available in the
   "Model" dropdown. Each model's compute/checkValidity functions
   live in their own file under js/physics/ — this file only wires
   them together, AND owns that model's parameter schema.

   Why parameters live here (per model) rather than in a shared
   global list: different models need different inputs entirely —
   not just different defaults. A single-layer model like FPW1992
   takes one set of optical properties; a future N-layer model needs
   a *repeatable* set (one per layer) plus its own grid. Keeping the
   schema next to the model it belongs to means each physics file is
   self-contained, and ui-params.js can stay generic.

   paramGroups: array of groups, each rendered as its own panel.
     Plain group:
       { id, title, params: [ {id,label,min,max,step,def,fmt}, ... ] }
       → values merge flat into getParams()'s result, keyed by
         each param's own `id` (e.g. p.mua, p.lx).

     Repeating group (e.g. per-layer parameters):
       { id, title, params: [...], repeat: {min, max, def} }
       → rendered as `def` instances initially, with add/remove-
         instance buttons (bounded by min/max). Values come back as
         an array under result[group.id], one object per instance,
         e.g. p.layers = [ {mua:..., mus:...}, {mua:..., mus:...} ].

   To add a new model in future:
     1. Create js/physics/<name>.js with:
        - computeXxx(p) → { phi, abs, derived }
          `p` is whatever shape this model's own paramGroups produce
          (flat object for plain groups, plus arrays for any repeat
          groups — read it apart however suits the physics).
          `phi`/`abs` must be Float64Arrays of length nx*ny*nz, same
          voxel ordering as the existing models (ix + iy*nx + iz*nx*ny).
          `derived` is a free-form object of scalar quantities you
          want printed in the status line (see `summaryLine` below).
        - checkXxx(p, derived) → { valid, reasons }, optional — omit
          if the model has no known applicability limits.
     2. Add a <script src="js/physics/<name>.js"></script> tag in
        Example.html, before js/models.js.
     3. Add one entry below: label, compute, checkValidity (optional),
        summaryLine(derived, dt), and this model's own paramGroups
        (with its own defaults/ranges — nothing is shared with other
        models unless you explicitly reuse the same param objects).

   The dropdown, param panel, run handler, and warning display all
   pick up new entries automatically — no other code needs to change.
   ================================================================ */

/* Shared formatter helpers, purely to avoid repeating the same
   arrow function body — models are still free to define their own. */
const fmt3 = v => v.toFixed(3);
const fmt0 = v => v.toFixed(0);

const MODELS = {
  fpw1992: {
    label: 'Farrell, Patterson & Wilson (1992) — pencil beam, semi-infinite slab',
    compute: computeDiffusion_FPW1992,
    checkValidity: checkValidity_FPW1992,
    summaryLine: (derived, dt) =>
      `Done in ${dt} ms — μ<sub>s</sub>' = ${derived.musp.toFixed(3)} cm⁻¹ | ` +
      `D = ${derived.D.toFixed(4)} cm | μ<sub>eff</sub> = ${derived.mueff.toFixed(4)} cm⁻¹ | ` +
      `δ = ${derived.delta.toFixed(3)} cm`,

    paramGroups: [
            {
        id: 'optical',
        title: 'Optical properties',
        params: [
          { id: 'mua', label: 'μ<sub>a</sub> absorption [cm⁻¹]', min: 0.01, max: 5, step: 0.001, def: 0.1, fmt: fmt3 },
          { id: 'mus', label: 'μ<sub>s</sub> scattering [cm⁻¹]', min: 1, max: 300, step: 0.001, def: 100, fmt: fmt3 },
          { id: 'g',   label: 'g anisotropy factor', min: 0, max: 0.99, step: 0.001, def: 0.9, fmt: fmt3 },
          { id: 'n',   label: 'n refractive index', min: 1.0, max: 1.7, step: 0.001, def: 1.4, fmt: fmt3 },
          { id: 'p0',  label: 'P<sub>0</sub> input power [W]', min: 0.01, max: 10, step: 0.001, def: 1.0, fmt: fmt3 },
        ],
      },
      {
        id: 'grid',
        title: 'Grid',
        params: [
          { id: 'lx', label: 'L<sub>x</sub> [cm]', min: 0.5, max: 6, step: 0.001, def: 2, fmt: fmt3 },
          { id: 'ly', label: 'L<sub>y</sub> [cm]', min: 0.5, max: 6, step: 0.001, def: 2, fmt: fmt3 },
          { id: 'lz', label: 'L<sub>z</sub> [cm]', min: 0.5, max: 6, step: 0.001, def: 2, fmt: fmt3 },
          { id: 'nx', label: 'N<sub>x</sub> voxels', min: 10, max: 80, step: 1, def: 40, fmt: fmt0 },
          { id: 'ny', label: 'N<sub>y</sub> voxels', min: 10, max: 80, step: 1, def: 40, fmt: fmt0 },
          { id: 'nz', label: 'N<sub>z</sub> voxels', min: 10, max: 80, step: 1, def: 40, fmt: fmt0 },
        ],
      },
    ],
  },

  /* Example of what a future N-layer model's entry will look like —
     note the `repeat` block on the layer group, and that grid/optical
     defaults here are entirely independent of fpw1992's above:

  kubelkaMunkNLayer: {
    label: 'Kubelka–Munk — two-flux, N-layer stack',
    compute: computeDiffusion_KubelkaMunkNLayer,
    checkValidity: checkValidity_KubelkaMunkNLayer,   // optional
    summaryLine: (derived, dt) => `Done in ${dt} ms — ...`,
    paramGroups: [
      {
        id: 'layers',
        title: 'Layer',
        repeat: { min: 1, max: 8, def: 2 },
        params: [
          { id: 'mua',       label: 'μ_a  absorption [cm⁻¹]', min: 0.01, max: 5,  step: 0.001, def: 0.1, fmt: fmt3 },
          { id: 'mus',       label: 'μ_s  scattering [cm⁻¹]',  min: 1,    max: 300, step: 0.001, def: 100, fmt: fmt3 },
          { id: 'thickness', label: 'thickness [cm]',          min: 0.01, max: 2,   step: 0.001, def: 0.2, fmt: fmt3 },
        ],
      },
      { id: 'grid', title: 'Grid', params: [ ... ] },
    ],
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
