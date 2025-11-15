import { hexToRgba } from "../utils.js";
import { marchingCubes } from "isosurface";

export function getFermiMesh3d(
  scalarFieldInfo,
  E,
  color = "#0000ff",
  name = "Fermi Surface"
) {
  const { dimensions, origin, spacing, scalarField, minVal, maxVal } =
    scalarFieldInfo;
  const [nx, ny, nz] = dimensions;

  const t0 = performance.now();

  // Pre-allocate outer array
  const values = new Array(nx);
  let idx = 0;

  for (let ix = 0; ix < nx; ix++) {
    const arrY = new Array(ny);
    for (let iy = 0; iy < ny; iy++) {
      const arrZ = new Array(nz);
      for (let iz = 0; iz < nz; iz++, idx++) {
        const v = scalarField[idx];
        arrZ[iz] = v === null ? Infinity : v;
      }
      arrY[iy] = arrZ;
    }
    values[ix] = arrY;
  }

  const t1 = performance.now();
  console.log(`Array nested: ${(t1 - t0).toFixed(6)} ms`);

  // Physical bounds of the grid
  const bounds = [
    origin, // lower corner
    [
      origin[0] + (nx - 1) * spacing[0],
      origin[1] + (ny - 1) * spacing[1],
      origin[2] + (nz - 1) * spacing[2],
    ],
  ];

  const t2 = performance.now();
  console.log(`Bounds Computed : ${(t2 - t1).toFixed(6)} ms`);

  // Get mesh geometry
  const mesh = marchingCubes(
    [nx, ny, nz],
    (x, y, z) => {
      const ix = Math.floor((x - origin[0]) / spacing[0]);
      const iy = Math.floor((y - origin[1]) / spacing[1]);
      const iz = Math.floor((z - origin[2]) / spacing[2]);

      const clamp = (v, max) => Math.min(Math.max(v, 0), max - 1);

      return values[clamp(ix, nx)][clamp(iy, ny)][clamp(iz, nz)] - E;
    },
    bounds
  );

  const t3 = performance.now();
  console.log(`marchingCubes : ${(t3 - t2).toFixed(6)} ms`);

  const { positions, cells } = mesh;

  const x = positions.map((v) => v[0]);
  const y = positions.map((v) => v[1]);
  const z = positions.map((v) => v[2]);

  // Extract face indices
  const i = cells.map((c) => c[0]);
  const j = cells.map((c) => c[1]);
  const k = cells.map((c) => c[2]);

  const t4 = performance.now();
  console.log(`Extraction and mapping made: ${(t4 - t3).toFixed(6)} ms`);

  return {
    type: "mesh3d",
    x,
    y,
    z,
    i,
    j,
    k,
    color,
    opacity: 0.5,
    flatshading: true,
    name,
    hoverinfo: "skip",
    showlegend: true,
    lighting: {
      ambient: 1.0,
      diffuse: 0.0,
      specular: 0.0,
      roughness: 0.0,
      fresnel: 0,
    },
  };
}

export function getFermiIsosurface(
  scalarFieldInfo,
  E,
  tolerance,
  color = "#0000ff",
  name = "Fermi Surface"
) {
  const { dimensions, origin, spacing, scalarField } = scalarFieldInfo;
  const [nx, ny, nz] = dimensions;

  const x = [],
    y = [],
    z = [];
  for (let ix = 0; ix < nx; ix++) {
    for (let iy = 0; iy < ny; iy++) {
      for (let iz = 0; iz < nz; iz++) {
        x.push(origin[0] + ix * spacing[0]);
        y.push(origin[1] + iy * spacing[1]);
        z.push(origin[2] + iz * spacing[2]);
      }
    }
  }

  const sF = scalarField.map((v) => (v === 0 ? null : v));
  console.log(sF);

  const colorscale = [
    [0, color],
    [1, color],
  ];

  return {
    type: "isosurface",
    x,
    y,
    z,
    value: sF,
    showlegend: true,
    isomin: E - tolerance,
    isomax: E + tolerance,
    colorscale: colorscale, // colorscale or RdBu for multi or single band plots.
    opacity: 0.45,
    showscale: false,
    name,
    hoverinfo: "skip", // disable hover
    lighting: {
      ambient: 1.0,
      diffuse: 0.0,
      specular: 0.0,
      roughness: 0.0,
      fresnel: 0,
    },
    caps: { x: false, y: false, z: false },
  };
}
