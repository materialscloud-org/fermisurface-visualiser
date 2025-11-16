# **FermiVisPlotly**

## Interactive 3D visualization of Fermi surfaces inside the Brillouin zone, powered by [Plotly.js](https://plotly.com/javascript/).

- A small JavaScript module to visualize Fermi surfaces as isosurfaces
- Shows them inside the Brillouin zone, rendered with Plotly.js
- Usable in:

  - Vanilla JS
  - React (via a simple wrapper component)

- Requires your data to be preprocessed into a JSON format

---

## **Converting BXSF files**

Use the helper script to convert `.bxsf` to the required JSON format:

```bash
cd convertBXSF
pip install numpy scipy  # needed for Voronoi & remapping

# Convert a file:
python3 prepareForFermiVis.py PATH/TO/your.bxsf
```

Has optional flags to control:

- Choose resolution
- Extraction of specific band indices

---

## 🚀 **Usage (Vanilla JS)**

```js
import { FermiVisualiser } from "fermi-vis-plotly";

const data = await fetch("./path/to/your/data.json").then((r) => r.json());

// Grab a div where you want the plot:
const container = document.getElementById("plot");

// Create visualiser:
const vis = new FermiVisualiser(container, data, {
  initialE: 5.5,
  initialTol: 0.0,
});

// Later, update:
vis.update(newE, newTolerance);
```

---

## ⚛ **Usage (React)**

Wrap it with your own controls:

```jsx
<FermiVisualiserReact data={data} initialE={5.5} E={E} />
```

Your React state drives updates — the visualiser only handles plotting.

```js
const [E, setE] = useState(5.5); // controlled state for energy
```

---

## 🛠 **Development & demo**

For the included demo with an example dataset:

```bash
npm install
npm run dev
```

Then open: [http://localhost:5173/](http://localhost:5173/)

Replace `src/example_data/data.json` with your own converted dataset.

---

## **(WIP) and potential lowhanging fruit**

- Have switched to using a on the fly marching cubes algorithm, and that converts, null to infinity on BZ boundaries.

  - Now post process the resulting mesh for extremely nice plane cleavage,

    - I think im perhaps over-sending planes (20 instead of 8 on the example data).
      - I have some plane duplication function, but this may be a little suspect on different data # TODO test this.
      - These cleaved meshes are significantly reduced in size (1/10th the previous), maybe these could be cached and loaded from a backend (via some expensive pipeline), this also means that loading them from the visualisercache is a little faster...

- Fix small bug with low-res grids
  - The spanning axis currently recieves a padding (5%) this means grids less than 20 (100/5) dont get to span the whole BZ space (1 datapoint < 5%)
  - switch to use a absolute grid padding

## Testing on 100x100x100 grid - performance notes etc.

- Debouncing is a free feature that could be tuned to proportionally to the size of the data array.
  - Alternative is a 'Go' button that does the recalculation only then...
  - Some how offloading mesh calculation to a webworker through wasm (or even just a generic webworker) would be amazing but hard
  - Low-resolution - could do the live updates, while the high resolution churns away in the background
    - Crazy idea would be to have the highresolution mesh calculate on the backend and be able to be fetched'
- Post process mesh optimization may make better meshes (at potentially little overhead.)
- Possible future improvements:

  - “Recalculate” button instead of live update
  - Low-resolution preview that updates quickly, with full-res in background
