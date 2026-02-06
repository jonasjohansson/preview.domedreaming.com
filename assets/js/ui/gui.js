// GUI Controller Module using lil-gui
import GUI from 'lil-gui';
import { cameraSettings } from '../core/settings.js';
import * as settings from '../core/settings.js';

let gui = null;
let videoControllers = null;
let cameraController = null;
let flyModeController = null;
let colorControllers = {};
let loadImage, loadVideo, loadVideoFromURL, connectWebcam, disconnectWebcam, getCurrentVideo;
let getCurrentVideoFilename, getCurrentVideoTexture, getScreenObject, applyProjectionMode, setTextureColorSpace, getVideoDevices;
let touchMovement;
let fileInput = null;
let videoUpdateInterval = null;
let isCameraConnected = false;
let updateCameraFOV = null;
let videoDevices = [];
let selectedDeviceId = null;
let cameraSelectController = null;

// Store current projection settings for reset
let currentProjectionMode = 'dome';
let defaultTransformValues = {
  panX: 0,
  panY: 0,
  tilt: 0,
  roll: 0,
  scale: 1
};

// Control objects
const controls = {
  // Media controls
  upload: () => {
    if (!fileInput) {
      fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*,video/*";
      fileInput.style.display = "none";
      document.body.appendChild(fileInput);

      fileInput.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) {
          if (file.type.startsWith("image/")) {
            loadImage(file);
            hideVideoControls();
          } else if (file.type.startsWith("video/")) {
            loadVideo(file);
            setTimeout(() => {
              setupVideoControls();
            }, 500);
          }
        }
        fileInput.value = "";
      });
    }
    fileInput.click();
  },
  camera: async () => {
    if (isCameraConnected) {
      if (disconnectWebcam) {
        disconnectWebcam();
        isCameraConnected = false;
        updateCameraButton();
        hideCameraDropdown();
        hideVideoControls();
      }
    } else {
      if (connectWebcam) {
        // Request permissions and populate camera list on first connect
        await refreshCameraList();
        showCameraDropdown();
        connectWebcam(selectedDeviceId).then(() => {
          isCameraConnected = true;
          updateCameraButton();
          hideVideoControls();
        }).catch(() => {
          isCameraConnected = false;
          updateCameraButton();
        });
      }
    }
  },
  cameraDevice: 'default',
  loadURL: () => {
    showURLInputModal();
  },

  // Video controls
  videoPlaying: false,
  videoTime: 0,
  videoLoop: true,
  videoVolume: 0,
  videoTitle: '',

  // Time display
  timeDisplayMode: 'percentage',
  timeDisplay: '0%',
  frameRate: 24,

  // Projection and transform controls
  projectionMode: 'dome',
  colorSpace: 'sRGB',
  panX: 0,
  panY: 0,
  tilt: 0,
  roll: 0,
  scale: 1,
  resetTransform: () => {
    controls.panX = 0;
    controls.panY = 0;
    controls.tilt = 0;
    controls.roll = 0;
    controls.scale = 1;
    applyTransformToTexture();
    // Update GUI displays
    if (videoControllers) {
      if (videoControllers.panX) videoControllers.panX.updateDisplay();
      if (videoControllers.panY) videoControllers.panY.updateDisplay();
      if (videoControllers.tilt) videoControllers.tilt.updateDisplay();
      if (videoControllers.roll) videoControllers.roll.updateDisplay();
      if (videoControllers.scale) videoControllers.scale.updateDisplay();
    }
  },

  // Camera controls
  cameraFOV: 80,
  flyMode: false,
};

export function initGUI(modules) {
  // Get functions from modules
  loadImage = modules.loadImage;
  loadVideo = modules.loadVideo;
  loadVideoFromURL = modules.loadVideoFromURL;
  connectWebcam = modules.connectWebcam;
  disconnectWebcam = modules.disconnectWebcam;
  getCurrentVideo = modules.getCurrentVideo;
  getCurrentVideoFilename = modules.getCurrentVideoFilename;
  getCurrentVideoTexture = modules.getCurrentVideoTexture;
  getScreenObject = modules.getScreenObject;
  applyProjectionMode = modules.applyProjectionMode;
  setTextureColorSpace = modules.setTextureColorSpace;
  getVideoDevices = modules.getVideoDevices;
  touchMovement = modules.touchMovement;
  updateCameraFOV = modules.updateCameraFOV;

  // Initialize FOV from settings
  controls.cameraFOV = cameraSettings.fov || 80;
  controls.flyMode = settings.flyMode;

  // Create GUI
  gui = new GUI({ title: 'Fulldome Preview', width: 280 });

  // Help and Credits at the top
  gui.add({ showHelp: () => showHelpAlert() }, 'showHelp').name('❓ Help');
  gui.add({ showCredits: () => showCreditsAlert() }, 'showCredits').name('ℹ️ Credits');

  // Media controls at root
  gui.add(controls, 'upload').name('📁 Upload Image/Video');
  gui.add(controls, 'loadURL').name('🔗 Load from URL');

  // Connect Virtual Camera button
  cameraController = gui.add(controls, 'camera').name('📷 Connect Virtual Camera');
  cameraController.onChange(() => {
    updateCameraButton();
  });

  // Virtual Camera device selection dropdown (hidden until camera is connected)
  cameraSelectController = gui.add(controls, 'cameraDevice', { 'Default Camera': 'default' }).name('📹 Virtual Camera').onChange((value) => {
    selectedDeviceId = value === 'default' ? null : value;
    // If already connected, reconnect with new device
    if (isCameraConnected && connectWebcam && disconnectWebcam) {
      disconnectWebcam();
      connectWebcam(selectedDeviceId).then(() => {
        isCameraConnected = true;
        updateCameraButton();
      }).catch(() => {
        isCameraConnected = false;
        updateCameraButton();
      });
    }
  });

  // Hide camera dropdown until user connects
  cameraSelectController.hide();

  // Camera FOV slider
  gui.add(controls, 'cameraFOV', 30, 120, 1).name('📐 Camera FOV').onChange((fov) => {
    cameraSettings.fov = fov;
    if (updateCameraFOV) {
      updateCameraFOV(fov);
    }
  });

  // Fly mode checkbox
  flyModeController = gui.add(controls, 'flyMode').name('✈️ Fly Mode (F)').onChange((value) => {
    settings.setFlyMode(value);
  });

  // Listen for F key toggle from camera.js
  window.onFlyModeChange = (newValue) => {
    controls.flyMode = newValue;
    if (flyModeController) {
      flyModeController.updateDisplay();
    }
  };


  // Video controls at root (hidden by default)
  // 1. File title (readonly)
  const titleController = gui.add(controls, 'videoTitle').name('📄 File').listen();
  titleController.domElement.style.pointerEvents = 'none';
  titleController.domElement.querySelector('input').readOnly = true;

  // 2. Play/Pause
  const playController = gui.add(controls, 'videoPlaying').name('⏸️ Play/Pause').listen();
  playController.onChange((playing) => {
    const video = getCurrentVideo ? getCurrentVideo() : null;
    if (video) {
      if (playing) {
        video.play();
      } else {
        video.pause();
      }
    }
  });

  // 3. Time scrubber
  const timeController = gui.add(controls, 'videoTime', 0, 100).name('Time').step(0.1).listen();
  timeController.onChange((value) => {
    const video = getCurrentVideo ? getCurrentVideo() : null;
    if (video && video.duration) {
      video.currentTime = (value / 100) * video.duration;
    }
  });

  // 4. Time Display Mode dropdown
  const timeDisplayModeController = gui.add(controls, 'timeDisplayMode', ['percentage', 'seconds', 'frames']).name('Time Format');

  // 5. Time Display (readonly)
  const timeDisplayController = gui.add(controls, 'timeDisplay').name('Position').listen();
  timeDisplayController.domElement.style.pointerEvents = 'none';
  timeDisplayController.domElement.querySelector('input').readOnly = true;

  // 6. Frame Rate (for frames mode)
  const frameRateController = gui.add(controls, 'frameRate', [24, 25, 30, 60]).name('Frame Rate');

  // 7. Loop
  const loopController = gui.add(controls, 'videoLoop').name('Loop').onChange((loop) => {
    const video = getCurrentVideo ? getCurrentVideo() : null;
    if (video) {
      video.loop = loop;
    }
  });

  // 8. Volume
  const volumeController = gui.add(controls, 'videoVolume', 0, 100).name('Volume').step(1).onChange((volume) => {
    const video = getCurrentVideo ? getCurrentVideo() : null;
    if (video) {
      video.volume = volume / 100;
      video.muted = volume === 0;
    }
  });

  // 9. Projection dropdown
  const projectionController = gui.add(controls, 'projectionMode', ['dome', 'equirectangular', '16:9', 'square']).name('Projection').onChange(() => {
    applyTransformToTexture();
  });

  // 9b. Color Space dropdown (for PNG sequences that need linear color)
  const colorSpaceController = gui.add(controls, 'colorSpace', ['sRGB', 'linear']).name('Color Space').onChange((value) => {
    const texture = getCurrentVideoTexture ? getCurrentVideoTexture() : null;
    if (texture && setTextureColorSpace) {
      setTextureColorSpace(texture, value);
    }
  });

  // 10. Pan/Tilt/Roll sliders
  const panXController = gui.add(controls, 'panX', -1, 1).name('Pan X').step(0.01).onChange(() => {
    applyTransformToTexture();
  });

  const panYController = gui.add(controls, 'panY', -1, 1).name('Pan Y').step(0.01).onChange(() => {
    applyTransformToTexture();
  });

  const tiltController = gui.add(controls, 'tilt', -Math.PI, Math.PI).name('Tilt').step(0.01).onChange(() => {
    applyTransformToTexture();
  });

  const rollController = gui.add(controls, 'roll', -Math.PI, Math.PI).name('Roll').step(0.01).onChange(() => {
    applyTransformToTexture();
  });

  // 11. Scale slider
  const scaleController = gui.add(controls, 'scale', 0.5, 2.0).name('Scale').step(0.01).onChange(() => {
    applyTransformToTexture();
  });

  // 12. Reset Transform button
  const resetController = gui.add(controls, 'resetTransform').name('↺ Reset Transform');

  // Store video controllers for show/hide
  videoControllers = {
    title: titleController,
    playPause: playController,
    time: timeController,
    timeDisplayMode: timeDisplayModeController,
    timeDisplay: timeDisplayController,
    frameRate: frameRateController,
    loop: loopController,
    volume: volumeController,
    projection: projectionController,
    colorSpace: colorSpaceController,
    panX: panXController,
    panY: panYController,
    tilt: tiltController,
    roll: rollController,
    scale: scaleController,
    reset: resetController,
  };

  // Hide video controls initially
  Object.values(videoControllers).forEach(controller => controller.hide());


  // Setup keyboard handlers for movement
  setupKeyboardHandlers();

  // Start video update loop
  startVideoUpdateLoop();

  // Setup color controls after model loads
  setupColorControls();

}

// Custom modal function for displaying HTML content with links
function showCustomModal(title, htmlContent) {
  // Remove existing modal if any
  const existingModal = document.getElementById('custom-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // Create modal overlay
  const modal = document.createElement('div');
  modal.id = 'custom-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  `;

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background-color: #1a1a1a;
    color: #ffffff;
    padding: 24px;
    border-radius: 8px;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  `;

  // Create title
  const titleEl = document.createElement('h2');
  titleEl.textContent = title;
  titleEl.style.cssText = `
    margin: 0 0 16px 0;
    font-size: 20px;
    font-weight: 600;
  `;

  // Create content
  const contentEl = document.createElement('div');
  contentEl.innerHTML = htmlContent;
  contentEl.style.cssText = `
    font-size: 14px;
    line-height: 1.6;
  `;

  // Style links
  const style = document.createElement('style');
  style.textContent = `
    #custom-modal a {
      color: #4a9eff;
      text-decoration: none;
    }
    #custom-modal a:hover {
      text-decoration: underline;
    }
  `;
  document.head.appendChild(style);

  // Create close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = `
    margin-top: 20px;
    padding: 8px 16px;
    background-color: #4a9eff;
    color: #ffffff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
  `;
  closeBtn.onmouseover = () => {
    closeBtn.style.backgroundColor = '#5aaeff';
  };
  closeBtn.onmouseout = () => {
    closeBtn.style.backgroundColor = '#4a9eff';
  };
  closeBtn.onclick = () => {
    modal.remove();
    style.remove();
  };

  // Assemble modal
  modalContent.appendChild(titleEl);
  modalContent.appendChild(contentEl);
  modalContent.appendChild(closeBtn);
  modal.appendChild(modalContent);

  // Close on overlay click
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.remove();
      style.remove();
    }
  };

  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      style.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);

  document.body.appendChild(modal);
}

// Show URL input modal for loading video from URL
function showURLInputModal() {
  // Remove existing modal if any
  const existingModal = document.getElementById('url-input-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // Create modal overlay
  const modal = document.createElement('div');
  modal.id = 'url-input-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  `;

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background-color: #1a1a1a;
    color: #ffffff;
    padding: 24px;
    border-radius: 8px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  `;

  // Create title
  const titleEl = document.createElement('h2');
  titleEl.textContent = 'Load Video from URL';
  titleEl.style.cssText = `
    margin: 0 0 16px 0;
    font-size: 20px;
    font-weight: 600;
  `;

  // Create description
  const descEl = document.createElement('p');
  descEl.innerHTML = `Enter a direct URL to a video file or stream:<br>
    • Video files: .mp4, .webm<br>
    • HLS streams: .m3u8 (VLC, OBS, IP cameras)<br><br>
    <small style="color: #888;">Note: YouTube/Vimeo page URLs won't work. Use direct video URLs or HLS stream URLs.</small>`;
  descEl.style.cssText = `
    font-size: 14px;
    line-height: 1.6;
    margin-bottom: 16px;
  `;

  // Create input
  const input = document.createElement('input');
  input.type = 'url';
  input.placeholder = 'https://example.com/video.mp4';
  input.style.cssText = `
    width: 100%;
    padding: 10px;
    font-size: 14px;
    border: 1px solid #444;
    border-radius: 4px;
    background-color: #2a2a2a;
    color: #fff;
    box-sizing: border-box;
    margin-bottom: 16px;
  `;

  // Create error message element (hidden by default)
  const errorEl = document.createElement('p');
  errorEl.style.cssText = `
    color: #ff6b6b;
    font-size: 13px;
    margin: 0 0 16px 0;
    display: none;
  `;

  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  `;

  // Create cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `
    padding: 8px 16px;
    background-color: #444;
    color: #ffffff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
  `;
  cancelBtn.onmouseover = () => { cancelBtn.style.backgroundColor = '#555'; };
  cancelBtn.onmouseout = () => { cancelBtn.style.backgroundColor = '#444'; };

  // Create load button
  const loadBtn = document.createElement('button');
  loadBtn.textContent = 'Load Video';
  loadBtn.style.cssText = `
    padding: 8px 16px;
    background-color: #4a9eff;
    color: #ffffff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
  `;
  loadBtn.onmouseover = () => { loadBtn.style.backgroundColor = '#5aaeff'; };
  loadBtn.onmouseout = () => { loadBtn.style.backgroundColor = '#4a9eff'; };

  const closeModal = () => {
    modal.remove();
  };

  const handleLoad = async () => {
    const url = input.value.trim();
    if (!url) {
      errorEl.textContent = 'Please enter a URL';
      errorEl.style.display = 'block';
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      errorEl.textContent = 'Please enter a valid URL';
      errorEl.style.display = 'block';
      return;
    }

    // Show loading state
    loadBtn.textContent = 'Loading...';
    loadBtn.disabled = true;
    errorEl.style.display = 'none';

    try {
      if (loadVideoFromURL) {
        await loadVideoFromURL(url);
        closeModal();
      } else {
        throw new Error('Video loading not available');
      }
    } catch (error) {
      errorEl.textContent = error.message || 'Failed to load video';
      errorEl.style.display = 'block';
      loadBtn.textContent = 'Load Video';
      loadBtn.disabled = false;
    }
  };

  cancelBtn.onclick = closeModal;
  loadBtn.onclick = handleLoad;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleLoad();
    }
  });

  // Close on overlay click
  modal.onclick = (e) => {
    if (e.target === modal) {
      closeModal();
    }
  };

  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);

  // Assemble modal
  buttonContainer.appendChild(cancelBtn);
  buttonContainer.appendChild(loadBtn);
  modalContent.appendChild(titleEl);
  modalContent.appendChild(descEl);
  modalContent.appendChild(input);
  modalContent.appendChild(errorEl);
  modalContent.appendChild(buttonContainer);
  modal.appendChild(modalContent);

  document.body.appendChild(modal);

  // Focus the input
  setTimeout(() => input.focus(), 100);
}

// Show help alert
export function showHelpAlert() {
  const helpText = `How to use the Fulldome Preview:

Movement:
- WASD: Move camera (W=forward, S=backward, A=left, D=right)
- Q/E: Rotate camera left/right
- F: Toggle Fly Mode (free movement without navmesh)
- Space: Move up (in Fly Mode)
- Shift: Move down (in Fly Mode)
- Click and drag: Look around

Media:
- Upload images or videos using the "Upload" button
- Load videos from URL using the "Load from URL" button
- Connect a virtual camera using the "Connect Virtual Camera" button
- Select camera source from the "Virtual Camera" dropdown

Video Controls:
- Play, pause, scrub, loop, and adjust volume
- Choose time display format (percentage, seconds, or frames)
- Change projection mode (dome, equirectangular, 16:9, square)
- Adjust Pan X/Y, Tilt, Roll, and Scale
- Reset Transform to restore defaults

Colors:
- Adjust colors of 3D objects using the color pickers

Other fulldome tools:
- Domeport: https://domeport.sat.qc.ca/
- Wizdome Visualiser: https://lab.possan.codes/wizdome/vis/4/index.html`;

  alert(helpText);
}

// Show credits alert
export function showCreditsAlert() {
  const creditsText = `Credits:

3D model by Ashley Reed
https://smash.studio/
(Modelled after the dome at Tekniska museet, Stockholm)

Original dome preview by Per-Olov Jernberg
https://possan.se/

Design and development by Jonas Johansson
https://jonasjohansson.se

Background by Paul Bourke
https://paulbourke.net/`;

  alert(creditsText);
}

async function setupColorControls() {
  // Wait for model to load
  const checkModel = async () => {
    try {
      const modelModule = await import("../3d/model.js");
      if (modelModule.fbxMeshes && modelModule.fbxMeshes.length > 0) {
        const { getMaterial, colorToHex } = await import("../3d/utils.js");

        // Initialize savedColorSettings if needed
        if (!window.savedColorSettings) {
          window.savedColorSettings = {};
        }

        // Create a folder for color controls
        const colorFolder = gui.addFolder('Colors');
        colorFolder.close(); // Start collapsed

        // Create color controls for each mesh
        modelModule.fbxMeshes.forEach((item) => {
          const material = getMaterial(item.mesh);
          if (material && material.color) {
            // Get current color (from saved settings or material)
            let currentColor;
            if (window.savedColorSettings[item.name]) {
              const saved = window.savedColorSettings[item.name];
              currentColor = `#${Math.floor(saved.r * 255).toString(16).padStart(2, "0")}${Math.floor(saved.g * 255).toString(16).padStart(2, "0")}${Math.floor(saved.b * 255).toString(16).padStart(2, "0")}`;
            } else {
              currentColor = colorToHex(material.color);
            }

            // Create color object for this mesh
            const colorObj = { color: currentColor };

            // Add color controller to the folder
            const controller = colorFolder.addColor(colorObj, 'color').name(item.name);
            controller.onChange((value) => {
              // Convert hex to RGB (0-1)
              const hex = value.replace('#', '');
              const r = parseInt(hex.substring(0, 2), 16) / 255;
              const g = parseInt(hex.substring(2, 4), 16) / 255;
              const b = parseInt(hex.substring(4, 6), 16) / 255;

              // Update material
              material.color.setRGB(r, g, b);
              material.needsUpdate = true;

              // Save to settings
              window.savedColorSettings[item.name] = { r, g, b };

              // Colors are updated in memory only (no persistence)
            });

            colorControllers[item.name] = controller;
          }
        });
      } else {
        // Model not loaded yet, try again
        setTimeout(checkModel, 500);
      }
    } catch (error) {
      console.warn("Error setting up color controls:", error);
    }
  };
  
  checkModel();
}

function setupKeyboardHandlers() {
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (touchMovement) {
      setMovementKey(key, true);
    }
  });

  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (touchMovement) {
      setMovementKey(key, false);
    }
  });
}

function setMovementKey(key, active) {
  if (!touchMovement) return;

  const keyLower = key.toLowerCase();
  switch (keyLower) {
    case "w":
      touchMovement.forward = active;
      break;
    case "s":
      touchMovement.backward = active;
      break;
    case "a":
      touchMovement.left = active;
      break;
    case "d":
      touchMovement.right = active;
      break;
    case "q":
      touchMovement.rotateLeft = active;
      break;
    case "e":
      touchMovement.rotateRight = active;
      break;
    case " ":
      touchMovement.up = active;
      break;
    case "shift":
      touchMovement.down = active;
      break;
  }
}


function setupVideoControls() {
  const video = getCurrentVideo ? getCurrentVideo() : null;

  if (video && videoControllers) {
    // Show video controls
    Object.values(videoControllers).forEach(controller => controller.show());

    // Setup initial values
    controls.videoLoop = video.loop;
    controls.videoVolume = Math.round(video.volume * 100);
    controls.videoPlaying = !video.paused;

    // Set video title
    const filename = getCurrentVideoFilename ? getCurrentVideoFilename() : '';
    controls.videoTitle = filename;
    if (videoControllers.title) {
      videoControllers.title.updateDisplay();
    }

    // Reset transform values
    controls.panX = 0;
    controls.panY = 0;
    controls.tilt = 0;
    controls.roll = 0;
    controls.scale = 1;
    controls.projectionMode = 'dome';
    controls.colorSpace = 'sRGB';

    // Update controllers
    videoControllers.loop.setValue(video.loop);
    videoControllers.volume.setValue(Math.round(video.volume * 100));
    videoControllers.playPause.setValue(!video.paused);
    if (videoControllers.projection) videoControllers.projection.setValue('dome');
    if (videoControllers.colorSpace) videoControllers.colorSpace.setValue('sRGB');
    if (videoControllers.panX) videoControllers.panX.updateDisplay();
    if (videoControllers.panY) videoControllers.panY.updateDisplay();
    if (videoControllers.tilt) videoControllers.tilt.updateDisplay();
    if (videoControllers.roll) videoControllers.roll.updateDisplay();
    if (videoControllers.scale) videoControllers.scale.updateDisplay();

    // Listen for video events
    const playHandler = () => {
      controls.videoPlaying = true;
      videoControllers.playPause.updateDisplay();
    };

    const pauseHandler = () => {
      controls.videoPlaying = false;
      videoControllers.playPause.updateDisplay();
    };

    video.addEventListener("play", playHandler);
    video.addEventListener("pause", pauseHandler);
    video.addEventListener("ended", pauseHandler);
  }
}

function hideVideoControls() {
  if (videoControllers) {
    Object.values(videoControllers).forEach(controller => controller.hide());
  }
}

function startVideoUpdateLoop() {
  if (videoUpdateInterval) {
    clearInterval(videoUpdateInterval);
  }

  videoUpdateInterval = setInterval(() => {
    const video = getCurrentVideo ? getCurrentVideo() : null;
    if (video && videoControllers && !videoControllers.time._hidden) {
      if (video.duration) {
        controls.videoTime = (video.currentTime / video.duration) * 100;
        videoControllers.time.updateDisplay();

        // Update time display based on mode
        const mode = controls.timeDisplayMode;
        const currentTime = video.currentTime;
        const duration = video.duration;

        if (mode === 'percentage') {
          controls.timeDisplay = Math.round((currentTime / duration) * 100) + '%';
        } else if (mode === 'seconds') {
          controls.timeDisplay = currentTime.toFixed(1) + 's / ' + duration.toFixed(1) + 's';
        } else if (mode === 'frames') {
          const fps = controls.frameRate;
          const currentFrame = Math.floor(currentTime * fps);
          const totalFrames = Math.floor(duration * fps);
          controls.timeDisplay = currentFrame + ' / ' + totalFrames;
        }

        if (videoControllers.timeDisplay) {
          videoControllers.timeDisplay.updateDisplay();
        }
      }
    }
  }, 100);
}

function updateCameraButton() {
  if (cameraController) {
    cameraController.name(isCameraConnected ? '🔌 Disconnect Virtual Camera' : '📷 Connect Virtual Camera');
  }
}

function showCameraDropdown() {
  if (cameraSelectController) {
    cameraSelectController.show();
  }
}

function hideCameraDropdown() {
  if (cameraSelectController) {
    cameraSelectController.hide();
  }
}

// Refresh camera device list
async function refreshCameraList() {
  if (!getVideoDevices || !cameraSelectController) return;

  try {
    videoDevices = await getVideoDevices();

    // Build options object
    const options = { 'Default Camera': 'default' };
    videoDevices.forEach(device => {
      options[device.label] = device.deviceId;
    });

    // Update the dropdown options in place (preserves position)
    const currentValue = controls.cameraDevice;
    cameraSelectController.options(options);

    // Restore selected value if still valid
    if (currentValue && (currentValue === 'default' || videoDevices.some(d => d.deviceId === currentValue))) {
      controls.cameraDevice = currentValue;
      cameraSelectController.updateDisplay();
    }
  } catch (error) {
    console.warn("Error refreshing camera list:", error);
  }
}

// Apply current transform values to texture
function applyTransformToTexture() {
  const texture = getCurrentVideoTexture ? getCurrentVideoTexture() : null;
  if (!texture) return;

  // Apply projection mode base values
  if (applyProjectionMode) {
    applyProjectionMode(texture, controls.projectionMode, controls.scale);
  }

  // Apply pan offset on top of projection offset
  texture.offset.x += controls.panX;
  texture.offset.y += controls.panY;

  // Apply tilt (texture rotation)
  texture.rotation = controls.tilt;

  // Apply roll to screen object if available
  const screen = getScreenObject ? getScreenObject() : null;
  if (screen) {
    screen.rotation.z = controls.roll;
  }

  texture.needsUpdate = true;
}

// Make functions available globally for texture.js
window.setupVideoControls = setupVideoControls;
window.hideVideoControls = hideVideoControls;
