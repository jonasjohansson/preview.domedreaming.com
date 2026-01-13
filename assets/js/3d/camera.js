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
  // Pointer lock
  function requestPointerLock() {
    const request = canvas.requestPointerLock || canvas.mozRequestPointerLock || canvas.webkitRequestPointerLock;
    if (request) request.call(canvas);
  }

  function onPointerLockChange() {
    const wasLocked = isPointerLocked;
    isPointerLocked =
      document.pointerLockElement === canvas || document.mozPointerLockElement === canvas || document.webkitPointerLockElement === canvas;

    if (!wasLocked && isPointerLocked && modelLoaded) {
      euler.setFromQuaternion(camera.quaternion);
    }
  }

  document.addEventListener("pointerlockchange", onPointerLockChange);
  document.addEventListener("mozpointerlockchange", onPointerLockChange);
  document.addEventListener("webkitpointerlockchange", onPointerLockChange);

  // Request pointer lock on canvas click
  canvas.addEventListener("click", () => {
    if (!isPointerLocked) {
      requestPointerLock();
    }
  });

  // Mouse movement with pointer lock - only when Cmd (Mac) or Ctrl (Windows/Linux) is held
  // Track modifier key state separately since pointer lock events don't always have key info
  let isModifierPressed = false;
  
  window.addEventListener('keydown', (e) => {
    // Check if the key being pressed is Meta (Cmd) or Control
    if (e.key === 'Meta' || e.key === 'Control' || e.metaKey || e.ctrlKey) {
      isModifierPressed = true;
    }
  });
  
  window.addEventListener('keyup', (e) => {
    // Check if the key being released is Meta (Cmd) or Control
    if (e.key === 'Meta' || e.key === 'Control') {
      isModifierPressed = false;
    }
  });
  
  // Also check modifier state on mousemove as a fallback
  function onMouseMove(event) {
    if (!isPointerLocked || !modelLoaded) return;
    // Only apply camera rotation when Cmd (Meta) or Ctrl is held
    // Check both our tracked state and the event itself as fallback
    if (!isModifierPressed && !event.metaKey && !event.ctrlKey) return;
    
    const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

    euler.y -= movementX * cameraSettings.sensitivity;
    euler.x -= movementY * cameraSettings.sensitivity;
    euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
    camera.quaternion.setFromEuler(euler);
  }

  canvas.addEventListener("mousemove", onMouseMove);

  // Touch controls - only active when in dome mode
  // Track touches: single touch = camera rotation, two touches = move forward
  let cameraTouchId = null;

  canvas.addEventListener(
    "touchstart",
    (event) => {
      // Only allow touch camera controls if in dome mode
      if (!document.body.classList.contains("dome-mode") || !modelLoaded) return;
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
      
      // Two touches = move forward
      if (event.touches.length === 2) {
        touchMovement.forward = true;
      }
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchmove",
    (event) => {
      // Only allow touch camera controls if in dome mode
      if (!document.body.classList.contains("dome-mode") || !modelLoaded) return;
      event.preventDefault();
      
      // Camera rotation - works with single touch anywhere on screen
      // Also allow rotation with first touch even when second touch is added (for moving forward)
      if (cameraTouchId !== null) {
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
      
      // Two touches = move forward (keep moving forward while two touches are active)
      if (event.touches.length === 2) {
        touchMovement.forward = true;
        touchMovement.backward = false;
        touchMovement.left = false;
        touchMovement.right = false;
      } else if (event.touches.length === 1) {
        // If we go back to one touch, stop moving forward
        touchMovement.forward = false;
      }
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchend",
    (event) => {
      // Only handle if in dome mode
      if (!document.body.classList.contains("dome-mode")) return;
      event.preventDefault();
      
      // Check which touch ended
      for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        if (touch.identifier === cameraTouchId) {
          cameraTouchId = null;
          isTouching = false;
        }
      }
      
      // If we have less than 2 touches now, stop moving forward
      if (event.touches.length < 2) {
        touchMovement.forward = false;
        touchMovement.backward = false;
        touchMovement.left = false;
        touchMovement.right = false;
      }
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchcancel",
    (event) => {
      // Only handle if in dome mode
      if (!document.body.classList.contains("dome-mode")) return;
      event.preventDefault();
      
      // Reset all touches
      for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        if (touch.identifier === cameraTouchId) {
          cameraTouchId = null;
          isTouching = false;
        }
      }
      
      // Reset movement
      touchMovement.forward = false;
      touchMovement.backward = false;
      touchMovement.left = false;
      touchMovement.right = false;
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
