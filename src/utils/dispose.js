export function disposeHierarchy(object3d) {
  object3d.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material.dispose?.());
    } else {
      child.material?.dispose?.();
    }
  });
}
