import {EffectComposer, GLTFLoader, OrbitControls, RenderPass, UnrealBloomPass} from "three/addons";
import * as THREE from "three";

// Variables
const line = document.getElementById("progress-bar-line")
let camera, scene, renderer, composer, group, bloomPass;
let audio, audioContext, analyser, soundDataArray;
const cubes = [];
const params = {threshold: 0, strength: 2, radius: 0, exposure: 1};

init();

async function init() {
  const container = document.getElementById('container');
  // Scene and Camera
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 100);
  camera.position.set(-5, 2.3, -5.5);
  scene.add(camera);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff));
  const pointLight = new THREE.PointLight(0xffffff, 0.1);
  camera.add(pointLight);

  // Renderer
  renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.toneMapping = THREE.ReinhardToneMapping;
  container.appendChild(renderer.domElement);

  // Postprocessing
  const renderScene = new RenderPass(scene, camera);
  bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), params.strength, params.radius, params.threshold);
  composer = new EffectComposer(renderer);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = 5;
  controls.maxDistance = 8;
  controls.maxPolarAngle = Math.PI / 2;

  // Create Group
  group = new THREE.Group();
  scene.add(group);

  // Create Elements
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync('/models/cube.glb');
  const model = gltf.scene;
  createCubeLine({model, radius: 1.6, scaleY: 2.5, count: 24, color: [.8, 0, 1]})
  createCubeLine({model, radius: 1, scaleY: 5, count: 16, color: [0, .1, 1]})
  createCubeLine({model, radius: 2.2, scaleY: 1, count: 32, color: [0, .8, 1]})
  createTorus()

  animate();

  // Resize Event
  window.addEventListener('resize', onWindowResize);
}

function animate() {
  requestAnimationFrame(animate); // next frame init
  if (analyser) {
    line.style.width = 100 / audio.duration * audio.currentTime + '%'
    analyser.getByteFrequencyData(soundDataArray);
    visualizeFrequencyData();
    // Animate Effects
    const thresholdEffectValue = .5 / 200 * (200 - soundDataArray[0])
    bloomPass.radius = thresholdEffectValue < 0 ? 0 : thresholdEffectValue
    bloomPass.strength = 2 + soundDataArray[0] / 300
    group.rotation.y -= 0.001;// Rotate group
  }

  composer.render(); // Render
}

function createCubeLine({model, scaleY, radius, count, color}) {
  for (let i = 0; i < count; i++) {
    // Angel
    const angle = (i / count) * 2 * Math.PI;

    // Calculate position
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);

    // Clone model
    const modelClone = model.clone();
    modelClone.position.set(x, 0, z); // Встановлюємо позицію копії моделі
    modelClone.scale.set(1, scaleY, 1);

    // Change material
    let originalMaterial = modelClone.children[0].children[1].material;
    const newMaterial = originalMaterial.clone();
    newMaterial.emissive.setRGB(...color);
    modelClone.children[0].children[1].material = newMaterial;

    // Add to scene
    group.add(modelClone);
    cubes.push({
      model: modelClone,
      startYScale: scaleY
    })
  }
}

function handleAudioUpload(event) {
  const file = event.target.files[0];
  if (file) {
    initAudio(file);
  }
}

function initAudio(file) {
  if (!audio) {
    document.getElementById("upload-icon").classList.add("upload-icon-active")
    document.getElementById("progress-bar").style.display = "block"
  }

  if (audio) {
    audio.pause();
    audio.src = "";
    audio = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  const audioUrl = URL.createObjectURL(file);
  audio = new Audio(audioUrl);
  audio.crossOrigin = "anonymous";
  audio.volume = 0.1;
  audio.play();

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  const source = audioContext.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(audioContext.destination);

  const bufferLength = analyser.frequencyBinCount;
  soundDataArray = new Uint8Array(bufferLength);
}

function visualizeFrequencyData() {
  // visualize by soundDataArray
  for (let i = 0; i < cubes.length; i++) {
    const frequencyDataValue = soundDataArray[i % soundDataArray.length] / 255;
    cubes[i].model.scale.y = cubes[i].startYScale + frequencyDataValue * 5;
  }
}

function createTorus() {
  const geometry = new THREE.TorusGeometry(2.6, 0.01, 16, 100); // (radius, tube radius, radial segments, tubular segments)
  const material = new THREE.MeshStandardMaterial({
    emissive: new THREE.Color(.2, .3, 1),
    emissiveIntensity: 1,  // Яскравість емісивного кольору
    color: 0x008000
  });
  const torus = new THREE.Mesh(geometry, material);
  torus.rotation.x = Math.PI / 2;
  group.add(torus);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

document.getElementById("audio-upload_input").addEventListener("change", handleAudioUpload);
