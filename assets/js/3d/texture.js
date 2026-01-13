import * as THREE from "three";
import { configureTexture, applyTextureToScreen, getMaterial } from "./utils.js";
import { SCREEN_MATERIAL_SETTINGS } from "./config.js";
import { screenSettings } from "../core/settings.js";

let screenObject = null;
let currentVideoTexture = null;
let currentVideo = null;
let currentImageTexture = null;
let currentWebcamStream = null;

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

export function connectWebcam() {
  if (!screenObject) return Promise.reject(new Error("Screen object not available"));

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Webcam access is not available in your browser.");
    return Promise.reject(new Error("Webcam not available"));
  }

  return navigator.mediaDevices
    .getUserMedia({ video: true, audio: false })
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
