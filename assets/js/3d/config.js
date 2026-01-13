import * as THREE from "three";

// Constants & Configuration
export const CAMERA_HEIGHT = 1.6;
export const NAVMESH_SEARCH_BOX = { x: 5, y: 10, z: 5 };
export const SCREEN_MATERIAL_SETTINGS = {
  emissive: new THREE.Color(0xffffff), // White emissive for brightness
  emissiveIntensity: 1.0, // Full emissive intensity
  color: new THREE.Color(0xffffff), // White so texture shows true colors
  toneMapped: false,
  transparent: true, // Enable transparency for PNG alpha channel
  opacity: 1.0,
};








