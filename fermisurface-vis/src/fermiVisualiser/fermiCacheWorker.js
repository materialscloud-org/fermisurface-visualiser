// fermiCacheWorker.js
import { getFermiMesh3d } from "./getFS.js";
import { colorPalette } from "../utils.js";

onmessage = async (event) => {
  const { scalarFields, planes, EMIN, EMAX, STEPSIZE, cachedEs } = event.data;

  const cachedSet = new Set(
    cachedEs?.map((v) => parseFloat(v.toFixed(3))) || []
  );

  const step = EMIN < EMAX ? Math.abs(STEPSIZE) : -Math.abs(STEPSIZE);
  const endCondition = (E) => (step > 0 ? E <= EMAX + 1e-9 : E >= EMAX - 1e-9);

  for (let E = EMIN; endCondition(E); E += step) {
    const roundedE = parseFloat(E.toFixed(3));
    if (cachedSet.has(roundedE)) {
      console.log(`Worker skipping cached E=${roundedE}`);
      continue;
    }

    console.log(`Worker calculating meshes for E=${roundedE}`);

    const meshes = scalarFields.map((field, idx) =>
      getFermiMesh3d(
        field.scalarFieldInfo,
        E,
        planes,
        colorPalette[idx % colorPalette.length],
        field.name ?? `Band ${idx + 1}`
      )
    );

    console.log(`Worker posting meshes for E=${roundedE}`);
    postMessage({ E: roundedE, meshes });
  }

  console.log("Worker finished all calculations");
  postMessage({ done: true });
};
