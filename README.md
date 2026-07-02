# FLUXEL

A browser-based simulator for light transport in biological tissue using the **diffusion approximation**. No installation required — open `Example.html` in any modern browser.

> **Work in progress.** This is an early draft. More features are planned; see the roadmap below.

---

## Physics

The simulator currently implements one theoretical model, the **pencil beam diffusion approximation** (Farrell, Patterson & Wilson, *Med. Phys.* 19(4), 1992), selectable from the **Model** dropdown. A narrow collimated beam entering a homogeneous tissue slab is modelled as an isotropic point source placed one transport mean free path below the surface. The extrapolated boundary condition accounts for the refractive index mismatch at the air–tissue interface. The resulting fluence field is computed analytically per voxel using a real source + image source pair:

```text
Φ(r) = P₀ / (4π D) · [ exp(-μ_eff r₁)/r₁  −  exp(-μ_eff r₂)/r₂ ]
```

Absorption rate density follows directly as `A = μ_a · Φ`.

Each model has its own inputs, defaults, and validity checks (see `js/physics/`); the app is built so additional models can be added without touching shared code.

## Parameters

Parameters are model-specific, since different theoretical models need different inputs (e.g. a single-layer model vs. one supporting an arbitrary number of tissue layers). The parameter panel is generated from the selected model's schema, so it changes shape when you switch models.

For the FPW1992 model currently implemented:

| Symbol | Meaning | Unit |
| -------- | --------- | ------ |
| μ_a | Absorption coefficient | cm⁻¹ |
| μ_s | Scattering coefficient | cm⁻¹ |
| g | Anisotropy factor | — |
| n | Refractive index | — |
| P₀ | Input beam power | W |
| L_x, L_y, L_z | Tissue slab dimensions | cm |
| N_x, N_y, N_z | Voxel count per axis | — |

Derived quantities (μ_s', D, μ_eff, penetration depth δ) are printed in the status bar after each run, along with a warning if the diffusion approximation is weakly justified for the chosen parameters.

## Usage

1. Open `Example.html` in a browser.
2. Choose a theoretical model from the **Model** dropdown.
3. Set the model's parameters using the sliders (min/max bounds and the value itself are all directly editable).
4. Click **Compute & visualise**.
5. Use the x / y / z sliders beneath each plot to move the slice planes through the volume.

Two plots are shown side by side: fluence Φ and absorption A, both on a logarithmic colour scale to reveal the full dynamic range.

## File structure

```text
Example.html          — page structure and layout
style.css              — dark-theme styling
js/
  models.js            — model registry: wires each model's compute/validity
                          functions to its own parameter schema (paramGroups)
  ui-params.js          — generic parameter-panel builder/reader, driven
                          entirely by the selected model's schema; handles
                          both fixed parameter groups and repeatable ones
                          (e.g. an arbitrary number of tissue layers)
  render.js             — colormap, colorbar, and 3-slice volume rendering
  main.js               — simulation state, model switching, run handler,
                          plot/axis-slider wiring
  physics/
    fpw1992.js           — FPW1992 model: compute() + checkValidity()
                          (add one file per model here; see models.js
                          for the registration steps)
```

Each theoretical model is self-contained: its physics, its own parameter definitions (including defaults and ranges), and its own validity checks all live in one file under `js/physics/`, registered with a short entry in `js/models.js`. The dropdown, parameter panel, run handler, and warning display all pick up new models automatically.

## Roadmap

The following features are planned for future releases:

- **Finite laser beams** — Gaussian and flat-top beam profiles instead of the infinitely thin pencil beam
- **Multi-layered tissue** — stacked slabs with independent optical properties per layer (e.g. skin, fat, muscle), using the repeatable-parameter-group support already in the schema
- **Structured light / scanning patterns** — multiple beam positions or scanning trajectories
- **Monte Carlo validation** — optional MC reference run for cross-checking the diffusion result, likely via WebAssembly (Rust + wasm-pack) for the computationally intensive photon transport
- **Export** — download fluence / absorption volumes as CSV or HDF5 for post-processing in Python / Julia
- **Isosurface overlay** — 3D isosurface rendering on top of the slice views

## Reference

T. J. Farrell, M. S. Patterson, B. Wilson, *A diffusion theory model of spatially resolved, steady-state diffuse reflectance for the noninvasive determination of tissue optical properties in vivo*, Med. Phys. **19**(4), 879–888 (1992).
