// GUI Controller Module using lil-gui
import GUI from 'lil-gui';

let gui = null;
let videoControllers = null;
let cameraController = null;
let colorControllers = {};
let loadImage, loadVideo, connectWebcam, disconnectWebcam, getCurrentVideo;
let touchMovement;
let fileInput = null;
let videoUpdateInterval = null;
let isCameraConnected = false;

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
};

export function initGUI(modules) {
  // Get functions from modules
  loadImage = modules.loadImage;
  loadVideo = modules.loadVideo;
  connectWebcam = modules.connectWebcam;
  disconnectWebcam = modules.disconnectWebcam;
  getCurrentVideo = modules.getCurrentVideo;
  touchMovement = modules.touchMovement;

  // Create GUI
  gui = new GUI({ title: 'Fulldome Visualiser', width: 280 });

  // Media controls at root
  gui.add(controls, 'upload').name('📁 Upload Image/Video');
  cameraController = gui.add(controls, 'camera').name('📷 Connect Camera');
  cameraController.onChange(() => {
    updateCameraButton();
  });

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

  // Help button at the bottom
  const controlsInfo = {
    help: () => {
      alert('Controls:\n\n' +
        'W - Move Forward\n' +
        'S - Move Backward\n' +
        'A - Move Left\n' +
        'D - Move Right\n' +
        'Q - Rotate Left\n' +
        'E - Rotate Right\n\n' +
        'Click and Drag - Rotate camera'
      );
    }
  };
  gui.add(controlsInfo, 'help').name('📖 Help');

  // Setup keyboard handlers for movement
  setupKeyboardHandlers();

  // Start video update loop
  startVideoUpdateLoop();
  
  // Setup color controls after model loads
  setupColorControls();
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
