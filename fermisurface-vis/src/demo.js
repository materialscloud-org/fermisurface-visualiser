import { FermiVisualiser } from "./fermiVisualiser/fermiVisualiser.js";
import { debounce } from "./utils.js";

async function runDemo() {
  const data = await fetch("data.json").then((r) => r.json());

  const containerDiv = document.getElementById("plot");
  const vis = new FermiVisualiser(containerDiv, data, { initialE: 4.9 });

  // could be used to prebuild cache
  // vis.buildCacheByRange(3, 10, 0.1);

  const EInput = document.getElementById("E");
  EInput.value = Math.round(data.fermiEnergy * 10) / 10;

  const onUserInput = () => {
    const E = parseFloat(EInput.value);
    vis.update(E);
  };

  EInput.addEventListener("input", onUserInput);
}

runDemo();
