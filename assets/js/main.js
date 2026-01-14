// Import core 3D scene (needed immediately for canvas setup)
import {
  scene,
  camera,
  renderer,
  canvas,
  resetCamera,
  setupLighting,
  initPostProcessing,
  updatePostProcessing,
  setupCameraControls,
  euler,
  updateCameraFOV,
} from "./3d/index.js";

// 3D model and movement will be dynamically imported for code splitting
let loadModel, updateMovement, updateRotation, fbxMeshes, glbLights;
let getCurrentImageTexture, getCurrentVideoTexture, getCurrentVideo, connectWebcam;
let loadImage, loadVideo, disconnectWebcam, loadDefaultScreenTexture;
let updateScreenLighting, touchMovement;

import {
  loadSettings,
  currentCameraPosition,
  currentCameraRotation,
  startCameraPosition,
  startCameraRotation,
  cameraSettings,
} from "./core/settings.js";
import * as THREE from "three";

let animationFrameId = null;
let lastTime = 0;
let lastCameraSaveTime = 0;
const CAMERA_SAVE_INTERVAL = 2000;

// Function to dynamically load 3D modules (code splitting)
async function load3DModules() {
  if (loadModel && connectWebcam) {
    return; // Already loaded
  }

  try {
    const modelModule = await import("./3d/model.js");
    const movementModule = await import("./3d/movement.js");
    const textureModule = await import("./3d/texture.js");
    const screenLightingModule = await import("./3d/screen-lighting.js");

    // Assign to module-level variables
    loadModel = modelModule.loadModel;
    updateMovement = movementModule.updateMovement;
    updateRotation = movementModule.updateRotation;
    fbxMeshes = modelModule.fbxMeshes;
    glbLights = modelModule.glbLights;
    getCurrentImageTexture = textureModule.getCurrentImageTexture;
    getCurrentVideoTexture = textureModule.getCurrentVideoTexture;
    getCurrentVideo = textureModule.getCurrentVideo;
    connectWebcam = textureModule.connectWebcam;
    loadImage = textureModule.loadImage;
    loadVideo = textureModule.loadVideo;
    disconnectWebcam = textureModule.disconnectWebcam;
    loadDefaultScreenTexture = textureModule.loadDefaultScreenTexture;
    updateScreenLighting = screenLightingModule.updateScreenLighting;
    touchMovement = movementModule.touchMovement;

    // Make available globally for other modules
    window.loadModel = loadModel;
    window.connectWebcam = connectWebcam;
    window.loadImage = loadImage;
    window.loadVideo = loadVideo;
    window.disconnectWebcam = disconnectWebcam;
    window.loadDefaultScreenTexture = loadDefaultScreenTexture;
  } catch (error) {
    console.error("Error loading 3D modules:", error);
  }
}

async function init() {
  // Load settings
  await loadSettings();

  // Update camera FOV from settings
  updateCameraFOV(cameraSettings.fov || 80);

  // Setup 3D scene
  setupLighting();
  initPostProcessing();
  setupCameraControls();

  // Setup event listeners
  setupEventListeners();

  // Load 3D modules and start rendering
  await load3DModules();
  if (loadModel) {
    loadModel();
    startRenderLoop();
  }

  // Initialize GUI after modules are loaded
  try {
    const { initGUI } = await import("./ui/gui.js");
    initGUI({
      loadImage,
      loadVideo,
      connectWebcam: async () => {
        if (connectWebcam) {
          await connectWebcam();
        }
      },
      disconnectWebcam,
      getCurrentVideo,
      touchMovement,
      updateCameraFOV,
    });
  } catch (error) {
    console.error("Error initializing GUI:", error);
  }
}

function setupEventListeners() {
  // Prevent scrolling/swiping on mobile, but allow interactions with GUI and inputs
  document.addEventListener("touchmove", (e) => {
    // Allow touch events on interactive elements (GUI, inputs, buttons)
    const target = e.target;
    if (target.tagName === 'INPUT' || 
        target.tagName === 'BUTTON' || 
        target.tagName === 'SELECT' ||
        target.closest('.lil-gui') ||
        target === canvas || 
        canvas.contains(target)) {
      return;
    }
    // Prevent scrolling elsewhere
    e.preventDefault();
  }, { passive: false });
  
  // Create file input for uploads
  let fileInput = null;
  function getFileInput() {
    if (!fileInput) {
      fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*,video/*";
      fileInput.style.display = "none";
      document.body.appendChild(fileInput);

      fileInput.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (file) {
          if (!loadImage || !loadVideo) {
            await load3DModules();
          }
          if (file.type.startsWith("image/")) {
            loadImage(file);
          } else if (file.type.startsWith("video/")) {
            loadVideo(file);
          }
        }
        fileInput.value = "";
      });
    }
    return fileInput;
  }

  // Setup drag and drop
  load3DModules().then(async () => {
    const textureModule = await import("./3d/texture.js");
    textureModule.setupDragAndDrop();
  });

  // Handle resize
  const handleResize = () => {
  };
  window.addEventListener("resize", handleResize);

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", handleResize);
  }

  window.addEventListener("orientationchange", () => {
    setTimeout(handleResize, 100);
  });

  // Setup keyboard shortcuts for file upload
  window.addEventListener("keydown", async (e) => {
    if (e.key === "u" || e.key === "U") {
      e.preventDefault();
      getFileInput().click();
    } else if (e.key === "c" || e.key === "C") {
      e.preventDefault();
      if (!connectWebcam) {
        await load3DModules();
      }
      if (confirm("Do you want to connect your webcam to the screen?")) {
        connectWebcam();
      }
    }
  });
}

function animate(currentTime) {
  animationFrameId = requestAnimationFrame(animate);

  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  // Only update if 3D modules are loaded
  if (updateMovement && updateRotation) {
    updateMovement(deltaTime);
    updateRotation(deltaTime);
  }

  currentCameraPosition.x = camera.position.x;
  currentCameraPosition.y = camera.position.y;
  currentCameraPosition.z = camera.position.z;
  currentCameraRotation.x = camera.rotation.x;
  currentCameraRotation.y = camera.rotation.y;
  currentCameraRotation.z = camera.rotation.z;

  // Update camera position tracking (no persistence)
  const timeSinceLastSave = currentTime - lastCameraSaveTime;
  if (timeSinceLastSave >= CAMERA_SAVE_INTERVAL) {
    Object.assign(startCameraPosition, currentCameraPosition);
    Object.assign(startCameraRotation, currentCameraRotation);
    lastCameraSaveTime = currentTime;
  }

  if (updateScreenLighting) {
    updateScreenLighting(currentTime);
  }

  updatePostProcessing();
}


function startRenderLoop() {
  lastTime = performance.now();
  animate(lastTime);
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
