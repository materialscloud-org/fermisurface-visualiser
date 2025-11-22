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

// TODO - extend this to be me more flexible + less ugly
export function getBZVectorTraces(
  reciprocalVectors,
  axisColors = ["#2ca02c", "#1f77b4", "#d62728"]
) {
  const traces = [];

  for (let i = 0; i < reciprocalVectors.length; i++) {
    const v = reciprocalVectors[i];
    const [vx, vy, vz] = v;

    traces.push({
      type: "scatter3d",
      mode: "lines",
      x: [0, 0.95 * vx],
      y: [0, 0.95 * vy],
      z: [0, 0.95 * vz],
      line: {
        width: 6,
        color: axisColors[i],
      },
      hoverinfo: "skip",
      showlegend: false,
    });

    traces.push({
      type: "cone",
      x: [vx],
      y: [vy],
      z: [vz],
      u: [vx],
      v: [vy],
      w: [vz],
      sizeref: 0.1,
      anchor: "tip",
      hoverinfo: "skip",
      showscale: false,
      colorscale: [
        ["0.0", axisColors[i]],
        ["1.0", axisColors[i]],
      ],
    });
  }

  // add the origin sphere
  traces.push(makeOriginSphere());

  return traces;
}

// Creates a shaded sphere as a Plotly surface trace
export function makeOriginSphere({
  radius = 0.04,
  color = "#999",
  resolution = 200,
} = {}) {
  const theta = [];
  const phi = [];

  for (let i = 0; i <= resolution; i++) {
    theta.push((i / resolution) * Math.PI);
    phi.push((i / resolution) * 2 * Math.PI);
  }

  const x = [];
  const y = [];
  const z = [];

  for (let i = 0; i <= resolution; i++) {
    const rowX = [];
    const rowY = [];
    const rowZ = [];

    for (let j = 0; j <= resolution; j++) {
      const t = theta[i];
      const p = phi[j];

      rowX.push(radius * Math.sin(t) * Math.cos(p));
      rowY.push(radius * Math.sin(t) * Math.sin(p));
      rowZ.push(radius * Math.cos(t));
    }

    x.push(rowX);
    y.push(rowY);
    z.push(rowZ);
  }

  return {
    type: "surface",
    x,
    y,
    z,
    showscale: false,
    hoverinfo: "skip",
    hovertemplate: "",
    showlegend: false,
    opacity: 1.0,
    surfacecolor: x.map(() => y.map(() => 0)),
    colorscale: [
      ["0.0", color],
      ["1.0", color],
    ],
    lighting: {
      ambient: 0.6,
      diffuse: 0.8,
      specular: 0.6,
      roughness: 0.3,
      fresnel: 0.2,
    },
    contours: { x: { show: false }, y: { show: false }, z: { show: false } },
  };
}
