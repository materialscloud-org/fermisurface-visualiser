import Plotly from "plotly.js-dist";
import { getBZTraces } from "./getBZ.js";
import { getFermiMesh3d } from "./getFS.js";
import { colorPalette } from "../utils.js";

export class FermiVisualiser {
  constructor(containerDiv, dataObject, options = {}) {
    this.containerDiv = containerDiv;
    this.dataObject = dataObject;
    this.currentE = options.initialE ?? 5.5; // def to 5.5 eV

    this.bzEdgesTrace = null;
    this.scalarFieldTraces = null;
    this.plotInitialized = false;

    this.defaultLayout = {
      title: "Brillouin Zone + Scalar Fields",
      scene: {
        xaxis: { visible: false },
        yaxis: { visible: false },
        zaxis: { visible: false },
      },
    };

    // Precompute nested arrays for scalar fields
    for (const field of this.dataObject.scalarFields) {
      if (!field.scalarFieldInfo.values3D) {
        field.scalarFieldInfo.values3D = this._nestScalarField(
          field.scalarFieldInfo
        );
      }
    }

    for (const field of this.dataObject.scalarFields) {
      this._convertNullsToInf(field.scalarFieldInfo);
    }

    // this may be useful to know the max total number of 'grid points'
    let totalSize = 0;
    for (const field of this.dataObject.scalarFields) {
      const [nx, ny, nz] = field.scalarFieldInfo.dimensions;
      totalSize += nx * ny * nz;
    }
    this.totalDimensionality = totalSize;

    // simple cache
    this.meshCache = new Map();

    // plot initialisation.
    this.initializePlot();
  }

  async initializePlot() {
    const { vertices, edges } = this.dataObject.brillouinZone;

    console.log(this.totalDimensionality);

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

    // set in cache
    this.meshCache.set(this.currentE, this.scalarFieldTraces);

    await Plotly.newPlot(
      this.containerDiv,
      [this.bzEdgesTrace, ...this.scalarFieldTraces],
      this.defaultLayout
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

    // update current Energy choice
    this.oldE = this.currentE;
    this.currentE = E;

    // track visible traces.
    const oldTraces = this.containerDiv.data;
    const visibleStates = oldTraces.map((trace) => trace.visible);

    let scalarFieldMesh;
    const initialTime = performance.now();
    let timeTaken;
    // Look in cache
    if (this.meshCache.has(E)) {
      scalarFieldMesh = this.meshCache.get(E);
      timeTaken = performance.now() - initialTime;
    } else {
      // recalculate mesh.
      scalarFieldMesh = this.dataObject.scalarFields.map((field, idx) =>
        getFermiMesh3d(
          field.scalarFieldInfo,
          E,
          colorPalette[idx % colorPalette.length],
          field.name ?? `Band ${idx + 1}`
        )
      );
      timeTaken = performance.now() - initialTime;
      // add to cache
      this.meshCache.set(E, scalarFieldMesh);

      // if the calculation was exceedingly short we can build the cache on both sides very deep.
      if (timeTaken < 50) {
        this.buildCacheByRange(E - 0.5, E + 0.5, 0.1);
      }
    }

    this.scalarFieldMesh = scalarFieldMesh;
    const newTraces = [this.bzEdgesTrace, ...this.scalarFieldMesh];

    // apply visibility state.
    for (let i = 0; i < newTraces.length; i++) {
      if (visibleStates[i] !== undefined) {
        newTraces[i].visible = visibleStates[i];
      }
    }

    // apply camera state
    const scene = this.containerDiv._fullLayout.scene;
    const camera = scene ? scene.camera : null;
    const camLayout = { ...this.defaultLayout, ...(camera && { camera }) };

    // finally update plot.
    Plotly.react(this.containerDiv, newTraces, camLayout);
  }

  // Helper functions - currently mostly for testing a high performance cache builder.
  /**
   * Add an external mesh to the cache for a given E value.
   * @param {number} E - Energy value
   * @param {Array} meshTraces - Array of mesh3d traces corresponding to E
   */
  addExtraCache(E, meshTraces) {
    this.meshCache.set(E, meshTraces);
    console.log(`Added external mesh to cache for E = ${E}`);
  }

  getFullCache() {
    // Shallow copy is fine; the traces themselves can remain references
    return new Map(this.meshCache);
  }

  /** Private helper: builds the nested [nx][ny][nz] array */
  _nestScalarField(scalarFieldInfo) {
    const { scalarField, dimensions } = scalarFieldInfo;
    const [nx, ny, nz] = dimensions;
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
    return values;
  }

  /** Private preformatter: builds the nested [nx][ny][nz] array */
  _convertNullsToInf(scalarFieldInfo) {
    const { scalarField, dimensions } = scalarFieldInfo;
    const [nx, ny, nz] = dimensions;
    const totalSize = nx * ny * nz;

    // Use Float32Array for fast numeric operations
    const formattedScalarField = new Float32Array(totalSize);

    for (let i = 0; i < totalSize; i++) {
      const v = scalarField[i];
      formattedScalarField[i] = v === null ? Infinity : v;
    }

    // Save to scalarFieldInfo
    scalarFieldInfo.formattedScalarField = formattedScalarField;
  }

  /**
   * Builds and caches meshes for a range of energy values.
   * @param {number} EMIN - Minimum energy
   * @param {number} EMAX - Maximum energy
   * @param {number} STEPSIZE - Step size for energies
   * @returns {Map} meshCache - Map of E -> mesh traces
   */
  async buildCacheByRange(EMIN, EMAX, STEPSIZE) {
    for (let E = EMIN; E <= EMAX + 1e-9; E += STEPSIZE) {
      const roundedE = parseFloat(E.toFixed(3));
      if (!this.meshCache.has(roundedE)) {
        const fields = this.dataObject.scalarFields.map((field, idx) =>
          getFermiMesh3d(
            field.scalarFieldInfo,
            E,
            colorPalette[idx % colorPalette.length],
            field.name ?? `Band ${idx + 1}`
          )
        );
        this.meshCache.set(roundedE, fields);
      }
    }

    return this.meshCache;
  }
}
