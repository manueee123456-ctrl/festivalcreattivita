import * as THREE from './three.module.min.js';

const host = document.getElementById('v6WebGL');
if (host) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.z = 8.8;
  const renderer = new THREE.WebGLRenderer({ alpha:true, antialias:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.65));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  host.appendChild(renderer.domElement);

  const world = new THREE.Group(); scene.add(world);
  const core = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1.72, .53, 260, 38, 2, 3),
    new THREE.MeshPhysicalMaterial({ color:0xf472b6, roughness:.13, metalness:.08, clearcoat:1, clearcoatRoughness:.09, iridescence:.48, iridescenceIOR:1.6 })
  );
  world.add(core);
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.72,.075,20,190),new THREE.MeshPhysicalMaterial({color:0x60a5fa,roughness:.15,metalness:.35,emissive:0x003c55,emissiveIntensity:.45}));
  ring1.rotation.set(1.08,.18,.4); world.add(ring1);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.25,.045,16,160),new THREE.MeshStandardMaterial({color:0xef4444,roughness:.22,emissive:0x531209,emissiveIntensity:.35}));
  ring2.rotation.set(.35,1.12,-.25); world.add(ring2);
  const orbMat = new THREE.MeshPhysicalMaterial({color:0xc084fc,roughness:.14,clearcoat:1,emissive:0x554000,emissiveIntensity:.22});
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(.52,4),orbMat);orb.position.set(2.35,1.55,.75);world.add(orb);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(.6,2),new THREE.MeshPhysicalMaterial({color:0xa855f7,roughness:.1,clearcoat:1,emissive:0x190061,emissiveIntensity:.4}));gem.position.set(-2.3,-1.55,.55);world.add(gem);
  const satellite = new THREE.Mesh(new THREE.SphereGeometry(.26,24,24),new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.08,clearcoat:1}));satellite.position.set(-2.55,1.25,1);world.add(satellite);

  scene.add(new THREE.HemisphereLight(0xc7dcff,0x2b0648,3.2));
  const key=new THREE.DirectionalLight(0xffffff,6.5);key.position.set(5,6,7);scene.add(key);
  const pink=new THREE.PointLight(0xf472b6,42,16);pink.position.set(-4,-2,5);scene.add(pink);
  const cyan=new THREE.PointLight(0x60a5fa,35,14);cyan.position.set(4,1,3);scene.add(cyan);

  let px=0,py=0,scroll=0,visible=true;
  addEventListener('pointermove',e=>{px=(e.clientX/innerWidth-.5)*1.45;py=(e.clientY/innerHeight-.5)*.95},{passive:true});
  addEventListener('scroll',()=>scroll=Math.min(2,scrollY/innerHeight),{passive:true});
  document.addEventListener('visibilitychange',()=>visible=!document.hidden);
  function resize(){const r=host.getBoundingClientRect();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix()}
  new ResizeObserver(resize).observe(host);resize();
  const clock=new THREE.Clock();
  function loop(){requestAnimationFrame(loop);if(!visible)return;const t=clock.getElapsedTime();world.rotation.y+=(px+scroll*.5-world.rotation.y)*.055;world.rotation.x+=(-py+scroll*.18-world.rotation.x)*.05;core.rotation.z=t*.22;core.rotation.x=Math.sin(t*.55)*.25;ring1.rotation.z=-t*.2;ring2.rotation.y=t*.18;orb.position.y=1.55+Math.sin(t*1.7)*.38;orb.rotation.y=t*.8;gem.position.y=-1.55+Math.cos(t*1.35)*.3;gem.rotation.set(t*.5,t*.7,0);satellite.position.x=Math.cos(t*.85)*2.75;satellite.position.y=Math.sin(t*.85)*1.4;world.position.y=Math.sin(t*.8)*.14-scroll*.42;world.scale.setScalar(1+Math.sin(t*.9)*.025);renderer.render(scene,camera)}loop();
}
