import {
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  Plane,
  Raycaster,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { groupHouses, type MapHouse } from './map-types';

export function provinceHeight(count: number) {
  return 0.12 + Math.log2(1 + Math.max(0, count)) * 0.09;
}

export interface ModelProjection {
  projectedCenterMeters: [number, number];
  unitsPerMeter: number;
}
export function modelProjection(metadata: ModelProjection) {
  const a = 6378137;
  const e2 = 0.0066943799901413165;
  const radians = Math.PI / 180;
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  function meridian(latitude: number) {
    const phi = latitude * radians;
    return (
      a *
      ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi -
        ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi) +
        ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi) -
        ((35 * e6) / 3072) * Math.sin(6 * phi))
    );
  }
  // WGS84 ellipsoidal equidistant cylindrical projection, lat_ts=lat_0=13, lon_0=101.
  const parallel = 13 * radians;
  const n = a / Math.sqrt(1 - e2 * Math.sin(parallel) ** 2);
  return (longitude: number, latitude: number) =>
    new Vector3(
      (n * Math.cos(parallel) * (longitude - 101) * radians - metadata.projectedCenterMeters[0]) *
        metadata.unitsPerMeter,
      0,
      -(meridian(latitude) - meridian(13) - metadata.projectedCenterMeters[1]) *
        metadata.unitsPerMeter,
    );
}

export function createThailandScene(
  container: HTMLElement,
  callbacks: {
    province: (code: string) => void;
    houses: (houses: MapHouse[]) => void;
    bounds: (bounds: [number, number, number, number]) => void;
    error: () => void;
  },
) {
  const scene = new Scene();
  scene.background = new Color('#f5f2e9');
  const camera = new OrthographicCamera(-8, 8, 8, -8, 0.1, 100);
  const home = new Vector3(2.6, 14, 9);
  camera.position.copy(home);
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minZoom = 0.65;
  controls.maxZoom = 30;
  controls.maxPolarAngle = Math.PI / 2.2;
  controls.update();
  scene.add(new HemisphereLight('#fff9ec', '#65796c', 2));
  const sun = new DirectionalLight('#ffffff', 3);
  sun.position.set(-5, 12, 5);
  scene.add(sun);
  const provinces = new Map<string, Mesh>();
  const houses = new Group();
  const houseBodyGeometry = new BoxGeometry(0.065, 0.09, 0.065);
  const houseRoofGeometry = new ConeGeometry(0.06, 0.055, 4);
  const houseRoofMaterial = new MeshStandardMaterial({ color: '#d96750' });
  const houseBodyMaterials = new Map<string, MeshStandardMaterial>();
  scene.add(houses);
  const targets = new Map<string, number>();
  let selected = '';
  let destroyed = false;
  let frame = 0;
  let active = true;
  let dirty = true;
  const invalidate = () => {
    dirty = true;
  };
  controls.addEventListener('change', invalidate);
  let project: ReturnType<typeof modelProjection> | undefined;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function dispose(object: Object3D) {
    object.traverse((child) => {
      if (child instanceof Mesh || child instanceof Sprite) {
        if ('geometry' in child) child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material: Material) => {
          if (material instanceof SpriteMaterial) material.map?.dispose();
          material.dispose();
        });
      }
    });
  }
  function clearHouses() {
    houses.traverse((child) => {
      if (!(child instanceof Sprite)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (material instanceof SpriteMaterial) material.map?.dispose();
        material.dispose();
      });
    });
    houses.clear();
  }
  function position(longitude: number, latitude: number) {
    return project!(longitude, latitude);
  }
  const ready = new GLTFLoader().loadAsync('/models/thailand-77-provinces.glb').then((gltf) => {
    if (destroyed) {
      dispose(gltf.scene);
      return;
    }
    if (!gltf.scene.userData.unitsPerMeter || !gltf.scene.userData.projectedCenterMeters) {
      dispose(gltf.scene);
      throw new Error('Invalid model projection');
    }
    gltf.scene.traverse((object) => {
      if (!(object instanceof Mesh) || !object.userData.provinceCode) return;
      provinces.set(String(object.userData.provinceCode), object);
    });
    if (provinces.size !== 77) {
      dispose(gltf.scene);
      throw new Error('Expected 77 provinces');
    }
    project = modelProjection(gltf.scene.userData as ModelProjection);
    scene.add(gltf.scene);
    invalidate();
  });
  function update(points: MapHouse[], counts: Record<string, number>) {
    if (!project || destroyed) return;
    invalidate();
    clearHouses();
    const initialSnapshot = targets.size === 0;
    provinces.forEach((province, code) => {
      const height = provinceHeight(counts[code] ?? 0) / 0.12;
      targets.set(code, height);
      // First load has no previous count to animate from. Animate subsequent changes only.
      if (initialSnapshot) province.scale.y = height;
    });
    for (const group of groupHouses(points)) {
      const place = group[0]!;
      if (!provinces.has(place.provinceCode)) continue;
      const house = new Group();
      house.userData.houses = group;
      house.position.copy(position(place.longitude, place.latitude));
      const bodyColor = place.construction ? '#e8a32a' : place.color;
      const bodyKey = `${bodyColor}:${place.construction ? 'construction' : 'public'}`;
      let bodyMaterial = houseBodyMaterials.get(bodyKey);
      if (!bodyMaterial) {
        bodyMaterial = new MeshStandardMaterial({
          color: bodyColor,
          wireframe: Boolean(place.construction),
        });
        houseBodyMaterials.set(bodyKey, bodyMaterial);
      }
      const body = new Mesh(houseBodyGeometry, bodyMaterial);
      body.position.y = 0.045;
      const roof = new Mesh(houseRoofGeometry, houseRoofMaterial);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 0.1175;
      house.add(body, roof);
      if (group.length > 1) {
        const label = document.createElement('canvas');
        label.width = 128;
        label.height = 64;
        const context = label.getContext('2d')!;
        context.fillStyle = '#143c30';
        context.fillRect(0, 0, 128, 64);
        context.fillStyle = '#ffffff';
        context.font = 'bold 42px sans-serif';
        context.textAlign = 'center';
        context.fillText(String(group.length), 64, 48);
        const badge = new Sprite(new SpriteMaterial({ map: new CanvasTexture(label) }));
        badge.scale.set(0.19, 0.095, 1);
        badge.position.y = 0.22;
        house.add(badge);
      }
      houses.add(house);
    }
  }
  function select(code: string) {
    invalidate();
    selected = code;
    const province = provinces.get(code);
    if (province) {
      const label = province.userData.labelPosition as number[];
      const target = new Vector3(label[0], 0, label[2]);
      camera.position.add(target.clone().sub(controls.target));
      controls.target.copy(target);
      camera.zoom = 3;
      camera.updateProjectionMatrix();
      controls.update();
      emitBounds();
    }
  }
  function reset() {
    invalidate();
    selected = '';
    camera.position.copy(home);
    camera.zoom = 1;
    controls.target.set(0, 0, 0);
    camera.updateProjectionMatrix();
    controls.update();
    emitBounds();
  }
  function zoom(factor: number) {
    invalidate();
    camera.zoom = MathUtils.clamp(camera.zoom * factor, 0.65, 30);
    camera.updateProjectionMatrix();
    emitBounds();
  }
  const ray = new Raycaster();
  let press: { x: number; y: number } | null = null;
  const down = (event: PointerEvent) => {
    press = { x: event.clientX, y: event.clientY };
  };
  const up = (event: PointerEvent) => {
    const start = press;
    press = null;
    if (
      !start ||
      event.button !== 0 ||
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6
    )
      return;
    const rect = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(
      new Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const house = ray.intersectObjects(houses.children, true)[0]?.object.parent;
    if (house?.userData.houses) {
      callbacks.houses(house.userData.houses as MapHouse[]);
      return;
    }
    const province = ray.intersectObjects([...provinces.values()], false)[0]?.object;
    if (province) callbacks.province(String(province.userData.provinceCode));
  };
  renderer.domElement.addEventListener('pointerdown', down);
  renderer.domElement.addEventListener('pointerup', up);
  const lost = (event: Event) => {
    event.preventDefault();
    callbacks.error();
  };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  function emitBounds() {
    if (!project) return;
    camera.updateMatrixWorld();
    const floor = new Plane(new Vector3(0, 1, 0), 0);
    const points: Vector3[] = [];
    for (const x of [-1, 1])
      for (const y of [-1, 1]) {
        ray.setFromCamera(new Vector2(x, y), camera);
        const point = ray.ray.intersectPlane(floor, new Vector3());
        if (point) points.push(point);
      }
    if (points.length !== 4) {
      callbacks.bounds([97, 5, 106, 21]);
      return;
    }
    const origin = project(101, 13),
      scaleX = project(102, 13).x - origin.x;
    const longitude = (x: number) => 101 + (x - origin.x) / scaleX;
    const latitude = (z: number) => {
      let low = 5,
        high = 21;
      for (let i = 0; i < 30; i++) {
        const mid = (low + high) / 2;
        if (project!(101, mid).z > z) low = mid;
        else high = mid;
      }
      return (low + high) / 2;
    };
    const west = Math.max(97, longitude(Math.min(...points.map((p) => p.x))) - 0.5);
    const east = Math.min(106, longitude(Math.max(...points.map((p) => p.x))) + 0.5);
    const south = Math.max(5, latitude(Math.max(...points.map((p) => p.z))) - 0.5);
    const north = Math.min(21, latitude(Math.min(...points.map((p) => p.z))) + 0.5);
    callbacks.bounds(west < east && south < north ? [west, south, east, north] : [97, 5, 106, 21]);
  }
  controls.addEventListener('end', emitBounds);
  const resizeScene = () => {
    if (!active) return;
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    const aspect = width / height;
    const half = Math.max(6.8, 3.65 / aspect);
    camera.left = -half * aspect;
    camera.right = half * aspect;
    camera.top = half;
    camera.bottom = -half;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    invalidate();
    emitBounds();
  };
  const resize = new ResizeObserver(resizeScene);
  resize.observe(container);
  let previous = 0;
  function animate(time: number) {
    if (destroyed || !active) return;
    const ease = reducedMotion.matches
      ? 1
      : 1 - Math.exp(-8 * Math.min((time - previous) / 1000, 0.1));
    previous = time;
    provinces.forEach((province, code) => {
      const target = targets.get(code) ?? 1;
      const difference = target - province.scale.y;
      if (difference !== 0) {
        province.scale.y =
          Math.abs(difference) < 0.001 ? target : province.scale.y + difference * ease;
        invalidate();
      }
      const material = province.material;
      if (material instanceof MeshStandardMaterial) {
        material.emissive.set('#38846a');
        material.emissiveIntensity = code === selected ? 0.3 : 0;
      }
    });
    houses.children.forEach((house) => {
      const place = (house.userData.houses as MapHouse[])[0]!;
      house.position.y = 0.12 * (provinces.get(place.provinceCode)?.scale.y ?? 1);
    });
    controls.update();
    // Keep damping/height animation responsive, but do not redraw a stationary model.
    if (dirty && !document.hidden) {
      renderer.render(scene, camera);
      dirty = false;
    }
    frame = requestAnimationFrame(animate);
  }
  frame = requestAnimationFrame(animate);
  return {
    ready,
    update,
    setActive(value: boolean) {
      if (destroyed || active === value) return;
      active = value;
      controls.enabled = value;
      container.dataset.modelActive = String(value);
      if (value) {
        previous = performance.now();
        resizeScene();
        invalidate();
        frame = requestAnimationFrame(animate);
      } else cancelAnimationFrame(frame);
    },
    select,
    reset,
    zoom,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      controls.removeEventListener('end', emitBounds);
      controls.removeEventListener('change', invalidate);
      controls.dispose();
      clearHouses();
      houseBodyGeometry.dispose();
      houseRoofGeometry.dispose();
      houseRoofMaterial.dispose();
      houseBodyMaterials.forEach((material) => material.dispose());
      houseBodyMaterials.clear();
      dispose(scene);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
