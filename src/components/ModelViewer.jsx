import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ModelViewer({ geometry, controls }) {
  const containerRef = useRef(null);
  const compassNeedleRef = useRef(null);
  const compassHeadingRef = useRef(null);

  useEffect(() => {
    if (!geometry || !containerRef.current) return undefined;

    const container = containerRef.current;
    container.innerHTML = '';
    const width = container.clientWidth || 700;
    const height = 420;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x091120);
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x63708c, 1.1));
    const sun = new THREE.DirectionalLight(0xfff3d1, 1.4);
    sun.position.set(14, 20, 10);
    scene.add(sun);

    const shell = geometry.plan.outerWalls[0];
    const scale = geometry.plan.scale * 8;
    const modelWidth = shell.w * scale;
    const modelDepth = shell.h * scale;
    const sceneSpan = Math.max(modelWidth, modelDepth);
    const floorHeight = 3;
    scene.add(new THREE.GridHelper(Math.max(18, sceneSpan * 2.4), 24, 0x28365f, 0x1b2946));
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(modelWidth, 0.25, modelDepth),
      new THREE.MeshLambertMaterial({ color: 0x1b2946, wireframe: Boolean(controls.wireframe) }),
    );
    slab.position.set(0, -0.1, 0);
    slab.visible = controls.slab;
    scene.add(slab);

    const wallGroup = new THREE.Group();
    geometry.walls.forEach((wall, index) => {
      const dx = (wall.x2 - wall.x1) * scale;
      const dz = (wall.y2 - wall.y1) * scale;
      const length = Math.sqrt(dx * dx + dz * dz);
      if (length < 0.05) return;
      const thickness = wall.type === 'load-bearing' ? 0.32 : 0.16;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(length, floorHeight, thickness),
        new THREE.MeshLambertMaterial({
          color: wall.type === 'load-bearing' ? 0xff7a59 : 0x4be9d4,
          wireframe: Boolean(controls.wireframe),
          transparent: true,
          opacity: controls.walls ? 0.92 : 0.12,
        }),
      );
      const cx = ((wall.x1 + wall.x2) / 2 - shell.x - shell.w / 2) * scale;
      const cz = ((wall.y1 + wall.y2) / 2 - shell.y - shell.h / 2) * scale;
      mesh.position.set(cx, floorHeight / 2 + (controls.explode ? index * 0.02 : 0), cz);
      mesh.rotation.y = -Math.atan2(dz, dx);
      wallGroup.add(mesh);
    });
    scene.add(wallGroup);

    const openingGroup = new THREE.Group();
    geometry.openings.forEach((opening) => {
      const localX = (opening.x - shell.x - shell.w / 2) * scale;
      const localZ = (opening.y - shell.y - shell.h / 2) * scale;
      const width3d = Math.max(0.8, opening.width * 0.75);

      if (opening.type.includes('door')) {
        const door = new THREE.Mesh(
          new THREE.BoxGeometry(opening.hostOrientation === 'horizontal' ? width3d : 0.12, 2.2, opening.hostOrientation === 'vertical' ? width3d : 0.12),
          new THREE.MeshLambertMaterial({ color: 0xf6c85f, transparent: true, opacity: 0.95 }),
        );
        door.position.set(localX, 1.1, localZ);
        openingGroup.add(door);
        return;
      }

      const windowPanel = new THREE.Mesh(
        new THREE.BoxGeometry(opening.hostOrientation === 'horizontal' ? width3d : 0.08, 1.15, opening.hostOrientation === 'vertical' ? width3d : 0.08),
        new THREE.MeshLambertMaterial({ color: 0x7ce8ff, transparent: true, opacity: 0.75 }),
      );
      windowPanel.position.set(localX, 1.75, localZ);
      openingGroup.add(windowPanel);
    });
    scene.add(openingGroup);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(modelWidth, 0.18, modelDepth),
      new THREE.MeshLambertMaterial({ color: 0xd8ff52, transparent: true, opacity: 0.25, wireframe: Boolean(controls.wireframe) }),
    );
    roof.position.set(0, floorHeight + 0.18, 0);
    roof.visible = controls.roof;
    scene.add(roof);

    let theta = 0.55;
    let phi = 1.05;
    let radius = Math.max(8, sceneSpan * 1.45);
    let dragging = false;
    let prevX = 0;
    let prevY = 0;
    let touchId = null;

    const syncCamera = () => {
      camera.position.set(
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.cos(theta),
      );
      camera.lookAt(0, 1.5, 0);

      const heading = theta * (180 / Math.PI);
      const normalizedHeading = ((heading % 360) + 360) % 360;
      if (compassNeedleRef.current) {
        compassNeedleRef.current.style.transform = `translate(-50%, -100%) rotate(${normalizedHeading}deg)`;
      }
      if (compassHeadingRef.current) {
        compassHeadingRef.current.textContent = `${Math.round(normalizedHeading)}°`;
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
      theta -= (event.clientX - prevX) * 0.01;
      phi = Math.max(0.3, Math.min(1.4, phi + (event.clientY - prevY) * 0.01));
      prevX = event.clientX;
      prevY = event.clientY;
      syncCamera();
    };
    const onMouseUp = () => {
      dragging = false;
    };
    const onWheel = (event) => {
      radius = Math.max(sceneSpan * 0.55, Math.min(sceneSpan * 3.5, radius + event.deltaY * 0.03));
      syncCamera();
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
      theta -= (touch.clientX - prevX) * 0.01;
      phi = Math.max(0.3, Math.min(1.45, phi + (touch.clientY - prevY) * 0.01));
      prevX = touch.clientX;
      prevY = touch.clientY;
      syncCamera();
      event.preventDefault();
    };
    const onTouchEnd = (event) => {
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === touchId);
      if (!touch) return;
      dragging = false;
      touchId = null;
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel);
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    renderer.domElement.addEventListener('touchend', onTouchEnd);

    let frameId;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (controls.autoRotate && !dragging) {
        theta += 0.008;
        syncCamera();
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchmove', onTouchMove);
      renderer.domElement.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('mouseup', onMouseUp);
      renderer.dispose();
      scene.clear();
    };
  }, [geometry, controls]);

  return (
    <div className="relative">
      <div ref={containerRef} className="h-[420px] w-full overflow-hidden rounded-3xl border border-white/10 bg-ink" />
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
      <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-white/10 bg-ink/80 px-3 py-1 text-xs text-fog backdrop-blur">
        Drag or swipe for 360 degree orbit
      </div>
    </div>
  );
}
