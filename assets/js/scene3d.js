// ============================================================================
// PTT PANAMÁ — Interactive 3D Isthmus of Panama WebGL Engine (Three.js r170)
// Features:
//  - Procedural stylized 3D topography of the Isthmus of Panama (Pacific + Caribbean)
//  - Animated dual-ocean custom GLSL shader (turqoise Caribbean + deep Pacific)
//  - Luminous Panama Canal waterway + golden Panama City skyline spires + San Blas islets
//  - 7 Interactive 3D Destination Beacons with pulsing sonar rings & hover raycasting
//  - Animated 3D curved flight/tour route arc from Tocumen Airport (PTY) / City
//  - Smooth spherical camera orbiting, zoom, fly-to easing & 3 atmosphere presets
//  - IntersectionObserver auto-pause + capped pixelRatio for silky 60fps performance
// ============================================================================

import * as THREE from '../vendor/three.module.min.js';
import { EXPERIENCES } from './data.js';

const ATMOSPHERES = {
  day: {
    bgTop: 0x0b3b64,
    bgBottom: 0x051c33,
    fogColor: 0x093358,
    sunColor: 0xfff4d9,
    sunIntensity: 1.85,
    sunPos: new THREE.Vector3(8, 12, 6),
    hemiSky: 0x7dd3fc,
    hemiGround: 0x0a2e38,
    hemiIntensity: 1.05,
    waterCaribbean: new THREE.Color('#00b4c6'),
    waterPacific: new THREE.Color('#023e7d'),
    waterDeep: new THREE.Color('#021830'),
    specular: new THREE.Color('#fff7d6'),
    starOpacity: 0.08,
    skylineEmissive: 0.45,
  },
  sunset: {
    bgTop: 0x09162e,
    bgBottom: 0x1e2140,
    fogColor: 0x0c1a33,
    sunColor: 0xffb35c,
    sunIntensity: 2.15,
    sunPos: new THREE.Vector3(-10, 5.5, 8),
    hemiSky: 0xffc478,
    hemiGround: 0x071d36,
    hemiIntensity: 0.85,
    waterCaribbean: new THREE.Color('#009fb7'),
    waterPacific: new THREE.Color('#082a54'),
    waterDeep: new THREE.Color('#030f22'),
    specular: new THREE.Color('#ffbe6b'),
    starOpacity: 0.42,
    skylineEmissive: 1.15,
  },
  night: {
    bgTop: 0x020814,
    bgBottom: 0x051326,
    fogColor: 0x030c1c,
    sunColor: 0x67e8f9,
    sunIntensity: 1.05,
    sunPos: new THREE.Vector3(6, 9, -7),
    hemiSky: 0x1e40af,
    hemiGround: 0x020a18,
    hemiIntensity: 0.6,
    waterCaribbean: new THREE.Color('#005f73'),
    waterPacific: new THREE.Color('#04152e'),
    waterDeep: new THREE.Color('#010712'),
    specular: new THREE.Color('#38bdf8'),
    starOpacity: 0.95,
    skylineEmissive: 2.1,
  },
};

// Procedural elevation model sculpting the iconic S-curve Isthmus of Panama
function getPanamaElevation(x, z) {
  // Smooth S-curve centerline of the Isthmus from West (x=-5.5) to East (x=+5.5)
  const spineZ =
    0.35 * Math.sin(x * 0.58 + 0.35) -
    0.18 * Math.cos(x * 0.32) +
    (x > 2.2 ? (x - 2.2) * 0.16 : 0);

  // Land width varies: wider in West (Chiriquí/Coclé), narrowest at the Panama Canal (x≈0)
  const canalPinch = 1.0 - 0.36 * Math.exp(-Math.pow((x - 0.05) / 0.85, 2));
  const eastWestFade =
    smoothstep(-5.8, -4.1, x) * (1.0 - smoothstep(4.2, 5.9, x));
  const halfWidth = (1.18 + 0.32 * Math.sin(x * 0.7 + 1.1)) * canalPinch;

  const distFromSpine = Math.abs(z - spineZ);
  let landMask = Math.max(0, 1.0 - Math.pow(distFromSpine / Math.max(0.25, halfWidth), 2.05));
  landMask *= eastWestFade;

  // Base coastal rise + organic mountain noise
  const ridge =
    0.42 * Math.sin(x * 1.45 + z * 1.1) * Math.cos(x * 0.65 - z * 1.3) +
    0.22 * Math.sin(x * 2.9 - z * 2.4) +
    0.11 * Math.cos(x * 4.8 + z * 3.9);

  let h = landMask * (0.58 + Math.max(0, ridge) * 0.72);

  // Western highlands & El Valle de Antón volcanic caldera (around x=-2.65, z=0.35)
  const dValle = Math.hypot(x - -2.65, z - 0.35);
  const valleRing = Math.exp(-Math.pow((dValle - 0.42) / 0.28, 2)) * 0.88;
  const vallePeak = Math.exp(-Math.pow(dValle / 0.85, 2)) * 0.52;
  const valleCraterDip = Math.exp(-Math.pow(dValle / 0.24, 2)) * 0.26;
  h += (vallePeak + valleRing - valleCraterDip) * eastWestFade;

  // Far western Cordillera (Boquete / Volcán Barú silhouette in distance)
  const dWest = Math.hypot(x - -4.3, z - 0.15);
  h += Math.exp(-Math.pow(dWest / 0.85, 2)) * 0.92;

  // Gatun Lake basin (x≈-0.25, z≈-0.18) — serene inland turquoise depression
  const dGatun = Math.hypot((x - -0.25) * 1.15, (z - -0.15) * 1.35);
  if (dGatun < 0.75) {
    const lakeFactor = Math.exp(-Math.pow(dGatun / 0.42, 2));
    h = h * (1.0 - lakeFactor * 0.82) + 0.03 * lakeFactor;
  }

  // Panama Canal cut slicing cleanly from Caribbean (z<0) to Pacific (z>0) near x≈0.02
  const canalCurveX = 0.05 + 0.18 * Math.sin(z * 1.35);
  const dCanal = Math.abs(x - canalCurveX);
  if (z > -1.35 && z < 1.15) {
    const canalCut = Math.exp(-Math.pow(dCanal / 0.13, 2));
    h = h * (1.0 - canalCut * 0.92);
  }

  // Azuero-like southern peninsula hint in southwest (x≈-2.1, z≈1.2)
  const dAzuero = Math.hypot((x - -2.2) * 0.9, (z - 1.25) * 1.15);
  h += Math.exp(-Math.pow(dAzuero / 0.78, 2)) * 0.46;

  // Panama City & Amador Causeway coastal prominence (x≈0.55, z≈0.65)
  const dCity = Math.hypot((x - 0.6) * 1.2, (z - 0.62) * 1.3);
  h += Math.exp(-Math.pow(dCity / 0.55, 2)) * 0.22;

  // San Blas archipelago coral islets in Caribbean northeast (x≈2.5..4.1, z≈-0.9..-1.4)
  const islets = [
    [2.65, -0.98, 0.22, 0.2],
    [3.15, -1.05, 0.26, 0.24],
    [3.65, -0.92, 0.21, 0.18],
    [3.38, -1.38, 0.18, 0.16],
    [2.92, -1.32, 0.16, 0.14],
    [3.98, -1.16, 0.2, 0.17],
  ];
  for (const [ix, iz, r, ih] of islets) {
    const di = Math.hypot(x - ix, z - iz);
    h += Math.exp(-Math.pow(di / r, 2)) * ih;
  }

  // Pearl Islands subtle islets in Pacific bay (x≈1.9, z≈1.85)
  const dPearl = Math.hypot(x - 1.95, z - 1.82);
  h += Math.exp(-Math.pow(dPearl / 0.26, 2)) * 0.24;

  // Submerge gently below sea level for coastal reef depth
  return h - 0.08;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export class Panama3DScene {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.activeId = 'city-tour';
    this.hoveredId = null;
    this.highlightedIds = new Set(EXPERIENCES.map((e) => e.id));
    this.atmosphere = 'sunset';
    this.autoRotate = true;
    this.isVisible = true;
    this.disposed = false;
    this.webglSupported = true;

    // Spherical camera state (current + smooth lerp target)
    this.camCurrent = { theta: 0.12, phi: 0.95, radius: 10.2, lookX: 0.3, lookY: 0.15, lookZ: 0.1 };
    this.camTarget = { ...this.camCurrent };
    this.isDragging = false;
    this.pointerMoved = false;
    this.lastPointer = { x: 0, y: 0 };
    this.pointerNDC = new THREE.Vector2(-99, -99);

    this.beacons = new Map();
    this.beaconHitMeshes = [];
    this.clock = new THREE.Clock();

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 1000;
    const height = this.container.clientHeight || 620;

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      this.webglSupported = false;
      this.renderFallback();
      return;
    }

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(ATMOSPHERES.sunset.fogColor, 0.042);

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 80);
    this.raycaster = new THREE.Raycaster();

    this.setupLights();
    this.buildStarfield();
    this.buildTerrain();
    this.buildOcean();
    this.buildPanamaCanalRibbon();
    this.buildSkyline();
    this.buildBeacons();
    this.buildRouteArc();
    this.applyAtmosphere(this.atmosphere);

    this.bindEvents();
    this.setupVisibilityObserver();
    this.updateCameraPosition(true);
    this.animate();
  }

  renderFallback() {
    this.container.innerHTML = `
      <div class="scene-fallback">
        <img src="assets/img/city-panama.jpg" alt="Panamá" />
      </div>
    `;
  }

  setupLights() {
    this.hemiLight = new THREE.HemisphereLight(0xffc478, 0x071d36, 0.85);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffb35c, 2.1);
    this.sunLight.position.set(-10, 5.5, 8);
    this.scene.add(this.sunLight);

    this.rimLight = new THREE.DirectionalLight(0x00c9a7, 0.85);
    this.rimLight.position.set(7, 4, -8);
    this.scene.add(this.rimLight);

    this.canalGlowLight = new THREE.PointLight(0x00e5c3, 1.2, 6);
    this.canalGlowLight.position.set(0.15, 0.8, 0.25);
    this.scene.add(this.canalGlowLight);
  }

  buildStarfield() {
    const count = 420;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 18 + Math.random() * 18;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.48;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) + 1.5;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xe2f1ff,
      size: 0.11,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.stars = new THREE.Points(geo, this.starMat);
    this.scene.add(this.stars);
  }

  buildTerrain() {
    const geo = new THREE.PlaneGeometry(14.5, 9.2, 165, 110);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    const cDeepReef = new THREE.Color('#04395e');
    const cShallowTurq = new THREE.Color('#00c9a7');
    const cSand = new THREE.Color('#e2c992');
    const cJungleLow = new THREE.Color('#136f4a');
    const cJungleHigh = new THREE.Color('#238c55');
    const cVolcanicPeak = new THREE.Color('#3b6e5c');
    const cSnowMist = new THREE.Color('#9ec5b6');
    const tmpColor = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = getPanamaElevation(x, z);
      pos.setY(i, h);

      if (h < -0.02) {
        tmpColor.copy(cDeepReef).lerp(cShallowTurq, smoothstep(-0.08, -0.01, h));
      } else if (h < 0.055) {
        tmpColor.copy(cShallowTurq).lerp(cSand, smoothstep(-0.02, 0.055, h));
      } else if (h < 0.24) {
        tmpColor.copy(cSand).lerp(cJungleLow, smoothstep(0.055, 0.22, h));
      } else if (h < 0.62) {
        tmpColor.copy(cJungleLow).lerp(cJungleHigh, smoothstep(0.24, 0.62, h));
      } else if (h < 0.95) {
        tmpColor.copy(cJungleHigh).lerp(cVolcanicPeak, smoothstep(0.62, 0.95, h));
      } else {
        tmpColor.copy(cVolcanicPeak).lerp(cSnowMist, smoothstep(0.95, 1.35, h));
      }

      // Extra vibrant coral-sand tint around San Blas islets
      if (x > 2.3 && z < -0.65 && h > -0.05 && h < 0.14) {
        tmpColor.lerp(new THREE.Color('#f7e8c3'), 0.45);
      }

      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.78,
      metalness: 0.06,
      flatShading: false,
    });

    this.terrainMesh = new THREE.Mesh(geo, mat);
    this.scene.add(this.terrainMesh);

    // Subtle glowing topographic wireframe contours hovering slightly above terrain
    const wireGeo = geo.clone();
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x38f2d1,
      wireframe: true,
      transparent: true,
      opacity: 0.045,
      depthWrite: false,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    wireMesh.position.y = 0.012;
    this.scene.add(wireMesh);
  }

  buildOcean() {
    const geo = new THREE.PlaneGeometry(42, 32, 96, 72);
    geo.rotateX(-Math.PI / 2);

    this.oceanUniforms = {
      uTime: { value: 0 },
      uCaribbean: { value: ATMOSPHERES.sunset.waterCaribbean.clone() },
      uPacific: { value: ATMOSPHERES.sunset.waterPacific.clone() },
      uDeep: { value: ATMOSPHERES.sunset.waterDeep.clone() },
      uSpecular: { value: ATMOSPHERES.sunset.specular.clone() },
      uSunDir: { value: ATMOSPHERES.sunset.sunPos.clone().normalize() },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.oceanUniforms,
      transparent: true,
      vertexShader: `
        uniform float uTime;
        varying vec3 vWorldPos;
        varying float vWave;
        void main() {
          vec3 p = position;
          float w1 = sin(p.x * 1.15 + uTime * 0.9) * cos(p.z * 0.95 + uTime * 0.65) * 0.025;
          float w2 = sin(p.x * 2.4 - uTime * 1.2 + p.z * 1.8) * 0.012;
          p.y += w1 + w2;
          vWave = w1 + w2;
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uCaribbean;
        uniform vec3 uPacific;
        uniform vec3 uDeep;
        uniform vec3 uSpecular;
        uniform vec3 uSunDir;
        varying vec3 vWorldPos;
        varying float vWave;

        void main() {
          // Smooth gradient between Caribbean (north z < 0) and Pacific (south z > 0)
          float oceanMix = smoothstep(-2.4, 2.4, vWorldPos.z);
          vec3 baseCol = mix(uCaribbean, uPacific, oceanMix);

          // Radial fade to deep abyssal horizon
          float dist = length(vWorldPos.xz * vec2(0.07, 0.1));
          vec3 col = mix(baseCol, uDeep, clamp(dist, 0.0, 0.92));

          // Animated shimmer waves & subtle nautical grid
          float shimmer = pow(max(0.0, sin(vWorldPos.x * 3.2 + uTime * 1.4) * cos(vWorldPos.z * 2.9 - uTime * 1.1)), 5.0);
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float fresnel = pow(1.0 - max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);

          // Sun reflection glint
          vec3 normalApprox = normalize(vec3(
            sin(vWorldPos.x * 2.2 + uTime) * 0.08,
            1.0,
            cos(vWorldPos.z * 2.0 + uTime * 0.8) * 0.08
          ));
          vec3 halfDir = normalize(uSunDir + viewDir);
          float spec = pow(max(dot(normalApprox, halfDir), 0.0), 48.0) * 0.65;

          // Subtle luxury cartographic latitude/longitude lines
          float gridX = smoothstep(0.975, 1.0, abs(cos(vWorldPos.x * 1.57)));
          float gridZ = smoothstep(0.975, 1.0, abs(cos(vWorldPos.z * 1.57)));
          float grid = max(gridX, gridZ) * 0.09 * (1.0 - clamp(dist, 0.0, 1.0));

          col += uSpecular * (spec + shimmer * 0.12 + fresnel * 0.14);
          col += vec3(0.35, 0.95, 0.88) * grid;
          col += vec3(0.04, 0.12, 0.14) * (vWave * 14.0);

          gl_FragColor = vec4(col, 0.88);
        }
      `,
    });

    this.oceanMesh = new THREE.Mesh(geo, mat);
    this.oceanMesh.position.y = 0.015;
    this.scene.add(this.oceanMesh);
  }

  buildPanamaCanalRibbon() {
    const pts = [];
    for (let i = 0; i <= 28; i++) {
      const t = i / 28;
      const z = -1.35 + t * 2.55;
      const x = 0.05 + 0.18 * Math.sin(z * 1.35);
      pts.push(new THREE.Vector3(x, 0.045, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tubeGeo = new THREE.TubeGeometry(curve, 48, 0.036, 8, false);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: 0x2ef2d6,
      transparent: true,
      opacity: 0.78,
    });
    const canalMesh = new THREE.Mesh(tubeGeo, tubeMat);
    this.scene.add(canalMesh);

    // Animated tiny golden vessel dot transiting the Panama Canal
    const shipGeo = new THREE.SphereGeometry(0.055, 12, 12);
    const shipMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    this.canalShip = new THREE.Mesh(shipGeo, shipMat);
    this.canalCurve = curve;
    this.scene.add(this.canalShip);
  }

  buildSkyline() {
    // Stylized miniature Panama City skyline glowing towers near (0.55, 0.62)
    this.skylineGroup = new THREE.Group();
    const towers = [
      [0.48, 0.66, 0.05, 0.24],
      [0.56, 0.62, 0.055, 0.34], // F&F Tower ("El Tornillo")
      [0.64, 0.64, 0.05, 0.28],
      [0.72, 0.58, 0.045, 0.22],
      [0.42, 0.72, 0.04, 0.16],
      [0.6, 0.71, 0.042, 0.19],
    ];

    this.skylineMat = new THREE.MeshStandardMaterial({
      color: 0xf8e3b0,
      emissive: 0xffb74d,
      emissiveIntensity: 1.1,
      roughness: 0.25,
      metalness: 0.75,
    });

    towers.forEach(([x, z, w, h], idx) => {
      const baseY = Math.max(0.05, getPanamaElevation(x, z));
      const geo =
        idx === 1
          ? new THREE.CylinderGeometry(w * 0.55, w * 0.75, h, 6)
          : new THREE.BoxGeometry(w, h, w);
      const mesh = new THREE.Mesh(geo, this.skylineMat);
      mesh.position.set(x, baseY + h * 0.5, z);
      if (idx === 1) mesh.rotation.y = Math.PI / 5;
      this.skylineGroup.add(mesh);
    });

    this.scene.add(this.skylineGroup);
  }

  buildBeacons() {
    EXPERIENCES.forEach((exp) => {
      const { x, z } = exp.coords3D;
      const groundY = Math.max(0.04, getPanamaElevation(x, z));
      const group = new THREE.Group();
      group.position.set(x, groundY, z);

      const isAccentGold = exp.bestseller;
      const primaryHex = isAccentGold ? 0xf5bd4f : 0x00e5c3;

      // Vertical light beam pillar
      const pillarGeo = new THREE.CylinderGeometry(0.012, 0.022, 0.52, 8);
      const pillarMat = new THREE.MeshBasicMaterial({
        color: primaryHex,
        transparent: true,
        opacity: 0.65,
      });
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.y = 0.26;
      group.add(pillar);

      // Floating diamond crystal marker
      const gemGeo = new THREE.OctahedronGeometry(0.115, 0);
      const gemMat = new THREE.MeshStandardMaterial({
        color: primaryHex,
        emissive: primaryHex,
        emissiveIntensity: 0.85,
        roughness: 0.15,
        metalness: 0.5,
      });
      const gem = new THREE.Mesh(gemGeo, gemMat);
      gem.position.y = 0.6;
      group.add(gem);

      // Pulsing sonar ground ring
      const ringGeo = new THREE.RingGeometry(0.12, 0.175, 32);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: primaryHex,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.03;
      group.add(ring);

      // Generous invisible hitbox sphere for effortless mouse/touch selection
      const hitGeo = new THREE.SphereGeometry(0.32, 10, 10);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.y = 0.45;
      hitMesh.userData.expId = exp.id;
      group.add(hitMesh);

      this.scene.add(group);
      this.beaconHitMeshes.push(hitMesh);
      this.beacons.set(exp.id, {
        exp,
        group,
        pillar,
        pillarMat,
        gem,
        gemMat,
        ring,
        ringMat,
        baseColor: new THREE.Color(primaryHex),
        phase: Math.random() * Math.PI * 2,
      });
    });
  }

  buildRouteArc() {
    this.routeGroup = new THREE.Group();
    this.scene.add(this.routeGroup);

    const pulseGeo = new THREE.SphereGeometry(0.06, 12, 12);
    const pulseMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.routePulse = new THREE.Mesh(pulseGeo, pulseMat);
    this.routeGroup.add(this.routePulse);

    this.updateRouteArc(this.activeId);
  }

  updateRouteArc(targetId) {
    if (this.routeLine) {
      this.routeGroup.remove(this.routeLine);
      this.routeLine.geometry.dispose();
      this.routeLine.material.dispose();
      this.routeLine = null;
    }

    const target = this.beacons.get(targetId);
    const hub = this.beacons.get(targetId === 'vip-transfers' ? 'city-tour' : 'vip-transfers');
    if (!target || !hub) return;

    const p0 = hub.group.position.clone().add(new THREE.Vector3(0, 0.35, 0));
    const p2 = target.group.position.clone().add(new THREE.Vector3(0, 0.35, 0));
    const mid = p0.clone().lerp(p2, 0.5);
    const dist = p0.distanceTo(p2);
    mid.y += Math.max(0.65, dist * 0.34);

    this.routeCurve = new THREE.QuadraticBezierCurve3(p0, mid, p2);
    const geo = new THREE.TubeGeometry(this.routeCurve, 44, 0.022, 8, false);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xf7c95c,
      transparent: true,
      opacity: 0.85,
    });
    this.routeLine = new THREE.Mesh(geo, mat);
    this.routeGroup.add(this.routeLine);
  }

  applyAtmosphere(mode) {
    if (!ATMOSPHERES[mode] || !this.webglSupported) return;
    this.atmosphere = mode;
    const cfg = ATMOSPHERES[mode];

    this.scene.fog.color.setHex(cfg.fogColor);
    this.sunLight.color.setHex(cfg.sunColor);
    this.sunLight.intensity = cfg.sunIntensity;
    this.sunLight.position.copy(cfg.sunPos);

    this.hemiLight.color.setHex(cfg.hemiSky);
    this.hemiLight.groundColor.setHex(cfg.hemiGround);
    this.hemiLight.intensity = cfg.hemiIntensity;

    this.oceanUniforms.uCaribbean.value.copy(cfg.waterCaribbean);
    this.oceanUniforms.uPacific.value.copy(cfg.waterPacific);
    this.oceanUniforms.uDeep.value.copy(cfg.waterDeep);
    this.oceanUniforms.uSpecular.value.copy(cfg.specular);
    this.oceanUniforms.uSunDir.value.copy(cfg.sunPos).normalize();

    this.starMat.opacity = cfg.starOpacity;
    this.skylineMat.emissiveIntensity = cfg.skylineEmissive;

    // Sync hero container atmospheric CSS gradient
    this.container.dataset.atmosphere = mode;
  }

  setAutoRotate(enabled) {
    this.autoRotate = Boolean(enabled);
  }

  resetView() {
    this.camTarget = { theta: 0.12, phi: 0.95, radius: 10.2, lookX: 0.3, lookY: 0.15, lookZ: 0.1 };
  }

  focusExperience(expId, flyCamera = true) {
    const beacon = this.beacons.get(expId);
    if (!beacon) return;
    this.activeId = expId;
    this.updateRouteArc(expId);

    if (flyCamera) {
      const { x, z } = beacon.exp.coords3D;
      const off = beacon.exp.cameraOffset;
      this.camTarget = {
        theta: off.theta,
        phi: off.phi,
        radius: off.radius,
        lookX: x * 0.72,
        lookY: 0.25,
        lookZ: z * 0.72,
      };
    }

    if (this.callbacks.onSelect) {
      this.callbacks.onSelect(expId);
    }
  }

  setHighlightedExperiences(idsArray) {
    this.highlightedIds = new Set(idsArray);
  }

  bindEvents() {
    const dom = this.renderer.domElement;

    const onPointerDown = (e) => {
      this.isDragging = true;
      this.pointerMoved = false;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      dom.style.cursor = 'grabbing';
    };

    const onPointerMove = (e) => {
      const rect = dom.getBoundingClientRect();
      this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (this.isDragging) {
        const dx = e.clientX - this.lastPointer.x;
        const dy = e.clientY - this.lastPointer.y;
        if (Math.hypot(dx, dy) > 3) this.pointerMoved = true;

        this.camTarget.theta -= dx * 0.0065;
        this.camTarget.phi = Math.max(0.45, Math.min(1.28, this.camTarget.phi - dy * 0.0055));
        this.lastPointer = { x: e.clientX, y: e.clientY };
        return;
      }

      // Raycast beacons on hover
      this.raycaster.setFromCamera(this.pointerNDC, this.camera);
      const hits = this.raycaster.intersectObjects(this.beaconHitMeshes, false);
      const hitId = hits.length > 0 ? hits[0].object.userData.expId : null;

      if (hitId !== this.hoveredId) {
        this.hoveredId = hitId;
        dom.style.cursor = hitId ? 'pointer' : 'grab';
        if (this.callbacks.onHover) {
          this.callbacks.onHover(hitId);
        }
      }
    };

    const onPointerUp = () => {
      const wasClick = this.isDragging && !this.pointerMoved;
      this.isDragging = false;
      dom.style.cursor = this.hoveredId ? 'pointer' : 'grab';

      if (wasClick) {
        this.raycaster.setFromCamera(this.pointerNDC, this.camera);
        const hits = this.raycaster.intersectObjects(this.beaconHitMeshes, false);
        if (hits.length > 0) {
          const id = hits[0].object.userData.expId;
          this.focusExperience(id, true);
        }
      }
    };

    const onWheel = (e) => {
      // Only zoom when user holds Ctrl or interacts directly over canvas without blocking page scroll
      if (!e.ctrlKey && Math.abs(e.deltaY) < 4) return;
      if (e.ctrlKey) {
        e.preventDefault();
        this.camTarget.radius = Math.max(4.8, Math.min(13.5, this.camTarget.radius + e.deltaY * 0.01));
      }
    };

    dom.style.cursor = 'grab';
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    this.resizeObserver = new ResizeObserver(() => {
      if (this.disposed) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (!w || !h) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
    this.resizeObserver.observe(this.container);
  }

  setupVisibilityObserver() {
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        this.isVisible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.05 }
    );
    this.intersectionObserver.observe(this.container);
  }

  zoom(delta) {
    this.camTarget.radius = Math.max(4.6, Math.min(13.5, this.camTarget.radius + delta));
  }

  updateCameraPosition(instant = false) {
    const ease = instant ? 1 : 0.065;
    this.camCurrent.theta += (this.camTarget.theta - this.camCurrent.theta) * ease;
    this.camCurrent.phi += (this.camTarget.phi - this.camCurrent.phi) * ease;
    this.camCurrent.radius += (this.camTarget.radius - this.camCurrent.radius) * ease;
    this.camCurrent.lookX += (this.camTarget.lookX - this.camCurrent.lookX) * ease;
    this.camCurrent.lookY += (this.camTarget.lookY - this.camCurrent.lookY) * ease;
    this.camCurrent.lookZ += (this.camTarget.lookZ - this.camCurrent.lookZ) * ease;

    const { theta, phi, radius, lookX, lookY, lookZ } = this.camCurrent;
    const x = lookX + radius * Math.sin(phi) * Math.sin(theta);
    const y = lookY + radius * Math.cos(phi);
    const z = lookZ + radius * Math.sin(phi) * Math.cos(theta);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(lookX, lookY, lookZ);
  }

  projectToScreen(worldPos) {
    const v = worldPos.clone().project(this.camera);
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    return {
      x: (v.x * 0.5 + 0.5) * w,
      y: (-v.y * 0.5 + 0.5) * h,
      visible: v.z < 1 && v.x > -1.05 && v.x < 1.05 && v.y > -1.05 && v.y < 1.05,
    };
  }

  animate() {
    if (this.disposed) return;
    requestAnimationFrame(() => this.animate());

    // Auto-pause rendering when scrolled out of viewport (massive battery & FPS win)
    if (!this.isVisible || document.hidden) return;

    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.getElapsedTime();

    if (this.autoRotate && !this.isDragging) {
      this.camTarget.theta += dt * 0.085;
    }

    this.updateCameraPosition(false);

    // Update ocean waves
    this.oceanUniforms.uTime.value = elapsed;

    // Move tiny vessel along the Panama Canal
    if (this.canalShip && this.canalCurve) {
      const t = (elapsed * 0.055) % 1;
      const p = this.canalCurve.getPointAt(t);
      this.canalShip.position.copy(p).add(new THREE.Vector3(0, 0.04, 0));
    }

    // Move route arc pulse dot
    if (this.routePulse && this.routeCurve) {
      const t = (elapsed * 0.35) % 1;
      this.routePulse.position.copy(this.routeCurve.getPointAt(t));
    }

    // Animate 3D destination beacons
    const screenCoords = {};
    this.beacons.forEach((b, id) => {
      const isSelected = id === this.activeId;
      const isHovered = id === this.hoveredId;
      const isMatch = this.highlightedIds.has(id);

      const scaleTarget = isSelected ? 1.42 : isHovered ? 1.25 : isMatch ? 1.0 : 0.65;
      b.gem.scale.lerp(new THREE.Vector3(scaleTarget, scaleTarget, scaleTarget), 0.12);
      b.gem.rotation.y = elapsed * (isSelected ? 2.1 : 1.1) + b.phase;
      b.gem.position.y = 0.58 + Math.sin(elapsed * 2.4 + b.phase) * 0.07;

      const pulse = (elapsed * 0.9 + b.phase) % 1;
      const ringScale = 0.75 + pulse * (isSelected ? 2.1 : 1.35);
      b.ring.scale.set(ringScale, ringScale, 1);
      b.ringMat.opacity = (1 - pulse) * (isMatch ? (isSelected ? 0.95 : 0.65) : 0.18);

      b.gemMat.emissiveIntensity = isSelected ? 1.85 : isHovered ? 1.45 : isMatch ? 0.8 : 0.2;
      b.pillarMat.opacity = isSelected ? 0.95 : isMatch ? 0.6 : 0.16;

      if (isSelected) {
        b.gemMat.color.setHex(0xffd166);
        b.gemMat.emissive.setHex(0xffb703);
      } else {
        b.gemMat.color.copy(b.baseColor);
        b.gemMat.emissive.copy(b.baseColor);
      }

      const labelPos = b.group.position.clone().add(new THREE.Vector3(0, 0.9, 0));
      screenCoords[id] = this.projectToScreen(labelPos);
    });

    // Project geographic water labels
    const geoLabels = {
      caribbean: this.projectToScreen(new THREE.Vector3(-0.9, 0.1, -2.5)),
      pacific: this.projectToScreen(new THREE.Vector3(0.4, 0.1, 2.75)),
      canal: this.projectToScreen(new THREE.Vector3(0.08, 0.25, -0.55)),
    };

    if (this.callbacks.onFrameLabels) {
      this.callbacks.onFrameLabels(screenCoords, geoLabels);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
