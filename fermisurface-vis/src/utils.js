// utils.js
export const colorPalette = [
  "#1f77b4", // muted blue
  "#ff7f0e", // safety orange
  "#2ca02c", // cooked asparagus green
  "#d62728", // brick red
  "#9467bd", // muted purple
  "#8c564b", // chestnut brown
  "#e377c2", // raspberry yogurt pink
  "#7f7f7f", // middle gray
  "#bcbd22", // curry yellow-green
  "#17becf"  // blue-teal
];

// Utility: Convert hex color to rgba string with alpha
export function hexToRgba(hex, alpha = 0.75) {
  // Remove leading '#' if present
  hex = hex.replace(/^#/, "");

  // Parse 3 or 6 digit hex
  let r, g, b;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else {
    throw new Error("Invalid hex color format");
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Fetch JSON data safely.
 * @param {string} url
 * @returns {Promise<object>}
 */
export async function getData(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error("Failed to fetch data:", err);
    throw err;
  }
}

export function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function getNiceRandomColor() {
  const hue = Math.floor(Math.random() * 360); // full color wheel
  const saturation = 65; // stay reasonably colorful
  const lightness = 50; // not too light or dark
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}