// TOOD - performance maximise this, it seems to be a large chunk of the performance hit.

// Helper: linear interpolation along edge for plane intersection
function interpVertex(v1, v2, d1, d2) {
  const t = d1 / (d1 - d2); // fraction along the edge
  return [
    v1[0] + t * (v2[0] - v1[0]),
    v1[1] + t * (v2[1] - v1[1]),
    v1[2] + t * (v2[2] - v1[2]),
  ];
}

// Clip a single triangle against a single plane
function clipTriangleToPlane(triangle, plane) {
  const [v0, v1, v2] = triangle;
  const verts = [v0, v1, v2];
  const distances = verts.map(
    ([x, y, z]) =>
      plane.normal[0] * x + plane.normal[1] * y + plane.normal[2] * z - plane.D
  );

  const inside = [];
  const outside = [];
  for (let i = 0; i < 3; i++) (distances[i] <= 0 ? inside : outside).push(i);

  if (inside.length === 0) return []; // fully outside
  if (inside.length === 3) return [verts]; // fully inside

  // partially inside → split triangle
  const newVerts = [];

  if (inside.length === 1 && outside.length === 2) {
    const i0 = inside[0],
      o0 = outside[0],
      o1 = outside[1];
    const vi = verts[i0];
    const v0 = interpVertex(vi, verts[o0], distances[i0], distances[o0]);
    const v1 = interpVertex(vi, verts[o1], distances[i0], distances[o1]);
    newVerts.push([vi, v0, v1]);
  } else if (inside.length === 2 && outside.length === 1) {
    const i0 = inside[0],
      i1 = inside[1],
      o0 = outside[0];
    const v0 = verts[i0];
    const v1 = verts[i1];
    const v2 = interpVertex(v0, verts[o0], distances[i0], distances[o0]);
    const v3 = interpVertex(v1, verts[o0], distances[i1], distances[o0]);
    newVerts.push([v0, v1, v3]);
    newVerts.push([v0, v3, v2]);
  }

  return newVerts;
}

// Clip entire mesh to multiple planes
export function clipMeshToPlanes(positions, cells, planes) {
  let newPositions = [];
  let newCells = [];
  let vertexMap = new Map(); // map from vertex string to index

  function addVertex(v) {
    const key = v.map((x) => x.toFixed(6)).join(",");
    if (!vertexMap.has(key)) {
      vertexMap.set(key, newPositions.length);
      newPositions.push(v);
    }
    return vertexMap.get(key);
  }

  for (const cell of cells) {
    // get triangle vertices
    let tris = [cell.map((i) => positions[i])];

    // clip sequentially against all planes
    for (const plane of planes) {
      const clipped = [];
      for (const tri of tris) {
        clipped.push(...clipTriangleToPlane(tri, plane));
      }
      tris = clipped;
      if (tris.length === 0) break; // completely clipped
    }

    for (const tri of tris) {
      const idxs = tri.map(addVertex);
      newCells.push(idxs);
    }
  }

  return { positions: newPositions, cells: newCells };
}
