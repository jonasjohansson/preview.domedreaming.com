/**
 * Barrel export for 3D module
 * Re-exports all 3D-related functions and constants from individual modules
 */

// Scene exports
export { scene, camera, renderer, canvas, canvasContainer, setResizeHandler, resetCamera, updateCameraFOV } from "./scene.js";

// Camera exports
export { 
  isPointerLocked, 
  isTouching, 
  euler, 
  modelLoaded, 
  touchStartX, 
  touchStartY, 
  keys, 
  qeRotationSpeed,
  setModelLoaded,
  setQeRotationSpeed,
  setupCameraControls 
} from "./camera.js";

// Movement exports
export { touchMovement, setNavMeshQuery, updateMovement, updateRotation } from "./movement.js";

// Model exports
export { wisdomeModel, fbxMeshes, glbLights, glbLightsGroup, loadModel } from "./model.js";

// Texture exports
export {
  setScreenObject,
  getScreenObject,
  getCurrentVideoTexture,
  getCurrentVideo,
  getCurrentImageTexture,
  loadDefaultScreenTexture,
  loadImage,
  loadVideo,
  connectWebcam,
  disconnectWebcam,
  setupDragAndDrop
} from "./texture.js";

// Lighting exports
export { setupLighting } from "./lighting.js";

// Screen lighting exports
export { initScreenLighting, updateScreenLighting, setColorSamplingEnabled, getScreenLight } from "./screen-lighting.js";

// Post-processing exports
export { initPostProcessing, updatePostProcessing, resizePostProcessing, getBloomPass } from "./postprocessing.js";

// Navmesh exports
export { getNavMeshQuery, verifyNavmeshAtStartPosition, initNavmesh } from "./navmesh.js";

// Utils exports
export { 
  applyTextureToScreen, 
  configureTexture, 
  getMaterial, 
  colorToHex, 
  pruneObjectChildren, 
  safeTraverse 
} from "./utils.js";

// Config exports
export { CAMERA_HEIGHT, NAVMESH_SEARCH_BOX, SCREEN_MATERIAL_SETTINGS } from "./config.js";

