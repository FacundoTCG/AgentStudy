'use strict';

/**
 * engine.js — Three.js r158 rendering engine for "Regni d'Oriente"
 * All geometry is procedural (no external model files).
 * Exposed as window.GameRenderer
 */

(function (global) {

// ─── Constants ───────────────────────────────────────────────────────────────

const WORLD_SIZE   = 3200;
const HALF_WORLD   = WORLD_SIZE / 2;
const VILLAGE_RADIUS = 320;
const VILLAGE_CX   = 1600;
const VILLAGE_CZ   = 1600;
const CAM_FOV      = 55;
const CAM_NEAR     = 0.5;
const CAM_FAR      = 2000;
const CAM_ZOOM_MIN = 8;
const CAM_ZOOM_MAX = 40;
const CAM_DEFAULT_ZOOM   = 22;
const CAM_DEFAULT_PITCH  = Math.PI / 4;   // 45°
const CAM_SMOOTH         = 0.08;

const CLASS_COLORS = {
  guerriero : 0xc0392b,
  ninja     : 0x27ae60,
  mago      : 0x8e44ad,
  sciamano  : 0x2980b9,
  default   : 0x95a5a6,
};

const MONSTER_CONFIGS = {
  wolf    : { color: 0x7f8c8d, scaleX: 1.0, scaleY: 0.55, scaleZ: 1.4, floatY: 0 },
  orc     : { color: 0x2ecc71, scaleX: 1.35, scaleY: 1.0, scaleZ: 1.0, floatY: 0 },
  specter : { color: 0x9b59b6, scaleX: 0.9, scaleY: 1.1, scaleZ: 0.9, floatY: 0.6 },
  bandit  : { color: 0xe67e22, scaleX: 1.0, scaleY: 1.0, scaleZ: 1.0, floatY: 0 },
  golem   : { color: 0x5d6d7e, scaleX: 1.5, scaleY: 1.3, scaleZ: 1.5, floatY: 0 },
  default : { color: 0xe74c3c, scaleX: 1.0, scaleY: 1.0, scaleZ: 1.0, floatY: 0 },
};

// ─── Utility helpers ─────────────────────────────────────────────────────────

function worldToScene(x, z) {
  // World coords (0-3200) → scene coords centred at 0
  return { x: x - HALF_WORLD, z: z - HALF_WORLD };
}

function rand(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

// ─── GameRenderer ─────────────────────────────────────────────────────────────

class GameRenderer {

  constructor(canvas) {
    this._canvas = canvas;

    // Three.js core
    this._renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.setSize(canvas.clientWidth || window.innerWidth,
                           canvas.clientHeight || window.innerHeight);
    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this._renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = 1.1;

    this._scene  = new THREE.Scene();
    this._camera = null;

    // Camera state
    this._camTarget    = new THREE.Vector3(0, 0, 0);
    this._camCurrent   = new THREE.Vector3(0, 0, 0);
    this._camYaw       = 0;
    this._camPitch     = CAM_DEFAULT_PITCH;
    this._camZoom      = CAM_DEFAULT_ZOOM;

    // Entity registry: id → { mesh, data, animTime, state }
    this._entities = new Map();

    // Effect pools
    this._particles       = [];
    this._floatingTexts   = [];
    this._selectionRing   = null;

    // Clock
    this._clock = new THREE.Clock();

    this._setupScene();
    this._setupLighting();
    this._setupCamera();
    this._buildSelectionRing();
  }

  // ── Scene Setup ──────────────────────────────────────────────────────────────

  _setupScene() {
    this._scene.background = new THREE.Color(0x7ec8e3);
    this._scene.fog = new THREE.FogExp2(0x9dd0e0, 0.0008);
  }

  _setupLighting() {
    // Hemisphere — sky / ground light
    const hemi = new THREE.HemisphereLight(0xbfd9f2, 0x4a6741, 0.7);
    this._scene.add(hemi);

    // Directional sun
    const sun = new THREE.DirectionalLight(0xfff3cc, 1.6);
    sun.position.set(600, 900, 400);
    sun.castShadow = true;
    sun.shadow.camera.near   = 1;
    sun.shadow.camera.far    = 2500;
    sun.shadow.camera.left   = -800;
    sun.shadow.camera.right  =  800;
    sun.shadow.camera.top    =  800;
    sun.shadow.camera.bottom = -800;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.001;
    this._scene.add(sun);
    this._sun = sun;

    // Ambient fill
    const ambient = new THREE.AmbientLight(0x404060, 0.4);
    this._scene.add(ambient);
  }

  _setupCamera() {
    const w = this._canvas.clientWidth  || window.innerWidth;
    const h = this._canvas.clientHeight || window.innerHeight;
    this._camera = new THREE.PerspectiveCamera(CAM_FOV, w / h, CAM_NEAR, CAM_FAR);
    this._updateCameraPosition();
  }

  _updateCameraPosition() {
    const t = this._camCurrent;
    const zoom  = this._camZoom;
    const pitch = this._camPitch;
    const yaw   = this._camYaw;

    // Spherical offset from target
    const offX = zoom * Math.sin(yaw)   * Math.cos(pitch);
    const offY = zoom * Math.sin(pitch);
    const offZ = zoom * Math.cos(yaw)   * Math.cos(pitch);

    this._camera.position.set(t.x + offX, t.y + offY, t.z + offZ);
    this._camera.lookAt(t.x, t.y + 0.9, t.z);
  }

  // ── Terrain ──────────────────────────────────────────────────────────────────

  buildTerrain(mapData) {
    const SEGS = 128;
    const geo  = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEGS, SEGS);
    geo.rotateX(-Math.PI / 2);

    // Vertex colours
    const pos    = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const col    = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i) + HALF_WORLD; // 0-3200
      const wz = pos.getZ(i) + HALF_WORLD;

      const dv = Math.sqrt((wx - VILLAGE_CX) ** 2 + (wz - VILLAGE_CZ) ** 2);

      if (dv < VILLAGE_RADIUS) {
        // Village ground — warm sandy earth
        col.setRGB(0.72 + rand(-0.04, 0.04),
                   0.62 + rand(-0.04, 0.04),
                   0.42 + rand(-0.03, 0.03));
      } else if (dv < VILLAGE_RADIUS + 80) {
        // Transition paths
        const t = (dv - VILLAGE_RADIUS) / 80;
        col.setRGB(0.72 * (1 - t) + 0.22 * t,
                   0.62 * (1 - t) + 0.55 * t,
                   0.42 * (1 - t) + 0.24 * t);
      } else {
        // Forest / grassland — dark green with variation
        const noise = rand(-0.06, 0.06);
        col.setRGB(0.18 + noise, 0.46 + noise * 0.5, 0.18 + noise);
      }

      colors[i * 3    ] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat  = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    this._scene.add(mesh);

    // Safe-zone ring indicator in village
    this._buildSafeZoneRing();

    // Water bodies — scattered lakes
    this._buildWater(mapData);
  }

  _buildSafeZoneRing() {
    const geo = new THREE.RingGeometry(VILLAGE_RADIUS - 4, VILLAGE_RADIUS + 4, 64);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color    : 0xf1c40f,
      side     : THREE.DoubleSide,
      transparent: true,
      opacity  : 0.35,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.set(VILLAGE_CX - HALF_WORLD, 0.05, VILLAGE_CZ - HALF_WORLD);
    this._scene.add(ring);
  }

  _buildWater(mapData) {
    const lakes = (mapData && mapData.lakes) ? mapData.lakes : [
      { cx: 400,  cz: 500,  w: 300, h: 250 },
      { cx: 2800, cz: 2600, w: 350, h: 300 },
      { cx: 700,  cz: 2400, w: 280, h: 220 },
    ];

    const waterMat = new THREE.MeshLambertMaterial({
      color      : 0x1a7abf,
      transparent: true,
      opacity    : 0.72,
      side       : THREE.DoubleSide,
    });

    for (const lake of lakes) {
      const geo  = new THREE.PlaneGeometry(lake.w, lake.h);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, waterMat);
      mesh.position.set(lake.cx - HALF_WORLD, 0.08, lake.cz - HALF_WORLD);
      this._scene.add(mesh);
    }
  }

  // ── Decorations ───────────────────────────────────────────────────────────────

  buildDecorations(mapData) {
    this._buildTrees(mapData);
    this._buildRocks(mapData);
    this._buildBushes(mapData);
    this._buildHouses(mapData);
  }

  _buildTrees(mapData) {
    const TREE_COUNT  = 280;
    const TRUNK_H     = rand(2.4, 3.6);
    const dummy       = new THREE.Object3D();

    // Shared geometries + materials for instanced meshes
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 3.2, 7);
    const crownGeo = new THREE.SphereGeometry(1.6, 8, 7);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e });

    // Four slightly different crown tints
    const crownMats = [
      new THREE.MeshLambertMaterial({ color: 0x1a5c2a }),
      new THREE.MeshLambertMaterial({ color: 0x1e6b30 }),
      new THREE.MeshLambertMaterial({ color: 0x145224 }),
      new THREE.MeshLambertMaterial({ color: 0x216b34 }),
    ];

    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, TREE_COUNT);
    const crownMeshes = crownMats.map(m => new THREE.InstancedMesh(crownGeo, m, Math.ceil(TREE_COUNT / crownMats.length)));
    trunkMesh.castShadow    = true;
    trunkMesh.receiveShadow = true;
    for (const cm of crownMeshes) { cm.castShadow = true; }

    let treeIdx   = 0;
    const perCrown = Array(crownMats.length).fill(0);

    while (treeIdx < TREE_COUNT) {
      const wx = rand(20, WORLD_SIZE - 20);
      const wz = rand(20, WORLD_SIZE - 20);
      const d  = Math.sqrt((wx - VILLAGE_CX) ** 2 + (wz - VILLAGE_CZ) ** 2);
      if (d < VILLAGE_RADIUS + 60) continue; // no trees in village

      const sx = wx - HALF_WORLD;
      const sz = wz - HALF_WORLD;
      const trunkH  = rand(2.4, 3.8);
      const crownSY = rand(0.85, 1.15);
      const crownSX = rand(0.85, 1.15);
      const crownY  = trunkH / 2 + 1.2;

      // Trunk
      dummy.position.set(sx, trunkH / 2, sz);
      dummy.rotation.set(0, rand(0, Math.PI * 2), 0);
      dummy.scale.set(1, trunkH / 3.2, 1);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(treeIdx, dummy.matrix);

      // Crown
      const ci = treeIdx % crownMats.length;
      dummy.position.set(sx, crownY, sz);
      dummy.rotation.set(0, rand(0, Math.PI * 2), 0);
      dummy.scale.set(crownSX, crownSY, crownSX);
      dummy.updateMatrix();
      crownMeshes[ci].setMatrixAt(perCrown[ci], dummy.matrix);
      perCrown[ci]++;

      treeIdx++;
    }

    trunkMesh.instanceMatrix.needsUpdate = true;
    this._scene.add(trunkMesh);

    for (let ci = 0; ci < crownMeshes.length; ci++) {
      crownMeshes[ci].count = perCrown[ci];
      crownMeshes[ci].instanceMatrix.needsUpdate = true;
      this._scene.add(crownMeshes[ci]);
    }
  }

  _buildRocks(mapData) {
    const ROCK_COUNT = 80;
    const geo  = new THREE.IcosahedronGeometry(1, 0);
    const mat  = new THREE.MeshLambertMaterial({ color: 0x7f8c8d });
    const mesh = new THREE.InstancedMesh(geo, mat, ROCK_COUNT);
    mesh.castShadow    = true;
    mesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < ROCK_COUNT; i++) {
      const wx = rand(20, WORLD_SIZE - 20);
      const wz = rand(20, WORLD_SIZE - 20);
      const scale = rand(0.3, 1.1);
      dummy.position.set(wx - HALF_WORLD, scale * 0.5, wz - HALF_WORLD);
      dummy.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    this._scene.add(mesh);
  }

  _buildBushes(mapData) {
    const COUNT = 120;
    const geo   = new THREE.SphereGeometry(0.7, 6, 5);
    const mat   = new THREE.MeshLambertMaterial({ color: 0x2d7a3a });
    const mesh  = new THREE.InstancedMesh(geo, mat, COUNT);
    mesh.castShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < COUNT; i++) {
      const wx = rand(40, WORLD_SIZE - 40);
      const wz = rand(40, WORLD_SIZE - 40);
      const d  = Math.sqrt((wx - VILLAGE_CX) ** 2 + (wz - VILLAGE_CZ) ** 2);
      const sx = rand(0.6, 1.2);
      const sz = rand(0.6, 1.2);
      dummy.position.set(wx - HALF_WORLD, 0.45, wz - HALF_WORLD);
      dummy.scale.set(sx, rand(0.7, 1.0), sz);
      dummy.rotation.y = rand(0, Math.PI * 2);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    this._scene.add(mesh);
  }

  _buildHouses(mapData) {
    // Place 12 houses around the village centre
    const HOUSE_DATA = [
      { x: 1480, z: 1480, rot: 0.2  },
      { x: 1560, z: 1450, rot: 0.8  },
      { x: 1640, z: 1470, rot: 1.4  },
      { x: 1700, z: 1540, rot: 0.0  },
      { x: 1710, z: 1630, rot: 2.1  },
      { x: 1660, z: 1700, rot: 3.0  },
      { x: 1580, z: 1730, rot: 0.6  },
      { x: 1490, z: 1710, rot: 1.1  },
      { x: 1440, z: 1640, rot: 1.8  },
      { x: 1450, z: 1560, rot: 2.5  },
      { x: 1530, z: 1520, rot: 0.4  },
      { x: 1620, z: 1540, rot: 3.5  },
    ];

    const wallMat = new THREE.MeshLambertMaterial({ color: 0xd4b896 });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x8b3a3a });
    const doorMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e });

    for (const h of HOUSE_DATA) {
      const group = new THREE.Group();

      // Body
      const bGeo  = new THREE.BoxGeometry(4.5, 3.2, 4.5);
      const body  = new THREE.Mesh(bGeo, wallMat);
      body.position.y = 1.6;
      body.castShadow    = true;
      body.receiveShadow = true;
      group.add(body);

      // Roof (cone)
      const rGeo = new THREE.ConeGeometry(3.6, 2.5, 4);
      const roof = new THREE.Mesh(rGeo, roofMat);
      roof.position.y = 3.2 + 1.25;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);

      // Door
      const dGeo = new THREE.BoxGeometry(0.9, 1.8, 0.15);
      const door = new THREE.Mesh(dGeo, doorMat);
      door.position.set(0, 0.9, 2.28);
      group.add(door);

      group.position.set(h.x - HALF_WORLD, 0, h.z - HALF_WORLD);
      group.rotation.y = h.rot;
      this._scene.add(group);
    }
  }

  // ── Entity Meshes ─────────────────────────────────────────────────────────────

  createPlayerMesh(player) {
    const group  = new THREE.Group();
    const cls    = (player && player.class) ? player.class.toLowerCase() : 'default';
    const color  = CLASS_COLORS[cls] || CLASS_COLORS.default;

    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const headMat = new THREE.MeshLambertMaterial({ color: 0xf5cba7 });

    // Torso
    const torsoGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.9, 8);
    const torso    = new THREE.Mesh(torsoGeo, bodyMat);
    torso.position.y = 0.85;
    torso.castShadow = true;
    group.add(torso);

    // Head
    const headGeo = new THREE.SphereGeometry(0.3, 10, 8);
    const head    = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.6;
    head.castShadow = true;
    group.add(head);

    // Legs (two small cylinders)
    const legGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.7, 6);
    for (const side of [-0.16, 0.16]) {
      const leg = new THREE.Mesh(legGeo, bodyMat);
      leg.position.set(side, 0.35, 0);
      leg.castShadow = true;
      group.add(leg);
    }

    // Class accessory
    if (cls === 'mago') {
      // Pointy hat
      const hatGeo = new THREE.ConeGeometry(0.28, 0.55, 6);
      const hat    = new THREE.Mesh(hatGeo, new THREE.MeshLambertMaterial({ color: 0x4a235a }));
      hat.position.y = 2.0;
      group.add(hat);
    } else if (cls === 'guerriero') {
      // Shoulder pauldrons
      const padGeo = new THREE.BoxGeometry(0.25, 0.2, 0.25);
      const padMat = new THREE.MeshLambertMaterial({ color: 0x808080 });
      for (const side of [-0.5, 0.5]) {
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.set(side, 1.15, 0);
        group.add(pad);
      }
    } else if (cls === 'ninja') {
      // Headband
      const bandGeo = new THREE.TorusGeometry(0.31, 0.04, 5, 12);
      const bandMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
      const band    = new THREE.Mesh(bandGeo, bandMat);
      band.position.y = 1.6;
      band.rotation.x = Math.PI / 2;
      group.add(band);
    } else if (cls === 'sciamano') {
      // Staff
      const stGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.0, 5);
      const stMat = new THREE.MeshLambertMaterial({ color: 0x8b6914 });
      const staff = new THREE.Mesh(stGeo, stMat);
      staff.position.set(0.55, 1.0, 0);
      group.add(staff);
    }

    this._addNameLabel(group, (player && player.name) ? player.name : 'Player', color);

    group.userData.type = 'player';
    group.userData.animTime = 0;
    return group;
  }

  createMonsterMesh(monsterType) {
    const cfg   = MONSTER_CONFIGS[monsterType] || MONSTER_CONFIGS.default;
    const group = new THREE.Group();
    const mat   = new THREE.MeshLambertMaterial({ color: cfg.color });

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.9, 8);
    const body    = new THREE.Mesh(bodyGeo, mat);
    body.position.y = cfg.floatY + 0.85;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.32, 9, 7);
    const head    = new THREE.Mesh(headGeo, mat);
    head.position.y = cfg.floatY + 1.65;
    head.castShadow = true;
    group.add(head);

    // Eyes (glowing spheres)
    const eyeGeo = new THREE.SphereGeometry(0.07, 5, 5);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3300 });
    for (const side of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(side, cfg.floatY + 1.7, 0.27);
      group.add(eye);
    }

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.65, 6);
    for (const side of [-0.18, 0.18]) {
      const leg = new THREE.Mesh(legGeo, mat);
      leg.position.set(side, cfg.floatY + 0.32, 0);
      leg.castShadow = true;
      group.add(leg);
    }

    // Type-specific extras
    if (monsterType === 'wolf') {
      const earGeo = new THREE.ConeGeometry(0.12, 0.28, 4);
      for (const side of [-0.2, 0.2]) {
        const ear = new THREE.Mesh(earGeo, mat);
        ear.position.set(side, cfg.floatY + 2.0, 0.1);
        group.add(ear);
      }
      group.scale.set(cfg.scaleX, cfg.scaleY, cfg.scaleZ);
    } else if (monsterType === 'specter') {
      // Cloak / ghost tail
      const cloakGeo = new THREE.ConeGeometry(0.5, 1.4, 6);
      const cloakMat = new THREE.MeshLambertMaterial({ color: cfg.color, transparent: true, opacity: 0.65 });
      const cloak    = new THREE.Mesh(cloakGeo, cloakMat);
      cloak.position.y = cfg.floatY + 0.2;
      cloak.rotation.x = Math.PI;
      group.add(cloak);
      group.scale.set(cfg.scaleX, cfg.scaleY, cfg.scaleZ);
    } else if (monsterType === 'golem') {
      // Rock chunks on shoulders
      const chunkGeo = new THREE.IcosahedronGeometry(0.32, 0);
      const chunkMat = new THREE.MeshLambertMaterial({ color: 0x4a5568 });
      for (const side of [-0.7, 0.7]) {
        const chunk = new THREE.Mesh(chunkGeo, chunkMat);
        chunk.position.set(side, 1.2, 0);
        group.add(chunk);
      }
      group.scale.set(cfg.scaleX, cfg.scaleY, cfg.scaleZ);
    } else {
      group.scale.set(cfg.scaleX, cfg.scaleY, cfg.scaleZ);
    }

    group.userData.type = 'monster';
    group.userData.animTime = 0;
    group.userData.floatY = cfg.floatY;
    return group;
  }

  createNPCMesh(npc) {
    const group = new THREE.Group();
    const color = 0xf39c12;
    const mat   = new THREE.MeshLambertMaterial({ color });
    const headMat = new THREE.MeshLambertMaterial({ color: 0xf0d0a0 });

    const torsoGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.85, 8);
    const torso = new THREE.Mesh(torsoGeo, mat);
    torso.position.y = 0.85;
    torso.castShadow = true;
    group.add(torso);

    const headGeo = new THREE.SphereGeometry(0.28, 10, 8);
    const head    = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.55;
    group.add(head);

    // Icon billboard (! above NPC)
    const iconCanvas  = document.createElement('canvas');
    iconCanvas.width  = 64;
    iconCanvas.height = 64;
    const ctx = iconCanvas.getContext('2d');
    ctx.fillStyle = '#f1c40f';
    ctx.font      = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 32, 32);
    const iconTex   = new THREE.CanvasTexture(iconCanvas);
    const iconGeo   = new THREE.PlaneGeometry(0.5, 0.5);
    const iconMat   = new THREE.MeshBasicMaterial({ map: iconTex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const iconMesh  = new THREE.Mesh(iconGeo, iconMat);
    iconMesh.position.y = 2.4;
    iconMesh.userData.isBillboard = true;
    group.add(iconMesh);

    this._addNameLabel(group, (npc && npc.name) ? npc.name : 'NPC', 0xf39c12);

    group.userData.type = 'npc';
    group.userData.animTime = 0;
    return group;
  }

  createDropMesh(drop) {
    const group  = new THREE.Group();
    const isGold = !drop || !drop.type || drop.type === 'gold';

    if (isGold) {
      const coinGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.08, 12);
      const coinMat = new THREE.MeshLambertMaterial({ color: 0xf1c40f, emissive: 0x886600, emissiveIntensity: 0.4 });
      const coin    = new THREE.Mesh(coinGeo, coinMat);
      coin.rotation.x = Math.PI / 2;
      coin.position.y = 0.3;
      group.add(coin);
    } else {
      const boxGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
      const boxMat = new THREE.MeshLambertMaterial({ color: 0x9b59b6, emissive: 0x3d1a5e, emissiveIntensity: 0.3 });
      const box    = new THREE.Mesh(boxGeo, boxMat);
      box.position.y = 0.3;
      group.add(box);
    }

    // Glow ring under drop
    const ringGeo = new THREE.RingGeometry(0.18, 0.34, 16);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf1c40f, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    const ring    = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.02;
    group.add(ring);

    group.userData.type    = 'drop';
    group.userData.animTime = 0;
    return group;
  }

  createProjectileMesh(type) {
    const group  = new THREE.Group();
    const colors = { fireball: 0xff4500, lightning: 0x00cfff, arrow: 0x8b6914, default: 0xffffff };
    const color  = colors[type] || colors.default;

    const geo  = new THREE.SphereGeometry(0.22, 8, 6);
    const mat  = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    // Light for fireball / lightning
    if (type === 'fireball' || type === 'lightning') {
      const light = new THREE.PointLight(color, 1.5, 6);
      group.add(light);
    }

    group.userData.type    = 'projectile';
    group.userData.animTime = 0;
    return group;
  }

  createStoneMesh() {
    const group  = new THREE.Group();
    const geo    = new THREE.IcosahedronGeometry(0.55, 1);
    const mat    = new THREE.MeshLambertMaterial({
      color    : 0x2c3e50,
      emissive : 0x1a0040,
      emissiveIntensity: 0.5,
    });
    const crystal = new THREE.Mesh(geo, mat);
    crystal.scale.y = 1.6;
    crystal.position.y = 0.6;
    group.add(crystal);

    // Pulsing light
    const light = new THREE.PointLight(0x9b59b6, 1.2, 5);
    light.position.y = 0.8;
    group.add(light);
    group.userData.pulsing = true;
    group.userData.pulseLight = light;
    group.userData.animTime = 0;

    // Base ring
    const ringGeo = new THREE.RingGeometry(0.4, 0.7, 8);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x9b59b6, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    const ring    = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.05;
    group.add(ring);

    group.userData.type = 'stone';
    return group;
  }

  // ── Name Label ────────────────────────────────────────────────────────────────

  _addNameLabel(group, name, color) {
    const canvas  = document.createElement('canvas');
    canvas.width  = 256;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 40);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, 256, 40);
    ctx.fillStyle = '#' + (color).toString(16).padStart(6, '0');
    ctx.font      = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 20);

    const tex  = new THREE.CanvasTexture(canvas);
    const geo  = new THREE.PlaneGeometry(2.0, 0.32);
    const mat  = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 2.15;
    mesh.userData.isBillboard = true;
    group.add(mesh);
  }

  // ── Entity Management ─────────────────────────────────────────────────────────

  addEntity(id, mesh, data) {
    if (this._entities.has(id)) {
      this._scene.remove(this._entities.get(id).mesh);
    }
    this._scene.add(mesh);
    this._entities.set(id, { mesh, data, animTime: 0, state: 'idle' });
  }

  removeEntity(id) {
    if (!this._entities.has(id)) return;
    const ent = this._entities.get(id);
    this._scene.remove(ent.mesh);
    this._entities.delete(id);
  }

  updateEntityPosition(id, x, z, dir, state) {
    const ent = this._entities.get(id);
    if (!ent) return;
    const sc = worldToScene(x, z);
    ent.mesh.position.x = sc.x;
    ent.mesh.position.z = sc.z;
    if (dir !== undefined) ent.mesh.rotation.y = -dir;
    if (state) ent.state = state;
  }

  updateEntityAnimation(id, state) {
    const ent = this._entities.get(id);
    if (!ent) return;
    ent.state = state;
  }

  // ── Effects ───────────────────────────────────────────────────────────────────

  spawnParticles(x, z, color, count, spread) {
    const sc = worldToScene(x, z);
    for (let i = 0; i < count; i++) {
      const geo  = new THREE.PlaneGeometry(0.18, 0.18);
      const mat  = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1.0, side: THREE.DoubleSide, depthWrite: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        sc.x + rand(-spread, spread),
        rand(0.2, 1.4),
        sc.z + rand(-spread, spread)
      );
      mesh.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
      this._scene.add(mesh);
      this._particles.push({ mesh, life: 0.8, maxLife: 0.8, vy: rand(1.5, 3.5) });
    }
  }

  spawnHitEffect(x, z, isCrit) {
    const color = isCrit ? 0xffffff : 0xf1c40f;
    this.spawnParticles(x, z, color, isCrit ? 14 : 8, isCrit ? 0.9 : 0.6);
    if (isCrit) {
      this.createFloatingText(x, z, 'CRITICO!', '#fff700');
    }
  }

  spawnLevelUpEffect(x, z) {
    const sc  = worldToScene(x, z);
    const geo = new THREE.RingGeometry(0.1, 0.3, 32);
    geo.rotateX(-Math.PI / 2);
    const mat  = new THREE.MeshBasicMaterial({ color: 0xf1c40f, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.set(sc.x, 0.1, sc.z);
    this._scene.add(ring);
    this._particles.push({ mesh: ring, life: 1.2, maxLife: 1.2, vy: 0, expand: true, scale: 0.1 });
    this.createFloatingText(x, z, 'LIVELLO SU!', '#f1c40f');
  }

  spawnSkillEffect(skillId, x, z, targetX, targetZ) {
    const skillColors = {
      fireball  : 0xff4500,
      lightning : 0x00cfff,
      slash     : 0xc0392b,
      heal      : 0x2ecc71,
      default   : 0xffffff,
    };
    const color = skillColors[skillId] || skillColors.default;
    this.spawnParticles(x, z, color, 12, 0.8);
    if (targetX !== undefined && targetZ !== undefined) {
      this.spawnParticles(targetX, targetZ, color, 10, 0.6);
    }
  }

  createFloatingText(x, z, text, color) {
    const sc     = worldToScene(x, z);
    const canvas = document.createElement('canvas');
    canvas.width  = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);
    ctx.strokeStyle = '#000';
    ctx.lineWidth   = 4;
    ctx.font        = 'bold 26px sans-serif';
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(text, 128, 32);
    ctx.fillStyle = color || '#ffffff';
    ctx.fillText(text, 128, 32);

    const tex  = new THREE.CanvasTexture(canvas);
    const geo  = new THREE.PlaneGeometry(2.2, 0.55);
    const mat  = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 1.0, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(sc.x, rand(1.8, 2.4), sc.z);
    this._scene.add(mesh);
    this._floatingTexts.push({ mesh, life: 1.4, maxLife: 1.4, vy: 1.8 });
  }

  // ── Camera ────────────────────────────────────────────────────────────────────

  setCameraTarget(x, z) {
    const sc = worldToScene(x, z);
    this._camTarget.set(sc.x, 0, sc.z);
  }

  rotateCameraBy(dx, dy) {
    this._camYaw   += dx * 0.005;
    this._camPitch  = Math.max(0.15, Math.min(Math.PI / 2.2, this._camPitch + dy * 0.004));
  }

  zoomCamera(delta) {
    this._camZoom = Math.max(CAM_ZOOM_MIN, Math.min(CAM_ZOOM_MAX, this._camZoom + delta * 0.015));
  }

  // ── Selection Ring ────────────────────────────────────────────────────────────

  _buildSelectionRing() {
    const geo = new THREE.RingGeometry(0.6, 0.85, 36);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color       : 0xf1c40f,
      transparent : true,
      opacity     : 0.7,
      side        : THREE.DoubleSide,
      depthWrite  : false,
    });
    this._selectionRing = new THREE.Mesh(geo, mat);
    this._selectionRing.visible = false;
    this._selectionRing.position.y = 0.04;
    this._scene.add(this._selectionRing);
  }

  setSelectionRing(x, z, r, show) {
    if (!this._selectionRing) return;
    this._selectionRing.visible = !!show;
    if (show) {
      const sc = worldToScene(x, z);
      this._selectionRing.position.set(sc.x, 0.04, sc.z);
      if (r) {
        const s = r / 0.6;
        this._selectionRing.scale.setScalar(s);
      }
    }
  }

  // ── Minimap ───────────────────────────────────────────────────────────────────

  updateMinimap(playerX, playerZ, entities, mapData) {
    const canvas = document.getElementById('minimap');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W   = canvas.width;
    const H   = canvas.height;
    const scale = W / WORLD_SIZE;

    ctx.clearRect(0, 0, W, H);

    // Background map
    ctx.fillStyle = '#2d6a30';
    ctx.fillRect(0, 0, W, H);

    // Village zone
    const vcx = VILLAGE_CX * scale;
    const vcz = VILLAGE_CZ * scale;
    const vr  = VILLAGE_RADIUS * scale;
    ctx.beginPath();
    ctx.arc(vcx, vcz, vr, 0, Math.PI * 2);
    ctx.fillStyle = '#c2a06a';
    ctx.fill();

    // Water bodies
    const lakes = (mapData && mapData.lakes) ? mapData.lakes : [
      { cx: 400, cz: 500,  w: 300, h: 250 },
      { cx: 2800, cz: 2600, w: 350, h: 300 },
      { cx: 700,  cz: 2400, w: 280, h: 220 },
    ];
    ctx.fillStyle = '#1a7abf';
    for (const lake of lakes) {
      ctx.fillRect((lake.cx - lake.w / 2) * scale, (lake.cz - lake.h / 2) * scale, lake.w * scale, lake.h * scale);
    }

    // Entities on minimap
    if (entities) {
      for (const [id, ent] of entities) {
        const d = ent.data;
        if (!d) continue;
        let col = '#e74c3c';
        if (d.type === 'npc')    col = '#f1c40f';
        if (d.type === 'player') col = '#3498db';
        if (d.type === 'drop')   col = '#9b59b6';
        ctx.beginPath();
        ctx.arc(d.x * scale, d.z * scale, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
      }
    }

    // Player marker
    ctx.beginPath();
    ctx.arc(playerX * scale, playerZ * scale, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Border
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth   = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
  }

  // ── Main Render Loop ──────────────────────────────────────────────────────────

  render(dt) {
    // Smooth camera follow
    this._camCurrent.lerp(this._camTarget, CAM_SMOOTH);
    this._updateCameraPosition();

    const t = performance.now() * 0.001;

    // Billboard all labels / icons to face camera
    for (const [id, ent] of this._entities) {
      ent.animTime += dt;
      this._animateEntity(ent, t);
      ent.mesh.traverse(child => {
        if (child.userData.isBillboard) {
          child.quaternion.copy(this._camera.quaternion);
        }
      });
    }

    // Animate particles
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this._scene.remove(p.mesh);
        p.mesh.material.dispose();
        p.mesh.geometry.dispose();
        this._particles.splice(i, 1);
        continue;
      }
      const frac = p.life / p.maxLife;
      if (p.expand) {
        const s = 1 + (1 - frac) * 14;
        p.mesh.scale.setScalar(s);
        p.mesh.material.opacity = frac * 0.9;
      } else {
        p.mesh.position.y += p.vy * dt;
        p.mesh.material.opacity = frac;
        p.mesh.rotation.x += dt * 1.5;
        p.mesh.rotation.y += dt * 2.0;
      }
    }

    // Animate floating texts
    for (let i = this._floatingTexts.length - 1; i >= 0; i--) {
      const ft = this._floatingTexts[i];
      ft.life -= dt;
      if (ft.life <= 0) {
        this._scene.remove(ft.mesh);
        ft.mesh.material.dispose();
        ft.mesh.geometry.dispose();
        this._floatingTexts.splice(i, 1);
        continue;
      }
      const frac = ft.life / ft.maxLife;
      ft.mesh.position.y += ft.vy * dt;
      ft.mesh.material.opacity = Math.min(1, frac * 2);
      ft.mesh.quaternion.copy(this._camera.quaternion);
    }

    // Pulse stone entities
    for (const [id, ent] of this._entities) {
      if (ent.mesh.userData.pulsing && ent.mesh.userData.pulseLight) {
        ent.mesh.userData.pulseLight.intensity = 0.8 + 0.7 * Math.sin(t * 2.8 + ent.animTime);
      }
    }

    this._renderer.render(this._scene, this._camera);
  }

  _animateEntity(ent, t) {
    const mesh  = ent.mesh;
    const state = ent.state || 'idle';
    const at    = ent.animTime;

    if (state === 'walk') {
      mesh.position.y = Math.abs(Math.sin(at * 5.5)) * 0.12;
    } else if (state === 'attack') {
      mesh.rotation.y += 0.12;
      mesh.position.y = Math.abs(Math.sin(at * 9)) * 0.08;
    } else if (state === 'die') {
      if (mesh.rotation.x > -Math.PI / 2) {
        mesh.rotation.x -= 0.06;
      }
      if (mesh.position.y > -0.5) {
        mesh.position.y -= 0.03;
      }
    } else {
      // Idle: gentle bob
      mesh.position.y = Math.sin(at * 1.8) * 0.04 + (mesh.userData.floatY || 0);
    }

    if (mesh.userData.type === 'drop') {
      mesh.rotation.y += 0.04;
      mesh.position.y = 0.06 + Math.sin(at * 2.4) * 0.08;
    }

    if (mesh.userData.type === 'projectile') {
      mesh.rotation.y += 0.15;
    }
  }

  // ── Resize ────────────────────────────────────────────────────────────────────

  resize() {
    const w = this._canvas.clientWidth  || window.innerWidth;
    const h = this._canvas.clientHeight || window.innerHeight;
    this._renderer.setSize(w, h, false);
    if (this._camera) {
      this._camera.aspect = w / h;
      this._camera.updateProjectionMatrix();
    }
  }
}

// ── Export ────────────────────────────────────────────────────────────────────

global.GameRenderer = GameRenderer;

}(window));
