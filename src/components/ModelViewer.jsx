import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const FLOOR_HEIGHT = 3;
const VIEWER_HEIGHT = 420;

export default function ModelViewer({ geometry, controls }) {
  const containerRef = useRef(null);
  const compassNeedleRef = useRef(null);
  const compassHeadingRef = useRef(null);
  const [renderError, setRenderError] = useState('');

  const shells = geometry?.plan?.outerWalls ?? [];
  const walls = geometry?.walls ?? [];
  const openings = geometry?.openings ?? [];
  const hasGeometry = shells.length > 0 && walls.length > 0;

  const openingSummary = useMemo(() => {
    const doors = openings.filter((opening) => opening.type?.includes('door')).length;
    const windows = openings.filter((opening) => opening.type === 'window').length;
    return { doors, windows };
  }, [openings]);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const container = containerRef.current;
    container.replaceChildren();
    setRenderError('');

    if (!hasGeometry) {
      return undefined;
    }

    let renderer;
    let frameId = 0;
    let dragging = false;
    let prevX = 0;
    let prevY = 0;
    let touchId = null;
    const cleanupFns = [];

    try {
      const width = container.clientWidth || 700;
      const height = VIEWER_HEIGHT;
      const bounds = getPlanBounds(shells);
      if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.maxX)) {
        throw new Error('Invalid plan bounds for 3D model.');
      }

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x091120);
      scene.fog = new THREE.Fog(0x091120, 26, 64);

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      container.appendChild(renderer.domElement);

      const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 240);

      const ambient = new THREE.HemisphereLight(0xa7d8ff, 0x091120, 1.35);
      scene.add(ambient);

      const keyLight = new THREE.DirectionalLight(0xfff1d6, 1.75);
      keyLight.position.set(14, 18, 10);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 70;
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(0x6dc8ff, 0.65);
      rimLight.position.set(-10, 8, -16);
      scene.add(rimLight);

      const scale = (geometry?.plan?.scale ?? 1) * 8;
      const modelWidth = Math.max(1, (bounds.maxX - bounds.minX) * scale);
      const modelDepth = Math.max(1, (bounds.maxY - bounds.minY) * scale);
      const sceneSpan = Math.max(modelWidth, modelDepth, 6);
      const planCenterX = (bounds.minX + bounds.maxX) / 2;
      const planCenterY = (bounds.minY + bounds.maxY) / 2;

      const grid = new THREE.GridHelper(Math.max(22, sceneSpan * 2.6), 24, 0x2c3a62, 0x17223d);
      grid.position.y = -0.08;
      scene.add(grid);

      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(Math.max(18, sceneSpan * 1.5), 64),
        new THREE.MeshStandardMaterial({ color: 0x0d172c, roughness: 0.96, metalness: 0.05 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.1;
      ground.receiveShadow = true;
      scene.add(ground);

      const slabGroup = new THREE.Group();
      shells.forEach((shell) => {
        const slab = new THREE.Mesh(
          new THREE.BoxGeometry(Math.max(shell.w * scale, 0.2), 0.28, Math.max(shell.h * scale, 0.2)),
          new THREE.MeshStandardMaterial({
            color: 0x162747,
            roughness: 0.82,
            metalness: 0.08,
            wireframe: Boolean(controls.wireframe),
          }),
        );
        slab.position.set(
          (shell.x + shell.w / 2 - planCenterX) * scale,
          -0.12,
          (shell.y + shell.h / 2 - planCenterY) * scale,
        );
        slab.receiveShadow = true;
        slab.visible = controls.slab;
        slabGroup.add(slab);
      });
      scene.add(slabGroup);

      const roofGroup = new THREE.Group();
      shells.forEach((shell) => {
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(Math.max(shell.w * scale, 0.2), 0.18, Math.max(shell.h * scale, 0.2)),
          new THREE.MeshStandardMaterial({
            color: 0xd8ff52,
            transparent: true,
            opacity: 0.2,
            roughness: 0.4,
            metalness: 0.18,
            wireframe: Boolean(controls.wireframe),
          }),
        );
        roof.position.set(
          (shell.x + shell.w / 2 - planCenterX) * scale,
          FLOOR_HEIGHT + 0.18,
          (shell.y + shell.h / 2 - planCenterY) * scale,
        );
        roof.visible = controls.roof;
        roofGroup.add(roof);
      });
      scene.add(roofGroup);

      const wallGroup = new THREE.Group();
      walls.forEach((wall, index) => {
        const dx = (wall.x2 - wall.x1) * scale;
        const dz = (wall.y2 - wall.y1) * scale;
        const length = Math.hypot(dx, dz);
        if (length < 0.05) return;

        const thickness = Math.max(0.14, wall.thickness ?? (wall.type === 'load-bearing' ? 0.32 : 0.16));
        const baseOpacity = controls.walls ? (wall.type === 'load-bearing' ? 0.96 : 0.88) : 0.12;
        const cx = ((wall.x1 + wall.x2) / 2 - planCenterX) * scale;
        const cz = ((wall.y1 + wall.y2) / 2 - planCenterY) * scale;
        const rotationY = -Math.atan2(dz, dx);
        const explodedOffset = controls.explode ? index * 0.02 : 0;

        if (controls.cutaway) {
          const lowerHeight = wall.type === 'load-bearing' ? 1.55 : 1.35;
          const upperHeight = Math.max(0.65, FLOOR_HEIGHT - lowerHeight);

          const lowerMesh = new THREE.Mesh(
            new THREE.BoxGeometry(length, lowerHeight, thickness),
            new THREE.MeshStandardMaterial({
              color: wall.type === 'load-bearing' ? 0xf98363 : 0x41d6cc,
              wireframe: Boolean(controls.wireframe),
              roughness: 0.75,
              metalness: 0.05,
              transparent: true,
              opacity: baseOpacity,
            }),
          );
          lowerMesh.position.set(cx, lowerHeight / 2 + explodedOffset, cz);
          lowerMesh.rotation.y = rotationY;
          lowerMesh.castShadow = true;
          lowerMesh.receiveShadow = true;
          wallGroup.add(lowerMesh);

          const upperMesh = new THREE.Mesh(
            new THREE.BoxGeometry(length, upperHeight, thickness),
            new THREE.MeshStandardMaterial({
              color: wall.type === 'load-bearing' ? 0xffb39c : 0x8ff0e8,
              wireframe: Boolean(controls.wireframe),
              roughness: 0.4,
              metalness: 0.12,
              transparent: true,
              opacity: controls.walls ? 0.18 : 0.06,
            }),
          );
          upperMesh.position.set(cx, lowerHeight + upperHeight / 2 + explodedOffset, cz);
          upperMesh.rotation.y = rotationY;
          wallGroup.add(upperMesh);
          return;
        }

        const wallMesh = new THREE.Mesh(
          new THREE.BoxGeometry(length, FLOOR_HEIGHT, thickness),
          new THREE.MeshStandardMaterial({
            color: wall.type === 'load-bearing' ? 0xff7a59 : 0x4be9d4,
            wireframe: Boolean(controls.wireframe),
            roughness: 0.72,
            metalness: 0.06,
            transparent: true,
            opacity: baseOpacity,
          }),
        );
        wallMesh.position.set(cx, FLOOR_HEIGHT / 2 + explodedOffset, cz);
        wallMesh.rotation.y = rotationY;
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        wallGroup.add(wallMesh);
      });
      scene.add(wallGroup);

      const openingGroup = new THREE.Group();
      if (controls.openings) {
        openings.forEach((opening, index) => {
          const localX = (opening.x - planCenterX) * scale;
          const localZ = (opening.y - planCenterY) * scale;
          const width3d = Math.max(0.95, (opening.width ?? 1) * 0.78);
          const assembly = opening.type?.includes('door')
            ? createDoorAssembly(opening, localX, localZ, width3d, index)
            : createWindowAssembly(opening, localX, localZ, width3d, index);
          openingGroup.add(assembly);
        });
      }
      scene.add(openingGroup);

      let targetTheta = 0.9;
      let targetPhi = 1.12;
      let targetRadius = Math.max(9, sceneSpan * 1.25);
      let theta = targetTheta;
      let phi = targetPhi;
      let radius = targetRadius;
      const focusPoint = new THREE.Vector3(0, controls.cutaway ? 1.15 : 1.55, 0);

      const syncCamera = () => {
        theta += (targetTheta - theta) * 0.11;
        phi += (targetPhi - phi) * 0.11;
        radius += (targetRadius - radius) * 0.11;

        camera.position.set(
          radius * Math.sin(phi) * Math.sin(theta),
          radius * Math.cos(phi) + 1.6,
          radius * Math.sin(phi) * Math.cos(theta),
        );
        camera.lookAt(focusPoint);

        const heading = theta * (180 / Math.PI);
        const normalizedHeading = ((heading % 360) + 360) % 360;
        if (compassNeedleRef.current) {
          compassNeedleRef.current.style.transform = `translate(-50%, -100%) rotate(${normalizedHeading}deg)`;
        }
        if (compassHeadingRef.current) {
          compassHeadingRef.current.textContent = `${Math.round(normalizedHeading)} deg`;
        }
      };
      syncCamera();

      const onMouseDown = (event) => {
        dragging = true;
        prevX = event.clientX;
        prevY = event.clientY;
      };

      const onMouseMove = (event) => {
        if (!dragging) return;
        targetTheta -= (event.clientX - prevX) * 0.01;
        targetPhi = Math.max(0.56, Math.min(1.32, targetPhi + (event.clientY - prevY) * 0.008));
        prevX = event.clientX;
        prevY = event.clientY;
      };

      const onMouseUp = () => {
        dragging = false;
      };

      const onWheel = (event) => {
        targetRadius = Math.max(sceneSpan * 0.7, Math.min(sceneSpan * 3.1, targetRadius + event.deltaY * 0.025));
      };

      const onTouchStart = (event) => {
        const touch = event.changedTouches[0];
        if (!touch) return;
        dragging = true;
        touchId = touch.identifier;
        prevX = touch.clientX;
        prevY = touch.clientY;
      };

      const onTouchMove = (event) => {
        const touch = Array.from(event.changedTouches).find((item) => item.identifier === touchId);
        if (!touch || !dragging) return;
        targetTheta -= (touch.clientX - prevX) * 0.012;
        targetPhi = Math.max(0.56, Math.min(1.35, targetPhi + (touch.clientY - prevY) * 0.009));
        prevX = touch.clientX;
        prevY = touch.clientY;
        event.preventDefault();
      };

      const onTouchEnd = (event) => {
        const touch = Array.from(event.changedTouches).find((item) => item.identifier === touchId);
        if (!touch) return;
        dragging = false;
        touchId = null;
      };

      const onResize = () => {
        const nextWidth = container.clientWidth || 700;
        renderer.setSize(nextWidth, height);
        camera.aspect = nextWidth / height;
        camera.updateProjectionMatrix();
      };

      const addListener = (target, eventName, handler, options) => {
        target.addEventListener(eventName, handler, options);
        cleanupFns.push(() => target.removeEventListener(eventName, handler, options));
      };

      addListener(renderer.domElement, 'mousedown', onMouseDown);
      addListener(renderer.domElement, 'mousemove', onMouseMove);
      addListener(window, 'mouseup', onMouseUp);
      addListener(renderer.domElement, 'wheel', onWheel, { passive: true });
      addListener(renderer.domElement, 'touchstart', onTouchStart, { passive: false });
      addListener(renderer.domElement, 'touchmove', onTouchMove, { passive: false });
      addListener(renderer.domElement, 'touchend', onTouchEnd);
      addListener(window, 'resize', onResize);

      const animate = () => {
        frameId = window.requestAnimationFrame(animate);
        if (controls.autoRotate && !dragging) {
          targetTheta += 0.0045;
        }
        syncCamera();
        renderer.render(scene, camera);
      };
      animate();

      return () => {
        if (frameId) {
          window.cancelAnimationFrame(frameId);
        }
        cleanupFns.forEach((cleanup) => cleanup());
        renderer.dispose();
        scene.clear();
        container.replaceChildren();
      };
    } catch (error) {
      if (renderer) {
        renderer.dispose();
      }
      container.replaceChildren();
      setRenderError('3D preview could not start in this browser right now. The plan data is still available.');
      return undefined;
    }
  }, [controls, geometry, hasGeometry, openings, shells, walls]);

  const showOverlay = renderError || !hasGeometry;
  const overlayTitle = renderError ? '3D Viewer Error' : '3D Preview Ready After Parsing';
  const overlayMessage = renderError
    ? renderError
    : 'Generate or open a parsed plan and the model will render here automatically.';

  return (
    <div className="relative">
      <div ref={containerRef} className="h-[420px] w-full overflow-hidden rounded-3xl border border-white/10 bg-ink" />

      {showOverlay ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="max-w-md rounded-3xl border border-white/10 bg-ink/90 px-6 py-5 text-center shadow-2xl backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-coral">{overlayTitle}</p>
            <p className="mt-3 text-sm leading-6 text-fog">{overlayMessage}</p>
          </div>
        </div>
      ) : null}

      {!showOverlay ? (
        <>
          <div className="pointer-events-none absolute left-4 top-4 flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-ink/80 backdrop-blur">
            <div className="absolute h-20 w-20 rounded-full border border-white/10" />
            <span className="absolute left-1/2 top-1 -translate-x-1/2 text-[11px] font-semibold text-lime">N</span>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-fog">E</span>
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[11px] text-fog">S</span>
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-fog">W</span>
            <div ref={compassNeedleRef} className="absolute left-1/2 top-1/2 h-8 w-[2px] origin-bottom -translate-x-1/2 -translate-y-full bg-gradient-to-t from-coral via-coral to-lime transition-transform duration-150" />
            <div className="absolute left-1/2 top-[18px] h-0 w-0 -translate-x-1/2 border-x-[5px] border-b-[10px] border-x-transparent border-b-lime" />
            <div className="absolute h-3 w-3 rounded-full border border-white/20 bg-white/80" />
            <div ref={compassHeadingRef} className="absolute bottom-5 rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-fog" />
          </div>

          <div className="pointer-events-none absolute left-4 top-[7.5rem] rounded-2xl border border-white/10 bg-ink/78 px-3 py-2 text-xs text-fog backdrop-blur">
            <p className="font-medium text-white">Third-person preview</p>
            <p className="mt-1">Doors: {openingSummary.doors} | Windows: {openingSummary.windows}</p>
            <p className="mt-1">{controls.cutaway ? 'Cutaway upper walls enabled' : 'Full wall mass enabled'}</p>
          </div>

          <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-white/10 bg-ink/80 px-3 py-1 text-xs text-fog backdrop-blur">
            Drag or swipe for third-person orbit
          </div>
        </>
      ) : null}
    </div>
  );
}

function getPlanBounds(shells) {
  return shells.reduce((acc, shell) => ({
    minX: Math.min(acc.minX, shell.x),
    minY: Math.min(acc.minY, shell.y),
    maxX: Math.max(acc.maxX, shell.x + shell.w),
    maxY: Math.max(acc.maxY, shell.y + shell.h),
  }), {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  });
}

function createDoorAssembly(opening, localX, localZ, width3d, index) {
  const group = new THREE.Group();
  const horizontal = opening.hostOrientation === 'horizontal';
  const frameThickness = horizontal ? 0.2 : width3d + 0.18;
  const frameDepth = horizontal ? width3d + 0.18 : 0.2;
  const yBase = 1.1;
  const depthOffset = horizontal ? 0.02 : -0.02;

  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xead8bd, roughness: 0.62, metalness: 0.08 });
  const woodMaterial = new THREE.MeshStandardMaterial({ color: 0xb97744, roughness: 0.72, metalness: 0.05 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xf6c85f, roughness: 0.35, metalness: 0.3, emissive: 0x3f2a00, emissiveIntensity: 0.22 });

  const frameTop = new THREE.Mesh(
    new THREE.BoxGeometry(frameThickness, 0.12, frameDepth),
    frameMaterial,
  );
  frameTop.position.set(0, 1.1, 0);
  group.add(frameTop);

  const jambGeometry = new THREE.BoxGeometry(horizontal ? 0.12 : frameThickness, 2.2, horizontal ? frameDepth : 0.12);
  const leftJamb = new THREE.Mesh(jambGeometry, frameMaterial);
  leftJamb.position.set(horizontal ? -(width3d / 2 + 0.03) : 0, 0, horizontal ? 0 : -(width3d / 2 + 0.03));
  const rightJamb = leftJamb.clone();
  rightJamb.position.set(horizontal ? width3d / 2 + 0.03 : 0, horizontal ? 0 : 0, horizontal ? 0 : width3d / 2 + 0.03);
  group.add(leftJamb);
  group.add(rightJamb);

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(horizontal ? width3d * 0.88 : 0.08, 2.05, horizontal ? 0.08 : width3d * 0.88),
    woodMaterial,
  );
  panel.position.set(horizontal ? width3d * 0.16 : 0, -0.05, horizontal ? depthOffset : width3d * 0.16);
  panel.rotation.y = horizontal ? -0.3 : 0.3;
  panel.castShadow = true;
  group.add(panel);

  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), accentMaterial);
  handle.position.set(horizontal ? width3d * 0.05 : 0, 0.2, horizontal ? 0.1 : width3d * 0.05);
  group.add(handle);

  const threshold = new THREE.Mesh(
    new THREE.BoxGeometry(horizontal ? width3d : 0.2, 0.05, horizontal ? 0.2 : width3d),
    new THREE.MeshStandardMaterial({ color: 0x706f7f, roughness: 0.92 }),
  );
  threshold.position.set(0, -1.05, 0);
  group.add(threshold);

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xd8ff52, emissive: 0xb7ff1a, emissiveIntensity: 0.65 }),
  );
  beacon.position.set(0, 1.55 + (index % 2) * 0.08, 0);
  group.add(beacon);

  group.position.set(localX, yBase, localZ);
  return group;
}

function createWindowAssembly(opening, localX, localZ, width3d, index) {
  const group = new THREE.Group();
  const horizontal = opening.hostOrientation === 'horizontal';
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xd8dee9, roughness: 0.42, metalness: 0.28 });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0x84dcff,
    transparent: true,
    opacity: 0.55,
    roughness: 0.12,
    metalness: 0.18,
  });

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(horizontal ? width3d : 0.16, 1.35, horizontal ? 0.16 : width3d),
    frameMaterial,
  );
  group.add(frame);

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(horizontal ? width3d * 0.84 : 0.07, 1.08, horizontal ? 0.07 : width3d * 0.84),
    glassMaterial,
  );
  glass.position.set(0, 0, 0.01);
  group.add(glass);

  const sill = new THREE.Mesh(
    new THREE.BoxGeometry(horizontal ? width3d + 0.16 : 0.24, 0.08, horizontal ? 0.22 : width3d + 0.16),
    new THREE.MeshStandardMaterial({ color: 0xa7b6d9, roughness: 0.65 }),
  );
  sill.position.set(0, -0.76, 0);
  group.add(sill);

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0x7ce8ff, emissive: 0x1e90ff, emissiveIntensity: 0.55 }),
  );
  beacon.position.set(0, 0.98 + (index % 2) * 0.08, 0);
  group.add(beacon);

  group.position.set(localX, 1.75, localZ);
  return group;
}
