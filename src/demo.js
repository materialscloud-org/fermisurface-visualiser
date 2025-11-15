import { FermiVisualiser } from "./fermiVisualiser/fermiVisualiser.js";
import { debounce } from "./utils.js";

async function runDemo() {
  const data = await fetch("./src/example_data/data.json").then((r) =>
    r.json()
  );

  const containerDiv = document.getElementById("plot");
  const vis = new FermiVisualiser(containerDiv, data, {
    initialE: 5.5,
  });

  const EInput = document.getElementById("E");

  const onUserInput = () => {
    const E = parseFloat(EInput.value);
    vis.update(E);
  };

  EInput.addEventListener("input", onUserInput);
}

runDemo();
