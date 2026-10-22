// Optional modelled landmarks. Drop a glTF binary named after the landmark type (public/models/<type>.glb, in metres,
// origin at the centre of the base, front facing -Z) and it replaces the generated building; where there is no file the
// generated one is used as before. Loaded once at startup; a missing file costs nothing.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LANDMARK_NAMES } from './stages.js';

export const MODELS = {};

export async function loadLandmarkModels() {
  const loader = new GLTFLoader();
  const base = import.meta.env.BASE_URL + 'models/';
  await Promise.all(Object.keys(LANDMARK_NAMES).map(async (type) => {
    try {
      const res = await fetch(base + type + '.glb');
      const kind = res.headers.get('content-type') || '';
      if (!res.ok || kind.includes('html')) return;
      const gltf = await loader.parseAsync(await res.arrayBuffer(), base);
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.frustumCulled = true;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.map) m.map.anisotropy = 4;
      });
      MODELS[type] = gltf.scene;
    } catch (e) {
      console.warn('landmark model ' + type + ' not loaded', e);
    }
  }));
}

// a copy of the model standing at a road position, turned to face along the road
export function placeModel(type, pos, yaw) {
  const src = MODELS[type];
  if (!src) return null;
  const m = src.clone(true);
  m.position.set(pos[0], pos[1], pos[2]);
  m.rotation.y = -yaw;
  return m;
}
