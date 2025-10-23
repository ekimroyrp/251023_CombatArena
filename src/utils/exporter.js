import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";

export function exportBlockoutOBJ(object3d, filename = "arena.obj") {
  const exporter = new OBJExporter();
  const objContent = exporter.parse(object3d);

  const blob = new Blob([objContent], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  setTimeout(() => URL.revokeObjectURL(url), 0);
}
