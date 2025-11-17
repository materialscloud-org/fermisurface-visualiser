export function getBZTraces(vertices, edges, options = {}) {
  const { color = "black", width = 2.5, name = "" } = options;

  const x = [];
  const y = [];
  const z = [];

  edges.forEach(([startIdx, endIdx]) => {
    const start = vertices[startIdx];
    const end = vertices[endIdx];
    x.push(start[0], end[0], null);
    y.push(start[1], end[1], null);
    z.push(start[2], end[2], null);
  });

  return {
    type: "scatter3d",
    mode: "lines",
    x,
    y,
    z,
    line: {
      color,
      width,
    },
    name,
    hoverinfo: "skip",
  };
}

export function getBZMesh(vertices, faces, options = {}) {
  const { color = "#888", opacity = 0.2, name = "BZ Faces" } = options;

  console.log("creating mesh from faces...");

  return {
    type: "mesh3d",
    x: vertices.map((v) => v[0]),
    y: vertices.map((v) => v[1]),
    z: vertices.map((v) => v[2]),
    i: faces.map((f) => f[0]),
    j: faces.map((f) => f[1]),
    k: faces.map((f) => f[2]),
    color,
    opacity,
    flatshading: true,
    hoverinfo: "skip",
    name,
    showlegend: false,
  };
}
