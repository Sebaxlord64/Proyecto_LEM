/**
 * Proyecto LEM - Probador Virtual de Corbatas Neón (3D AR)
 * Integración Three.js (WebGL) + MediaPipe Pose
 * Corrección matemática definitiva: Inclinación garantizada en 0° (sin giro de 180°)
 */

// --- ELEMENTOS DEL DOM ---
const videoElement = document.getElementById('webcam');
const threeCanvas = document.getElementById('three-canvas');
const debugCanvas = document.getElementById('debug-canvas');
const cameraContainer = document.getElementById('camera-container');

// UI y Estados
const loaderScreen = document.getElementById('loader-screen');
const loaderTitle = document.getElementById('loader-title');
const loaderDesc = document.getElementById('loader-desc');
const statusPill = document.getElementById('status-pill');
const statusText = document.getElementById('status-text');
const fpsDisplay = document.getElementById('fps-display');
const guideText = document.getElementById('guide-text');
const detectionGuide = document.getElementById('detection-guide');
const flashEffect = document.getElementById('flash-effect');

// Controles y botones
const btnToggleCam = document.getElementById('btn-toggle-cam');
const btnToggleMirror = document.getElementById('btn-toggle-mirror');
const btnToggleFlip = document.getElementById('btn-toggle-flip');
const btnToggleLandmarks = document.getElementById('btn-toggle-landmarks');
const btnTakePhoto = document.getElementById('btn-take-photo');
const btnResetCalibration = document.getElementById('btn-reset-calibration');

// Sliders y opciones
const sliderGlow = document.getElementById('slider-glow');
const glowVal = document.getElementById('glow-val');
const toggleShirt = document.getElementById('toggle-shirt');
const sliderScale = document.getElementById('slider-scale');
const scaleVal = document.getElementById('scale-val');
const sliderY = document.getElementById('slider-y');
const yVal = document.getElementById('y-val');
const sliderZ = document.getElementById('slider-z');
const zVal = document.getElementById('z-val');

// Modal de foto
const photoModal = document.getElementById('photo-modal');
const photoPreviewImg = document.getElementById('photo-preview-img');
const btnDownloadPhoto = document.getElementById('btn-download-photo');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnDiscardPhoto = document.getElementById('btn-discard-photo');

// Selectores
const colorSwatches = document.querySelectorAll('.color-swatch');
const tieItems = document.querySelectorAll('.tie-item');

// --- VARIABLES DE ESTADO Y THREE.JS ---
let scene, camera, renderer;
let tieAnchorGroup = null; // Grupo pivote anclado al nudo de la corbata
let currentModelInstance = null;
let currentTieBox = null;
let shirtMesh = null;
let currentNeonMaterial = null;

let isCameraRunning = false;
let isMirrorMode = true;
let isFlippedVertical = false; // Orientación natural hacia abajo
let showLandmarks = false;

// Parámetros de personalización
let neonColor = 0x00f0ff;
let neonIntensity = 2.5;
let showShirt = false;

// Calibración de usuario
let userScale = 1.0;
let userOffsetY = 0.0;
let userOffsetZ = 0.0;

// Caché de modelos cargados
const modelCache = {};
let currentModelPath = 'models/corbata_neon1.glb';

// Suavizado anti-temblor (LERP)
const smoothedPose = {
  x: 0,
  y: 0,
  rotZ: 0,
  scale: 1,
  confidence: 0
};

// Rendimiento FPS
let frameCount = 0;
let lastFpsUpdate = performance.now();

// --- 1. INICIALIZACIÓN DE THREE.JS ---
function initThree() {
  scene = new THREE.Scene();

  const width = cameraContainer.clientWidth || 640;
  const height = cameraContainer.clientHeight || 480;

  // Cámara de perspectiva frontal
  camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(0, 0, 3.0);

  renderer = new THREE.WebGLRenderer({
    canvas: threeCanvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;

  // Iluminación
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
  keyLight.position.set(0, 2, 3);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xaaccff, 0.8);
  fillLight.position.set(-2, 0, 2);
  scene.add(fillLight);

  // Luz puntual del neón
  const neonLight = new THREE.PointLight(neonColor, 2.2, 3.5);
  neonLight.name = "neonPointLight";
  neonLight.position.set(0, -0.2, 0.2);
  scene.add(neonLight);

  // Grupo ancla principal (el nudo de la corbata estará en 0, 0, 0 de este grupo)
  tieAnchorGroup = new THREE.Group();
  tieAnchorGroup.visible = false;
  scene.add(tieAnchorGroup);

  window.addEventListener('resize', handleResize);
  handleResize();
}

function handleResize() {
  const width = cameraContainer.clientWidth;
  const height = cameraContainer.clientHeight;
  if (!width || !height) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);

  debugCanvas.width = width;
  debugCanvas.height = height;
}

// --- 2. CARGADOR DE MODELOS 3D CON PIVOTE EN EL NUDO ---
const gltfLoader = new THREE.GLTFLoader();

function applyTieOrientation() {
  if (!currentModelInstance || !currentTieBox) return;

  const knotX = (currentTieBox.min.x + currentTieBox.max.x) / 2;
  const knotZ = (currentTieBox.min.z + currentTieBox.max.z) / 2;

  if (isFlippedVertical) {
    currentModelInstance.scale.y = -1;
    currentModelInstance.position.set(-knotX, currentTieBox.min.y, -knotZ);
  } else {
    // Modo natural: el nudo (max.y) queda en Y = 0 y el cuerpo cae hacia abajo (-Y)
    currentModelInstance.scale.y = 1;
    currentModelInstance.position.set(-knotX, -currentTieBox.max.y, -knotZ);
  }

  tieAnchorGroup.updateMatrixWorld(true);
}

function loadTieModel(path) {
  statusText.textContent = "Cargando corbata 3D...";
  statusPill.className = "status-pill status-loading";

  // Limpiar modelo previo
  while (tieAnchorGroup.children.length > 0) {
    tieAnchorGroup.remove(tieAnchorGroup.children[0]);
  }
  shirtMesh = null;
  currentNeonMaterial = null;
  currentModelInstance = null;
  currentTieBox = null;

  function setupLoadedModel(gltf) {
    const model = gltf.scene.clone(true);
    currentModelInstance = model;

    // 1. Añadir el modelo al grupo pivote
    tieAnchorGroup.add(model);

    // 2. Configurar materiales y visibilidad
    model.traverse((child) => {
      if (child.isMesh) {
        if (child.material) {
          child.material.side = THREE.DoubleSide;
        }

        const name = child.name.toLowerCase();
        
        // Camisa
        if (name.includes('shirt')) {
          shirtMesh = child;
          child.visible = showShirt;
        }

        // Material Neón LED
        if (child.material) {
          const mat = child.material;
          if (mat.name && (mat.name.toLowerCase().includes('led') || mat.name.toLowerCase().includes('neon'))) {
            currentNeonMaterial = mat;
            mat.emissive = new THREE.Color(neonColor);
            mat.emissiveIntensity = neonIntensity;
          }
        }
      }
    });

    // 3. Reset de transformaciones para medir la geometría virgen
    tieAnchorGroup.position.set(0, 0, 0);
    tieAnchorGroup.rotation.set(0, 0, 0);
    tieAnchorGroup.scale.set(1, 1, 1);
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    tieAnchorGroup.updateMatrixWorld(true);

    // 4. Medir la caja delimitadora en espacio del mundo de la corbata
    const tieBox = new THREE.Box3();
    model.traverse((child) => {
      if (child.isMesh) {
        const name = child.name.toLowerCase();
        if (!name.includes('shirt')) {
          tieBox.expandByObject(child);
        }
      }
    });

    if (tieBox.isEmpty()) {
      tieBox.setFromObject(model);
    }
    currentTieBox = tieBox;

    // 5. Fijar el nudo en Y = 0 y dejar caer la corbata hacia el pecho (Y negativo)
    applyTieOrientation();

    applyNeonSettings();

    statusText.textContent = "Probador listo";
    statusPill.className = "status-pill status-ready";
  }

  if (modelCache[path]) {
    setupLoadedModel(modelCache[path]);
    return;
  }

  gltfLoader.load(
    path,
    (gltf) => {
      modelCache[path] = gltf;
      setupLoadedModel(gltf);
    },
    (progress) => {
      if (progress.total > 0) {
        const percent = Math.round((progress.loaded / progress.total) * 100);
        statusText.textContent = `Descargando 3D (${percent}%)...`;
      }
    },
    (error) => {
      console.error("Error al cargar modelo GLB:", error);
      statusText.textContent = "Error al cargar 3D";
      statusPill.className = "status-pill status-error";
    }
  );
}

function applyNeonSettings() {
  if (currentNeonMaterial) {
    currentNeonMaterial.emissive = new THREE.Color(neonColor);
    currentNeonMaterial.emissiveIntensity = neonIntensity;
  }
  const neonLight = scene.getObjectByName("neonPointLight");
  if (neonLight) {
    neonLight.color = new THREE.Color(neonColor);
    neonLight.intensity = neonIntensity * 0.8;
  }
}

// --- 3. SEGUIMIENTO CORPORAL Y SINCRONIZACIÓN (MediaPipe Pose) ---
const pose = new Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  enableSegmentation: false,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

pose.onResults(onPoseResults);

function onPoseResults(results) {
  updateFPS();

  const ctx = debugCanvas.getContext('2d');
  ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);

  if (!results.poseLandmarks) {
    smoothedPose.confidence = Math.max(0, smoothedPose.confidence - 0.1);
    if (smoothedPose.confidence <= 0) {
      tieAnchorGroup.visible = false;
      detectionGuide.classList.remove('detected');
      guideText.textContent = "Buscando persona... Sitúate frente a la cámara";
    }
    renderer.render(scene, camera);
    return;
  }

  const landmarks = results.poseLandmarks;
  // Puntos clave MediaPipe:
  // 11 = Hombro izquierdo
  // 12 = Hombro derecho
  // 0  = Nariz
  const rawLeft = landmarks[11];
  const rawRight = landmarks[12];
  const rawNose = landmarks[0];

  const minVis = Math.min(rawLeft.visibility || 0, rawRight.visibility || 0);
  if (minVis < 0.35) {
    tieAnchorGroup.visible = false;
    detectionGuide.classList.remove('detected');
    guideText.textContent = "Alinea tus hombros frente a la cámara";
    renderer.render(scene, camera);
    return;
  }

  detectionGuide.classList.add('detected');
  guideText.textContent = "Persona detectada - Corbata sincronizada";
  smoothedPose.confidence = 1.0;
  tieAnchorGroup.visible = true;

  // CONVERSIÓN A COORDENADAS DE PANTALLA:
  const toScreen = (pt) => ({
    x: isMirrorMode ? (1.0 - pt.x) : pt.x,
    y: pt.y,
    z: pt.z || 0
  });

  const ptA = toScreen(rawLeft);
  const ptB = toScreen(rawRight);
  const pNose = toScreen(rawNose);

  // 1. DETERMINAR ESTRICTAMENTE CUÁL HOMBRO ESTÁ A LA IZQUIERDA Y CUÁL A LA DERECHA DE LA PANTALLA:
  // Esto garantiza que el vector (dX) siempre apunte de izquierda a derecha (dX > 0),
  // eliminando por completo cualquier rotación de 180° involuntaria.
  const shoulderOnLeft = (ptA.x < ptB.x) ? ptA : ptB;
  const shoulderOnRight = (ptA.x < ptB.x) ? ptB : ptA;

  // 2. Ancla del cuello (entre la barbilla y la línea de hombros)
  const shoulderMidX = (shoulderOnLeft.x + shoulderOnRight.x) / 2;
  const shoulderMidY = (shoulderOnLeft.y + shoulderOnRight.y) / 2;

  const neckScreenX = shoulderMidX;
  // Nudo situado en la base del cuello
  const neckScreenY = (shoulderMidY * 0.70) + (pNose.y * 0.30);

  // 3. Ángulo de inclinación (Roll)
  const dX = shoulderOnRight.x - shoulderOnLeft.x; // SIEMPRE POSITIVO (> 0)
  const dY = shoulderOnRight.y - shoulderOnLeft.y;
  // Cuando estás derecho: dY = 0, dX > 0 => targetAngleZ = 0.00° (VERTICAL)
  const targetAngleZ = Math.atan2(dY, dX);

  // 4. Distancia y Escala:
  const shoulderDistScreen = Math.hypot(dX, dY);

  // Dimensiones del plano visible de la cámara en Z = 0
  const vFOV = THREE.MathUtils.degToRad(camera.fov);
  const planeHeight = 2 * Math.tan(vFOV / 2) * camera.position.z;
  const planeWidth = planeHeight * camera.aspect;

  // Convertir coordenada de pantalla (0 a 1) a espacio del mundo 3D de Three.js
  const targetWorldX = (neckScreenX - 0.5) * planeWidth;
  const targetWorldY = -(neckScreenY - 0.5) * planeHeight;

  // Ancho de hombros en unidades 3D
  const personShoulderWidth3D = shoulderDistScreen * planeWidth;

  // ESCALA REALISTA 2.4X:
  // Escala para que cubra el torso y el collar rodee el cuello naturalmente
  const targetScale = (personShoulderWidth3D / 0.907) * 2.4 * userScale;

  // 5. FILTRO DE SUAVIZADO CINEMÁTICO (Anti-jitter)
  const lerpFactor = 0.40;
  smoothedPose.x += (targetWorldX - smoothedPose.x) * lerpFactor;
  smoothedPose.y += (targetWorldY - smoothedPose.y) * lerpFactor;
  smoothedPose.rotZ += (targetAngleZ - smoothedPose.rotZ) * lerpFactor;
  smoothedPose.scale += (targetScale - smoothedPose.scale) * lerpFactor;

  // Aplicar posición, inclinación y escala a la corbata
  tieAnchorGroup.position.set(
    smoothedPose.x,
    smoothedPose.y + (userOffsetY * 0.02),
    userOffsetZ * 0.02
  );

  // Rotación en Z suave según inclinación del torso
  tieAnchorGroup.rotation.z = -smoothedPose.rotZ;
  tieAnchorGroup.rotation.y = 0;
  tieAnchorGroup.rotation.x = 0;

  tieAnchorGroup.scale.set(smoothedPose.scale, smoothedPose.scale, smoothedPose.scale);

  // Dibujar puntos para modo demostración AR
  if (showLandmarks) {
    drawDebugLandmarks(ctx, shoulderOnLeft, shoulderOnRight, neckScreenX, neckScreenY);
  }

  renderer.render(scene, camera);
}

// Dibujar puntos visuales para exposiciones
function drawDebugLandmarks(ctx, sLeft, sRight, nX, nY) {
  const w = debugCanvas.width;
  const h = debugCanvas.height;

  function drawPoint(normX, normY, color, label) {
    const px = normX * w;
    const py = normY * h;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (label) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(label, px + 8, py - 4);
    }
  }

  // Línea entre hombros
  ctx.beginPath();
  ctx.moveTo(sLeft.x * w, sLeft.y * h);
  ctx.lineTo(sRight.x * w, sRight.y * h);
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
  ctx.lineWidth = 3;
  ctx.stroke();

  drawPoint(sLeft.x, sLeft.y, '#3b82f6', 'Hombro Izq Pantalla');
  drawPoint(sRight.x, sRight.y, '#3b82f6', 'Hombro Der Pantalla');
  drawPoint(nX, nY, '#00f0ff', 'Nudo Corbata');
}

// Contador FPS
function updateFPS() {
  frameCount++;
  const now = performance.now();
  if (now - lastFpsUpdate >= 1000) {
    const fps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
    fpsDisplay.textContent = `${fps} FPS`;
    frameCount = 0;
    lastFpsUpdate = now;
  }
}

// --- 4. CÁMARA Y SERVICIOS ---
let streamObj = null;

async function startCamera() {
  try {
    loaderDesc.textContent = "Conectando cámara web...";
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      },
      audio: false
    });

    videoElement.srcObject = stream;
    streamObj = stream;

    await new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        videoElement.play();
        const vw = videoElement.videoWidth;
        const vh = videoElement.videoHeight;
        if (vw && vh) {
          cameraContainer.style.aspectRatio = `${vw} / ${vh}`;
          handleResize();
        }
        resolve();
      };
    });

    isCameraRunning = true;
    btnToggleCam.classList.add('active');
    btnToggleCam.querySelector('.label').textContent = "Cámara Activa";

    sendFramesToMediaPipe();

    loaderScreen.classList.add('hidden');
    statusText.textContent = "Probador Listo";
    statusPill.className = "status-pill status-ready";
  } catch (err) {
    console.error("No se pudo iniciar la cámara:", err);
    loaderTitle.textContent = "Permiso de Cámara Requerido";
    loaderDesc.textContent = "Por favor permite el acceso a tu cámara web para usar el probador virtual.";
    statusText.textContent = "Sin acceso a cámara";
    statusPill.className = "status-pill status-error";
  }
}

async function sendFramesToMediaPipe() {
  if (!isCameraRunning) return;

  if (videoElement.readyState >= 2) {
    await pose.send({ image: videoElement });
  }
  requestAnimationFrame(sendFramesToMediaPipe);
}

function stopCamera() {
  if (streamObj) {
    streamObj.getTracks().forEach(t => t.stop());
    videoElement.srcObject = null;
    streamObj = null;
  }
  isCameraRunning = false;
  btnToggleCam.classList.remove('active');
  btnToggleCam.querySelector('.label').textContent = "Cámara Pausada";
  tieAnchorGroup.visible = false;
  renderer.render(scene, camera);
}

// --- 5. EVENT LISTENERS Y ACCIONES ---

// Selección de Corbata
tieItems.forEach((item) => {
  item.addEventListener('click', () => {
    tieItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    currentModelPath = item.dataset.path;
    loadTieModel(currentModelPath);
  });
});

// Selector de Color Neón
colorSwatches.forEach((swatch) => {
  swatch.addEventListener('click', () => {
    colorSwatches.forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
    neonColor = parseInt(swatch.dataset.color.replace('#', '0x'), 16);
    applyNeonSettings();
  });
});

// Slider Brillo Neón
sliderGlow.addEventListener('input', (e) => {
  neonIntensity = parseFloat(e.target.value);
  glowVal.textContent = `${neonIntensity.toFixed(1)}x`;
  applyNeonSettings();
});

// Mostrar Camisa 3D
toggleShirt.addEventListener('change', (e) => {
  showShirt = e.target.checked;
  if (shirtMesh) {
    shirtMesh.visible = showShirt;
  }
});

// Sliders de Calibración
sliderScale.addEventListener('input', (e) => {
  userScale = parseFloat(e.target.value);
  scaleVal.textContent = `${Math.round(userScale * 100)}%`;
});

sliderY.addEventListener('input', (e) => {
  userOffsetY = parseFloat(e.target.value);
  yVal.textContent = `${userOffsetY > 0 ? '+' : ''}${userOffsetY} cm`;
});

sliderZ.addEventListener('input', (e) => {
  userOffsetZ = parseFloat(e.target.value);
  zVal.textContent = `${userOffsetZ > 0 ? '+' : ''}${userOffsetZ} cm`;
});

btnResetCalibration.addEventListener('click', () => {
  userScale = 1.0;
  userOffsetY = 0.0;
  userOffsetZ = 0.0;
  sliderScale.value = 1.0;
  sliderY.value = 0.0;
  sliderZ.value = 0.0;
  scaleVal.textContent = "100%";
  yVal.textContent = "0 cm";
  zVal.textContent = "0 cm";
});

// Botones del Visor
btnToggleCam.addEventListener('click', () => {
  if (isCameraRunning) {
    stopCamera();
  } else {
    startCamera();
  }
});

btnToggleMirror.addEventListener('click', () => {
  isMirrorMode = !isMirrorMode;
  if (isMirrorMode) {
    cameraContainer.classList.add('mirror');
    btnToggleMirror.classList.add('active');
  } else {
    cameraContainer.classList.remove('mirror');
    btnToggleMirror.classList.remove('active');
  }
});

// Botón para invertir orientación vertical en vivo
btnToggleFlip.addEventListener('click', () => {
  isFlippedVertical = !isFlippedVertical;
  btnToggleFlip.classList.toggle('active', isFlippedVertical);
  applyTieOrientation();
});

btnToggleLandmarks.addEventListener('click', () => {
  showLandmarks = !showLandmarks;
  debugCanvas.classList.toggle('visible', showLandmarks);
  btnToggleLandmarks.classList.toggle('active', showLandmarks);
});

// --- 6. CAPTURA DE FOTO CON LA CORBATA ---
btnTakePhoto.addEventListener('click', () => {
  if (!isCameraRunning) {
    alert("Inicia la cámara para tomar una foto.");
    return;
  }

  // Efecto Flash
  flashEffect.classList.add('flash-active');
  setTimeout(() => flashEffect.classList.remove('flash-active'), 250);

  // Renderizar escena Three.js
  renderer.render(scene, camera);

  // Crear canvas temporal para la captura HD
  const snapCanvas = document.createElement('canvas');
  snapCanvas.width = videoElement.videoWidth || 1280;
  snapCanvas.height = videoElement.videoHeight || 720;
  const ctx = snapCanvas.getContext('2d');

  // Si está en modo espejo, dibujar el video invertido
  ctx.save();
  if (isMirrorMode) {
    ctx.scale(-1, 1);
    ctx.drawImage(videoElement, -snapCanvas.width, 0, snapCanvas.width, snapCanvas.height);
  } else {
    ctx.drawImage(videoElement, 0, 0, snapCanvas.width, snapCanvas.height);
  }
  ctx.restore();

  // Superponer el canvas 3D directamente
  ctx.drawImage(threeCanvas, 0, 0, snapCanvas.width, snapCanvas.height);

  // Marca de agua sutil
  ctx.font = '600 16px sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText('VirtualTie Neón AR | Proyecto LEM', 24, snapCanvas.height - 24);

  const imgData = snapCanvas.toDataURL('image/png');
  photoPreviewImg.src = imgData;
  btnDownloadPhoto.href = imgData;
  photoModal.classList.add('open');
});

btnCloseModal.addEventListener('click', () => photoModal.classList.remove('open'));
btnDiscardPhoto.addEventListener('click', () => photoModal.classList.remove('open'));

// --- ARRANQUE ---
window.addEventListener('DOMContentLoaded', () => {
  initThree();
  loadTieModel(currentModelPath);
  cameraContainer.classList.add('mirror');
  startCamera();
});
