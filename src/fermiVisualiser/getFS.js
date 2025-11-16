import { hexToRgba } from "../utils.js";

import { clipMeshToPlanes } from "./clipMeshOpt.js";

import { marchingCubes } from "isosurface";

export function getFermiMesh3d(
  scalarFieldInfo,
  E,
  slicedPlanes = [],
  color = "#0000ff",
  name = "Fermi Surface"
) {
  const { dimensions, origin, spacing, minval, maxval, formattedScalarField } =
    scalarFieldInfo;

  if (1.1 * E < minval || 0.9 * E > maxval) {
    // if outside of range just return a placeholder mesh
    return {
      type: "mesh3d",
      x: [0],
      y: [0],
      z: [0],
      i: [0],
      j: [0],
      k: [0],
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

  const [nx, ny, nz] = dimensions;

  // Physical bounds of the grid
  const bounds = [
    origin, // lower corner
    [
      origin[0] + (nx - 1) * spacing[0],
      origin[1] + (ny - 1) * spacing[1],
      origin[2] + (nz - 1) * spacing[2],
    ],
  ];

  //   // Get mesh geometry
  // const mesh = marchingCubes(
  //   [nx, ny, nz],
  //   (x, y, z) => {
  //     const ix = Math.floor((x - origin[0]) / spacing[0]);
  //     const iy = Math.floor((y - origin[1]) / spacing[1]);
  //     const iz = Math.floor((z - origin[2]) / spacing[2]);

  //     const clamp = (v, max) => Math.min(Math.max(v, 0), max - 1);

  //     return values[clamp(ix, nx)][clamp(iy, ny)][clamp(iz, nz)] - E;
  //   },
  //   bounds
  // );

  const invSpacingX = 1 / spacing[0];
  const invSpacingY = 1 / spacing[1];
  const invSpacingZ = 1 / spacing[2];
  const nyz = ny * nz;

  const t2 = performance.now();

  // Get mesh geometry - equivalent to above but uses a flattened array for fast indexing.
  const mesh = marchingCubes(
    [nx, ny, nz],
    (x, y, z) => {
      const ix = ((x - origin[0]) * invSpacingX) | 0;
      const iy = ((y - origin[1]) * invSpacingY) | 0;
      const iz = ((z - origin[2]) * invSpacingZ) | 0;

      const idx = ix * nyz + iy * nz + iz;
      return formattedScalarField[idx] - E; // This can probably now be the normal scalarField
    },
    bounds
  );

  const t3 = performance.now();
  // console.log(`mC run took: ${t3 - t2} ms`);
  // TODO - performance improve this - potentially with idk some other shit.

  const planes = slicedPlanes;
  const { positions, cells } = clipMeshToPlanes(
    mesh.positions,
    mesh.cells,
    planes
  );
  // old method (no clipping [since approximated at data level.])
  //const { positions, cells} = mesh;

  const t4 = performance.now();
  console.log(`mesh Clipping run took: ${t4 - t3} ms - `);

  // const x = positions.map((v) => v[0]);
  // const y = positions.map((v) => v[1]);
  // const z = positions.map((v) => v[2]);

  // const i = cells.map((c) => c[0]);
  // const j = cells.map((c) => c[1]);
  // const k = cells.map((c) => c[2]);

  // const t4 = performance.now();
  // console.log(`Extraction and mapping made: ${(t4 - t3).toFixed(6)} ms`);

  // Get x,y,z & i,j,k (equivalent to above but slightly faster)
  const nVertices = positions.length;
  const nFaces = cells.length;

  // Pre-allocate typed arrays
  const x = new Float32Array(nVertices);
  const y = new Float32Array(nVertices);
  const z = new Float32Array(nVertices);

  for (let v = 0; v < nVertices; v++) {
    const p = positions[v];
    x[v] = p[0];
    y[v] = p[1];
    z[v] = p[2];
  }

  // Face indices
  const i = new Uint32Array(nFaces);
  const j = new Uint32Array(nFaces);
  const k = new Uint32Array(nFaces);

  for (let f = 0; f < nFaces; f++) {
    const c = cells[f];
    i[f] = c[0];
    j[f] = c[1];
    k[f] = c[2];
  }

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
