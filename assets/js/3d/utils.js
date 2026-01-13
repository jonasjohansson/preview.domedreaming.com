import * as THREE from "three";
import { SCREEN_MATERIAL_SETTINGS } from "./config.js";

export function applyTextureToScreen(texture, screenObject) {
  if (!screenObject) return;

  const material = Array.isArray(screenObject.material) ? screenObject.material[0] : screenObject.material;

  if (!material) {
    const newMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      ...SCREEN_MATERIAL_SETTINGS,
      color: new THREE.Color(0xffffff), // White so texture shows true colors
      emissive: new THREE.Color(0xffffff), // White emissive for brightness
      emissiveMap: texture, // Use texture as emissive map
      emissiveIntensity: 1.0, // Full emissive intensity
    });
    screenObject.material = newMaterial;
    return;
  }

  // Dispose old textures
  if (material.map) material.map.dispose();
  if (material.emissiveMap && material.emissiveMap !== texture) {
    material.emissiveMap.dispose();
  }

  // Apply new texture
  material.map = texture;
  material.emissiveMap = texture; // Use texture as emissive map
  // Apply screen material settings
  Object.assign(material, SCREEN_MATERIAL_SETTINGS);
  // Set color to white so texture shows true colors (like a normal screen)
  material.color.setRGB(1, 1, 1);
  // Set emissive to white with texture for brightness
  material.emissive.setRGB(1, 1, 1);
  material.emissiveIntensity = 1.0; // Full emissive intensity
  material.needsUpdate = true;
}

export function configureTexture(texture) {
  texture.flipY = true;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.x = 1; // Flip on X axis (horizontal flip)
  texture.repeat.y = -1; // Keep Y axis normal
  texture.colorSpace = THREE.SRGBColorSpace;
  // Set center to (0.5, 0.5) for rotation around center
  texture.center.set(0.5, 0.5);
  texture.needsUpdate = true;
}

export function getMaterial(mesh) {
  return Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
}

export function colorToHex(color) {
  return `#${Math.floor(color.r * 255)
    .toString(16)
    .padStart(2, "0")}${Math.floor(color.g * 255)
    .toString(16)
    .padStart(2, "0")}${Math.floor(color.b * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

export function pruneObjectChildren(obj) {
  if (!obj || !obj.children) return;
  obj.children = obj.children.filter(Boolean);
  obj.children.forEach((child) => pruneObjectChildren(child));
}

export function safeTraverse(obj, callback) {
  if (!obj) return;
  const stack = [obj];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    callback(current);
    if (current.children && current.children.length) {
      for (let i = current.children.length - 1; i >= 0; i--) {
        const child = current.children[i];
        if (child && typeof child.traverse === "function") {
          stack.push(child);
        } else {
          // remove invalid child
          current.children.splice(i, 1);
        }
      }
    }
  }
}
