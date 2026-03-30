import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ThreeStageViewer({ model3d }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    container.replaceChildren();

    if (!model3d?.elements?.length) {
      return undefined;
    }

    const width = container.clientWidth || 600;
    const height = 380;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    scene.fog = new THREE.Fog(0x020617, 18, 60);

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 300);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x111827, 1.25));
    const directional = new THREE.DirectionalLight(0xfff7ed, 1.4);
    directional.position.set(12, 20, 8);
    directional.castShadow = true;
    scene.add(directional);

    const group = new THREE.Group();
    const palette = {
      load_bearing: 0xf59e0b,
      partition: 0x22c55e,
      floor: 0x1d4ed8,
      door: 0x8b5e34,
      window: 0x38bdf8,
    };

    model3d.elements.forEach((element) => {
      const geometry = new THREE.BoxGeometry(...element.dimensions);
      const openingFamily = element.type === 'window' ? 'window' : element.type === 'door' ? 'door' : null;
      const material = new THREE.MeshStandardMaterial({
        color: palette[element.metadata?.wall_type] || palette[openingFamily] || palette[element.type] || 0x94a3b8,
        transparent: element.type === 'floor' || element.type === 'window',
        opacity: element.type === 'floor' ? 0.55 : element.type === 'window' ? 0.45 : 0.94,
        roughness: element.type === 'floor' ? 0.9 : element.type === 'window' ? 0.18 : 0.65,
        metalness: element.type === 'window' ? 0.35 : 0.08,
        emissive: element.type === 'window' ? new THREE.Color(0x082f49) : new THREE.Color(0x000000),
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(element.position[0], element.position[1], element.position[2]);
      mesh.rotation.set(element.rotation[0], element.rotation[1], element.rotation[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      if (element.type === 'window' || element.type === 'door') {
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry),
          new THREE.LineBasicMaterial({ color: element.type === 'window' ? 0xe0f2fe : 0xfde68a, transparent: true, opacity: 0.75 }),
        );
        edges.position.copy(mesh.position);
        edges.rotation.copy(mesh.rotation);
        group.add(edges);
      }
    });

    const rawBox = new THREE.Box3().setFromObject(group);
    const rawCenter = rawBox.getCenter(new THREE.Vector3());
    group.position.x -= rawCenter.x;
    group.position.z -= rawCenter.z;
    group.position.y -= rawBox.min.y;
    scene.add(group);

    const modelBox = new THREE.Box3().setFromObject(group);
    const modelCenter = modelBox.getCenter(new THREE.Vector3());
    const modelSize = modelBox.getSize(new THREE.Vector3());
    const sceneSpan = Math.max(modelSize.x, modelSize.z, 6);
    const focusPoint = new THREE.Vector3(modelCenter.x, modelSize.y * 0.35, modelCenter.z);

    const grid = new THREE.GridHelper(sceneSpan * 2.2, 24, 0x334155, 0x1e293b);
    grid.position.y = -0.02;
    scene.add(grid);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(sceneSpan * 1.25, 48),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.96, metalness: 0.05 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    ground.receiveShadow = true;
    scene.add(ground);

    let frame = 0;
    let dragging = false;
    let prevX = 0;
    let prevY = 0;
    let theta = 0.86;
    let phi = 1.08;
    let radius = Math.max(sceneSpan * 1.35, modelSize.y * 2.6, 10);
    let targetTheta = theta;
    let targetPhi = phi;
    let targetRadius = radius;

    const syncCamera = () => {
      theta += (targetTheta - theta) * 0.12;
      phi += (targetPhi - phi) * 0.12;
      radius += (targetRadius - radius) * 0.12;
      camera.position.set(
        focusPoint.x + radius * Math.sin(phi) * Math.sin(theta),
        focusPoint.y + radius * Math.cos(phi) + modelSize.y * 0.3,
        focusPoint.z + radius * Math.sin(phi) * Math.cos(theta),
      );
      camera.lookAt(focusPoint);
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
      targetPhi = Math.max(0.62, Math.min(1.45, targetPhi + (event.clientY - prevY) * 0.008));
      prevX = event.clientX;
      prevY = event.clientY;
    };

    const onMouseUp = () => {
      dragging = false;
    };

    const onWheel = (event) => {
      targetRadius = Math.max(sceneSpan * 0.8, Math.min(sceneSpan * 3.2, targetRadius + event.deltaY * 0.02));
    };

    const onResize = () => {
      const nextWidth = container.clientWidth || 600;
      renderer.setSize(nextWidth, height);
      camera.aspect = nextWidth / height;
      camera.updateProjectionMatrix();
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onResize);

    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (!dragging) {
        targetTheta += 0.0035;
      }
      syncCamera();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      scene.clear();
      container.replaceChildren();
    };
  }, [model3d]);

  if (!model3d?.elements?.length) {
    return (
      <div className="flex h-[380px] items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-slate-950/70 p-8 text-center text-sm leading-6 text-slate-400">
        Stage 3 uses the geometry contract to emit 3D-ready elements. Run the pipeline to inspect the generated model.
      </div>
    );
  }

  return <div ref={containerRef} className="h-[380px] overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/80" />;
}
