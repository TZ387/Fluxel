'use strict';

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
function computeDiffusion_FPW1992(p) {
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
   DIFFUSION-APPROXIMATION VALIDITY CHECK
   ================================================================
   The diffusion approximation replaces the full radiative transport
   equation with its lowest-order (P1) angular expansion. That's only
   accurate once light has scattered enough times to become nearly
   isotropic before it's absorbed — i.e. when scattering dominates
   absorption. The standard rule of thumb (see e.g. Star, 1997;
   Jacques, 2013) is a reduced albedo

     a' = μ_s' / (μ_s' + μ_a)

   close to 1, commonly stated as requiring μ_s'/μ_a ≳ 10. Below that,
   the solver still returns a number, but it systematically mis-
   estimates fluence near the source because too much light is
   absorbed before it can randomize direction.

   A second, independent failure mode: if μ_s' itself is low relative
   to the slab size, the transport mean free path becomes comparable
   to (or larger than) the slab itself, so there isn't enough medium
   for multiple scattering to set in at all — again invalidating the
   P1 assumption regardless of the μ_s'/μ_a ratio.
   ================================================================ */
function checkValidity_FPW1992(p, derived) {
  const { mua } = p;
  const musp    = derived.musp;
  const ratio   = musp / mua;
  const minDim  = Math.min(p.lx, p.ly, p.lz);
  const mfpPrime = 1.0 / (mua + musp);   /* transport mean free path */

  const reasons = [];

  if (ratio < 10) {
    reasons.push(
      `μ_s'/μ_a = ${ratio.toFixed(2)} (want ≳10) — absorption is too strong ` +
      `relative to scattering for light to randomize direction before being absorbed`
    );
  }
  if (mfpPrime > 0.5 * minDim) {
    reasons.push(
      `transport mean free path (${mfpPrime.toFixed(3)} cm) is a large fraction of ` +
      `the smallest slab dimension (${minDim.toFixed(3)} cm) — too little medium for multiple scattering to build up`
    );
  }

  return { valid: reasons.length === 0, reasons };
}
