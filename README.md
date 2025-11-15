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
  - This fixed the harsh discontinuous plane but still has some stepping artifacts.
    - This could be improved by, passing the boundaries to the mc algorithm enforcing mesh cleavage there.
    - Alternatively, mesh cleavage can be handled from the unmasked data, with some care in deciding which side of the plane to keep.
      There seems to be a tonne of strategies to do this but in my attempts i got a misaligned mesh.

## Testing on 100x100x100 grid - performance notes etc.

- Debouncing is a free feature that can actually scale proportionally to the size of the data array.
  - Alternative is a 'Go' button that does the recalculation only then...
  - Some how offloading mesh calculation to a webworker through wasm (or even just a generic webworker) would be amazing but hard
  - Low-resolution - could do the live updates, while the high resolution churns away in the background
    - Crazy idea would be to have the highresolution mesh calculate on the backend and be able to be fetched'
- Post process mesh optimization may make better meshes (at potentially little overhead.)
- Possible future improvements:

  - “Recalculate” button instead of live update
  - Low-resolution preview that updates quickly, with full-res in background
