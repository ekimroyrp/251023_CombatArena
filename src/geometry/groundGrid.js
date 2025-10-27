import * as THREE from "three";

const GRID_EXTENT = 4000;
const FADE_STRENGTH = 0.01;
const LINE_ALPHA = 0.55;

export function createGroundGrid(initialCellSize, color = "#969696") {
  const geometry = new THREE.PlaneGeometry(GRID_EXTENT, GRID_EXTENT, 1, 1);
  geometry.rotateX(-Math.PI / 2);

  const uniforms = {
    uCellSize: { value: Math.max(0.001, initialCellSize) },
    uGridColor: { value: new THREE.Color(color) },
    uFadeStrength: { value: FADE_STRENGTH },
    uLineAlpha: { value: LINE_ALPHA }
  };

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms,
    extensions: { derivatives: true },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vWorldPos;
      uniform float uCellSize;
      uniform vec3 uGridColor;
      uniform float uFadeStrength;
      uniform float uLineAlpha;

      void main() {
        vec2 planePos = vWorldPos.xz / max(uCellSize, 0.0001);
        vec2 derivative = fwidth(planePos);
        derivative = max(derivative, vec2(0.0005));
        vec2 grid = abs(fract(planePos - 0.5) - 0.5) / derivative;
        float line = 1.0 - min(1.0, min(grid.x, grid.y));

        float dist = length(vWorldPos.xz - cameraPosition.xz);
        float fade = exp(-dist * uFadeStrength);

        float alpha = line * fade * uLineAlpha;
        if (alpha <= 0.001) {
          discard;
        }

        gl_FragColor = vec4(uGridColor, alpha);
      }
    `
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = -0.05;
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;

  return {
    mesh,
    material,
    uniforms
  };
}

export function updateGroundGrid(grid, cellSize, color) {
  if (!grid) {
    return;
  }
  grid.uniforms.uCellSize.value = Math.max(0.001, cellSize);
  if (grid.uniforms.uGridColor) {
    grid.uniforms.uGridColor.value.set(color ?? "#969696");
  }
}
