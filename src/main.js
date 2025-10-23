import { initApp } from "./app.js";

const container = document.getElementById("app");

if (!container) {
  throw new Error("Missing #app container element");
}

initApp(container);
