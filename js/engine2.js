'use strict';

/**
 * engine2.js — Prototype extensions for GameRenderer
 * Adds: createMountMesh, attachMountToPlayer, applyHairstyle,
 *       spawnGroundCircle, createTotemMesh
 *
 * Must be loaded AFTER engine.js. THREE is expected to be global.
 * No modifications to engine.js are made.
 */

(function () {

  // ── Internal world-to-scene offset (mirrors engine.js HALF_WORLD = 1600) ──────
  var HALF_WORLD = 1600;

  function _worldToScene(x, z) {
    return { x: x - HALF_WORLD, z: z - HALF_WORLD };
  }

  // ── Guard: defer patching until GameRenderer is defined ──────────────────────
  function _patch() {
    var proto = window.GameRenderer && window.GameRenderer.prototype;
    if (!proto) {
      console.warn('engine2.js: GameRenderer not found — retrying on DOMContentLoaded');
      return;
    }

    // =========================================================================
    // 1. createMountMesh(style)
    //    style = { body: hexColor, mane: hexColor, kind: 'horse'|'wolf'|'tiger'|'drake' }
    //    Returns THREE.Group, origin at ground, facing +X, ~1.2 units tall.
    // =========================================================================
    proto.createMountMesh = function createMountMesh(style) {
      style = style || {};
      var kind      = style.kind  || 'horse';
      var bodyColor = (style.body !== undefined) ? style.body : 0x8b6914;
      var maneColor = (style.mane !== undefined) ? style.mane : 0x3d1a00;

      var group = new THREE.Group();

      var bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, flatShading: true });
      var maneMat = new THREE.MeshStandardMaterial({ color: maneColor, flatShading: true });
      var legMat  = new THREE.MeshStandardMaterial({ color: bodyColor, flatShading: true });

      // ── Body (elongated box, horizontal, centred at y=0.6) ─────────────────
      var bodyGeo = new THREE.BoxGeometry(1.5, 0.55, 0.55);
      var body    = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.set(0, 0.60, 0);
      body.castShadow    = true;
      body.receiveShadow = true;
      group.add(body);

      // ── 4 cylinder legs (front pair and back pair) ─────────────────────────
      var legGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.60, 6);
      var legPositions = [
        [ 0.50,  0.20,  0.18],   // front-right
        [ 0.50,  0.20, -0.18],   // front-left
        [-0.50,  0.20,  0.18],   // back-right
        [-0.50,  0.20, -0.18],   // back-left
      ];
      for (var li = 0; li < legPositions.length; li++) {
        var lp  = legPositions[li];
        var leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(lp[0], lp[1], lp[2]);
        leg.castShadow = true;
        group.add(leg);
      }

      // ── Neck (angled box connecting body to head) ──────────────────────────
      var neckGeo = new THREE.BoxGeometry(0.22, 0.50, 0.22);
      var neck    = new THREE.Mesh(neckGeo, bodyMat);
      neck.position.set(0.70, 0.95, 0);
      neck.rotation.z = -0.45;   // lean forward toward +X
      neck.castShadow = true;
      group.add(neck);

      // ── Head (box) ─────────────────────────────────────────────────────────
      var headGeo = new THREE.BoxGeometry(0.38, 0.28, 0.28);
      var head    = new THREE.Mesh(headGeo, bodyMat);
      head.position.set(0.95, 1.18, 0);
      head.castShadow = true;
      group.add(head);

      // ── Muzzle (smaller box) ───────────────────────────────────────────────
      var muzzleGeo = new THREE.BoxGeometry(0.22, 0.18, 0.20);
      var muzzle    = new THREE.Mesh(muzzleGeo, bodyMat);
      muzzle.position.set(1.16, 1.12, 0);
      group.add(muzzle);

      // ── Mane (small boxes along top of neck/head) ─────────────────────────
      var manePositions = [
        [0.72, 1.22, 0],
        [0.82, 1.25, 0],
        [0.92, 1.28, 0],
      ];
      for (var mi = 0; mi < manePositions.length; mi++) {
        var mp      = manePositions[mi];
        var maneGeo = new THREE.BoxGeometry(0.10, 0.18, 0.08);
        var maneMesh = new THREE.Mesh(maneGeo, maneMat);
        maneMesh.position.set(mp[0], mp[1], mp[2]);
        group.add(maneMesh);
      }

      // ── Tail (small mane-colored box at rear) ─────────────────────────────
      var tailGeo  = new THREE.BoxGeometry(0.08, 0.38, 0.08);
      var tail     = new THREE.Mesh(tailGeo, maneMat);
      tail.position.set(-0.80, 0.72, 0);
      tail.rotation.z = 0.35;
      group.add(tail);

      // ── Kind-specific extras ───────────────────────────────────────────────
      if (kind === 'wolf') {
        // Pointed ears on head
        var earGeo = new THREE.ConeGeometry(0.07, 0.18, 4);
        var earMat = new THREE.MeshStandardMaterial({ color: bodyColor, flatShading: true });
        for (var side = -1; side <= 1; side += 2) {
          var ear = new THREE.Mesh(earGeo, earMat);
          ear.position.set(0.95, 1.35, side * 0.14);
          group.add(ear);
        }
      } else if (kind === 'tiger') {
        // Horizontal stripes via thin dark boxes along body
        var stripeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, flatShading: true });
        var stripeOffsets = [-0.40, -0.10, 0.20, 0.48];
        for (var si = 0; si < stripeOffsets.length; si++) {
          var stripeGeo  = new THREE.BoxGeometry(0.06, 0.56, 0.56);
          var stripeMesh = new THREE.Mesh(stripeGeo, stripeMat);
          stripeMesh.position.set(stripeOffsets[si], 0.60, 0);
          group.add(stripeMesh);
        }
      } else if (kind === 'drake') {
        // Two flat wing-like triangles (custom BufferGeometry) on either side of body
        // Wing points: root at body side, then spread outward
        var wingColor = (style.mane !== undefined) ? style.mane : 0x1a1a4e;
        var wingMat   = new THREE.MeshStandardMaterial({
          color      : wingColor,
          flatShading: true,
          side       : THREE.DoubleSide,
        });

        // Wing vertices: [rootFront, rootBack, tip] in local space
        // Left wing (z > 0)
        var wvLeft = new Float32Array([
           0.40, 0.70,  0.28,   // root front
          -0.40, 0.60,  0.28,   // root back
           0.00, 1.10,  1.10,   // wing tip
        ]);
        var wvRight = new Float32Array([
           0.40, 0.70, -0.28,
          -0.40, 0.60, -0.28,
           0.00, 1.10, -1.10,
        ]);

        for (var wi = 0; wi < 2; wi++) {
          var wverts   = wi === 0 ? wvLeft : wvRight;
          var wingBuf  = new THREE.BufferGeometry();
          wingBuf.setAttribute('position', new THREE.BufferAttribute(wverts.slice(), 3));
          wingBuf.setIndex([0, 1, 2]);
          wingBuf.computeVertexNormals();
          var wingMesh = new THREE.Mesh(wingBuf, wingMat);
          group.add(wingMesh);
        }

        // Spiky crest on back
        var crestMat = new THREE.MeshStandardMaterial({ color: maneColor, flatShading: true });
        var crestX   = [-0.50, -0.25, 0.0, 0.25];
        for (var ci = 0; ci < crestX.length; ci++) {
          var cGeo  = new THREE.ConeGeometry(0.05, 0.22, 4);
          var cMesh = new THREE.Mesh(cGeo, crestMat);
          cMesh.position.set(crestX[ci], 0.95, 0);
          group.add(cMesh);
        }
      }
      // 'horse' needs no extras beyond the shared structure

      group.name = 'mountGroup';
      return group;
    };


    // =========================================================================
    // 2. attachMountToPlayer(style | null)
    //    - style given:  build mount, add as child of player group, raise other
    //                    existing children by +0.55, store undo info.
    //    - style null:   remove mount, restore children offsets.
    //    Idempotent — calling twice with a style replaces cleanly.
    // =========================================================================
    proto.attachMountToPlayer = function attachMountToPlayer(style) {
      var entry = this._entities.get('player');
      if (!entry) {
        console.warn('attachMountToPlayer: no player entity registered');
        return;
      }
      var playerGroup = entry.mesh;

      // Always clean up any previous mount first (idempotency)
      if (this._playerMount) {
        // Remove old mount mesh from player group
        if (this._playerMount.mesh && this._playerMount.mesh.parent === playerGroup) {
          playerGroup.remove(this._playerMount.mesh);
        }
        // Restore previously raised children
        var raised = this._playerMount.raised || [];
        for (var ri = 0; ri < raised.length; ri++) {
          var rItem = raised[ri];
          if (rItem.child && rItem.child.parent === playerGroup) {
            rItem.child.position.y -= rItem.offset;
          }
        }
        this._playerMount = null;
      }

      // If called with null, we're done (cleanup only)
      if (!style) return;

      // Build the new mount mesh
      var mountMesh = this.createMountMesh(style);
      mountMesh.position.set(0, 0, 0);

      // Record all existing children BEFORE adding the mount, so we can raise them
      var RAISE_OFFSET = 0.55;
      var existingChildren = playerGroup.children.slice(); // snapshot
      var raisedList = [];

      for (var ci = 0; ci < existingChildren.length; ci++) {
        var child = existingChildren[ci];
        child.position.y += RAISE_OFFSET;
        raisedList.push({ child: child, offset: RAISE_OFFSET });
      }

      // Add mount as child of player group
      playerGroup.add(mountMesh);

      // Store undo info
      this._playerMount = {
        mesh  : mountMesh,
        raised: raisedList,
      };
    };


    // =========================================================================
    // 3. applyHairstyle(entityId, style | null)
    //    style = { shape: 'corto'|'lungo'|'coda'|'cresta'|'treccia'|'rasato',
    //              color: hexColor }
    //    Head in createPlayerMesh is at y=1.6, radius=0.3.
    // =========================================================================
    proto.applyHairstyle = function applyHairstyle(entityId, style) {
      var entry = this._entities.get(entityId);
      if (!entry) {
        console.warn('applyHairstyle: entity not found:', entityId);
        return;
      }
      var entityGroup = entry.mesh;

      // Remove any previous hair group (identified by name 'hairstyle')
      var prevHair = null;
      for (var ci = 0; ci < entityGroup.children.length; ci++) {
        if (entityGroup.children[ci].name === 'hairstyle') {
          prevHair = entityGroup.children[ci];
          break;
        }
      }
      if (prevHair) {
        entityGroup.remove(prevHair);
        // Dispose geometries/materials to avoid leaks
        prevHair.traverse(function (obj) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        });
      }

      if (!style) return;

      var shape     = style.shape || 'corto';
      var hairColor = (style.color !== undefined) ? style.color : 0x2c1810;
      var hairMat   = new THREE.MeshStandardMaterial({ color: hairColor, flatShading: true });

      var hairGroup = new THREE.Group();
      hairGroup.name = 'hairstyle';

      // Head centre is at y=1.6, radius≈0.3. Hair sits on top of the sphere.
      // We position hairGroup at the head centre and build relative to that.
      hairGroup.position.set(0, 1.6, 0);

      if (shape === 'corto') {
        // Slightly flattened sphere cap on top of head
        var capGeo = new THREE.SphereGeometry(0.30, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
        var cap    = new THREE.Mesh(capGeo, hairMat);
        cap.position.y = 0.02;
        hairGroup.add(cap);

      } else if (shape === 'lungo') {
        // Sphere cap + flat box falling down the back to shoulders
        var capGeoL = new THREE.SphereGeometry(0.30, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
        var capL    = new THREE.Mesh(capGeoL, hairMat);
        capL.position.y = 0.02;
        hairGroup.add(capL);

        var longGeo  = new THREE.BoxGeometry(0.28, 0.65, 0.10);
        var longMesh = new THREE.Mesh(longGeo, hairMat);
        // Falls behind head: z slightly negative (player faces +X in engine,
        // but the group may be rotated; z≈-0.25 is behind the sphere)
        longMesh.position.set(0, -0.28, -0.28);
        hairGroup.add(longMesh);

      } else if (shape === 'coda') {
        // Cap + thin cylinder ponytail angled back/down
        var capGeoC = new THREE.SphereGeometry(0.30, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
        var capC    = new THREE.Mesh(capGeoC, hairMat);
        capC.position.y = 0.02;
        hairGroup.add(capC);

        var ponyGeo  = new THREE.CylinderGeometry(0.045, 0.025, 0.55, 6);
        var ponyMesh = new THREE.Mesh(ponyGeo, hairMat);
        // Position the cylinder so its top touches the back of the head,
        // angled back/down at ~40°
        ponyMesh.position.set(0, -0.25, -0.32);
        ponyMesh.rotation.x = 0.70;   // ~40° toward back
        hairGroup.add(ponyMesh);

      } else if (shape === 'cresta') {
        // Row of 3–4 small boxes on top of head (mohawk)
        var crestOffsets = [-0.10, 0.00, 0.10, 0.20];
        for (var ki = 0; ki < crestOffsets.length; ki++) {
          var kGeo  = new THREE.BoxGeometry(0.08, 0.20 - ki * 0.02, 0.08);
          var kMesh = new THREE.Mesh(kGeo, hairMat);
          // Offset along x (forward direction in local player space)
          kMesh.position.set(crestOffsets[ki], 0.34, 0);
          hairGroup.add(kMesh);
        }

      } else if (shape === 'treccia') {
        // Cap + segmented cylinder chain (treccia = braid)
        var capGeoT = new THREE.SphereGeometry(0.30, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
        var capT    = new THREE.Mesh(capGeoT, hairMat);
        capT.position.y = 0.02;
        hairGroup.add(capT);

        var segCount  = 5;
        var segH      = 0.10;
        var segR      = 0.045;
        var segGeo    = new THREE.CylinderGeometry(segR, segR, segH, 6);
        for (var si = 0; si < segCount; si++) {
          var segMesh = new THREE.Mesh(segGeo, hairMat);
          // Each segment steps slightly further back and down
          var segY = -0.12 - si * (segH + 0.025);
          var segZ = -0.26 - si * 0.04;
          segMesh.position.set(0, segY, segZ);
          segMesh.rotation.x = 0.30 + si * 0.08;
          hairGroup.add(segMesh);
        }

      } else if (shape === 'rasato') {
        // Very thin, dark cap — almost shaved look
        var rasatoMat = new THREE.MeshStandardMaterial({
          color      : hairColor,
          flatShading: true,
        });
        var rasatoGeo = new THREE.SphereGeometry(0.31, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.38);
        var rasato    = new THREE.Mesh(rasatoGeo, rasatoMat);
        rasato.position.y = 0.01;
        rasato.scale.y    = 0.30;   // very flat
        hairGroup.add(rasato);
      }

      entityGroup.add(hairGroup);
    };


    // =========================================================================
    // 4. spawnGroundCircle(x, z, radius, color, duration)
    //    Translucent flat ring+fill on the ground at world coords,
    //    additive blending, fades out over `duration` seconds.
    //    Integrates with render loop via _groundCircles array + wrapped render.
    // =========================================================================

    // Patch render once to drive ground-circle updates
    (function () {
      var origRender = window.GameRenderer.prototype.render;
      window.GameRenderer.prototype.render = function (dt) {
        origRender.call(this, dt);
        if (this._updateGroundCircles) {
          this._updateGroundCircles(dt);
        }
      };
    }());

    proto._updateGroundCircles = function _updateGroundCircles(dt) {
      if (!this._groundCircles) return;
      for (var i = this._groundCircles.length - 1; i >= 0; i--) {
        var gc = this._groundCircles[i];
        gc.life -= dt;
        if (gc.life <= 0) {
          this._scene.remove(gc.mesh);
          gc.mesh.traverse(function (obj) {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
          });
          this._groundCircles.splice(i, 1);
          continue;
        }
        var frac    = gc.life / gc.maxLife;
        var opacity = frac * gc.maxOpacity;
        gc.mesh.traverse(function (obj) {
          if (obj.material && obj.material.opacity !== undefined) {
            obj.material.opacity = opacity;
          }
        });
      }
    };

    proto.spawnGroundCircle = function spawnGroundCircle(x, z, radius, color, duration) {
      if (!this._groundCircles) {
        this._groundCircles = [];
      }

      var sc = _worldToScene(x, z);

      // Outer ring
      var ringGeo = new THREE.RingGeometry(radius * 0.85, radius, 40);
      ringGeo.rotateX(-Math.PI / 2);
      var ringMat = new THREE.MeshBasicMaterial({
        color      : color || 0xffffff,
        transparent: true,
        opacity    : 0.75,
        side       : THREE.DoubleSide,
        depthWrite : false,
        blending   : THREE.AdditiveBlending,
      });
      var ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(sc.x, 0.06, sc.z);

      // Inner fill
      var fillGeo = new THREE.CircleGeometry(radius * 0.85, 40);
      fillGeo.rotateX(-Math.PI / 2);
      var fillMat = new THREE.MeshBasicMaterial({
        color      : color || 0xffffff,
        transparent: true,
        opacity    : 0.20,
        side       : THREE.DoubleSide,
        depthWrite : false,
        blending   : THREE.AdditiveBlending,
      });
      var fill = new THREE.Mesh(fillGeo, fillMat);
      fill.position.set(sc.x, 0.05, sc.z);

      // Group both so they can be removed together
      var gcGroup = new THREE.Group();
      gcGroup.add(ring);
      gcGroup.add(fill);
      this._scene.add(gcGroup);

      var dur = (duration && duration > 0) ? duration : 1.5;
      this._groundCircles.push({
        mesh      : gcGroup,
        life      : dur,
        maxLife   : dur,
        maxOpacity: 0.75,
      });
    };


    // =========================================================================
    // 5. createTotemMesh()
    //    Small shaman-flavored totem: stacked boxes with a glowing top sphere
    //    and PointLight. Returns THREE.Group.
    // =========================================================================
    proto.createTotemMesh = function createTotemMesh() {
      var group = new THREE.Group();

      // Base post (tall thin box)
      var postMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, flatShading: true });
      var postGeo = new THREE.BoxGeometry(0.18, 1.20, 0.18);
      var post    = new THREE.Mesh(postGeo, postMat);
      post.position.y = 0.60;
      post.castShadow    = true;
      post.receiveShadow = true;
      group.add(post);

      // Lower carved block
      var block1Mat = new THREE.MeshStandardMaterial({ color: 0x6b4423, flatShading: true });
      var block1Geo = new THREE.BoxGeometry(0.38, 0.32, 0.38);
      var block1    = new THREE.Mesh(block1Geo, block1Mat);
      block1.position.y = 0.36;
      block1.castShadow = true;
      group.add(block1);

      // Middle carved block (slightly smaller, rotated 20°)
      var block2Mat = new THREE.MeshStandardMaterial({ color: 0x7a4d2a, flatShading: true });
      var block2Geo = new THREE.BoxGeometry(0.32, 0.28, 0.32);
      var block2    = new THREE.Mesh(block2Geo, block2Mat);
      block2.position.y = 0.80;
      block2.rotation.y = Math.PI / 9;
      block2.castShadow = true;
      group.add(block2);

      // Upper carved block (smaller, rotated 45°)
      var block3Mat = new THREE.MeshStandardMaterial({ color: 0x8a5a32, flatShading: true });
      var block3Geo = new THREE.BoxGeometry(0.26, 0.24, 0.26);
      var block3    = new THREE.Mesh(block3Geo, block3Mat);
      block3.position.y = 1.12;
      block3.rotation.y = Math.PI / 4;
      block3.castShadow = true;
      group.add(block3);

      // Glowing top sphere
      var orbColor = 0x00e5ff;
      var orbMat   = new THREE.MeshStandardMaterial({
        color            : orbColor,
        emissive         : orbColor,
        emissiveIntensity: 0.80,
        flatShading      : true,
      });
      var orbGeo = new THREE.SphereGeometry(0.18, 8, 7);
      var orb    = new THREE.Mesh(orbGeo, orbMat);
      orb.position.y = 1.42;
      group.add(orb);

      // PointLight emanating from the orb
      var light = new THREE.PointLight(orbColor, 1.4, 6.0);
      light.position.y = 1.42;
      group.add(light);

      // Mark for pulsing (compatible with engine.js pulse logic)
      group.userData.pulsing   = true;
      group.userData.pulseLight = light;
      group.userData.animTime   = 0;
      group.userData.type       = 'totem';

      return group;
    };

  } // end _patch()

  // Run patch immediately if GameRenderer already exists,
  // otherwise wait for the DOM to finish loading scripts.
  if (window.GameRenderer) {
    _patch();
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      if (window.GameRenderer) {
        _patch();
      } else {
        console.error('engine2.js: GameRenderer still not found after DOMContentLoaded');
      }
    });
  }

}());
