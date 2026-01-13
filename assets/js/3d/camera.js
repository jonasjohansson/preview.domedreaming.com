import * as THREE from "three";
import { canvas, camera } from "./scene.js";
import { cameraSettings } from "../core/settings.js";
import { touchMovement } from "./movement.js";

// State variables
export let isPointerLocked = false;
export let isTouching = false;
// Initialize euler with default rotation to match camera initialization
export let euler = new THREE.Euler(-3, 0, 3.121154018741333, "YXZ");
export let modelLoaded = false;
export let touchStartX = 0;
export let touchStartY = 0;
export let keys = {};
export let qeRotationSpeed = 0;

export function setModelLoaded(value) {
  modelLoaded = value;
}

export function setQeRotationSpeed(value) {
  qeRotationSpeed = value;
}

export function setupCameraControls() {
  // Click and drag camera rotation
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  canvas.addEventListener("mousedown", (event) => {
    if (!modelLoaded) return;
    isDragging = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    euler.setFromQuaternion(camera.quaternion);
    canvas.style.cursor = "grabbing";
  });

  canvas.addEventListener("mousemove", (event) => {
    if (!isDragging || !modelLoaded) return;
    
    const deltaX = event.clientX - lastMouseX;
    const deltaY = event.clientY - lastMouseY;

    euler.y -= deltaX * cameraSettings.sensitivity;
    euler.x -= deltaY * cameraSettings.sensitivity;
    euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
    camera.quaternion.setFromEuler(euler);

    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
  });

  canvas.addEventListener("mouseup", () => {
    isDragging = false;
    canvas.style.cursor = "default";
  });

  canvas.addEventListener("mouseleave", () => {
    isDragging = false;
    canvas.style.cursor = "default";
  });

  // Touch controls for mobile - drag to rotate camera
  let cameraTouchId = null;

  canvas.addEventListener(
    "touchstart",
    (event) => {
      if (!modelLoaded) return;
      event.preventDefault();
      
      // Single touch = camera rotation
      if (event.touches.length === 1 && cameraTouchId === null) {
        const touch = event.touches[0];
        cameraTouchId = touch.identifier;
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        isTouching = true;
        euler.setFromQuaternion(camera.quaternion);
      }
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchmove",
    (event) => {
      if (!modelLoaded) return;
      event.preventDefault();
      
      // Camera rotation with single touch drag
      if (cameraTouchId !== null && event.touches.length === 1) {
        const touch = Array.from(event.touches).find(t => t.identifier === cameraTouchId);
        if (touch) {
          const deltaX = touch.clientX - touchStartX;
          const deltaY = touch.clientY - touchStartY;

          euler.y -= deltaX * cameraSettings.sensitivity;
          euler.x -= deltaY * cameraSettings.sensitivity;
          euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
          camera.quaternion.setFromEuler(euler);

          touchStartX = touch.clientX;
          touchStartY = touch.clientY;
        }
      }
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchend",
    (event) => {
      event.preventDefault();
      
      // Check which touch ended
      for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        if (touch.identifier === cameraTouchId) {
          cameraTouchId = null;
          isTouching = false;
        }
      }
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchcancel",
    (event) => {
      event.preventDefault();
      
      // Reset all touches
      for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        if (touch.identifier === cameraTouchId) {
          cameraTouchId = null;
          isTouching = false;
        }
      }
    },
    { passive: false }
  );

  // Helper function to update button visual state
  function updateButtonState(key, isActive) {
    const keyLower = key.toLowerCase();
    if (["q", "w", "a", "s", "d", "e"].includes(keyLower)) {
      const buttons = document.querySelectorAll(`[data-key="${keyLower}"]`);
      buttons.forEach((btn) => {
        if (isActive) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
    }
  }

  // Keyboard controls
  window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    keys[key] = true;
    
    // Update button visual state
    updateButtonState(e.key, true);
    
    if (e.key === "c" || e.key === "C") {
      console.log("Camera Position:", camera.position);
      console.log("Camera Rotation:", camera.rotation);
    }
    // Q and E for camera rotation
    if (e.key === "q" || e.key === "Q") {
      setQeRotationSpeed(1.5); // Rotate right
    }
    if (e.key === "e" || e.key === "E") {
      setQeRotationSpeed(-1.5); // Rotate left
    }
  });

  window.addEventListener("keyup", (e) => {
    const key = e.key.toLowerCase();
    keys[key] = false;
    
    // Update button visual state
    updateButtonState(e.key, false);
    
    if (e.key === "q" || e.key === "Q" || e.key === "e" || e.key === "E") {
      qeRotationSpeed = 0;
    }
  });
}
