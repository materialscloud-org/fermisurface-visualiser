# Materials Cloud fermisurface visualiser

This repository contains

- ./convertBXSF - a python package that allows conversion from a single bxsf file to a web-friendly json file.
- ./fermisurface-vis - the javascript package to visualise the json file.

---

### Converting BXSF files

Use the helper script to convert `.bxsf` to the required JSON format:

```bash
cd convertBXSF
pip install numpy scipy  # needed for Voronoi & remapping

# Convert a file:
python3 ./prepareForFermiVis.py path/to/your.bxsf -r RESOLUTION (default:20)

python3 ./prepareForFermiVis.py -h # for other flags.
```

---

### Usage (Vanilla JS)

```js
import { FermiVisualiser } from "fermi-vis-plotly";

const data = await fetch("./path/to/your/data.json").then((r) => r.json());

// Grab a div where you want the plot:
const container = document.getElementById("plot");

// Create visualiser defaults to fermilevel.
const vis = new FermiVisualiser(container, data);

// update the plot
vis.update(newFermiEValue);
```

---

### Development

```bash
npm install
npm run dev

# GOTO http://localhost:5173/
# The data.json inside public will be read.
```

### Development notes and TODOS

- These cleaved meshes are significantly reduced in size (1/10th the previous), maybe these could be cached and loaded from a backend (via some expensive pipeline), this also means that loading them from the visualisercache is a little faster...

#### Testing on 100x100x100 grid - performance notes etc.

- Debouncing is a free feature that could be tuned to proportionally to the size of the data array.
  - Alternative is a 'Go' button that does the recalculation only then...
  - Some how offloading mesh calculation to a webworker through wasm (or even just a generic webworker) would be amazing but hard
  - Low-resolution - could do the live updates, while the high resolution churns away in the background
    - Crazy idea would be to have the highresolution mesh calculate on the backend and be able to be fetched'
- Post process mesh optimization may make better meshes (at potentially little overhead.)
- Possible future improvements:

  - “Recalculate” button instead of live update
  - Low-resolution preview that updates quickly, with full-res in background
