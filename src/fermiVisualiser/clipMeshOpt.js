// Clip a single triangle against a single plane (optimized, safe)
export function clipTriangleToPlane(tri, plane) {
  const [v0, v1, v2] = tri;
  const { normal, D } = plane;

  // Compute signed distances
  const d0 = normal[0] * v0[0] + normal[1] * v0[1] + normal[2] * v0[2] - D;
  const d1 = normal[0] * v1[0] + normal[1] * v1[1] + normal[2] * v1[2] - D;
  const d2 = normal[0] * v2[0] + normal[1] * v2[1] + normal[2] * v2[2] - D;

  // Bitmask for vertices inside the plane
  const mask = (d0 <= 0 ? 1 : 0) | (d1 <= 0 ? 2 : 0) | (d2 <= 0 ? 4 : 0);

  if (mask === 0) return []; // fully resside
  if (mask === 7) return [tri]; // fully inside

  const res = [];

  // Inline interpolation (no shared storage)
  const interp = (vi, vj, di, dj) => {
    const t = di / (di - dj);
    return [
      vi[0] + t * (vj[0] - vi[0]),
      vi[1] + t * (vj[1] - vi[1]),
      vi[2] + t * (vj[2] - vi[2]),
    ];
  };

  switch (mask) {
    case 1: {
      // only v0 inside
      const a = interp(v0, v1, d0, d1);
      const b = interp(v0, v2, d0, d2);
      res.push([v0, a, b]);
      break;
    }
    case 2: {
      // only v1 inside
      const a = interp(v1, v0, d1, d0);
      const b = interp(v1, v2, d1, d2);
      res.push([v1, b, a]);
      break;
    }
    case 4: {
      // only v2 inside
      const a = interp(v2, v0, d2, d0);
      const b = interp(v2, v1, d2, d1);
      res.push([v2, a, b]);
      break;
    }
    case 3: {
      // v0 + v1 inside
      const a = interp(v0, v2, d0, d2);
      const b = interp(v1, v2, d1, d2);
      res.push([v0, v1, b], [v0, b, a]);
      break;
    }
    case 5: {
      // v0 + v2 inside
      const a = interp(v0, v1, d0, d1);
      const b = interp(v2, v1, d2, d1);
      res.push([v0, a, v2], [v2, b, a]);
      break;
    }
    case 6: {
      // v1 + v2 inside
      const a = interp(v1, v0, d1, d0);
      const b = interp(v2, v0, d2, d0);
      res.push([v1, v2, b], [v1, b, a]);
      break;
    }
  }

  return res;
}

// Fast integer hash for a vertex
function hashVertex(v) {
  const x = Math.round(v[0] * 1e6);
  const y = Math.round(v[1] * 1e6);
  const z = Math.round(v[2] * 1e6);
  return (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
}

// Clip mesh to multiple planes using integer hashing
export function clipMeshToPlanes(positions, cells, planes) {
  const newPositions = [];
  const newCells = [];
  const vertexMap = Object.create(null); // hash -> array of {v,index}

  function addVertex(v) {
    const h = hashVertex(v);
    if (!vertexMap[h]) vertexMap[h] = [];
    // Check for exact match to avoid hash collisions
    const arr = vertexMap[h];
    for (let i = 0; i < arr.length; i++) {
      const vv = arr[i].v;
      if (v[0] === vv[0] && v[1] === vv[1] && v[2] === vv[2])
        return arr[i].index;
    }
    const idx = newPositions.length;
    newPositions.push([v[0], v[1], v[2]]);
    arr.push({ v, index: idx });
    return idx;
  }

  for (let c = 0; c < cells.length; c++) {
    let tris = [
      [positions[cells[c][0]], positions[cells[c][1]], positions[cells[c][2]]],
    ];

    for (let p = 0; p < planes.length; p++) {
      const clipped = [];
      for (let t = 0; t < tris.length; t++) {
        const res = clipTriangleToPlane(tris[t], planes[p]);
        for (let r = 0; r < res.length; r++) clipped.push(res[r]);
      }
      tris = clipped;
      if (tris.length === 0) break;
    }

    for (let t = 0; t < tris.length; t++) {
      newCells.push([
        addVertex(tris[t][0]),
        addVertex(tris[t][1]),
        addVertex(tris[t][2]),
      ]);
    }
  }

  return { positions: newPositions, cells: newCells };
}
