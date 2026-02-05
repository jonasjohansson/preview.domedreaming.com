import * as THREE from "three";
import { configureTexture, applyTextureToScreen, getMaterial, setTextureColorSpace } from "./utils.js";
import { SCREEN_MATERIAL_SETTINGS } from "./config.js";
import { screenSettings } from "../core/settings.js";

// Re-export setTextureColorSpace for GUI access
export { setTextureColorSpace };

let screenObject = null;
let currentVideoTexture = null;
let currentVideo = null;
let currentImageTexture = null;
let currentWebcamStream = null;
let currentVideoFilename = '';

export function getCurrentVideoFilename() {
  return currentVideoFilename;
}

export function setScreenObject(obj) {
  screenObject = obj;
}

export function getScreenObject() {
  return screenObject;
}

export function getCurrentVideoTexture() {
  return currentVideoTexture;
}

export function getCurrentVideo() {
  return currentVideo;
}

export function getCurrentImageTexture() {
  return currentImageTexture;
}

export function loadDefaultScreenTexture(imagePath = screenSettings.defaultImage || "assets/media/background.png") {
  if (!screenObject) {
    return Promise.resolve();
  }

  // Dispose of previous texture to prevent memory leaks
  if (currentImageTexture) {
    currentImageTexture.dispose();
    currentImageTexture = null;
  }

  return new Promise((resolve, reject) => {
    const textureLoader = new THREE.TextureLoader();
    // Add cache-busting query parameter to force reload of updated images
    const cacheBustUrl = imagePath + (imagePath.includes('?') ? '&' : '?') + '_t=' + Date.now();
    
    textureLoader.load(
      cacheBustUrl,
      (texture) => {
        configureTexture(texture);
        texture.rotation = 0;
        applyTextureToScreen(texture, screenObject);
        currentImageTexture = texture;
        resolve(texture);
      },
      undefined,
      (error) => {
        console.warn("Error loading default texture:", error);
        reject(error);
      }
    );
  });
}

export function loadImage(file) {
  if (!screenObject) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      e.target.result,
      (texture) => {
        if (currentVideoTexture) {
          currentVideoTexture.dispose();
          currentVideoTexture = null;
        }
        if (currentVideo) {
          currentVideo.pause();
          currentVideo.src = "";
          URL.revokeObjectURL(currentVideo.src);
          currentVideo = null;
        }
        if (currentImageTexture) {
          currentImageTexture.dispose();
        }

        configureTexture(texture);
        texture.rotation = 0;
        applyTextureToScreen(texture, screenObject);
        currentImageTexture = texture;

        const material = getMaterial(screenObject);
        if (material) {
          setTimeout(() => {
            Object.assign(material, SCREEN_MATERIAL_SETTINGS);
            material.needsUpdate = true;
          }, 200);
        }
      },
      undefined,
      () => {}
    );
  };
  reader.readAsDataURL(file);
}

export function loadVideo(file) {
  if (!screenObject) return;

  // Track filename
  currentVideoFilename = file.name;

  const video = document.createElement("video");
  video.src = URL.createObjectURL(file);
  video.crossOrigin = "anonymous";
  video.loop = true;
  video.muted = false; // Allow volume control
  video.volume = 0; // Start at 0, user can adjust
  video.playsInline = true;

  video.addEventListener("loadedmetadata", () => {
    // Trigger video controls update
    if (window.setupVideoControls) {
      setTimeout(() => window.setupVideoControls(), 100);
    }
    video.play();

    if (currentVideoTexture) currentVideoTexture.dispose();
    if (currentVideo) {
      currentVideo.pause();
      currentVideo.src = "";
      URL.revokeObjectURL(currentVideo.src);
    }
    if (currentImageTexture) {
      currentImageTexture.dispose();
      currentImageTexture = null;
    }

    const videoTexture = new THREE.VideoTexture(video);
    configureTexture(videoTexture);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.rotation = 0;

    applyTextureToScreen(videoTexture, screenObject);
    currentVideoTexture = videoTexture;
    currentVideo = video;

    const material = getMaterial(screenObject);
    if (material) {
      setTimeout(() => {
        Object.assign(material, SCREEN_MATERIAL_SETTINGS);
        material.needsUpdate = true;
      }, 200);
    }
  });

  video.addEventListener("error", () => {});
}

// Check if URL is an HLS stream
function isHLSUrl(url) {
  return url.includes('.m3u8');
}

// Check if browser natively supports HLS (Safari)
function supportsNativeHLS() {
  const video = document.createElement('video');
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
}

// Store current HLS instance for cleanup
let currentHls = null;

export async function loadVideoFromURL(url) {
  if (!screenObject) return Promise.reject(new Error("Screen object not available"));

  // Extract filename from URL
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    currentVideoFilename = pathname.split('/').pop() || url;
  } catch {
    currentVideoFilename = url;
  }

  // Cleanup previous HLS instance
  if (currentHls) {
    currentHls.destroy();
    currentHls = null;
  }

  return new Promise(async (resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = false;
    video.volume = 0;
    video.playsInline = true;

    const onVideoReady = () => {
      if (window.setupVideoControls) {
        setTimeout(() => window.setupVideoControls(), 100);
      }
      video.play();

      if (currentVideoTexture) currentVideoTexture.dispose();
      if (currentVideo) {
        currentVideo.pause();
        currentVideo.src = "";
      }
      if (currentImageTexture) {
        currentImageTexture.dispose();
        currentImageTexture = null;
      }
      if (currentWebcamStream) {
        currentWebcamStream.getTracks().forEach((track) => track.stop());
        currentWebcamStream = null;
      }

      const videoTexture = new THREE.VideoTexture(video);
      configureTexture(videoTexture);
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;
      videoTexture.rotation = 0;

      applyTextureToScreen(videoTexture, screenObject);
      currentVideoTexture = videoTexture;
      currentVideo = video;

      const material = getMaterial(screenObject);
      if (material) {
        setTimeout(() => {
          Object.assign(material, SCREEN_MATERIAL_SETTINGS);
          material.needsUpdate = true;
        }, 200);
      }

      resolve(video);
    };

    // Handle HLS streams
    if (isHLSUrl(url)) {
      if (supportsNativeHLS()) {
        // Safari supports HLS natively
        video.addEventListener("loadedmetadata", onVideoReady, { once: true });
        video.addEventListener("error", (e) => {
          console.error("Error loading HLS stream:", e);
          reject(new Error("Failed to load HLS stream."));
        });
        video.src = url;
      } else {
        // Use hls.js for Chrome/Firefox
        try {
          const Hls = (await import('hls.js')).default;

          if (!Hls.isSupported()) {
            reject(new Error("HLS is not supported in this browser."));
            return;
          }

          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
          });

          currentHls = hls;

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            onVideoReady();
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              console.error("HLS fatal error:", data);
              reject(new Error(`HLS stream error: ${data.type}`));
            }
          });

          hls.loadSource(url);
          hls.attachMedia(video);
        } catch (error) {
          console.error("Error loading hls.js:", error);
          reject(new Error("Failed to load HLS library."));
        }
      }
    } else {
      // Regular video file
      video.addEventListener("loadedmetadata", onVideoReady, { once: true });
      video.addEventListener("error", (e) => {
        console.error("Error loading video from URL:", e);
        reject(new Error("Failed to load video. Make sure the URL points directly to a video file (e.g., .mp4, .webm) and allows cross-origin access."));
      });
      video.src = url;
    }
  });
}

// Enumerate available video input devices (cameras, virtual cameras)
export async function getVideoDevices() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    return [];
  }

  try {
    // Request permission first to get device labels
    await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(stream => {
        // Stop the stream immediately, we just needed permission
        stream.getTracks().forEach(track => track.stop());
      })
      .catch(() => {
        // Permission denied, labels will be empty but we can still enumerate
      });

    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter(device => device.kind === 'videoinput')
      .map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${device.deviceId.slice(0, 8)}...`
      }));
  } catch (error) {
    console.error("Error enumerating video devices:", error);
    return [];
  }
}

export function connectWebcam(deviceId = null) {
  if (!screenObject) return Promise.reject(new Error("Screen object not available"));

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Webcam access is not available in your browser.");
    return Promise.reject(new Error("Webcam not available"));
  }

  // Build video constraints - use specific device if provided
  const videoConstraints = deviceId
    ? { deviceId: { exact: deviceId } }
    : true;

  return navigator.mediaDevices
    .getUserMedia({ video: videoConstraints, audio: false })
    .then((stream) => {
      if (currentVideoTexture) {
        currentVideoTexture.dispose();
        currentVideoTexture = null;
      }
      if (currentVideo) {
        currentVideo.pause();
        currentVideo.srcObject = null;
        currentVideo = null;
      }
      if (currentImageTexture) {
        currentImageTexture.dispose();
        currentImageTexture = null;
      }
      if (currentWebcamStream) {
        currentWebcamStream.getTracks().forEach((track) => track.stop());
        currentWebcamStream = null;
      }

      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;

      video.addEventListener("loadedmetadata", () => {
        video.play();

        const videoTexture = new THREE.VideoTexture(video);
        configureTexture(videoTexture);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;
        videoTexture.rotation = 0;

        applyTextureToScreen(videoTexture, screenObject);
        currentVideoTexture = videoTexture;
        currentVideo = video;
        currentWebcamStream = stream;

        const material = getMaterial(screenObject);
        if (material) {
          setTimeout(() => {
            Object.assign(material, SCREEN_MATERIAL_SETTINGS);
            material.needsUpdate = true;
          }, 200);
        }
      });

      video.addEventListener("error", () => {
        alert("Error accessing webcam.");
      });
      
      return stream;
    })
    .catch((error) => {
      console.error("Error accessing webcam:", error);
      alert("Could not access webcam. Please check permissions.");
      throw error;
    });
}

export function disconnectWebcam() {
  if (currentWebcamStream) {
    currentWebcamStream.getTracks().forEach((track) => track.stop());
    currentWebcamStream = null;
  }
  if (currentVideoTexture) {
    currentVideoTexture.dispose();
    currentVideoTexture = null;
  }
  if (currentVideo) {
    currentVideo.pause();
    currentVideo.srcObject = null;
    currentVideo = null;
  }
}

// Projection mode presets
const projectionModes = {
  dome: { repeatX: 1, repeatY: -1, offsetX: 0, offsetY: 0 },
  equirectangular: { repeatX: 1, repeatY: -1, offsetX: 0, offsetY: 0 },
  '16:9': { repeatX: 1.78, repeatY: -1, offsetX: -0.39, offsetY: 0 },
  square: { repeatX: 1, repeatY: -1, offsetX: 0, offsetY: 0 }
};

export function applyProjectionMode(texture, mode, scale = 1) {
  const preset = projectionModes[mode] || projectionModes.dome;
  texture.repeat.set(preset.repeatX * scale, preset.repeatY * scale);
  texture.offset.set(preset.offsetX, preset.offsetY);
  texture.needsUpdate = true;
}

export function getProjectionModes() {
  return Object.keys(projectionModes);
}

export function setupDragAndDrop() {
  const dropZone = document.getElementById("drop-zone");

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function highlightScreen(isHighlight) {
    if (!screenObject) return;
    const material = getMaterial(screenObject);
    if (material) {
      if (isHighlight) {
        material.emissive = new THREE.Color(0x0096ff);
        material.emissiveIntensity = 0.8;
      } else {
        Object.assign(material, SCREEN_MATERIAL_SETTINGS);
        material.needsUpdate = true;
      }
    }
  }

  document.addEventListener(
    "dragenter",
    (e) => {
      preventDefaults(e);
      dropZone.classList.add("drag-over");
      highlightScreen(true);
    },
    false
  );

  document.addEventListener(
    "dragover",
    (e) => {
      preventDefaults(e);
      dropZone.classList.add("drag-over");
      highlightScreen(true);
    },
    false
  );

  document.addEventListener(
    "dragleave",
    (e) => {
      preventDefaults(e);
      if (e.clientX === 0 && e.clientY === 0) {
        dropZone.classList.remove("drag-over");
        highlightScreen(false);
      }
    },
    false
  );

  document.addEventListener(
    "drop",
    (e) => {
      preventDefaults(e);
      dropZone.classList.remove("drag-over");
      highlightScreen(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith("image/")) {
          loadImage(file);
          if (window.hideVideoControls) window.hideVideoControls();
        } else if (file.type.startsWith("video/")) {
          loadVideo(file);
          // Video controls will be set up in loadVideo's loadedmetadata handler
        }
      }
    },
    false
  );
}
