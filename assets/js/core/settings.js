// Simplified settings for 3D preview
export let moveSpeed = 1;
export let cameraSettings = {
  sensitivity: 0.002,
  rotationSpeed: 120,
};
export let startCameraPosition = { x: 0, y: 5.4, z: -4.3 };
export let startCameraRotation = { x: -3, y: 0, z: 3.121154018741333 };
export let currentCameraPosition = { x: 0, y: 0, z: 0 };
export let currentCameraRotation = { x: 0, y: 0, z: 0 };
export let bloomSettings = {
  enabled: true,
  strength: 1.5,
  radius: 0.4,
  threshold: 0.85,
};
export let screenSettings = {
  defaultImage: "assets/media/background.jpg",
};

export function setMoveSpeed(value) {
  moveSpeed = value;
}

export function setBloomSettings(strength, radius, threshold) {
  bloomSettings.strength = strength;
  bloomSettings.radius = radius;
  bloomSettings.threshold = threshold;
}

async function loadDefaultSettings() {
  try {
    const jsonPath = "assets/js/core/default-settings.json";
    const response = await fetch(jsonPath);
    if (!response.ok) {
      console.warn("Could not load default-settings.json, using hardcoded defaults");
      return false;
    }
    const defaultSettings = await response.json();

    if (defaultSettings.settings) {
      const settings = defaultSettings.settings;
      if (settings.moveSpeed !== undefined) moveSpeed = settings.moveSpeed;
      if (settings.cameraSettings) Object.assign(cameraSettings, settings.cameraSettings);
      if (settings.startCameraPosition) Object.assign(startCameraPosition, settings.startCameraPosition);
      if (settings.startCameraRotation) Object.assign(startCameraRotation, settings.startCameraRotation);
      if (settings.bloomSettings) Object.assign(bloomSettings, settings.bloomSettings);
      if (settings.screenSettings) Object.assign(screenSettings, settings.screenSettings);
      
      if (settings.colorSettings) {
        window.savedColorSettings = settings.colorSettings;
      }
      if (settings.lightSettings) {
        window.savedLightSettings = settings.lightSettings;
      }
    }

    return true;
  } catch (error) {
    console.warn("Failed to load default settings from JSON:", error);
    return false;
  }
}

export async function loadSettings() {
  await loadDefaultSettings();
  
  // Try localStorage as fallback (but don't override defaults for moveSpeed and cameraSettings)
  try {
    const saved = localStorage.getItem("domeDreamingSettings");
    if (saved) {
      const settings = JSON.parse(saved);
      // Don't override moveSpeed and cameraSettings from localStorage - use defaults
      // if (settings.moveSpeed !== undefined) moveSpeed = settings.moveSpeed;
      // if (settings.cameraSettings) Object.assign(cameraSettings, settings.cameraSettings);
      if (settings.bloomSettings) Object.assign(bloomSettings, settings.bloomSettings);
      if (settings.screenSettings) Object.assign(screenSettings, settings.screenSettings);
      if (settings.colorSettings) window.savedColorSettings = settings.colorSettings;
      if (settings.lightSettings) window.savedLightSettings = settings.lightSettings;
    }
  } catch (error) {
    console.warn("Failed to load settings from localStorage:", error);
  }
}

export async function applySettingsToScene() {
  if (!window.savedColorSettings) {
    window.savedColorSettings = {};
  }

  const modelModule = await import("../3d/model.js");
  if (modelModule.fbxMeshes && modelModule.fbxMeshes.length > 0) {
    const { getMaterial } = await import("../3d/utils.js");
    modelModule.fbxMeshes.forEach((item) => {
      const material = getMaterial(item.mesh);
      if (material && window.savedColorSettings[item.name]) {
        const color = window.savedColorSettings[item.name];
        material.color.setRGB(color.r, color.g, color.b);
        material.needsUpdate = true;
      }
    });
  }

  if (window.savedLightSettings && modelModule.glbLights) {
    modelModule.glbLights.forEach((light, index) => {
      const lightName = light.name || `light_${index}`;
      if (window.savedLightSettings[lightName]) {
        const saved = window.savedLightSettings[lightName];
        light.color.setRGB(saved.r, saved.g, saved.b);
        light.intensity = Math.max(0, Math.min(saved.intensity ?? light.intensity, 10));
      }
    });
  }

  const postProc = await import("../3d/postprocessing.js");
  const bloomPass = postProc.getBloomPass();
  if (bloomPass) {
    bloomPass.enabled = bloomSettings.enabled !== false;
    if (bloomSettings.enabled) {
      bloomPass.strength = bloomSettings.strength;
      bloomPass.radius = bloomSettings.radius;
      bloomPass.threshold = bloomSettings.threshold;
    }
  }
}

export function saveSettings(fbxMeshes, glbLights) {
  try {
    const colorSettings = {};
    if (fbxMeshes && Array.isArray(fbxMeshes)) {
      import("../3d/utils.js").then((utils) => {
        fbxMeshes.forEach((item) => {
          const material = utils.getMaterial(item.mesh);
          if (material?.color) {
            const meshName = item.name || `mesh_${fbxMeshes.indexOf(item)}`;
            colorSettings[meshName] = {
              r: material.color.r,
              g: material.color.g,
              b: material.color.b,
            };
          }
        });
        
        const lightSettings = {};
        if (glbLights && Array.isArray(glbLights)) {
          glbLights.forEach((light, index) => {
            const lightName = light.name || `light_${index}`;
            lightSettings[lightName] = {
              r: light.color.r,
              g: light.color.g,
              b: light.color.b,
              intensity: light.intensity,
            };
          });
        }

        const settings = {
          moveSpeed,
          cameraSettings,
          startCameraPosition,
          startCameraRotation,
          colorSettings,
          lightSettings,
          bloomSettings,
          screenSettings,
        };

        localStorage.setItem("domeDreamingSettings", JSON.stringify(settings));
      });
    } else {
      // Save without color settings if meshes not available
      const settings = {
        moveSpeed,
        cameraSettings,
        startCameraPosition,
        startCameraRotation,
        bloomSettings,
        screenSettings,
      };
      localStorage.setItem("domeDreamingSettings", JSON.stringify(settings));
    }
  } catch (error) {
    console.warn("Failed to save settings:", error);
  }
}
