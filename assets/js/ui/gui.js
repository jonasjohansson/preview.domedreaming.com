// GUI Controller Module using lil-gui
import GUI from 'lil-gui';
import { cameraSettings } from '../core/settings.js';

let gui = null;
let videoControllers = null;
let cameraController = null;
let colorControllers = {};
let loadImage, loadVideo, connectWebcam, disconnectWebcam, getCurrentVideo;
let touchMovement;
let fileInput = null;
let videoUpdateInterval = null;
let isCameraConnected = false;
let updateCameraFOV = null;

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
  camera: () => {
    if (isCameraConnected) {
      if (disconnectWebcam) {
        disconnectWebcam();
        isCameraConnected = false;
        updateCameraButton();
        hideVideoControls();
      }
    } else {
      if (connectWebcam) {
        connectWebcam().then(() => {
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
  
  // Video controls
  videoPlaying: false,
  videoTime: 0,
  videoLoop: true,
  videoVolume: 0,
  
  // Camera controls
  cameraFOV: 80,
};

export function initGUI(modules) {
  // Get functions from modules
  loadImage = modules.loadImage;
  loadVideo = modules.loadVideo;
  connectWebcam = modules.connectWebcam;
  disconnectWebcam = modules.disconnectWebcam;
  getCurrentVideo = modules.getCurrentVideo;
  touchMovement = modules.touchMovement;
  updateCameraFOV = modules.updateCameraFOV;

  // Initialize FOV from settings
  controls.cameraFOV = cameraSettings.fov || 80;

  // Create GUI
  gui = new GUI({ title: 'Fulldome Preview', width: 280 });

  // Media controls at root
  gui.add(controls, 'upload').name('📁 Upload Image/Video');
  cameraController = gui.add(controls, 'camera').name('📷 Connect Camera');
  cameraController.onChange(() => {
    updateCameraButton();
  });
  
  // Camera FOV slider
  gui.add(controls, 'cameraFOV', 30, 120, 1).name('📐 Camera FOV').onChange((fov) => {
    cameraSettings.fov = fov;
    if (updateCameraFOV) {
      updateCameraFOV(fov);
    }
  });
  
  // Help and Credits buttons
  gui.add({ showHelp: () => showHelpAlert() }, 'showHelp').name('❓ Help');
  gui.add({ showCredits: () => showCreditsAlert() }, 'showCredits').name('ℹ️ Credits');

  // Video controls at root (hidden by default)
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
  
  const timeController = gui.add(controls, 'videoTime', 0, 100).name('Time').step(0.1).listen();
  timeController.onChange((value) => {
    const video = getCurrentVideo ? getCurrentVideo() : null;
    if (video && video.duration) {
      video.currentTime = (value / 100) * video.duration;
    }
  });
  
  const loopController = gui.add(controls, 'videoLoop').name('Loop').onChange((loop) => {
    const video = getCurrentVideo ? getCurrentVideo() : null;
    if (video) {
      video.loop = loop;
    }
  });
  
  const volumeController = gui.add(controls, 'videoVolume', 0, 100).name('Volume').step(1).onChange((volume) => {
    const video = getCurrentVideo ? getCurrentVideo() : null;
    if (video) {
      video.volume = volume / 100;
      video.muted = volume === 0;
    }
  });
  
  // Store video controllers for show/hide
  videoControllers = {
    playPause: playController,
    time: timeController,
    loop: loopController,
    volume: volumeController,
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

// Show help alert
export function showHelpAlert() {
  const helpText = `How to use the Fulldome Preview:

Movement:
- WASD: Move camera (W=forward, S=backward, A=left, D=right)
- Q/E: Rotate camera left/right
- Click and drag: Look around

Media:
- Upload images or videos using the "Upload" button
- Connect your webcam using the "Connect Camera" button
- Use video controls to play, pause, scrub, loop, and adjust volume

Colors:
- Adjust colors of 3D objects using the color pickers

Keyboard shortcuts:
- U: Upload image/video
- C: Connect/disconnect camera`;

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
            
            // Add color controller
            const controller = gui.addColor(colorObj, 'color').name(item.name);
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
    
    // Update controllers
    videoControllers.loop.setValue(video.loop);
    videoControllers.volume.setValue(Math.round(video.volume * 100));
    videoControllers.playPause.setValue(!video.paused);
    
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
      }
    }
  }, 100);
}

function updateCameraButton() {
  if (cameraController) {
    cameraController.name(isCameraConnected ? '🔌 Disconnect Camera' : '📷 Connect Camera');
  }
}

// Make functions available globally for texture.js
window.setupVideoControls = setupVideoControls;
window.hideVideoControls = hideVideoControls;
