import * as THREE from "three";
import { camera } from "./scene.js";
import { CAMERA_HEIGHT, NAVMESH_SEARCH_BOX } from "./config.js";
import * as settings from "../core/settings.js";
import { keys, qeRotationSpeed, euler, modelLoaded, setQeRotationSpeed } from "./camera.js";

let navMeshQuery = null;

// Touch movement state
export let touchMovement = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  rotateLeft: false,  // Q key
  rotateRight: false,  // E key
  up: false,    // Space key (fly mode)
  down: false   // Shift key (fly mode)
};

export function setNavMeshQuery(query) {
  navMeshQuery = query;
}

export function updateMovement(deltaTime = 0.016) {
  // Don't allow movement until model is loaded
  if (!modelLoaded) return;
  
  camera.updateMatrixWorld();

  const forward = new THREE.Vector3();
  forward.setFromMatrixColumn(camera.matrixWorld, 2);
  forward.multiplyScalar(-1).normalize();

  const right = new THREE.Vector3();
  right.setFromMatrixColumn(camera.matrixWorld, 0);
  right.normalize();

  const movement = new THREE.Vector3();
  // Multiply moveSpeed by deltaTime to make it frame-rate independent
  const currentMoveSpeed = settings.moveSpeed * deltaTime;
  // Keyboard controls
  if (keys["w"]) movement.add(forward.clone().multiplyScalar(currentMoveSpeed));
  if (keys["s"]) movement.add(forward.clone().multiplyScalar(-currentMoveSpeed));
  if (keys["a"]) movement.add(right.clone().multiplyScalar(-currentMoveSpeed));
  if (keys["d"]) movement.add(right.clone().multiplyScalar(currentMoveSpeed));
  // Touch controls - double speed for mobile
  const touchMoveSpeed = currentMoveSpeed * 2;
  if (touchMovement.forward) movement.add(forward.clone().multiplyScalar(touchMoveSpeed));
  if (touchMovement.backward) movement.add(forward.clone().multiplyScalar(-touchMoveSpeed));
  if (touchMovement.left) movement.add(right.clone().multiplyScalar(-touchMoveSpeed));
  if (touchMovement.right) movement.add(right.clone().multiplyScalar(touchMoveSpeed));

  // Vertical movement in fly mode
  if (settings.flyMode) {
    const up = new THREE.Vector3(0, 1, 0);
    if (keys[" "] || touchMovement.up) movement.add(up.clone().multiplyScalar(currentMoveSpeed));
    if (keys["shift"] || touchMovement.down) movement.add(up.clone().multiplyScalar(-currentMoveSpeed));
  }

  if (movement.length() === 0) return;

  // Fly mode bypasses navmesh
  if (settings.flyMode) {
    camera.position.add(movement);
    return;
  }

  if (navMeshQuery) {
    const newPosition = camera.position.clone();
    newPosition.x += movement.x;
    newPosition.z += movement.z;

    const feetPosition = {
      x: newPosition.x,
      y: newPosition.y - CAMERA_HEIGHT,
      z: newPosition.z,
    };

    const result = navMeshQuery.findClosestPoint(feetPosition, {
      halfExtents: NAVMESH_SEARCH_BOX,
    });

    if (result.success) {
      camera.position.set(result.point.x, result.point.y + CAMERA_HEIGHT, result.point.z);
    } else {
      // Try sliding along axes
      const tryX = navMeshQuery.findClosestPoint(
        { x: newPosition.x, y: camera.position.y - CAMERA_HEIGHT, z: camera.position.z },
        { halfExtents: NAVMESH_SEARCH_BOX }
      );
      if (tryX.success) {
        camera.position.set(tryX.point.x, tryX.point.y + CAMERA_HEIGHT, camera.position.z);
      } else {
        const tryZ = navMeshQuery.findClosestPoint(
          { x: camera.position.x, y: camera.position.y - CAMERA_HEIGHT, z: newPosition.z },
          { halfExtents: NAVMESH_SEARCH_BOX }
        );
        if (tryZ.success) {
          camera.position.set(camera.position.x, tryZ.point.y + CAMERA_HEIGHT, tryZ.point.z);
        }
      }
    }
  } else {
    camera.position.add(movement);
  }
}

export function updateRotation(deltaTime) {
  // Q/E rotation - use moveSpeed for consistent feel
  // Q/E keyboard rotation (Q = right, E = left)
  const rotationSpeed = settings.moveSpeed * 2; // Scale rotation to feel similar to movement
  if (keys["q"] || keys["Q"]) {
    setQeRotationSpeed(rotationSpeed);
  } else if (keys["e"] || keys["E"]) {
    setQeRotationSpeed(-rotationSpeed);
  } else {
    setQeRotationSpeed(0);
  }

  // Q/E keyboard rotation
  if (qeRotationSpeed !== 0 && modelLoaded) {
    euler.y += qeRotationSpeed * deltaTime;
    camera.quaternion.setFromEuler(euler);
  }
  
  // Q/E touch/button rotation
  if (modelLoaded) {
    const touchRotationSpeed = rotationSpeed;
    if (touchMovement.rotateLeft) {
      euler.y += touchRotationSpeed * deltaTime; // Rotate right (increase y) - Q button
      camera.quaternion.setFromEuler(euler);
    }
    if (touchMovement.rotateRight) {
      euler.y -= touchRotationSpeed * deltaTime; // Rotate left (decrease y) - E button
      camera.quaternion.setFromEuler(euler);
    }
  }
}

