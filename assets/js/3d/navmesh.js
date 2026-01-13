import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { init as initRecastNavigation, NavMeshQuery, importNavMesh } from "@recast-navigation/core";
import { threeToSoloNavMesh } from "@recast-navigation/three";
import { scene, camera } from "./scene.js";
import { CAMERA_HEIGHT, NAVMESH_SEARCH_BOX } from "./config.js";
import { safeTraverse } from "./utils.js";
import { setNavMeshQuery } from "./movement.js";
import { modelLoaded, setModelLoaded } from "./camera.js";

let recastInitialized = false;
let navmesh = null;
let navmeshMeshes = [];
let navMeshQuery = null;

export function getNavMeshQuery() {
  return navMeshQuery;
}

async function initRecast() {
  if (recastInitialized) return;
  try {
    await initRecastNavigation();
    recastInitialized = true;
    loadNavmesh();
  } catch (error) {
    console.error("Failed to initialize recast-navigation:", error);
    recastInitialized = true;
  }
}

async function loadNavmesh() {
  if (!recastInitialized) {
    await initRecast();
    return;
  }

  try {
    const response = await fetch("assets/models/navmesh.bin");
    if (response.ok) {
      const data = await response.arrayBuffer();
      const navMeshData = new Uint8Array(data);
      const { navMesh } = importNavMesh(navMeshData);
      navMeshQuery = new NavMeshQuery(navMesh);
      setNavMeshQuery(navMeshQuery);

      if (modelLoaded) {
        verifyNavmeshAtStartPosition();
      }
      return;
    }
  } catch (error) {
  }

  loadNavmeshGLTF();
}

function loadNavmeshGLTF() {
  const gltfLoader = new GLTFLoader();
  gltfLoader.load(
    "assets/models/navmesh.gltf",
    async (gltf) => {
      navmesh = gltf.scene;
      navmesh.scale.setScalar(1);
      navmesh.visible = false;

      safeTraverse(navmesh, (child) => {
        if (child.isMesh) {
          navmeshMeshes.push(child);
          child.updateMatrixWorld();
        }
      });

      scene.add(navmesh);

      if (navmeshMeshes.length > 0 && recastInitialized) {
        const { success, navMesh } = threeToSoloNavMesh(navmeshMeshes, {
          cs: 0.05,
          ch: 0.05,
          walkableRadius: 0.2,
        });

        if (success) {
          navMeshQuery = new NavMeshQuery(navMesh);
          setNavMeshQuery(navMeshQuery);
        }
      }
    },
    undefined,
    (error) => {
      console.warn("Navmesh GLTF not found:", error);
    }
  );
}

export function verifyNavmeshAtStartPosition() {
  if (!navMeshQuery || !modelLoaded) return;
  const feetPosition = {
    x: camera.position.x,
    y: camera.position.y - CAMERA_HEIGHT,
    z: camera.position.z,
  };
  const result = navMeshQuery.findClosestPoint(feetPosition, {
    halfExtents: NAVMESH_SEARCH_BOX,
  });
  if (result.success) {
    camera.position.y = result.point.y + CAMERA_HEIGHT;
  }
}

export function initNavmesh() {
  initRecast().catch(console.error);
}
