import * as THREE from "three";

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

export const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// Initialize with default position (will be reset when model loads)
camera.position.set(0, 5.4, -4.3);
camera.rotation.set(-3, 0, 3.121154018741333);

export const renderer = new THREE.WebGLRenderer({
  antialias: false, // Disable antialiasing for better performance
  powerPreference: "high-performance",
  stencil: false,
  depth: true,
});

export const canvasContainer = document.getElementById("canvas-container");

// Function to get container dimensions
function getContainerSize() {
  const rect = canvasContainer.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
  };
}

// Set initial size based on container
const containerSize = getContainerSize();
renderer.setSize(containerSize.width, containerSize.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Further limit pixel ratio for performance
camera.aspect = containerSize.width / containerSize.height;
camera.updateProjectionMatrix();

// Trigger initial resize after a short delay to ensure container is fully rendered
setTimeout(() => {
  window.dispatchEvent(new Event("resize"));
}, 100);
renderer.shadowMap.enabled = false; // Disable shadows for better performance
renderer.toneMapping = THREE.NoToneMapping; // Disable tone mapping for better performance
renderer.outputColorSpace = THREE.SRGBColorSpace;

canvasContainer.appendChild(renderer.domElement);
export const canvas = renderer.domElement;

// Window resize handler - will be updated after post-processing is initialized
let resizeHandler = () => {
  const size = getContainerSize();
  camera.aspect = size.width / size.height;
  camera.updateProjectionMatrix();
  renderer.setSize(size.width, size.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
};

window.addEventListener("resize", resizeHandler);

export function setResizeHandler(handler) {
  window.removeEventListener("resize", resizeHandler);
  resizeHandler = handler;
  window.addEventListener("resize", resizeHandler);
}

/**
 * Reset camera to a specific position and rotation
 * Ensures quaternion and euler are properly synchronized
 */
export function resetCamera(position, rotation, euler) {
  if (position) {
    camera.position.set(position.x, position.y, position.z);
  }
  if (rotation) {
    camera.rotation.set(rotation.x, rotation.y, rotation.z);
    // Ensure quaternion is updated from rotation
    camera.updateMatrixWorld();
    // Sync euler if provided
    if (euler) {
      euler.setFromQuaternion(camera.quaternion);
    }
  }
}
