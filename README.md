# FLUXEL

A browser-based simulator for light transport in biological tissue using the **diffusion approximation**. No installation required — open `Example.html` in any modern browser.

> **Work in progress.** This is an early draft. More features are planned; see the roadmap below.

---

## Physics

The simulator implements the **pencil beam diffusion approximation** (Farrell, Patterson & Wilson, *Med. Phys.* 19(4), 1992). A narrow collimated beam entering a homogeneous tissue slab is modelled as an isotropic point source placed one transport mean free path below the surface. The extrapolated boundary condition accounts for the refractive index mismatch at the air–tissue interface. The resulting fluence field is computed analytically per voxel using a real source + image source pair:

```
Φ(r) = P₀ / (4π D) · [ exp(-μ_eff r₁)/r₁  −  exp(-μ_eff r₂)/r₂ ]
```

Absorption rate density follows directly as `A = μ_a · Φ`.

## Parameters

| Symbol | Meaning | Unit |
|--------|---------|------|
| μ_a | Absorption coefficient | cm⁻¹ |
| μ_s | Scattering coefficient | cm⁻¹ |
| g | Anisotropy factor | — |
| n | Refractive index | — |
| P₀ | Input beam power | W |
| L_x, L_y, L_z | Tissue slab dimensions | cm |
| N_x, N_y, N_z | Voxel count per axis | — |

Derived quantities (μ_s', D, μ_eff, penetration depth δ) are printed in the status bar after each run.

## Usage

1. Open `index.html` in a browser.
2. Set optical and grid parameters using the sliders.
3. Click **Compute & visualise**.
4. Use the x / y / z sliders beneath each plot to move the slice planes through the volume.

Two plots are shown side by side: fluence Φ and absorption A, both on a logarithmic colour scale to reveal the full dynamic range.

## File structure

```
index.html   — page structure and layout
script.js    — physics, rendering, and UI logic
style.css    — dark-theme styling
```

## Roadmap

The following features are planned for future releases:

- **Finite laser beams** — Gaussian and flat-top beam profiles instead of the infinitely thin pencil beam
- **Multi-layered tissue** — stacked slabs with independent optical properties per layer (e.g. skin, fat, muscle)
- **Structured light / scanning patterns** — multiple beam positions or scanning trajectories
- **Monte Carlo validation** — optional MC reference run for cross-checking the diffusion result
- **Export** — download fluence / absorption volumes as CSV or HDF5 for post-processing in Python / Julia
- **Isosurface overlay** — 3D isosurface rendering on top of the slice views

## Reference

T. J. Farrell, M. S. Patterson, B. Wilson, *A diffusion theory model of spatially resolved, steady-state diffuse reflectance for the noninvasive determination of tissue optical properties in vivo*, Med. Phys. **19**(4), 879–888 (1992).