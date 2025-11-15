import Plotly from "plotly.js-dist";
import { getBZTraces } from "./getBZ.js";
import { getFermiIsosurface, getFermiMesh3d } from "./getFS.js";
import { colorPalette } from "../utils.js";

export class FermiVisualiser {
  constructor(containerDiv, dataObject, options = {}) {
    this.containerDiv = containerDiv;
    this.dataObject = dataObject;
    this.currentE = options.initialE ?? 5.5;

    this.bzEdgesTrace = null;
    this.scalarFieldTraces = null;
    this.plotInitialized = false;

    this.initializePlot();
  }

  async initializePlot() {
    const { vertices, edges } = this.dataObject.brillouinZone;

    this.bzEdgesTrace = getBZTraces(vertices, edges, {
      color: "#111",
      width: 5,
    });
    this.bzEdgesTrace.showlegend = false;

    this.scalarFieldTraces = this.dataObject.scalarFields.map((field, idx) =>
      getFermiMesh3d(
        field.scalarFieldInfo,
        this.currentE,
        colorPalette[idx % colorPalette.length],
        field.name ?? `Band ${idx + 1}`
      )
    );

    const layout = {
      title: "Brillouin Zone + Scalar Fields",
      scene: {
        xaxis: { visible: false },
        yaxis: { visible: false },
        zaxis: { visible: false },
      },
    };

    await Plotly.newPlot(
      this.containerDiv,
      [this.bzEdgesTrace, ...this.scalarFieldTraces],
      layout
    );
    this.plotInitialized = true;

    this.containerDiv.on("plotly_legendclick", (eventData) => {
      const scene = this.containerDiv._fullLayout.scene;
      if (!scene) return;
      const currentCamera = { ...scene.camera };
      setTimeout(() => {
        Plotly.relayout(this.containerDiv, { "scene.camera": currentCamera });
      }, 0);
    });
  }

  update(E) {
    if (!this.plotInitialized) {
      console.warn("Plot not initialized yet.");
      return;
    }

    this.currentE = E;

    const oldTraces = this.containerDiv.data;
    const visibleStates = oldTraces.map((trace) => trace.visible);

    this.scalarFieldMesh = this.dataObject.scalarFields.map((field, idx) =>
      getFermiMesh3d(
        field.scalarFieldInfo,
        E,
        colorPalette[idx % colorPalette.length],
        field.name ?? `Band ${idx + 1}`
      )
    );

    const newTraces = [this.bzEdgesTrace, ...this.scalarFieldMesh];

    for (let i = 0; i < newTraces.length; i++) {
      if (visibleStates[i] !== undefined) {
        newTraces[i].visible = visibleStates[i];
      }
    }

    const scene = this.containerDiv._fullLayout.scene;
    const camera = scene ? scene.camera : null;

    const newLayout = {
      title: "Brillouin Zone + Scalar Fields",
      scene: {
        xaxis: { visible: false },
        yaxis: { visible: false },
        zaxis: { visible: false },
        ...(camera && { camera }),
      },
    };

    Plotly.react(this.containerDiv, newTraces, newLayout);
  }
}
