import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { scene, camera } from "./scene.js";
import { getMaterial, safeTraverse, pruneObjectChildren } from "./utils.js";
import * as settings from "../core/settings.js";
import { euler, setModelLoaded } from "./camera.js";
import { setScreenObject, loadDefaultScreenTexture, setupDragAndDrop } from "./texture.js";
import { verifyNavmeshAtStartPosition, initNavmesh, getNavMeshQuery } from "./navmesh.js";
import { initScreenLighting } from "./screen-lighting.js";

export let wisdomeModel = null;
export let fbxMeshes = [];
export let glbLights = [];
export let glbLightsGroup = null;

export function loadModel() {
  const loader = new GLTFLoader();
  
  // Set up DRACOLoader for Draco-compressed models
  const dracoLoader = new DRACOLoader();
  // Use CDN for decoder files (will switch to local after downloading)
  // TODO: After running ./download-draco.sh, change this to: "assets/js/libs/three/draco/"
  dracoLoader.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.181.0/examples/jsm/libs/draco/gltf/");
  loader.setDRACOLoader(dracoLoader);
  
  // Use fetchpriority="low" hint for 3D model to not block LCP
  loader.load(
    "assets/models/wisdome.glb",
    (gltf) => {
      if (!gltf || !gltf.scene) {
        console.error("GLB loaded but scene is missing");
        const loadingOverlay = document.getElementById("loading-overlay");
        if (loadingOverlay) {
          loadingOverlay.innerHTML = '<div style="color: #ff4444; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">Error: Model scene is missing.</div>';
        }
        return;
      }
      const object = gltf.scene;
      wisdomeModel = object;
      object.scale.setScalar(1);
      object.position.set(0, 0, 0);

      // Clean up any null/undefined children to avoid traverse errors
      pruneObjectChildren(object);

      // Find and group lights from GLB
      glbLightsGroup = new THREE.Group();
      glbLightsGroup.name = "GLBLights";

      // Find and group lights from GLB - check all possible light types
      // Use requestIdleCallback to break up the traversal work
      const processLights = () => {
        safeTraverse(object, (child) => {
          if (child.isLight) {
            glbLights.push(child);
            glbLightsGroup.add(child);
          }
        });
      };
      
      if ('requestIdleCallback' in window) {
        requestIdleCallback(processLights, { timeout: 100 });
      } else {
        processLights();
      }

      // Also check for lights that might not be detected by isLight
      if (glbLights.length === 0) {
        safeTraverse(object, (child) => {
          if (
            child instanceof THREE.Light ||
            child instanceof THREE.DirectionalLight ||
            child instanceof THREE.PointLight ||
            child instanceof THREE.SpotLight ||
            child instanceof THREE.RectAreaLight ||
            child instanceof THREE.HemisphereLight
          ) {
            if (!glbLights.includes(child)) {
              glbLights.push(child);
              glbLightsGroup.add(child);
            }
          }
        });
      }

      if (glbLights.length > 0) {
        scene.add(glbLightsGroup);

        // Apply saved light settings
        if (window.savedLightSettings) {
          glbLights.forEach((light, index) => {
            const lightName = light.name || `light_${index}`;
            const saved = window.savedLightSettings[lightName];
            if (saved) {
              light.color.setRGB(saved.r, saved.g, saved.b);
              // Clamp intensity to a sane range to avoid blowouts from bad saved data
              const clampedIntensity = Math.max(0, Math.min(saved.intensity ?? light.intensity, 10));
              light.intensity = clampedIntensity;
            }
          });
        }
      } else {
      }


      // Process meshes
      safeTraverse(object, (child) => {
        if (child.isMesh) {
          const name = child.name.toLowerCase();

          if (
            name.includes("screen") ||
            name.includes("display") ||
            name.includes("monitor") ||
            name.includes("panel") ||
            name.includes("projection") ||
            name.includes("canvas")
          ) {
            setScreenObject(child);
            child.visible = true;
          } else {
            let material = getMaterial(child);
            const originalColor = material?.color ? material.color.clone() : new THREE.Color(0xffffff);

            // Enhance materials for better visual quality
            if (material) {
              // Improve material properties for better rendering
              if (material.metalness !== undefined) {
                material.metalness = Math.max(material.metalness || 0, 0.1);
              }
              if (material.roughness !== undefined) {
                material.roughness = Math.min(material.roughness || 0.5, 0.8);
              }
              // Ensure proper color space
              if (material.map) {
                material.map.colorSpace = THREE.SRGBColorSpace;
              }
              // Enable better lighting
              if (material.isMeshBasicMaterial) {
                // Convert basic materials to standard for better lighting
                const newMaterial = new THREE.MeshStandardMaterial({
                  color: material.color,
                  map: material.map,
                  transparent: material.transparent,
                  opacity: material.opacity,
                  metalness: 0.1,
                  roughness: 0.5,
                });
                child.material = newMaterial;
                material = newMaterial;
              }
              material.needsUpdate = true;
            }

            // Apply color from savedColorSettings if available (after material setup)
            if (window.savedColorSettings && window.savedColorSettings[child.name]) {
              const color = window.savedColorSettings[child.name];
              material = getMaterial(child); // Get the current material (might have been converted)
              if (material) {
                material.color.setRGB(color.r, color.g, color.b);
                material.needsUpdate = true;
              }
            }
            
            fbxMeshes.push({
              mesh: child,
              name: child.name || "Unnamed",
              originalColor: originalColor,
            });
          }
        }
      });

      // Fallback screen detection - check if screen was found
      let screenObjectFound = false;
      safeTraverse(object, (child) => {
        if (
          child.isMesh &&
          child.name &&
          (child.name.toLowerCase().includes("screen") ||
            child.name.toLowerCase().includes("display") ||
            child.name.toLowerCase().includes("monitor") ||
            child.name.toLowerCase().includes("panel") ||
            child.name.toLowerCase().includes("projection") ||
            child.name.toLowerCase().includes("canvas"))
        ) {
          screenObjectFound = true;
        }
      });

      if (!screenObjectFound && object && object.children.length > 0) {
        safeTraverse(object, (child) => {
          if (child.isMesh && !screenObjectFound) {
            setScreenObject(child);
            child.visible = true;
            fbxMeshes = fbxMeshes.filter((item) => item.mesh !== child);
            screenObjectFound = true;
          }
        });
      }

      scene.add(object);

      // Reset camera position and rotation to ensure consistency
      // Use the settings values, ensuring they're valid
      const camPos = settings.startCameraPosition || { x: 0, y: 5.4, z: -4.3 };
      const camRot = settings.startCameraRotation || { x: -3, y: 0, z: 3.121154018741333 };
      
      camera.position.set(camPos.x, camPos.y, camPos.z);
      camera.rotation.set(camRot.x, camRot.y, camRot.z);
      // Ensure quaternion is updated from rotation
      camera.updateMatrixWorld();
      // Sync euler with camera quaternion to ensure consistency
      euler.setFromQuaternion(camera.quaternion);

      setModelLoaded(true);



      const navMeshQuery = getNavMeshQuery();
      if (navMeshQuery) {
        verifyNavmeshAtStartPosition();
      }

      initNavmesh();
      setupDragAndDrop(); // Initialize drag and drop for texture updates
      
      // Function to show the scene once everything is loaded
      function showScene() {
        // Fade out the overlay
        const loadingOverlay = document.getElementById("loading-overlay");
        if (loadingOverlay) {
          loadingOverlay.classList.add("fade-out");
          // Remove from DOM after fade completes
          setTimeout(() => {
            loadingOverlay.remove();
          }, 500);
        }
        
        const canvasContainer = document.getElementById("canvas-container");
        const infoPanel = document.getElementById("info-panel");
        if (canvasContainer) canvasContainer.classList.add("loaded");
        if (infoPanel) infoPanel.classList.add("loaded");
      }
      
      // Wait for all assets to load before showing the scene
      Promise.all([
        // Apply settings to scene (including random interior color)
        import("../core/settings.js").then((settingsModule) => {
          return settingsModule.applySettingsToScene();
        }),
        // Load default texture and wait for it to complete
        loadDefaultScreenTexture().catch((error) => {
          console.warn("Error loading default texture, continuing anyway:", error);
          return null; // Don't block scene from showing
        })
      ]).then(() => {
        // Initialize screen-based lighting after texture is loaded
        setTimeout(() => {
          const screenObj = object.children.find(child => {
            const name = child.name?.toLowerCase() || "";
            return name.includes("screen") || name.includes("monitor") || name.includes("panel") || 
                   name.includes("projection") || name.includes("canvas");
          });
          if (screenObj) {
            initScreenLighting(screenObj);
          }
          
          // Now show the scene - everything is loaded (model, colors, texture)
          showScene();
        }, 100);
      }).catch((error) => {
        console.error("Error during scene initialization:", error);
        // Show scene anyway after a delay
        setTimeout(showScene, 1000);
      });
    },
    undefined,
    (error) => {
      console.error("Error loading 3D model:", error);
      const loadingOverlay = document.getElementById("loading-overlay");
      if (loadingOverlay) {
        loadingOverlay.innerHTML = '<div style="color: #ff4444; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">Error loading 3D model.</div>';
      }
    }
  );
}
