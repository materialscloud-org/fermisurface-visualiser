import Plotly from "plotly.js-dist";
import { getBZTraces } from "./getBZ.js";
import { getFermiMesh3d } from "./getFS.js";
import { colorPalette } from "../utils.js";

export class FermiVisualiser {
  constructor(containerDiv, dataObject, options = {}) {
    this.containerDiv = containerDiv;
    this.dataObject = dataObject;
    this.currentE = options.initialE ?? this.dataObject.fermiEnergy;

    this.defaultMeshLighting = {
      ambient: 1.0,
      diffuse: 0.0,
      specular: 0.0,
      roughness: 0.0,
      fresnel: 0,
    };
    this.meshLighting = options.meshLighting || this.defaultMeshLighting;

    // backend
    this.worker = new Worker(
      new URL("./fermiCacheWorker.js", import.meta.url),
      {
        type: "module",
      }
    );

    this.bzEdgesTrace = null;
    this.scalarFieldTraces = null;
    this.plotInitialized = false;

    this.planes = dataObject.brillouinZone.planes;

    // TODO: should also preset the camera positon, to be looking down axis.
    this.defaultLayout = {
      margin: { t: 20, b: 0, l: 0, r: 0 }, // remove extra spacing
      title: "Brillouin Zone + Scalar Fields",
      scene: {
        xaxis: { visible: false },
        yaxis: { visible: false },
        zaxis: { visible: false },
        camera: {
          projection: {
            type: "orthographic", // no depth perseception.
          },
        },
      },
    };

    this.defaultConfig = {
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: [
        "zoom3d",
        "pan3d",
        "orbitRotation",
        "tableRotation",
        "resetCameraLastSave3d",
        "hoverClosest3d",
      ],
      modeBarButtonsToAdd: [
        {
          name: "Toggle view type",
          icon: Plotly.Icons.autoscale,
          click: function (gd) {
            const current = gd.layout.scene.camera.projection.type;
            const next =
              current === "perspective" ? "orthographic" : "perspective";
            Plotly.relayout(gd, { "scene.camera.projection.type": next });
          },
        },
      ],
    };

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

    // simple cache via a map
    this.meshCache = new Map();

    // plot initialisation.
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
        this.planes,
        colorPalette[idx % colorPalette.length],
        field.name ?? `Band ${idx + 1}`,
        this.meshLighting
      )
    );

    // set in cache
    this.meshCache.set(this.currentE, this.scalarFieldTraces);

    await Plotly.newPlot(
      this.containerDiv,
      [this.bzEdgesTrace, ...this.scalarFieldTraces],
      this.defaultLayout,
      this.defaultConfig
    );
    this.plotInitialized = true;

    this.containerDiv.on("plotly_legendclick", (eventData) => {
      const scene = this.containerDiv._fullLayout.scene;
      if (!scene) return;
      const currentCamera = { ...scene.camera };
      setTimeout(() => {
        // delay the relayout to avoid double firing events.
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
      console.log("cacheHit");
      scalarFieldMesh = this.meshCache.get(E);
      timeTaken = performance.now() - initialTime;
    } else {
      // recalculate mesh.
      scalarFieldMesh = this.dataObject.scalarFields.map((field, idx) =>
        getFermiMesh3d(
          field.scalarFieldInfo,
          E,
          this.planes,
          colorPalette[idx % colorPalette.length],
          field.name ?? `Band ${idx + 1}`,
          this.meshLighting
        )
      );
      timeTaken = performance.now() - initialTime;
      // add to cache
      this.meshCache.set(E, scalarFieldMesh);

      // here we do some crazy precaching...
      // since its kind of insane to run (potentially) so much compute off the main thread
      // for data that may never be seen i'm keeping this very obviously written badly so
      //  it will stick out as a sore thumb...
      // TODO - discuss whether it makes any amount of sense to have something like this...
      const ranges = [
        { maxTime: 20, range: 10.0 },
        { maxTime: 40, range: 5.0 },
        { maxTime: 50, range: 2.0 }, // additional range if desired
      ];
      for (const { maxTime, range } of ranges) {
        if (timeTaken < maxTime) {
          console.log(
            `WEB WORKER IS BUILDING A CACHE BECAUSE LAST CALC TOOK <${maxTime}ms`
          );

          if (this.currentE < this.oldE) {
            // stack a large positive cache
            this.buildCacheByRangeWorker(E, E - range, 0.1);
            // small negative cache
            this.buildCacheByRangeWorker(E, E + 0.5 * range, 0.1);

            break; //
          }
          if (this.currentE > this.oldE) {
            // negative cache
            this.buildCacheByRangeWorker(E, E + range, 0.1);
            // small positive cache
            this.buildCacheByRangeWorker(E, E - 0.5 * range, 0.1);

            break;
          }
        }
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

  /** Private helper: Currently unused - builds the nested [nx][ny][nz] array */
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
            this.planes,
            colorPalette[idx % colorPalette.length],
            field.name ?? `Band ${idx + 1}`,
            this.meshLighting
          )
        );
        this.meshCache.set(roundedE, fields);
      }
    }

    return this.meshCache;
  }

  // equivalent to the above method, but crazily runs off the main thread.
  // In principle this allows building a very deep cache without blocking current DOM rendering.
  // 1. Initial plot can load
  // 2. This can be called - and the plot (or other content) isnt locked from updates.
  async buildCacheByRangeWorker(EMIN, EMAX, STEPSIZE) {
    if (!this.worker) {
      this.worker = new Worker(
        new URL("./fermiCacheWorker.js", import.meta.url)
      );
    }

    return new Promise((resolve, reject) => {
      const energiesProcessed = new Set();

      this.worker.onmessage = (event) => {
        const data = event.data;

        if (data.done) {
          resolve(this.meshCache);
          return;
        }

        const { E, meshes } = data;
        const roundedE = parseFloat(E.toFixed(3));
        this.meshCache.set(roundedE, meshes);
        energiesProcessed.add(roundedE);

        // Optional: update plot if this is the currently selected E
        if (Math.abs(this.currentE - roundedE) < 1e-6 && this.plotInitialized) {
          const newTraces = [this.bzEdgesTrace, ...meshes];
          Plotly.react(this.containerDiv, newTraces, this.defaultLayout);
        }
      };

      this.worker.onerror = (err) => {
        reject(err);
      };

      // Start worker
      this.worker.postMessage({
        scalarFields: this.dataObject.scalarFields,
        planes: this.planes,
        EMIN,
        EMAX,
        STEPSIZE,
        cachedEs: Array.from(this.meshCache.keys()),
      });
    });
  }
}
