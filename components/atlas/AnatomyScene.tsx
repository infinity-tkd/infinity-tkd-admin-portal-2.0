'use client';

import { useEffect, useRef } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createExplosionLayout } from '@/lib/atlas/explosion-layout';
import { loadModelChunk } from '@/lib/atlas/model-download';
import { anatomyPixelRatio, requestedAtlasParts, validatePartBuffer, yieldToBrowser } from '@/lib/atlas/model-loading';
import { createDemandRenderLoop } from '@/lib/atlas/render-loop';
import { normalizeMuscleNameFor3D } from '@/lib/anatomyUtils';
import { PointerTap } from '@/lib/atlas/pointer-tap';
import { SYSTEMS, type Atlas, type SceneState } from '@/lib/atlas/anatomy';

interface Props {
  atlas: Atlas;
  state: SceneState;
  onSelect: (id: string) => void;
  onProgress: (n: number) => void;
  onError: (s: string) => void;
  isDark?: boolean;
  muscleLoads?: Record<string, number>;
}

export default function AnatomyScene({ atlas, state, onSelect, onProgress, onError, isDark, muscleLoads = {} }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(state);
  const loads = useRef(muscleLoads);
  const wake = useRef<(() => void) | null>(null);
  loads.current = muscleLoads;
  const select = useRef(onSelect);
  const callbacks = useRef({ onProgress, onError });
  latest.current = state;
  select.current = onSelect;
  callbacks.current = { onProgress, onError };

  useEffect(() => { wake.current?.(); }, [state, muscleLoads]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    let disposed = false;
    let invalidate = () => { dirty = true; };
    let paused = document.hidden;
    let failed = false;
    let lastLoads: Record<string, number> | null = null;
    let dirty = true;
    let ready = false;
    let lastView = '';
    let lastReset = -1;
    let lastIsolate = '';
    let layoutKey = '';
    let amount = 0;
    let lastState: SceneState | null = null;
    const abort = new AbortController();

    let renderer: T.WebGLRenderer;
    const probeCanvas = document.createElement('canvas');
    let glContext: RenderingContext | null = null;
    try {
      glContext =
        probeCanvas.getContext('webgl2', { powerPreference: 'default', failIfMajorPerformanceCaveat: false }) ||
        probeCanvas.getContext('webgl', { powerPreference: 'default', failIfMajorPerformanceCaveat: false }) ||
        (probeCanvas as any).getContext('experimental-webgl', { powerPreference: 'default', failIfMajorPerformanceCaveat: false });
    } catch {
      glContext = null;
    }

    if (!glContext) {
      callbacks.current.onError('WebGL hardware acceleration is unavailable on this device. Switching to 2D Biomechanical Scanner.');
      return;
    }

    try {
      renderer = new T.WebGLRenderer({
        canvas: probeCanvas,
        context: glContext as WebGLRenderingContext | WebGL2RenderingContext,
        antialias: false,
        alpha: false,
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false,
      });
    } catch {
      (glContext as WebGLRenderingContext | WebGL2RenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
      callbacks.current.onError('This browser could not start the 3D viewer. Switching to 2D Biomechanical Scanner.');
      return;
    }

    renderer.debug.onShaderError = () => {
      if (disposed || failed) return;
      failed = true;
      abort.abort();
      callbacks.current.onError('This device could not draw the 3D muscle view. Use the 2D view or reopen the viewer.');
    };

    const dark = isDark ?? (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));
    const clearColor = dark ? '#0a0b0d' : '#f2f3f3';
    renderer.setPixelRatio(anatomyPixelRatio(window.devicePixelRatio, el.clientWidth < 768));
    renderer.setClearColor(clearColor);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = dark ? 1.25 : 1.12;
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      'aria-label',
      'Interactive human anatomy. Drag to orbit, pinch or scroll to zoom, and tap a structure to inspect it.'
    );

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(34, 1, 0.005, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    camera.position.set(1.4, 1.05, 3.6);
    controls.target.set(0, 0.85, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.085;
    controls.minDistance = 0.07;
    controls.maxDistance = 40;
    controls.maxPolarAngle = Math.PI * 0.96;
    const controlChanged = () => { dirty = true; invalidate(); };
    controls.addEventListener('change', controlChanged);
    controls.addEventListener('start', controlChanged);

    scene.add(new T.HemisphereLight(0xffffff, dark ? 0x22262d : 0xa7acb2, dark ? 1.2 : 1.05));
    const key = new T.DirectionalLight(0xfffaf4, 2.3);
    key.position.set(-2, 4, 3);
    scene.add(key);

    const rim = new T.DirectionalLight(0xe9f0ff, 1.8);
    rim.position.set(2, 2, -3);
    scene.add(rim);

    // Floor and platform with dark-mode sensitivity
    const groundColor = dark ? 0x111317 : 0xd5d9dc;
    const ground = new T.Mesh(new T.CircleGeometry(30, 96), new T.MeshStandardMaterial({ color: groundColor, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.019;
    scene.add(ground);

    const platformColor = dark ? 0x181a1f : 0xeeeeec;
    const platform = new T.Mesh(
      new T.CylinderGeometry(0.68, 0.7, 0.028, 100),
      new T.MeshStandardMaterial({ color: platformColor, metalness: 0.12, roughness: 0.67 })
    );
    platform.position.y = -0.016;
    scene.add(platform);

    const ring = new T.Mesh(
      new T.RingGeometry(0.63, 0.632, 128),
      new T.MeshBasicMaterial({ color: dark ? 0xef2f38 : 0x8c969f, transparent: true, opacity: dark ? 0.35 : 0.4, side: T.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.001;
    scene.add(ring);

    const innerRing = new T.Mesh(
      new T.RingGeometry(0.55, 0.551, 128),
      new T.MeshBasicMaterial({ color: 0xa4aeb8, transparent: true, opacity: dark ? 0.1 : 0.16, side: T.DoubleSide })
    );
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.001;
    scene.add(innerRing);

    // GPU State Textures
    const width = T.MathUtils.ceilPowerOfTwo(atlas.parts.length);
    const data = new Float32Array(width * 4);
    const partTexture = new T.DataTexture(data, width, 1, T.RGBAFormat, T.FloatType);
    partTexture.needsUpdate = true;

    const selectedData = new Uint8Array(width * 4);
    const selectionTexture = new T.DataTexture(selectedData, width, 1);
    selectionTexture.needsUpdate = true;

    const materials: T.Material[] = [];
    const geometries: T.BufferGeometry[] = [];
    const pickers: (T.Mesh | undefined)[] = [];
    const centers = atlas.parts.map((p) =>
      new T.Vector3().fromArray(p.bounds[0]).add(new T.Vector3().fromArray(p.bounds[1])).multiplyScalar(0.5)
    );
    const muscleGroups = atlas.parts.map((part) => normalizeMuscleNameFor3D(part.name).toLowerCase());
    let groupLoads = new Map<string, number>();
    const offsets: T.Vector3[] = [];
    const bounds = atlas.parts.map((p) => new T.Box3(new T.Vector3().fromArray(p.bounds[0]), new T.Vector3().fromArray(p.bounds[1])));
    let packingWidth = 1;
    let packingHeight = 1;

    const markerPositions = new Float32Array(atlas.parts.length * 3);
    const markerGeometry = new T.BufferGeometry();
    markerGeometry.setAttribute('position', new T.BufferAttribute(markerPositions, 3));
    const markerMaterial = new T.PointsMaterial({
      color: 0xef2f38,
      size: 5,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.72,
      depthTest: false,
    });
    markerMaterial.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\nif (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;'
      );
    };
    const markers = new T.Points(markerGeometry, markerMaterial);
    markers.frustumCulled = false;
    markers.renderOrder = 10;
    markers.visible = false;
    scene.add(markers);

    const hover = document.createElement('div');
    hover.className = 'part-hover';
    hover.setAttribute('role', 'tooltip');
    hover.hidden = true;
    el.appendChild(hover);

    type Target = { index: number; x: number; y: number; left: number; right: number; top: number; bottom: number };
    let targets: Target[] = [];
    const projected = new T.Vector3();

    const findTarget = (x: number, y: number, radius: number) => {
      let best = -1;
      let score = Infinity;
      for (const t of targets) {
        const dx = Math.max(t.left - x, 0, x - t.right);
        const dy = Math.max(t.top - y, 0, y - t.bottom);
        const distance = Math.hypot(dx, dy);
        if (distance > radius) continue;
        const candidate = distance + Math.hypot(t.x - x, t.y - y) * 0.025;
        if (candidate < score) {
          score = candidate;
          best = t.index;
        }
      }
      return best;
    };

    const materialFor = (system: string) => {
      const m = new T.MeshStandardMaterial({
        color: SYSTEMS.find((s) => s.id === system)?.color ?? '#aebbb8',
        metalness: 0.08,
        roughness: 0.53,
        side: T.DoubleSide,
        transparent: system === 'integumentary',
        opacity: system === 'integumentary' ? 0.1 : 1,
        depthWrite: system !== 'integumentary',
      });
      m.onBeforeCompile = (shader) => {
        shader.uniforms.partState = { value: partTexture };
        shader.uniforms.selectionState = { value: selectionTexture };
        shader.uniforms.stateWidth = { value: width };
        shader.vertexShader =
          'attribute float partIndex; uniform sampler2D partState; uniform sampler2D selectionState; uniform float stateWidth; varying float partVisible; varying float partSelected; varying float partLoad;\n' +
          shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5); vec4 state = texture2D(partState, stateUv); transformed += state.xyz; partVisible = state.w; vec4 training = texture2D(selectionState, stateUv); partSelected = training.r; partLoad = training.g;'
        );
        shader.fragmentShader = 'varying float partVisible; varying float partSelected; varying float partLoad;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <clipping_planes_fragment>',
          '#include <clipping_planes_fragment>\nif (partVisible < 0.5) discard;'
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <color_fragment>',
          '#include <color_fragment>\nvec3 trainingColor = mix(vec3(0.93, 0.65, 0.22), vec3(0.88, 0.16, 0.20), partLoad); diffuseColor.rgb = mix(diffuseColor.rgb, trainingColor, step(0.001, partLoad) * (0.3 + partLoad * 0.55)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.98, 0.91, 0.69), partSelected * 0.75);'
        );
      };
      materials.push(m);
      return m;
    };

    const mats = new Map(SYSTEMS.map((s) => [s.id, materialFor(s.id)]));
    const chunkMeshes: { mesh: T.Mesh; indices: number[] }[] = [];
    const builtSystems = new Set<string>();
    let loading = false;
    const partIndex = new Map(atlas.parts.map((part, index) => [part.id, index]));
    const partsByChunk = atlas.chunks.map((_, chunk) => atlas.parts.filter((part) => part.chunk === chunk));
    const requestedSystems = () => new Set(requestedAtlasParts(atlas, latest.current).map((part) => part.system));
    const loadRequested = async () => {
      if (loading || disposed || failed) return;
      loading = true;
      ready = false;
      try {
        let systems = requestedSystems();
        let pending = atlas.chunks.map((_, index) => index).filter((index) =>
          partsByChunk[index].some((part) => systems.has(part.system) && !builtSystems.has(index + ':' + part.system)));
        while (pending.length && !disposed) {
          let cursor = 0;
          let completed = 0;
          const total = pending.length;
          callbacks.current.onProgress(0);
          await Promise.all(Array.from({ length: Math.min(2, total) }, async () => {
            while (cursor < pending.length && !disposed) {
              const ci = pending[cursor++];
              const buffer = await loadModelChunk(atlas.chunks[ci], abort.signal);
              const buildSystems = requestedSystems();
              const groups = new Map<string, T.BufferGeometry[]>();
              const groupIndices = new Map<string, number[]>();
              let batchStarted = performance.now();
              for (const part of partsByChunk[ci]) {
                if (disposed) return;
                if (!buildSystems.has(part.system) || builtSystems.has(ci + ':' + part.system)) continue;
                validatePartBuffer(part, buffer);
                const i = partIndex.get(part.id)!;
                const geometry = new T.BufferGeometry();
                geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(buffer, part.positions, part.vertexCount * 3), 3));
                geometry.setAttribute('normal', new T.BufferAttribute(new Int16Array(buffer, part.normals, part.vertexCount * 3), 3, true));
                geometry.setIndex(new T.BufferAttribute(new Uint32Array(buffer, part.indices, part.indexCount), 1));
                geometry.boundingBox = bounds[i].clone();
                geometry.boundingSphere = bounds[i].getBoundingSphere(new T.Sphere());
                const picker = new T.Mesh(geometry, mats.get(part.system as never));
                picker.matrixAutoUpdate = false;
                pickers[i] = picker;
                geometries.push(geometry);
                geometry.setAttribute('partIndex', new T.BufferAttribute(new Float32Array(part.vertexCount).fill(i), 1));
                const list = groups.get(part.system) ?? [];
                list.push(geometry);
                groups.set(part.system, list);
                const indices = groupIndices.get(part.system) ?? [];
                indices.push(i);
                groupIndices.set(part.system, indices);
                if (performance.now() - batchStarted > 8) {
                  await yieldToBrowser(abort.signal);
                  batchStarted = performance.now();
                }
              }
              for (const [system, gs] of groups) {
                if (disposed) return;
                const geometry = mergeGeometries(gs, false);
                if (!geometry) throw new Error('Could not assemble the training anatomy.');
                // The merged GPU buffer owns partIndex; CPU picking does not need it.
                gs.forEach((part) => part.deleteAttribute('partIndex'));
                geometries.push(geometry);
                const mesh = new T.Mesh(geometry, mats.get(system as never));
                mesh.frustumCulled = false;
                mesh.visible = false;
                scene.add(mesh);
                chunkMeshes.push({ mesh, indices: groupIndices.get(system)! });
                builtSystems.add(ci + ':' + system);
                await yieldToBrowser(abort.signal);
              }
              lastState = null;
              dirty = true;
              invalidate();
              completed++;
              callbacks.current.onProgress(Math.round((completed / total) * 99));
            }
          }));
          systems = requestedSystems();
          pending = atlas.chunks.map((_, index) => index).filter((index) =>
            partsByChunk[index].some((part) => systems.has(part.system) && !builtSystems.has(index + ':' + part.system)));
        }
        if (!disposed) {
          ready = true;
          callbacks.current.onProgress(100);
          dirty = true;
          invalidate();
        }
      } catch (error) {
        if (!disposed && !abort.signal.aborted) {
          failed = true;
          abort.abort();
          callbacks.current.onError(error instanceof Error ? error.message : 'Could not load the training anatomy.');
        }
      } finally {
        loading = false;
      }
    };

    const fit = (view: string, extent = 0) => {
      const aspect = Math.max(0.25, camera.aspect);
      const normalDistance = (Math.max(1.85, 0.8 / aspect) / (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)))) * 1.14;
      const atlasDistance = (Math.max(packingHeight, packingWidth / aspect) / (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)))) * 1.1;
      const distance = T.MathUtils.lerp(normalDistance, Math.max(0.2, atlasDistance), extent);
      if (extent > 0.8) view = 'front';
      const direction =
        view === 'front'
          ? new T.Vector3(0, 0.02, 1)
          : view === 'back'
          ? new T.Vector3(0, 0.02, -1)
          : view === 'side'
          ? new T.Vector3(1, 0.02, 0)
          : new T.Vector3(0.35, 0.06, 1).normalize();
      controls.target.set(0, 0.85, 0);
      camera.position.copy(controls.target).addScaledVector(direction, distance);
      controls.update();
      dirty = true;
    };

    const resize = () => {
      layoutKey = '';
      lastState = null;
      if (el.clientWidth < 1 || el.clientHeight < 1) return;
      renderer.setPixelRatio(anatomyPixelRatio(window.devicePixelRatio, el.clientWidth < 768 || el.clientHeight < 600));
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
      fit(latest.current.view, amount);
      invalidate();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);

    const raycaster = new T.Raycaster();
    const pointer = new T.Vector2();
    const tap = new PointerTap();
    const worldBox = new T.Box3();
    const hitPoint = new T.Vector3();

    const down = (e: PointerEvent) => {
      hover.hidden = true;
      tap.down(e.pointerId, e.clientX, e.clientY, e.pointerType === 'touch' ? 12 : 5);
    };

    const move = (e: PointerEvent) => {
      tap.move(e.pointerId, e.clientX, e.clientY);
      if (e.buttons || amount < 0.5 || e.pointerType === 'touch') {
        hover.hidden = true;
        return;
      }
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const index = findTarget(x, y, 12);
      hover.hidden = index < 0;
      renderer.domElement.style.cursor = index < 0 ? 'grab' : 'pointer';
      if (index >= 0) {
        hover.textContent = atlas.parts[index].name;
        hover.style.left = `${Math.max(8, Math.min(x + 14, el.clientWidth - 260))}px`;
        hover.style.top = `${Math.max(8, Math.min(y + 18, el.clientHeight - 55))}px`;
      }
    };

    const cancel = (e: PointerEvent) => tap.cancel(e.pointerId);

    const up = (e: PointerEvent) => {
      const validTap = tap.up(e.pointerId, e.clientX, e.clientY);
      if (!validTap || !ready) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      let nearest = Infinity;
      let found = -1;
      const hasSolid = atlas.parts.some((p, i) => p.system !== 'integumentary' && data[i * 4 + 3] > 0.5);

      const candidates: { mesh: T.Mesh; index: number; distance: number }[] = [];
      pickers.forEach((mesh, i) => {
        if (!mesh || data[i * 4 + 3] < 0.5 || (hasSolid && atlas.parts[i].system === 'integumentary')) return;
        worldBox.copy(bounds[i]).translate(mesh.position);
        if (!raycaster.ray.intersectBox(worldBox, hitPoint)) return;
        candidates.push({ mesh, index: i, distance: worldBox.containsPoint(raycaster.ray.origin) ? 0 : raycaster.ray.origin.distanceTo(hitPoint) });
      });
      // Once a closer triangle is found, farther bounding boxes cannot win.
      // This avoids raycasting every back-facing muscle under a foreground tap.
      candidates.sort((a, b) => a.distance - b.distance);
      for (const candidate of candidates) {
        if (candidate.distance > nearest) break;
        const hits = raycaster.intersectObject(candidate.mesh, false);
        if (hits[0] && hits[0].distance < nearest) {
          nearest = hits[0].distance;
          found = candidate.index;
        }
      }

      if (found < 0 && amount > 0.45) found = findTarget(e.clientX - rect.left, e.clientY - rect.top, e.pointerType === 'touch' ? 24 : 16);
      if (found >= 0) {
        hover.hidden = true;
        select.current(atlas.parts[found].id);
      }
    };

    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('pointercancel', cancel);

    let lastTime = 0;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let lastExtent = -1;

    const animate = (time: number) => {
      if (disposed || paused || failed) return false;
      const dt = Math.min(lastTime ? (time - lastTime) / 1000 : 1 / 60, 0.05);
      lastTime = time;
      const s = latest.current;
      const changed = lastState?.visible !== s.visible || lastState?.selected !== s.selected || lastState?.isolate !== s.isolate;
      if (changed) void loadRequested();
      const loadsChanged = lastLoads !== loads.current;
      if (loadsChanged) {
        groupLoads = new Map();
        for (const [name, load] of Object.entries(loads.current)) {
          if (!Number.isFinite(load)) continue;
          const group = normalizeMuscleNameFor3D(name).toLowerCase();
          groupLoads.set(group, Math.max(groupLoads.get(group) ?? 0, Math.min(1, Math.max(0, load))));
        }
      }
      const moving = Math.abs(amount - s.explode) > 0.0001;
      if (moving) {
        amount = motionPreference.matches ? s.explode : T.MathUtils.damp(amount, s.explode, 8, dt);
        if (Math.abs(amount - s.explode) <= 0.0001) amount = s.explode;
        dirty = true;
      }
      if (changed || moving || loadsChanged || lastExtent < 0) {
        const visible = new Set(s.visible);
        const selection = new Set(s.selected);
        const visibleParts = atlas.parts.filter((p) =>
          s.isolate ? selection.has(p.id) : visible.has(p.system) || selection.has(p.id)
        );
        const nextLayoutKey = visibleParts.map((p) => p.id).join(',') + ':' + camera.aspect.toFixed(3);
        if (nextLayoutKey !== layoutKey) {
          const layout = createExplosionLayout(visibleParts, camera.aspect);
          packingWidth = layout.width;
          packingHeight = layout.height;
          atlas.parts.forEach((p, i) => {
            const cell = layout.cells.get(p.id);
            offsets[i] = cell ? new T.Vector3(cell.x, cell.y + 0.85, 0) : centers[i].clone();
          });
          layoutKey = nextLayoutKey;
          if (amount > 0.05 && !s.isolate) fit(s.view, Math.max(0, (amount - 0.3) / 0.7));
        }

        atlas.parts.forEach((p, i) => {
          const c = centers[i];
          const destination = offsets[i];
          let dx = 0;
          let dy = 0;
          let dz = 0;
          if (amount <= 0.45) {
            const t = amount / 0.45;
            const group = SYSTEMS.findIndex((sys) => sys.id === p.system);
            const angle = (group / SYSTEMS.length) * Math.PI * 2;
            dx = Math.sin(angle) * t * 0.48;
            dy = (c.y - 0.85) * t * 0.28;
            dz = Math.cos(angle) * t * 0.48;
          } else {
            const t = (amount - 0.45) / 0.55;
            const group = SYSTEMS.findIndex((sys) => sys.id === p.system);
            const angle = (group / SYSTEMS.length) * Math.PI * 2;
            dx = T.MathUtils.lerp(Math.sin(angle) * 0.48, destination.x - c.x, t);
            dy = T.MathUtils.lerp((c.y - 0.85) * 0.28, destination.y - c.y, t);
            dz = T.MathUtils.lerp(Math.cos(angle) * 0.48, -c.z, t);
          }
          const selected = selection.has(p.id);
          data.set([dx, dy, dz, (s.isolate ? selected : visible.has(p.system) || selected) ? 1 : 0], i * 4);
          selectedData[i * 4] = selected ? 255 : 0;
          const score = p.system === 'muscular' ? groupLoads.get(muscleGroups[i]) ?? 0 : 0;
          selectedData[i * 4 + 1] = Math.round(score * 255);
          markerPositions.set(data[i * 4 + 3] > 0.5 ? [c.x + dx, c.y + dy, c.z + dz] : [10000, 10000, 10000], i * 3);
          const mesh = pickers[i];
          if (mesh) {
            mesh.position.set(dx, dy, dz);
            mesh.updateMatrix();
            mesh.updateMatrixWorld(true);
          }
        });
        partTexture.needsUpdate = true;
        selectionTexture.needsUpdate = true;
        markerGeometry.attributes.position.needsUpdate = true;
        chunkMeshes.forEach(({ mesh, indices }) => { mesh.visible = indices.some((i) => data[i * 4 + 3] > 0.5); });
        lastState = s;
        lastLoads = loads.current;
        lastExtent = amount;
        dirty = true;
      }
      if (s.view !== lastView || s.reset !== lastReset) {
        fit(s.view, amount);
        lastView = s.view;
        lastReset = s.reset;
      }
      if (moving && !s.isolate) fit(amount > 0.5 ? 'front' : s.view, Math.max(0, (amount - 0.3) / 0.7));
      const isolateKey = s.isolate ? s.selected.join(',') + ':' + s.reset + ':' + s.view + ':' + camera.aspect : '';
      if (isolateKey !== lastIsolate || (s.isolate && moving)) {
        if (s.isolate) {
          const box = new T.Box3();
          atlas.parts.forEach((p, i) => {
            if (s.selected.includes(p.id)) box.union(bounds[i].clone().translate(new T.Vector3(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])));
          });
          if (!box.isEmpty()) {
            const center = box.getCenter(new T.Vector3());
            const size = box.getSize(new T.Vector3());
            camera.clearViewOffset();
            const distance = Math.max(0.07,
              (Math.max(size.y, size.x / Math.max(0.25, camera.aspect), size.z) /
              (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)))) * 1.3);
            controls.maxDistance = Math.max(40, distance * 2);
            controls.target.copy(center);
            const direction = s.view === 'back' ? new T.Vector3(0, 0, -1) :
              s.view === 'side' ? new T.Vector3(1, 0, 0) :
              s.view === 'front' ? new T.Vector3(0, 0, 1) : new T.Vector3(0.2, 0.1, 1).normalize();
            camera.position.copy(center).addScaledVector(direction, distance);
            controls.update();
            dirty = true;
          }
        } else if (lastIsolate) {
          camera.clearViewOffset();
          fit(s.view, amount);
        }
        lastIsolate = isolateKey;
      }
      controls.enableRotate = amount < 0.8;
      controls.mouseButtons.LEFT = amount < 0.8 ? T.MOUSE.ROTATE : T.MOUSE.PAN;
      controls.touches.ONE = amount < 0.8 ? T.TOUCH.ROTATE : T.TOUCH.PAN;
      ground.visible = platform.visible = ring.visible = innerRing.visible = amount < 0.5 && !s.isolate;
      markers.visible = amount > 0.75;
      controls.autoRotate = s.rotate && !motionPreference.matches && !s.isolate && amount < 0.4;
      controls.enableDamping = !motionPreference.matches;
      controls.autoRotateSpeed = 0.65;
      const cameraMoving = controls.update(dt);
      if (controls.autoRotate) dirty = true;
      if (dirty) {
        renderer.render(scene, camera);
        el.dataset.renderFrames = String(Number(el.dataset.renderFrames ?? 0) + 1);
        el.dataset.renderTriangles = String(renderer.info.render.triangles);
        el.dataset.drawCalls = String(renderer.info.render.calls);
        targets = [];
        if (amount > 0.45) {
          const hasSolid = atlas.parts.some((p, i) => p.system !== 'integumentary' && data[i * 4 + 3] > 0.5);
          atlas.parts.forEach((p, i) => {
            if (data[i * 4 + 3] < 0.5 || (hasSolid && p.system === 'integumentary')) return;
            let left = Infinity;
            let right = -Infinity;
            let top = Infinity;
            let bottom = -Infinity;
            for (let corner = 0; corner < 8; corner++) {
              projected
                .set(
                  p.bounds[corner & 1 ? 1 : 0][0] + data[i * 4],
                  p.bounds[corner & 2 ? 1 : 0][1] + data[i * 4 + 1],
                  p.bounds[corner & 4 ? 1 : 0][2] + data[i * 4 + 2]
                )
                .project(camera);
              const x = ((projected.x + 1) * el.clientWidth) / 2;
              const y = ((1 - projected.y) * el.clientHeight) / 2;
              left = Math.min(left, x);
              right = Math.max(right, x);
              top = Math.min(top, y);
              bottom = Math.max(bottom, y);
            }
            projected.copy(centers[i]).add(new T.Vector3(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])).project(camera);
            if (projected.z < -1 || projected.z > 1) return;
            targets.push({ index: i, x: ((projected.x + 1) * el.clientWidth) / 2, y: ((1 - projected.y) * el.clientHeight) / 2, left, right, top, bottom });
          });
        }
        dirty = false;
      }
      return moving || cameraMoving || controls.autoRotate;
    };
    const loop = createDemandRenderLoop((time) => {
      try { return animate(time); }
      catch {
        failed = true;
        abort.abort();
        callbacks.current.onError('The 3D view could not continue on this device. Use the 2D muscle view or reopen the viewer.');
        return false;
      }
    });
    invalidate = loop.invalidate;
    wake.current = () => { dirty = true; invalidate(); };
    const visibilityChanged = () => {
      paused = document.hidden;
      lastTime = 0;
      loop.pause(paused);
    };
    const motionChanged = () => { dirty = true; invalidate(); };
    document.addEventListener('visibilitychange', visibilityChanged);
    motionPreference.addEventListener('change', motionChanged);
    resize();
    loop.pause(paused);
    invalidate();

    const contextLost = (e: Event) => {
      e.preventDefault();
      failed = true;
      abort.abort();
      loop.pause(true);
      callbacks.current.onError('The device paused the 3D view. Use the 2D muscle view or reopen the viewer.');
    };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);

    return () => {
      disposed = true;
      abort.abort();
      wake.current = null;
      loop.dispose();
      document.removeEventListener('visibilitychange', visibilityChanged);
      motionPreference.removeEventListener('change', motionChanged);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('pointercancel', cancel);
      observer.disconnect();
      controls.removeEventListener('change', controlChanged);
      controls.removeEventListener('start', controlChanged);
      controls.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      scene.traverse((o) => {
        if (o instanceof T.Mesh && !geometries.includes(o.geometry)) {
          o.geometry.dispose();
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach((m) => m.dispose());
        }
      });
      partTexture.dispose();
      selectionTexture.dispose();
      markerGeometry.dispose();
      markerMaterial.dispose();
      hover.remove();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [atlas, isDark]);

  return <div className="scene" ref={host} />;
}
