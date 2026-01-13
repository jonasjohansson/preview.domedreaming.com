import * as THREE from "three";
import { scene } from "./scene.js";
import { getCurrentImageTexture, getCurrentVideoTexture, getScreenObject } from "./texture.js";

let screenLight = null;
let screenObject = null;
let hemisphereLight = null;
let secondaryLight = null;
let lastColorUpdate = 0;
const COLOR_UPDATE_INTERVAL = 100; // Update color every 100ms
let colorSamplingEnabled = true;
const hsl = { h: 0, s: 0, l: 0 }; // Reusable HSL object for color manipulation

/**
 * Initialize screen-based lighting system
 * Creates a colored light that samples colors from the screen texture
 */
export function initScreenLighting(screenObj) {
  screenObject = screenObj;
  
  // Create a point light positioned near the screen with higher intensity
  // Position will be set based on screen object position
  screenLight = new THREE.PointLight(0xffffff, 2.0, 30); // Increased intensity and range
  screenLight.position.set(0, 0, 0);
  scene.add(screenLight);
  
  // Also create a hemisphere light for ambient color bleeding with stronger effect
  hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x1a1a1a, 0.8); // Increased intensity
  hemisphereLight.position.set(0, 5, 0);
  scene.add(hemisphereLight);
  
  // Add a second point light for more color spread
  secondaryLight = new THREE.PointLight(0xffffff, 1.5, 25);
  secondaryLight.position.set(0, 0, 0);
  scene.add(secondaryLight);
  
  return { screenLight, hemisphereLight, secondaryLight };
}

/**
 * Sample average color from texture
 * Uses a small canvas to read pixel data and calculate average color
 */
function sampleTextureColor(texture) {
  if (!texture || !texture.image) return null;
  
  const image = texture.image;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  
  // Use smaller size for performance (sample every Nth pixel)
  const sampleSize = 64;
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  
  try {
    ctx.drawImage(image, 0, 0, sampleSize, sampleSize);
    const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
    const data = imageData.data;
    
    let r = 0, g = 0, b = 0;
    const pixelCount = sampleSize * sampleSize;
    
    // Calculate average color
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    
    r /= pixelCount;
    g /= pixelCount;
    b /= pixelCount;
    
    return new THREE.Color(r / 255, g / 255, b / 255);
  } catch (error) {
    // If texture isn't ready or CORS issue, return null
    return null;
  }
}

/**
 * Update screen lighting based on current texture colors
 */
export function updateScreenLighting(currentTime) {
  if (!screenLight || !colorSamplingEnabled) return;
  
  // Throttle color updates for performance
  if (currentTime - lastColorUpdate < COLOR_UPDATE_INTERVAL) return;
  lastColorUpdate = currentTime;
  
  // Try to get color from current texture (image or video)
  let color = null;
  const imageTexture = getCurrentImageTexture();
  const videoTexture = getCurrentVideoTexture();
  
  if (videoTexture && videoTexture.image) {
    // For video, sample from the video element
    color = sampleTextureColor(videoTexture);
  } else if (imageTexture) {
    // For images, sample from the texture
    color = sampleTextureColor(imageTexture);
  }
  
  if (color) {
    // Boost the color saturation and brightness for more visible effect
    const boostedColor = color.clone();
    // Increase saturation
    boostedColor.getHSL(hsl);
    hsl.s = Math.min(1.0, hsl.s * 1.5); // Boost saturation by 50%
    hsl.l = Math.min(1.0, hsl.l * 1.2); // Boost lightness by 20%
    boostedColor.setHSL(hsl.h, hsl.s, hsl.l);
    
    // Update point light color with higher intensity
    screenLight.color.copy(boostedColor);
    screenLight.intensity = 3.0; // Much higher intensity for visible effect
    
    // Update hemisphere light sky color for ambient color bleeding
    if (hemisphereLight) {
      // Use more of the sampled color (less white blend) for stronger effect
      const ambientColor = new THREE.Color().lerpColors(new THREE.Color(0xffffff), boostedColor, 0.6);
      hemisphereLight.color.copy(ambientColor);
      hemisphereLight.intensity = 1.2; // Increase hemisphere intensity
    }
    
    // Update secondary light
    if (secondaryLight) {
      secondaryLight.color.copy(boostedColor);
      secondaryLight.intensity = 2.0;
    }
    
    // Update screen object position for lights if available
    const currentScreenObject = getScreenObject();
    if (currentScreenObject) {
      const worldPosition = new THREE.Vector3();
      currentScreenObject.getWorldPosition(worldPosition);
      screenLight.position.copy(worldPosition);
      // Offset slightly in front of screen
      screenLight.position.z += 0.5;
      
      if (secondaryLight) {
        secondaryLight.position.copy(worldPosition);
        secondaryLight.position.z += 0.3;
        secondaryLight.position.y += 0.2; // Slight vertical offset for spread
      }
    }
  }
}

/**
 * Enable or disable color sampling
 */
export function setColorSamplingEnabled(enabled) {
  colorSamplingEnabled = enabled;
}

/**
 * Get the screen light for external control
 */
export function getScreenLight() {
  return screenLight;
}

