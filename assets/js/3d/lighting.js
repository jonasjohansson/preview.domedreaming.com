import * as THREE from "three";
import { scene } from "./scene.js";

export function setupLighting() {
  // Simple ambient light only - GLB lights will provide the main lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(ambientLight);

  // Fog for atmospheric depth
  scene.fog = new THREE.Fog(0x1a1a1a, 20, 60);
}
