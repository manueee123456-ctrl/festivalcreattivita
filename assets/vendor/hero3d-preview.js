import * as THREE from './three.module.min.js';

const host = document.getElementById('heroWebGL');
if (host && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 8.2);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  host.appendChild(renderer.domElement);

  const group = new THREE.Group();
  scene.add(group);

  const mainMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xff5a36, roughness: 0.2, metalness: 0.08,
    clearcoat: 0.9, clearcoatRoughness: 0.16
  });
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.62, 0.48, 220, 32, 2, 3), mainMaterial);
  knot.rotation.set(0.35, -0.35, 0.15);
  group.add(knot);

  const ringMaterial = new THREE.MeshStandardMaterial({ color: 0x15231d, roughness: 0.35, metalness: 0.2 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.62, 0.055, 16, 160), ringMaterial);
  ring.rotation.set(1.05, 0.15, 0.35);
  group.add(ring);

  const accentMaterial = new THREE.MeshPhysicalMaterial({ color: 0xf3d76b, roughness: 0.25, clearcoat: 0.8 });
  const sphere = new THREE.Mesh(new THREE.IcosahedronGeometry(0.48, 3), accentMaterial);
  sphere.position.set(2.25, 1.35, 0.7);
  group.add(sphere);

  const blueMaterial = new THREE.MeshPhysicalMaterial({ color: 0x4f7183, roughness: 0.28, clearcoat: 0.65 });
  const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.15, 8, 20), blueMaterial);
  capsule.position.set(-2.25, -1.45, -0.1);
  capsule.rotation.z = 0.65;
  group.add(capsule);

  scene.add(new THREE.HemisphereLight(0xfff7e8, 0x26352e, 2.15));
  const key = new THREE.DirectionalLight(0xffffff, 4.2); key.position.set(4, 5, 6); scene.add(key);
  const rim = new THREE.PointLight(0xffa06e, 25, 15); rim.position.set(-4, -2, 4); scene.add(rim);

  let pointerX = 0, pointerY = 0, scrollTarget = 0, visible = true;
  window.addEventListener('pointermove', e => {
    pointerX = (e.clientX / innerWidth - 0.5) * 0.75;
    pointerY = (e.clientY / innerHeight - 0.5) * 0.5;
  }, { passive: true });
  window.addEventListener('scroll', () => { scrollTarget = Math.min(1.8, scrollY / Math.max(innerHeight, 1)); }, { passive: true });
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });

  function resize() {
    const rect = host.getBoundingClientRect();
    const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host); resize();

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    if (!visible) return;
    const t = clock.getElapsedTime();
    group.rotation.y += (pointerX + scrollTarget * 0.38 - group.rotation.y) * 0.045;
    group.rotation.x += (-pointerY + scrollTarget * 0.14 - group.rotation.x) * 0.045;
    knot.rotation.z = t * 0.12;
    ring.rotation.z = -t * 0.1;
    sphere.position.y = 1.35 + Math.sin(t * 1.35) * 0.22;
    capsule.position.y = -1.45 + Math.cos(t * 1.1) * 0.17;
    group.position.y = Math.sin(t * 0.7) * 0.1 - scrollTarget * 0.34;
    renderer.render(scene, camera);
  }
  animate();
}

// Scroll choreography: one observer, no geometry reads during scroll.
const targets = document.querySelectorAll('.prenota-step,.sport-card,.day-label,.activity-card,.annunci-card,.sponsor-card,.chisiamo-card');
targets.forEach((el, i) => {
  el.classList.add('v3-reveal');
  el.style.setProperty('--v3-delay', `${Math.min(i % 4, 3) * 65}ms`);
});
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('v3-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
targets.forEach(el => observer.observe(el));
