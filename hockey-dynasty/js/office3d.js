// 3D GM office: a Three.js hub where objects replace menu tabs, visitors walk in
// to deliver story events, and the room reflects the state of the world.
// Everything is built from primitives at runtime, so there are no model files.
var HD = HD || {};
HD.Office = (function () {
  var O = { ok: null };
  var T = null;
  var renderer, scene, camera, raycaster, pointer;
  // Own timer: THREE.Clock.getElapsedTime() resets getDelta(), which broke walking speed
  var t0 = performance.now(), lastFrame = t0;
  function elapsed() { return (performance.now() - t0) / 1000; }
  var host = null, tip = null, bubble = null;
  var clickables = [], hovered = null, pointerMoved = false;
  var P = {}; // named scene parts
  var tex = {}; // canvas textures
  var visitor = null, leaving = [];
  var phone = { ringing: false, t: 0 };
  var autoOpenedFor = null, arrivedAt = 0;
  var lastSig = {};
  var mx = 0, my = 0;
  var PHONE_EVENTS = { ai_trade_offer: 1, tampering: 1, job_offer: 1, job_hunt: 1, endorsement: 1, insider_tip: 1 };
  var DOOR = { x: 4.6, z: 1.7 }, CHAIR = { x: 2.15, z: -1.25 };

  O.supported = function () {
    if (O.ok !== null) return O.ok;
    try {
      var c = document.createElement('canvas');
      O.ok = !!(window.THREE && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { O.ok = false; }
    return O.ok;
  };

  // ---------- Primitive helpers ----------
  function mat(color, o) { return new T.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.75, metalness: 0.05 }, o || {})); }
  function mesh(geo, m, cast) { var x = new T.Mesh(geo, m); x.castShadow = cast !== false; x.receiveShadow = true; return x; }
  function box(w, h, d, m, cast) { return mesh(new T.BoxGeometry(w, h, d), m, cast); }
  function cyl(rt, rb, h, m, seg) { return mesh(new T.CylinderGeometry(rt, rb, h, seg || 16), m); }
  function sph(r, m, ws, hs) { return mesh(new T.SphereGeometry(r, ws || 16, hs || 12), m); }
  function at(o, x, y, z) { o.position.set(x, y, z); return o; }
  function canvasTex(w, h) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4;
    return { c: c, ctx: c.getContext('2d'), tex: t };
  }
  function screenPlane(w, h, ct) { return mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: ct.tex, toneMapped: false }), false); }
  function clickable(obj, label, act) {
    obj.userData.label = label; obj.userData.act = act;
    obj.traverse(function (m) {
      if (m.isMesh) { m.userData.root = obj; if (m.material && m.material.emissive) m.material = m.material.clone(); }
    });
    clickables.push(obj);
    return obj;
  }
  function label(text, color, w) {
    var ct = canvasTex(w || 512, 96);
    var g = ct.ctx;
    g.font = '600 42px Inter, Segoe UI, sans-serif';
    var tw = Math.min(ct.c.width - 20, g.measureText(text).width + 40);
    g.fillStyle = 'rgba(14,17,22,.82)'; roundRect(g, (ct.c.width - tw) / 2, 10, tw, 76, 18); g.fill();
    g.strokeStyle = color || '#d4a94f'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#f0e8d6'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, ct.c.width / 2, 50);
    var s = new T.Sprite(new T.SpriteMaterial({ map: ct.tex, transparent: true, depthTest: false }));
    s.scale.set((w || 512) / 300, 96 / 300, 1); s.renderOrder = 10;
    return s;
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function trunc(g, s, w) { if (g.measureText(s).width <= w) return s; while (s.length > 3 && g.measureText(s + '…').width > w) s = s.slice(0, -1); return s + '…'; }

  // ---------- Characters ----------
  function makeChar(p) {
    var L = HD.UI.looks(p);
    var g = new T.Group();
    var skin = mat(L.skin, { roughness: 0.6 });
    var hairM = mat(L.hair, { roughness: 0.9 });
    var isPlayer = p.role === 'player' || p.role === 'prospect';
    var top = mat(isPlayer ? L.c1 : L.suit ? (p.role === 'coach' ? L.c1 : '#1f2633') : (L.female ? '#6b4a7a' : '#3e4a5c'));
    var pantsM = mat(isPlayer ? '#1c1f26' : '#2a2f3a');
    var hips = new T.Group(); hips.position.y = 0.86; g.add(hips);
    var legs = [];
    [-0.1, 0.1].forEach(function (x) {
      var leg = new T.Group(); leg.position.x = x;
      leg.add(at(box(0.14, 0.82, 0.16, pantsM), 0, -0.41, 0));
      leg.add(at(box(0.15, 0.08, 0.26, mat('#151515')), 0, -0.82, 0.05));
      hips.add(leg); legs.push(leg);
    });
    var torso = at(box(0.48, 0.62, 0.27, top), 0, 1.17, 0); g.add(torso);
    if (isPlayer) {
      g.add(at(box(0.5, 0.07, 0.29, mat(L.c2)), 0, 1.0, 0));
      g.add(at(box(0.5, 0.05, 0.29, mat(L.c2)), 0, 1.3, 0));
    } else if (L.suit) {
      g.add(at(box(0.13, 0.36, 0.01, mat('#ececec')), 0, 1.3, 0.14));
      g.add(at(box(0.05, 0.32, 0.012, mat(L.c2)), 0, 1.28, 0.146));
    }
    var arms = [];
    [-0.31, 0.31].forEach(function (x) {
      var arm = new T.Group(); arm.position.set(x, 1.44, 0);
      arm.add(at(box(0.12, 0.56, 0.14, top), 0, -0.27, 0));
      arm.add(at(sph(0.065, skin), 0, -0.58, 0));
      g.add(arm); arms.push(arm);
    });
    var head = new T.Group(); head.position.y = 1.66; g.add(head);
    head.add(at(cyl(0.065, 0.075, 0.12, skin), 0, -0.13, 0));
    head.add(sph(0.17, skin, 20, 16));
    var cap = mesh(new T.SphereGeometry(0.178, 20, 10, 0, Math.PI * 2, 0, Math.PI * (L.style === 2 && p.age >= 40 ? 0.28 : 0.42)), hairM);
    cap.position.y = 0.01; cap.rotation.x = -0.25; head.add(cap);
    if (L.female || L.style === 3) head.add(at(box(0.3, 0.32, 0.1, hairM), 0, -0.08, -0.12));
    var eyeM = mat('#1b1410');
    head.add(at(sph(0.022, eyeM, 8, 6), -0.06, 0.02, 0.155));
    head.add(at(sph(0.022, eyeM, 8, 6), 0.06, 0.02, 0.155));
    head.add(at(box(0.07, 0.014, 0.01, mat('#6b3a30')), 0, -0.07, 0.165));
    head.add(at(sph(0.025, skin, 8, 6), 0, -0.02, 0.17));
    if (L.beard) head.add(at(box(0.26, 0.12, 0.12, hairM), 0, -0.11, 0.08));
    g.userData = { legs: legs, arms: arms, head: head, hips: hips, pid: p.id };
    return g;
  }
  function pose(ch, kind, t) {
    var u = ch.userData;
    if (kind === 'walk') {
      var s = Math.sin(t * 9);
      u.legs[0].rotation.x = s * 0.5; u.legs[1].rotation.x = -s * 0.5;
      u.arms[0].rotation.x = -s * 0.4; u.arms[1].rotation.x = s * 0.4;
      ch.position.y = Math.abs(Math.cos(t * 9)) * 0.03;
    } else if (kind === 'sit') {
      u.legs[0].rotation.x = u.legs[1].rotation.x = -Math.PI / 2;
      u.arms[0].rotation.x = u.arms[1].rotation.x = -0.5;
      ch.position.y = -0.38;
    } else {
      u.legs[0].rotation.x = u.legs[1].rotation.x = 0;
      u.arms[0].rotation.x = u.arms[1].rotation.x = Math.sin(t * 1.5) * 0.03;
      ch.position.y = 0;
    }
  }

  // ---------- Scene construction ----------
  function build() {
    T = window.THREE;
    renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(42, 16 / 9, 0.1, 400);
    raycaster = new T.Raycaster(); pointer = new T.Vector2(-9, -9);

    // Lights
    P.hemi = new T.HemisphereLight(0xdfe8ff, 0x3a2a1a, 0.55); scene.add(P.hemi);
    P.sun = new T.DirectionalLight(0xfff1dc, 0.9);
    P.sun.position.set(3, 9, 7); P.sun.castShadow = true;
    P.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(P.sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
    scene.add(P.sun);
    P.lamp = new T.PointLight(0xffc477, 0.9, 6, 2); P.lamp.position.set(-0.95, 1.55, -1.75); scene.add(P.lamp);
    P.windowLight = new T.PointLight(0x9fc3ff, 0.5, 12, 2); P.windowLight.position.set(0, 2.2, -3.2); scene.add(P.windowLight);

    buildRoom(); buildOutside(); buildDesk(); buildWalls(); buildDecor();
  }

  function buildRoom() {
    var floorT = canvasTex(512, 512), g = floorT.ctx;
    for (var i = 0; i < 16; i++) {
      var shade = 90 + ((i * 37) % 23);
      g.fillStyle = 'rgb(' + shade + ',' + Math.round(shade * 0.66) + ',' + Math.round(shade * 0.42) + ')';
      g.fillRect(0, i * 32, 512, 31);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(((i * 173) % 400) + 40, i * 32, 2, 32);
    }
    floorT.tex.wrapS = floorT.tex.wrapT = T.RepeatWrapping; floorT.tex.repeat.set(3, 3);
    var floor = mesh(new T.PlaneGeometry(10.6, 12), mat(0xffffff, { map: floorT.tex, roughness: 0.55 }), false);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 1.5); scene.add(floor);
    var wallM = mat('#cfc6b6', { roughness: 0.95 });
    P.wallM = wallM;
    var H = 4.6;
    // Back wall with a picture window (x -4..4, y 0.8..3.4)
    scene.add(at(box(1.9, H, 0.2, wallM, false), -4.35, H / 2, -4));
    scene.add(at(box(1.9, H, 0.2, wallM, false), 4.35, H / 2, -4));
    scene.add(at(box(6.8, 0.8, 0.2, wallM, false), 0, 0.4, -4));
    scene.add(at(box(6.8, H - 3.4, 0.2, wallM, false), 0, 3.4 + (H - 3.4) / 2, -4));
    var frameM = mat('#2b2f36', { metalness: 0.4, roughness: 0.4 });
    [-3.4, -1.13, 1.13, 3.4].forEach(function (x) { scene.add(at(box(0.08, 2.6, 0.12, frameM), x, 2.1, -3.95)); });
    scene.add(at(box(6.9, 0.08, 0.14, frameM), 0, 0.82, -3.95));
    scene.add(at(box(6.9, 0.08, 0.14, frameM), 0, 3.38, -3.95));
    var glass = mesh(new T.PlaneGeometry(6.8, 2.6), new T.MeshBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0.07 }), false);
    glass.position.set(0, 2.1, -3.96); scene.add(glass);
    P.windowHit = clickable(at(new T.Mesh(new T.PlaneGeometry(6.8, 2.6), new T.MeshBasicMaterial({ visible: false })), 0, 2.1, -3.9), 'Window — your arena & city', function () { HD.UI.showTeam(HD.me().teamId); });
    scene.add(P.windowHit);
    // Side walls
    scene.add(at(box(0.2, H, 9, wallM, false), -5.2, H / 2, 0.5));
    scene.add(at(box(0.2, H, 9, wallM, false), 5.2, H / 2, 0.5));
    // Ceiling keeps the outside world framed by the window
    var ceil = mesh(new T.PlaneGeometry(10.6, 9), mat('#e9e4da', { roughness: 1 }), false); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, 0.5); scene.add(ceil);
    // Accent stripe & baseboards in team colours
    P.stripeM = mat('#0b2a5b', { roughness: 0.6 });
    scene.add(at(box(0.04, 0.12, 9, P.stripeM, false), -5.08, 1.05, 0.5));
    scene.add(at(box(0.04, 0.12, 9, P.stripeM, false), 5.08, 1.05, 0.5));
    var base = mat('#3b2f25');
    scene.add(at(box(0.05, 0.14, 9, base, false), -5.08, 0.07, 0.5));
    scene.add(at(box(0.05, 0.14, 9, base, false), 5.08, 0.07, 0.5));
  }

  function buildOutside() {
    tex.sky = canvasTex(32, 256);
    var sky = new T.Mesh(new T.SphereGeometry(180, 24, 12), new T.MeshBasicMaterial({ map: tex.sky.tex, side: T.BackSide, fog: false, toneMapped: false }));
    scene.add(sky);
    var ground = mesh(new T.PlaneGeometry(400, 300), mat('#2c3328', { roughness: 1 }), false);
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -6, -120); scene.add(ground);
    P.groundM = ground.material;
    // City blocks with lit windows
    tex.cityWin = canvasTex(64, 128);
    var cg = tex.cityWin.ctx; cg.fillStyle = '#000'; cg.fillRect(0, 0, 64, 128);
    for (var y = 4; y < 128; y += 8) for (var x = 4; x < 64; x += 8) if (Math.random() < 0.45) { cg.fillStyle = Math.random() < 0.8 ? '#ffd890' : '#bfe2ff'; cg.fillRect(x, y, 4, 4); }
    tex.cityWin.tex.wrapS = tex.cityWin.tex.wrapT = T.RepeatWrapping;
    P.cityM = [];
    for (var i = 0; i < 34; i++) {
      var w = 6 + Math.random() * 10, h = 14 + Math.random() * 60, d = 6 + Math.random() * 8;
      var bx = (Math.random() - 0.5) * 220, bz = -60 - Math.random() * 90;
      if (bx > -8 && bx < 36 && bz > -120) bx += bx < 14 ? -26 : 26;
      var t2 = tex.cityWin.tex.clone(); t2.needsUpdate = true; t2.repeat.set(w / 8, h / 12);
      var m = mat(['#3a4250', '#2f3642', '#454c58', '#353b47'][i % 4], { emissive: 0xffffff, emissiveMap: t2, emissiveIntensity: 0.0, roughness: 0.9 });
      P.cityM.push(m);
      var b = box(w, h, d, m, false); b.position.set(bx, h / 2 - 6, bz); scene.add(b);
    }
    // The arena
    P.arena = new T.Group(); P.arena.position.set(14, -6, -95); P.arena.scale.setScalar(0.9);
    P.arenaBodyM = mat('#d9d9de', { roughness: 0.5, metalness: 0.2 });
    P.arena.add(at(cyl(17, 18, 10, P.arenaBodyM, 40), 0, 5, 0));
    P.arenaBandM = mat('#0b2a5b', { emissive: 0x000000 });
    P.arena.add(at(cyl(17.2, 17.2, 2, P.arenaBandM, 40), 0, 8.5, 0));
    var dome = mesh(new T.SphereGeometry(17, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2.6), mat('#bfc4cc', { metalness: 0.5, roughness: 0.35 }));
    dome.position.y = 10; dome.scale.y = 0.45; P.arena.add(dome);
    tex.sign = canvasTex(1024, 160);
    var sign = mesh(new T.PlaneGeometry(22, 3.4), new T.MeshBasicMaterial({ map: tex.sign.tex, toneMapped: false }), false);
    sign.position.set(-3, 14.5, 14); sign.rotation.y = 0.2; P.arena.add(sign);
    scene.add(P.arena);
    // Searchlights (scaled by hype)
    P.beams = [];
    for (var k = 0; k < 4; k++) {
      var beam = new T.Mesh(new T.ConeGeometry(2.2, 70, 16, 1, true), new T.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.09, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
      beam.geometry.translate(0, -35, 0); beam.rotation.x = Math.PI;
      var piv = new T.Group(); piv.position.set(14 + (k - 1.5) * 10, 3, -80); piv.add(beam);
      scene.add(piv); P.beams.push(piv);
    }
    // Snow
    var N = 900, pos = new Float32Array(N * 3);
    for (var n = 0; n < N; n++) { pos[n * 3] = (Math.random() - 0.5) * 40; pos[n * 3 + 1] = Math.random() * 24 - 4; pos[n * 3 + 2] = -6 - Math.random() * 30; }
    var sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(pos, 3));
    P.snow = new T.Points(sg, new T.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.85, depthWrite: false }));
    scene.add(P.snow);
  }

  function buildDesk() {
    var wood = mat('#5b3a24', { roughness: 0.5 });
    var dark = mat('#2a1d14', { roughness: 0.6 });
    var desk = new T.Group(); desk.position.set(0, 0, -1.55);
    desk.add(at(box(2.8, 0.08, 1.25, wood), 0, 0.78, 0));
    desk.add(at(box(2.7, 0.72, 0.06, dark), 0, 0.38, 0.55));
    desk.add(at(box(0.06, 0.74, 1.15, dark), -1.33, 0.37, 0));
    desk.add(at(box(0.06, 0.74, 1.15, dark), 1.33, 0.37, 0));
    scene.add(desk);
    // Your chair and you
    var chairM = mat('#1d1d22', { roughness: 0.45 });
    var chair = new T.Group(); chair.position.set(0, 0, -2.45);
    chair.add(at(box(0.62, 0.1, 0.6, chairM), 0, 0.5, 0));
    chair.add(at(box(0.62, 0.9, 0.1, chairM), 0, 1.0, -0.28));
    chair.add(at(cyl(0.04, 0.04, 0.45, mat('#777', { metalness: 0.8 })), 0, 0.25, 0));
    chair.add(at(cyl(0.3, 0.3, 0.04, mat('#333', { metalness: 0.6 })), 0, 0.03, 0));
    scene.add(chair);
    // Monitor
    tex.monitor = canvasTex(640, 400);
    var mon = new T.Group(); mon.position.set(0.85, 0.82, -1.8);
    mon.add(at(box(0.9, 0.58, 0.04, mat('#111')), 0, 0.42, 0));
    mon.add(at(box(0.08, 0.26, 0.06, mat('#222', { metalness: 0.6 })), 0, 0.12, -0.02));
    mon.add(at(box(0.32, 0.02, 0.22, mat('#222', { metalness: 0.6 })), 0, 0.01, 0));
    var scr = screenPlane(0.85, 0.53, tex.monitor); scr.position.set(0, 0.42, 0.021); mon.add(scr);
    mon.rotation.y = -0.55;
    scene.add(clickable(mon, 'Computer — club overview', function () { HD.UI.goTab('home'); }));
    scene.add(at(box(0.55, 0.02, 0.18, mat('#222')), 0.55, 0.83, -1.3).rotateY(-0.4));
    // Desk phone
    var ph = new T.Group(); ph.position.set(1.12, 0.82, -1.2);
    ph.add(at(box(0.3, 0.07, 0.24, mat('#1b1e24')), 0, 0.035, 0));
    P.handset = at(box(0.3, 0.06, 0.08, mat('#23272f')), 0, 0.1, -0.06); ph.add(P.handset);
    P.phoneLightM = new T.MeshBasicMaterial({ color: 0x333333 });
    ph.add(at(new T.Mesh(new T.SphereGeometry(0.02, 8, 6), P.phoneLightM), 0.11, 0.075, 0.08));
    ph.rotation.y = -0.4; P.phone = ph;
    scene.add(clickable(ph, 'Phone — trades & free agents', function () { if (pendingIsPhone()) HD.UI.showEvent(); else HD.UI.goTab('market'); }));
    // Inbox tray
    var inbox = new T.Group(); inbox.position.set(-1.0, 0.82, -1.35);
    inbox.add(at(box(0.42, 0.04, 0.32, mat('#7b6a55')), 0, 0.02, 0));
    P.papers = [];
    for (var i = 0; i < 6; i++) { var pp = at(box(0.36, 0.012, 0.27, mat('#f3efe4')), (i % 2) * 0.01, 0.05 + i * 0.014, 0); pp.visible = false; inbox.add(pp); P.papers.push(pp); }
    P.inbox = inbox;
    scene.add(clickable(inbox, 'Inbox — decisions waiting', function () { if (HD.G.pendingEvents.length) HD.UI.showEvent(); else HD.UI.goTab('chronicle'); }));
    // Lamp
    var lamp = new T.Group(); lamp.position.set(-0.95, 0.82, -1.85);
    lamp.add(at(cyl(0.1, 0.12, 0.03, mat('#b08a3c', { metalness: 0.8, roughness: 0.3 })), 0, 0.015, 0));
    lamp.add(at(cyl(0.015, 0.015, 0.55, mat('#b08a3c', { metalness: 0.8 })), 0, 0.3, 0));
    lamp.add(at(cyl(0.08, 0.16, 0.16, mat('#1e4d2b', { emissive: 0x2a1a00 })), 0, 0.6, 0));
    scene.add(lamp);
    // Nameplate
    tex.plate = canvasTex(512, 96);
    var plate = screenPlane(0.6, 0.11, tex.plate); plate.position.set(-0.2, 0.86, -0.95); plate.rotation.x = -0.6;
    scene.add(plate);
    scene.add(at(box(0.64, 0.12, 0.03, mat('#2a1d14')), -0.2, 0.86, -0.965).rotateX(-0.6));
    // Guest chair
    var gc = new T.Group(); gc.position.set(CHAIR.x + 0.05, 0, CHAIR.z); gc.rotation.y = -Math.PI / 2;
    var leather = mat('#6b2f22', { roughness: 0.5 });
    gc.add(at(box(0.6, 0.12, 0.56, leather), 0, 0.46, 0));
    gc.add(at(box(0.6, 0.6, 0.1, leather), 0, 0.8, -0.26));
    [[-0.26, -0.24], [0.26, -0.24], [-0.26, 0.24], [0.26, 0.24]].forEach(function (q) { gc.add(at(box(0.05, 0.42, 0.05, dark), q[0], 0.21, q[1])); });
    scene.add(gc);
  }

  function buildWalls() {
    // Whiteboard (left wall) — lines
    tex.board = canvasTex(1024, 640);
    var wb = new T.Group(); wb.position.set(-5.07, 2.0, -1.5); wb.rotation.y = Math.PI / 2;
    wb.add(box(2.5, 1.6, 0.05, mat('#9aa0a8', { metalness: 0.5 })));
    var bs = screenPlane(2.4, 1.5, tex.board); bs.position.z = 0.03; wb.add(bs);
    scene.add(clickable(wb, 'Whiteboard — lines & roster', function () { HD.UI.goTab('roster'); }));
    // Corkboard (left wall) — relations
    tex.cork = canvasTex(1024, 720);
    var cb = new T.Group(); cb.position.set(-5.07, 2.0, 1.6); cb.rotation.y = Math.PI / 2;
    cb.add(box(2.1, 1.5, 0.05, mat('#4a3423')));
    var cs = screenPlane(2.0, 1.4, tex.cork); cs.position.z = 0.03; cb.add(cs);
    scene.add(clickable(cb, 'Relations board — who thinks what of you', function () { HD.UI.goTab('people'); }));
    // TV (right wall) — league
    tex.tv = canvasTex(1024, 576);
    var tv = new T.Group(); tv.position.set(5.06, 2.15, -1.6); tv.rotation.y = -Math.PI / 2;
    tv.add(box(2.3, 1.32, 0.07, mat('#0b0b0d', { roughness: 0.3 })));
    var ts = screenPlane(2.2, 1.24, tex.tv); ts.position.z = 0.04; tv.add(ts);
    scene.add(clickable(tv, 'TV — league standings & news', function () { HD.UI.goTab('league'); }));
    // Owner's door (right wall)
    var door = new T.Group(); door.position.set(5.1, 0, DOOR.z); door.rotation.y = -Math.PI / 2;
    door.add(at(box(1.15, 2.3, 0.06, mat('#3b2a1e')), 0, 1.15, 0));
    var leaf = new T.Group(); leaf.position.set(-0.5, 0, 0.04);
    leaf.add(at(box(1.0, 2.15, 0.05, mat('#6e4a2e', { roughness: 0.5 })), 0.5, 1.08, 0));
    leaf.add(at(sph(0.04, mat('#d4a94f', { metalness: 0.9, roughness: 0.25 })), 0.88, 1.05, 0.05));
    door.add(leaf); P.doorLeaf = leaf;
    tex.doorPlate = canvasTex(512, 128);
    var dp = screenPlane(0.7, 0.17, tex.doorPlate); dp.position.set(0, 2.5, 0.05); door.add(dp);
    P.doorLightM = new T.MeshBasicMaterial({ color: 0x55ff88 });
    door.add(at(new T.Mesh(new T.SphereGeometry(0.06, 12, 8), P.doorLightM), 0.5, 2.5, 0.06));
    scene.add(clickable(door, 'Owner\'s office — job security', function () { var t = HD.myTeam(); if (t) HD.UI.showPerson(t.ownerId); }));
    // Calendar next to the TV
    tex.cal = canvasTex(256, 320);
    var cal = screenPlane(0.5, 0.62, tex.cal); cal.position.set(5.07, 2.1, 0.0); cal.rotation.y = -Math.PI / 2;
    scene.add(cal);
    // Trophy cabinet (back-left)
    var tc = new T.Group(); tc.position.set(-4.25, 0, -3.62);
    var tcM = mat('#3a2a1e', { roughness: 0.5 });
    tc.add(at(box(1.6, 2.2, 0.5, tcM), 0, 1.1, -0.02));
    tc.add(at(mesh(new T.BoxGeometry(1.5, 2.06, 0.02), new T.MeshStandardMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.12, roughness: 0.05 }), false), 0, 1.12, 0.22));
    tc.add(at(box(1.5, 2.06, 0.02, mat('#1a1410')), 0, 1.12, -0.25));
    [0.75, 1.35, 1.95].forEach(function (y) { tc.add(at(box(1.45, 0.03, 0.42, mat('#8a6a46')), 0, y, 0)); });
    P.trophies = new T.Group(); tc.add(P.trophies);
    var cupM = mat('#d8c27a', { metalness: 0.9, roughness: 0.2 });
    P.cupM = cupM;
    scene.add(clickable(tc, 'Trophy case — league history', function () { HD.UI.sub.league = 'history'; HD.UI.goTab('league'); }));
    // Safe / filing cabinet (back-right)
    var safe = new T.Group(); safe.position.set(4.3, 0, -3.55);
    safe.add(at(box(1.0, 1.3, 0.6, mat('#3d4450', { metalness: 0.6, roughness: 0.35 })), 0, 0.65, 0));
    safe.add(at(cyl(0.12, 0.12, 0.04, mat('#c9a15d', { metalness: 0.9, roughness: 0.2 })), 0.1, 0.8, 0.31).rotateX(Math.PI / 2));
    safe.add(at(box(0.25, 0.04, 0.04, mat('#c9a15d', { metalness: 0.9 })), -0.25, 0.8, 0.31));
    P.cash = new T.Group(); safe.add(P.cash);
    scene.add(clickable(safe, 'Club safe — club finances', function () { HD.UI.goTab('finance'); }));
    // Side table & laptop — your life
    var st = new T.Group(); st.position.set(-3.3, 0, 2.4);
    st.add(at(cyl(0.45, 0.45, 0.05, mat('#5b3a24')), 0, 0.6, 0));
    st.add(at(cyl(0.05, 0.08, 0.58, mat('#2a1d14')), 0, 0.3, 0));
    tex.laptop = canvasTex(512, 320);
    var lp = new T.Group(); lp.position.set(0, 0.63, 0); lp.rotation.y = 0.5;
    lp.add(at(box(0.5, 0.02, 0.34, mat('#9aa0a8', { metalness: 0.7 })), 0, 0.01, 0));
    var lid = new T.Group(); lid.position.set(0, 0.02, -0.17); lid.rotation.x = -0.25;
    lid.add(at(box(0.5, 0.32, 0.015, mat('#9aa0a8', { metalness: 0.7 })), 0, 0.16, 0));
    var lsc = screenPlane(0.46, 0.29, tex.laptop); lsc.position.set(0, 0.16, 0.009); lid.add(lsc);
    lp.add(lid); st.add(lp);
    scene.add(clickable(st, 'Laptop — your wealth & investments', function () { HD.UI.goTab('personal'); }));
  }

  function buildDecor() {
    // Tier 2: rug, plants, framed art. Tier 3: couch, aquarium, bar cart.
    P.tier2 = new T.Group(); P.tier3 = new T.Group();
    var rug = mesh(new T.PlaneGeometry(4.2, 3), mat('#5a1f24', { roughness: 1 }), false);
    rug.rotation.x = -Math.PI / 2; rug.position.set(0.6, 0.005, -0.6); P.tier2.add(rug);
    P.rugM = rug.material;
    [[-3.1, -3.5], [4.75, 0.75], [-4.7, 3.4]].forEach(function (q) {
      var pl = new T.Group(); pl.position.set(q[0], 0, q[1]);
      pl.add(at(cyl(0.22, 0.17, 0.42, mat('#6b4b3a')), 0, 0.21, 0));
      for (var i = 0; i < 7; i++) { var lf = sph(0.22, mat(i % 2 ? '#2f6b3a' : '#3d8a4a'), 8, 6); lf.position.set(Math.cos(i) * 0.15, 0.6 + (i % 3) * 0.18, Math.sin(i) * 0.15); lf.scale.y = 1.4; pl.add(lf); }
      P.tier2.add(pl);
    });
    scene.add(P.tier2); scene.add(P.tier3);
    // Couch
    var couchM = mat('#3b2418', { roughness: 0.45 });
    var couch = new T.Group(); couch.position.set(-4.4, 0, 0.2); couch.rotation.y = Math.PI / 2;
    couch.add(at(box(2.2, 0.42, 0.85, couchM), 0, 0.21, 0));
    couch.add(at(box(2.2, 0.55, 0.2, couchM), 0, 0.6, -0.36));
    couch.add(at(box(0.2, 0.3, 0.85, couchM), -1.0, 0.55, 0));
    couch.add(at(box(0.2, 0.3, 0.85, couchM), 1.0, 0.55, 0));
    P.tier3.add(couch);
    // Aquarium
    var aq = new T.Group(); aq.position.set(4.55, 0, -2.55);
    aq.add(at(box(0.6, 0.8, 1.2, mat('#2a1d14')), 0, 0.4, 0));
    aq.add(at(mesh(new T.BoxGeometry(0.55, 0.6, 1.15), new T.MeshStandardMaterial({ color: 0x3a8fb8, transparent: true, opacity: 0.45, roughness: 0.1 }), false), 0, 1.1, 0));
    P.fish = [];
    for (var f = 0; f < 4; f++) { var fish = sph(0.05, mat(['#ff8a3d', '#ffd23d', '#3dd0ff', '#ff4f6d'][f], { emissive: 0x221100 }), 8, 6); fish.scale.set(1, 0.7, 1.8); aq.add(fish); P.fish.push(fish); }
    P.tier3.add(aq);
    // Bar cart
    var bar = new T.Group(); bar.position.set(3.6, 0, 2.9);
    bar.add(at(box(0.8, 0.03, 0.45, mat('#c9a15d', { metalness: 0.8, roughness: 0.25 })), 0, 0.8, 0));
    bar.add(at(box(0.8, 0.03, 0.45, mat('#c9a15d', { metalness: 0.8, roughness: 0.25 })), 0, 0.35, 0));
    ['#6b2f12', '#2f4a1a', '#b8b8c8'].forEach(function (c, i) { bar.add(at(cyl(0.05, 0.05, 0.3, mat(c, { roughness: 0.15, transparent: true, opacity: 0.85 })), -0.25 + i * 0.25, 0.97, 0)); });
    P.tier3.add(bar);
    // Team pennant over the window
    tex.pennant = canvasTex(512, 128);
    var pen = screenPlane(1.6, 0.4, tex.pennant); pen.position.set(0, 3.75, -3.88); scene.add(pen);
  }

  // ---------- Dynamic content ----------
  function drawSky(phase) {
    var g = tex.sky.ctx, grd = g.createLinearGradient(0, 0, 0, 256);
    var night = phase === 'regular' || phase === 'playoffs';
    var stops = phase === 'preseason' ? ['#1b2a4a', '#ff9a5a', '#ffd9a0'] : night ? ['#030612', '#0c1838', '#24315a'] : ['#3d7dd8', '#8ec2f0', '#d8ecff'];
    grd.addColorStop(0, stops[0]); grd.addColorStop(0.42, stops[1]); grd.addColorStop(0.5, stops[2]); grd.addColorStop(1, '#101418');
    g.fillStyle = grd; g.fillRect(0, 0, 32, 256);
    if (night) for (var i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,' + Math.random() * 0.8 + ')'; g.fillRect(Math.random() * 32, Math.random() * 100, 1, 1); }
    tex.sky.tex.needsUpdate = true;
    P.cityM.forEach(function (m) { m.emissiveIntensity = night ? 0.9 : phase === 'preseason' ? 0.35 : 0.0; });
    P.hemi.intensity = night ? 0.42 : 0.6;
    P.sun.intensity = night ? 0.55 : 0.95;
    P.windowLight.color.set(night ? 0x6f8fff : phase === 'preseason' ? 0xffb070 : 0xcfe2ff);
    P.windowLight.intensity = night ? 0.35 : 0.8;
    P.lamp.intensity = night ? 1.3 : 0.6;
    P.groundM.color.set(night ? '#1c2230' : phase === 'regular' ? '#c8d0dc' : '#3b4a32');
    P.snow.visible = phase === 'regular';
  }

  function drawMonitor() {
    var G = HD.G, t = HD.myTeam(), g = tex.monitor.ctx, W = 640, H = 400;
    g.fillStyle = '#0f1620'; g.fillRect(0, 0, W, H);
    g.fillStyle = t ? t.colors[0] : '#223'; g.fillRect(0, 0, W, 64);
    g.fillStyle = '#fff'; g.font = '700 30px Inter, sans-serif'; g.textBaseline = 'middle';
    g.fillText(t ? HD.teamName(t) : 'Unemployed', 20, 33);
    g.font = '500 20px Inter, sans-serif'; g.fillStyle = '#9aa3b2';
    g.fillText(HD.seasonLabel(G.season) + ' · Week ' + G.week + ' · ' + HD.PHASE_NAMES[HD.phaseOf(G.week)], 20, 92);
    if (t) {
      var rank = HD.standings().indexOf(t) + 1;
      g.fillStyle = '#f0cf7e'; g.font = '700 64px Inter, sans-serif';
      g.fillText(t.record.w + '-' + t.record.l + '-' + t.record.otl, 20, 160);
      g.font = '500 24px Inter, sans-serif'; g.fillStyle = '#e6e1d6';
      g.fillText(HD.ordinal(rank) + ' place · ' + HD.points(t) + ' pts', 20, 215);
      g.fillText('Funds ' + HD.money(t.finance.balance) + '   Cap space ' + HD.money(HD.capSpace(t)), 20, 255);
      var games = (G.schedule || []).filter(function (x) { return x.wk === G.week && (x.h === t.id || x.a === t.id); });
      g.fillStyle = '#8fd3e8';
      g.fillText(games.length ? 'This week: ' + games.map(function (x) { return (x.h === t.id ? 'vs ' : '@ ') + G.teams[x.h === t.id ? x.a : x.h].abbr; }).join(', ') : 'No games this week', 20, 300);
      g.fillStyle = '#9aa3b2'; g.font = '500 20px Inter, sans-serif';
      g.fillText(G.ownerGoal ? 'Owner\'s target: ' + G.ownerGoal.desc : '', 20, 345);
    }
    tex.monitor.tex.needsUpdate = true;
  }

  function drawBoard() {
    var t = HD.myTeam(), g = tex.board.ctx, W = 1024, H = 640;
    g.fillStyle = '#f7f7f2'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(0,0,0,.06)'; for (var i = 0; i < W; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, H); g.stroke(); }
    g.fillStyle = '#1d3a8a'; g.font = '700 40px "Comic Sans MS", "Segoe Print", cursive';
    g.fillText('LINES', 30, 55);
    if (!t) { tex.board.tex.needsUpdate = true; return; }
    g.fillStyle = '#b5121b'; g.font = '600 26px "Comic Sans MS", "Segoe Print", cursive';
    g.fillText('Tactic: ' + HD.TACTICS[t.tactic].name, 640, 55);
    var ps = HD.rosterPlayers(t);
    var rows = [['F1', 'F2', 'F3', 'F4'], ['D1', 'D2', 'D3'], ['G1']];
    var y = 105;
    g.font = '500 25px "Comic Sans MS", "Segoe Print", cursive';
    rows.forEach(function (row, ri) {
      row.forEach(function (s) {
        var names = ps.filter(function (p) { return p.slot === s; }).map(function (p) { return p.last + (p.injury > 0 ? '✚' : ''); });
        g.fillStyle = ri === 0 ? '#1d3a8a' : ri === 1 ? '#1f6b3a' : '#7a3b1f';
        g.fillText(s, 30, y);
        g.fillStyle = '#222';
        g.fillText(trunc(g, names.join(' – ') || '—', 900), 100, y);
        y += 44;
      });
      y += 12;
    });
    var inj = ps.filter(function (p) { return p.injury > 0; });
    if (inj.length) { g.fillStyle = '#b5121b'; g.fillText(trunc(g, 'IR: ' + inj.map(function (p) { return p.last + ' (' + p.injury + 'w)'; }).join(', '), 960), 30, H - 30); }
    tex.board.tex.needsUpdate = true;
  }

  var corkImgs = {};
  function drawCork() {
    var G = HD.G, me = HD.me(), t = HD.myTeam(), g = tex.cork.ctx, W = 1024, H = 720;
    g.fillStyle = '#b58a5a'; g.fillRect(0, 0, W, H);
    for (var i = 0; i < 1400; i++) { g.fillStyle = 'rgba(80,50,20,' + (Math.random() * 0.25) + ')'; g.fillRect((i * 97) % W, (i * 53) % H, 3, 3); }
    var ppl = [];
    if (t) { ppl.push(G.people[t.ownerId]); ppl.push(G.people[t.coachId]); if (t.captainId && G.people[t.captainId]) ppl.push(G.people[t.captainId]); }
    var riv = HD.myRivalGm(); if (riv) ppl.push(G.people[riv]);
    if (me.spouseId) ppl.push(G.people[me.spouseId]);
    var mine = HD.myPlayers().slice().sort(function (a, b) { return HD.opinion(a.id, me.id) - HD.opinion(b.id, me.id); });
    if (mine.length) { ppl.push(mine[0]); ppl.push(mine[mine.length - 1]); }
    ppl.push(G.people[G.journalists[0]]);
    ppl = ppl.filter(function (p, i, a) { return p && a.indexOf(p) === i; }).slice(0, 8);
    var positions = [];
    ppl.forEach(function (p, i) {
      var x = 40 + (i % 4) * 245 + (i % 2) * 10, y = 40 + Math.floor(i / 4) * 340 + (i % 3) * 8;
      positions.push({ p: p, x: x, y: y });
    });
    // Red string between you and rivals, green to friends
    positions.forEach(function (a) {
      var rel = HD.relation(me.id, a.p.id);
      if (rel !== 'rival' && rel !== 'friend') return;
      g.strokeStyle = rel === 'rival' ? '#c0281f' : '#2f8a45'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(W / 2, H / 2); g.lineTo(a.x + 95, a.y + 20); g.stroke();
    });
    positions.forEach(function (a) {
      var p = a.p, x = a.x, y = a.y;
      var op = HD.opinion(p.id, me.id), L = HD.opinionLabel(op);
      g.save(); g.translate(x + 95, y + 140); g.rotate(((HD.hash(p.id) % 9) - 4) * 0.015); g.translate(-(x + 95), -(y + 140));
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + 6, y + 8, 190, 270);
      g.fillStyle = '#f6f2e8'; g.fillRect(x, y, 190, 270);
      var key = p.id + ':' + p.teamId + ':' + (op > 25 ? 1 : op < -25 ? -1 : 0);
      var img = corkImgs[key];
      if (img && img.complete && img.naturalWidth) g.drawImage(img, x + 12, y + 12, 166, 166);
      else {
        g.fillStyle = '#334'; g.fillRect(x + 12, y + 12, 166, 166);
        if (!img) { img = new Image(); img.onload = function () { drawCork(); }; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(HD.UI.portrait(p, 166)); corkImgs[key] = img; }
      }
      g.fillStyle = '#222'; g.font = '600 20px Inter, sans-serif'; g.textAlign = 'center';
      g.fillText(trunc(g, HD.fullName(p), 176), x + 95, y + 205);
      g.fillStyle = '#666'; g.font = '500 16px Inter, sans-serif';
      g.fillText(trunc(g, (HD.ROLE_NAMES[p.role] || p.role), 176), x + 95, y + 228);
      var col = { 'op-hate': '#b01c14', 'op-hostile': '#c8402f', 'op-cold': '#a06a5a', 'op-neutral': '#666', 'op-friendly': '#2f8a45', 'op-devoted': '#14a050' }[L.c];
      g.fillStyle = col; g.font = '700 20px Inter, sans-serif';
      g.fillText(HD.signed(op) + ' ' + L.t, x + 95, y + 256);
      g.textAlign = 'left';
      g.fillStyle = '#c0281f'; g.beginPath(); g.arc(x + 95, y + 4, 9, 0, 7); g.fill();
      g.restore();
    });
    tex.cork.tex.needsUpdate = true;
  }

  var tickerX = 0, tickerText = '';
  function drawTV(dt) {
    var G = HD.G, g = tex.tv.ctx, W = 1024, H = 576, me = HD.me();
    g.fillStyle = '#081020'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#b5121b'; g.fillRect(0, 0, W, 70);
    g.fillStyle = '#fff'; g.font = '800 38px Inter, sans-serif'; g.textBaseline = 'middle';
    g.fillText('NSN HOCKEY CENTRAL', 24, 36);
    g.font = '600 24px Inter, sans-serif'; g.textAlign = 'right';
    g.fillText('WEEK ' + G.week, W - 24, 36); g.textAlign = 'left';
    var st = HD.standings();
    g.font = '600 26px Inter, sans-serif';
    st.slice(0, 8).forEach(function (t, i) {
      var y = 108 + i * 46;
      g.fillStyle = t.id === me.teamId ? 'rgba(212,169,79,.25)' : i % 2 ? 'rgba(255,255,255,.03)' : 'transparent';
      g.fillRect(16, y - 21, 600, 42);
      g.fillStyle = t.colors[0]; g.fillRect(24, y - 14, 10, 28);
      g.fillStyle = '#e6e1d6'; g.fillText((i + 1) + '. ' + t.city + ' ' + t.name, 46, y);
      g.textAlign = 'right'; g.fillText(t.record.w + '-' + t.record.l + '-' + t.record.otl + '   ' + HD.points(t), 606, y); g.textAlign = 'left';
    });
    // Headline box
    g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(640, 90, 366, 370);
    g.fillStyle = '#f0cf7e'; g.font = '700 22px Inter, sans-serif'; g.fillText('HEADLINES', 656, 116);
    g.fillStyle = '#e6e1d6'; g.font = '500 19px Inter, sans-serif';
    var y2 = 152;
    G.news.filter(function (n) { return n.major; }).slice(0, 4).forEach(function (n) {
      var words = n.t.split(' '), line = '';
      var lines = 0;
      words.forEach(function (w) {
        if (lines >= 3) return;
        if (g.measureText(line + w).width > 334) { g.fillText(line, 656, y2); y2 += 24; line = ''; lines++; }
        line += w + ' ';
      });
      if (lines < 3 && line) { g.fillText(line, 656, y2); y2 += 24; }
      y2 += 14;
    });
    // Ticker
    g.fillStyle = '#0b2a5b'; g.fillRect(0, H - 64, W, 64);
    g.fillStyle = '#f0cf7e'; g.fillRect(0, H - 64, 120, 64);
    g.fillStyle = '#0b0e13'; g.font = '800 24px Inter, sans-serif'; g.fillText('LIVE', 30, H - 32);
    g.save(); g.beginPath(); g.rect(120, H - 64, W - 120, 64); g.clip();
    g.fillStyle = '#fff'; g.font = '500 26px Inter, sans-serif';
    var tw = g.measureText(tickerText).width + 200;
    tickerX -= (dt || 0) * 90; if (tickerX < -tw) tickerX = 0;
    g.fillText(tickerText, 140 + tickerX, H - 32); g.fillText(tickerText, 140 + tickerX + tw, H - 32);
    g.restore();
    tex.tv.tex.needsUpdate = true;
  }

  function drawStatic() {
    var me = HD.me(), t = HD.myTeam(), G = HD.G;
    var g = tex.plate.ctx;
    g.fillStyle = '#2a1d14'; g.fillRect(0, 0, 512, 96);
    g.fillStyle = '#e8c97a'; g.font = '700 40px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(HD.fullName(me).toUpperCase(), 256, 40); g.font = '500 22px Inter, sans-serif'; g.fillText('GENERAL MANAGER', 256, 78); g.textAlign = 'left';
    tex.plate.tex.needsUpdate = true;
    g = tex.doorPlate.ctx;
    g.fillStyle = '#d8c27a'; g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#2a1d14'; g.font = '700 44px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(t ? 'OWNER · ' + G.people[t.ownerId].last.toUpperCase() : 'OWNER', 256, 64); g.textAlign = 'left';
    tex.doorPlate.tex.needsUpdate = true;
    g = tex.cal.ctx;
    g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, 256, 320);
    g.fillStyle = '#b5121b'; g.fillRect(0, 0, 256, 70);
    g.fillStyle = '#fff'; g.font = '700 30px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(HD.seasonLabel(G.season), 128, 36);
    g.fillStyle = '#222'; g.font = '800 120px Inter, sans-serif'; g.fillText(G.week, 128, 165);
    g.font = '600 22px Inter, sans-serif'; g.fillStyle = '#555'; g.fillText('WEEK', 128, 240);
    g.fillText(HD.PHASE_NAMES[HD.phaseOf(G.week)].toUpperCase(), 128, 280); g.textAlign = 'left';
    tex.cal.tex.needsUpdate = true;
    if (t) {
      g = tex.sign.ctx;
      g.fillStyle = t.colors[0]; g.fillRect(0, 0, 1024, 160);
      g.fillStyle = '#fff'; g.font = '800 92px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(t.arena.toUpperCase(), 512, 84); g.textAlign = 'left';
      tex.sign.tex.needsUpdate = true;
      g = tex.pennant.ctx;
      g.clearRect(0, 0, 512, 128);
      g.fillStyle = t.colors[0]; g.beginPath(); g.moveTo(0, 0); g.lineTo(512, 64); g.lineTo(0, 128); g.closePath(); g.fill();
      g.fillStyle = t.colors[1]; g.font = '800 54px Cinzel, Georgia, serif'; g.textBaseline = 'middle'; g.fillText(t.name.toUpperCase(), 24, 66);
      tex.pennant.tex.needsUpdate = true;
      P.stripeM.color.set(t.colors[0]); P.arenaBandM.color.set(t.colors[0]); P.rugM.color.set(t.colors[0]).multiplyScalar(0.6);
    }
    tickerText = G.news.slice(0, 12).map(function (n) { return n.t; }).join('   •   ');
    // Laptop: net worth and a stock chart
    g = tex.laptop.ctx;
    g.fillStyle = '#0f1620'; g.fillRect(0, 0, 512, 320);
    g.fillStyle = '#9aa3b2'; g.font = '500 22px Inter, sans-serif'; g.fillText('Net worth', 20, 40);
    g.fillStyle = '#f0cf7e'; g.font = '700 48px Inter, sans-serif'; g.fillText(HD.money(HD.netWorth(me)), 20, 92);
    var s = G.stocks[0].hist.slice(-30), mn = Math.min.apply(null, s), mxv = Math.max.apply(null, s);
    g.strokeStyle = s[s.length - 1] >= s[0] ? '#5fbf77' : '#e0605a'; g.lineWidth = 4; g.beginPath();
    s.forEach(function (v, i) { var x = 20 + i / Math.max(1, s.length - 1) * 470, y = 290 - (v - mn) / ((mxv - mn) || 1) * 160; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke();
    g.fillStyle = '#9aa3b2'; g.font = '500 18px Inter, sans-serif'; g.fillText('PUCK $' + G.stocks[0].price.toFixed(2), 20, 120);
    tex.laptop.tex.needsUpdate = true;
  }

  function syncTrophies() {
    var me = HD.me(), t = HD.myTeam();
    while (P.trophies.children.length) P.trophies.remove(P.trophies.children[0]);
    var n = Math.min(12, me.career.titles + (t ? t.titles.length : 0) + (me.career.playoffs ? 1 : 0));
    for (var i = 0; i < n; i++) {
      var cup = new T.Group();
      var big = i < me.career.titles;
      cup.add(at(cyl(0.07, 0.09, 0.05, P.cupM), 0, 0.025, 0));
      cup.add(at(cyl(0.025, 0.025, big ? 0.18 : 0.1, P.cupM), 0, big ? 0.14 : 0.1, 0));
      cup.add(at(cyl(big ? 0.1 : 0.06, 0.04, big ? 0.14 : 0.09, P.cupM), 0, big ? 0.3 : 0.2, 0));
      cup.position.set(-0.55 + (i % 4) * 0.36, [0.77, 1.37, 1.97][Math.floor(i / 4)], 0);
      P.trophies.add(cup);
    }
  }
  function syncCash() {
    var t = HD.myTeam();
    while (P.cash.children.length) P.cash.remove(P.cash.children[0]);
    var stacks = t ? HD.clamp(Math.round(t.finance.balance / 15e6), 0, 8) : 0;
    var m = mat('#5f9a52');
    for (var i = 0; i < stacks; i++) P.cash.add(at(box(0.22, 0.08, 0.12, m), -0.3 + (i % 4) * 0.2, 1.34 + Math.floor(i / 4) * 0.08, 0));
  }

  // ---------- Visitors & phone ----------
  function pendingIsPhone() { var e = HD.G.pendingEvents[0]; return !!(e && PHONE_EVENTS[e.id]); }
  function visitorFor(ev) {
    if (!ev || PHONE_EVENTS[ev.id]) return null;
    try {
      var v = HD.EVENTS[ev.id].view(ev.ctx);
      var ids = (v.portraits || []).filter(function (id) { return id && id !== HD.G.playerId && HD.person(id) && HD.person(id).alive; });
      return ids[0] || null;
    } catch (e) { return null; }
  }
  function spawnVisitor(pid) {
    var p = HD.person(pid);
    var ch = makeChar(p);
    ch.position.set(5.8, 0, DOOR.z);
    var op = HD.opinion(pid, HD.G.playerId), L = HD.opinionLabel(op);
    var tag = label(HD.fullName(p) + '  ' + HD.signed(op), { 'op-hate': '#e0605a', 'op-hostile': '#e0605a', 'op-friendly': '#5fbf77', 'op-devoted': '#5fbf77' }[L.c] || '#9aa3b2');
    tag.position.y = 2.15; ch.add(tag);
    scene.add(clickable(ch, HD.fullName(p) + ' wants a word', function () { HD.UI.showEvent(); }));
    visitor = { pid: pid, g: ch, path: [{ x: DOOR.x, z: DOOR.z }, { x: CHAIR.x + 0.9, z: DOOR.z - 1.2 }, { x: CHAIR.x + 0.25, z: CHAIR.z }], i: 0, state: 'enter', t: 0 };
    P.doorOpen = 1.2;
  }
  function dismissVisitor() {
    if (!visitor) return;
    var v = visitor; visitor = null;
    v.state = 'leave'; v.path = [{ x: CHAIR.x + 0.9, z: DOOR.z - 1.2 }, { x: DOOR.x, z: DOOR.z }, { x: 6.0, z: DOOR.z }]; v.i = 0;
    clickables = clickables.filter(function (c) { return c !== v.g; });
    leaving.push(v); P.doorOpen = 2.5;
  }
  function stepWalker(v, dt) {
    var target = v.path[v.i];
    if (!target) return true;
    var dx = target.x - v.g.position.x, dz = target.z - v.g.position.z, d = Math.sqrt(dx * dx + dz * dz);
    var speed = 1.5 * dt;
    v.g.rotation.y = Math.atan2(dx, dz);
    if (d <= speed) { v.g.position.x = target.x; v.g.position.z = target.z; v.i++; return v.i >= v.path.length; }
    v.g.position.x += dx / d * speed; v.g.position.z += dz / d * speed;
    pose(v.g, 'walk', v.t);
    return false;
  }

  // ---------- Public API ----------
  O.mount = function (el) {
    if (!O.supported()) return false;
    if (!renderer) {
      build();
      renderer.domElement.addEventListener('pointermove', function (e) {
        var r = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1; pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
        mx = pointer.x; my = pointer.y; pointerMoved = true;
        if (tip) { tip.style.left = (e.clientX - r.left + 14) + 'px'; tip.style.top = (e.clientY - r.top + 14) + 'px'; }
      });
      renderer.domElement.addEventListener('pointerleave', function () { pointer.set(-9, -9); pointerMoved = true; });
      renderer.domElement.addEventListener('click', function (e) {
        var r = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1; pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
        var hit = pick();
        if (hit && hit.userData.act) hit.userData.act();
      });
      window.addEventListener('resize', resize);
      requestAnimationFrame(loop);
    }
    host = el;
    el.insertBefore(renderer.domElement, el.firstChild);
    tip = el.querySelector('.office-tip'); bubble = el.querySelector('.office-bubble');
    resize();
    O.sync();
    return true;
  };

  function resize() {
    if (!host || !host.isConnected) return;
    var r = host.getBoundingClientRect();
    var h = Math.max(380, window.innerHeight - r.top);
    host.style.height = h + 'px';
    renderer.setSize(r.width, h);
    camera.aspect = r.width / h;
    camera.fov = camera.aspect < 1 ? 80 : 50;
    camera.updateProjectionMatrix();
  }

  O.sync = function () {
    if (!renderer || !HD.G) return;
    var G = HD.G, me = HD.me(), t = HD.myTeam();
    var phase = HD.phaseOf(G.week);
    if (lastSig.phase !== phase) { drawSky(phase); lastSig.phase = phase; }
    drawMonitor(); drawBoard(); drawStatic(); drawTV(0);
    var corkSig = [G.absWeek, G.pendingEvents.length, me.teamId, Object.keys(me.relations).length].join('|') + HD.myPlayers().length;
    if (corkSig !== lastSig.cork) { drawCork(); lastSig.cork = corkSig; }
    syncTrophies(); syncCash();
    // Decor tiers follow your prestige / ownership
    P.tier2.visible = me.prestige >= 30 || me.assets.length >= 2;
    P.tier3.visible = me.prestige >= 75 || me.stakes >= 50;
    // Inbox stack
    var n = G.pendingEvents.length;
    P.papers.forEach(function (pp, i) { pp.visible = i < n; pp.material.emissive.set(n ? 0x3a2a00 : 0x000000); });
    // Door lamp shows job security
    if (t) { var oop = HD.opinion(t.ownerId, me.id); P.doorLightM.color.set(me.stakes >= 50 ? 0xd4a94f : oop <= -40 ? 0xff3b30 : oop < 0 ? 0xffb020 : 0x55ff88); }
    // Arena excitement
    var hype = t ? t.hype : 40;
    var night = phase === 'regular' || phase === 'playoffs';
    P.beams.forEach(function (b, i) { b.visible = night && i < Math.round(hype / 25); });
    P.arenaBandM.emissive.set(night ? (t ? t.colors[0] : '#223') : '#000000');
    P.arenaBandM.emissiveIntensity = night ? 0.6 : 0;
    // You, at your desk
    if (!P.me || P.me.userData.pid !== me.id || P.meTeam !== me.teamId) {
      if (P.me) { scene.remove(P.me); var old = P.me; clickables = clickables.filter(function (c) { return c !== old; }); }
      P.me = makeChar(me); P.me.position.set(0, 0, -2.4); pose(P.me, 'sit');
      P.meTeam = me.teamId;
      scene.add(clickable(P.me, 'You — ' + HD.fullName(me), function () { HD.UI.showPerson(me.id); }));
    }
    // Visitors and phone calls follow the decision queue
    var ev = G.pendingEvents[0];
    var vid = visitorFor(ev);
    if (visitor && visitor.pid !== vid) dismissVisitor();
    if (vid && !visitor) spawnVisitor(vid);
    phone.ringing = !!(ev && PHONE_EVENTS[ev.id]);
    if (!ev) autoOpenedFor = null;
    if (ev && !vid && !phone.ringing && autoOpenedFor !== ev) { arrivedAt = elapsed(); }
    if (phone.ringing && autoOpenedFor !== ev && !phone.t) phone.t = elapsed();
  };

  function pick() {
    raycaster.setFromCamera(pointer, camera);
    var hits = raycaster.intersectObjects(clickables, true);
    for (var i = 0; i < hits.length; i++) { var r = hits[i].object.userData.root; if (r && r.userData.act) return r; }
    return null;
  }

  function setHover(obj) {
    if (hovered === obj) return;
    var set = function (o, on) { o.traverse(function (m) { if (m.isMesh && m.material && m.material.emissive && !m.userData.keepEmissive) { if (on) { m.userData.e0 = m.material.emissive.getHex(); m.material.emissive.set(0x3a2a08); } else if (m.userData.e0 !== undefined) m.material.emissive.setHex(m.userData.e0); } }); };
    if (hovered) set(hovered, false);
    hovered = obj;
    if (obj) set(obj, true);
    if (tip) { tip.style.display = obj ? 'block' : 'none'; if (obj) tip.textContent = obj.userData.label; }
    renderer.domElement.style.cursor = obj ? 'pointer' : 'default';
  }

  function maybeAutoOpen(now) {
    var G = HD.G, ev = G.pendingEvents[0];
    if (!ev || autoOpenedFor === ev || HD.UI.modal || HD.UI.tab !== 'office') return;
    var ready = false;
    if (visitor && visitor.state === 'sit' && now - visitor.sitAt > 0.6) ready = true;
    else if (phone.ringing && phone.t && now - phone.t > 1.6) ready = true;
    else if (!visitor && !phone.ringing && now - arrivedAt > 0.8) ready = true;
    if (ready) { autoOpenedFor = ev; phone.t = 0; HD.UI.showEvent(); }
  }

  function loop() {
    requestAnimationFrame(loop);
    if (!host || !host.isConnected || !HD.G) return;
    var tnow = performance.now(), dt = Math.min(0.25, (tnow - lastFrame) / 1000), now = elapsed();
    lastFrame = tnow;
    // Camera with gentle parallax
    var narrow = camera.aspect < 1;
    var cx = (narrow ? 0.3 : 0.5) + mx * 0.5, cy = (narrow ? 2.7 : 3.0) + my * 0.25;
    camera.position.x += (cx - camera.position.x) * 0.05;
    camera.position.y += (cy - camera.position.y) * 0.05;
    camera.position.z = camera.aspect < 1 ? 4.9 : 8.4;
    camera.lookAt(0.3, 1.45, -1.2);
    // Visitors
    if (visitor) {
      visitor.t += dt;
      if (visitor.state === 'enter' && stepWalker(visitor, dt)) { visitor.state = 'sit'; visitor.sitAt = now; visitor.g.position.set(CHAIR.x, 0, CHAIR.z); visitor.g.rotation.y = -Math.PI / 2; pose(visitor.g, 'sit'); }
      if (visitor.state === 'sit') visitor.g.userData.head.rotation.y = Math.sin(now * 0.8) * 0.15;
    }
    leaving = leaving.filter(function (v) { v.t += dt; if (stepWalker(v, dt)) { scene.remove(v.g); return false; } return true; });
    // Door swing
    var openTarget = P.doorOpen > 0 ? -1.2 : 0; P.doorOpen = Math.max(0, (P.doorOpen || 0) - dt);
    P.doorLeaf.rotation.y += (openTarget - P.doorLeaf.rotation.y) * 0.12;
    // You: typing, glance at visitors
    if (P.me) {
      var hd = P.me.userData.head;
      hd.rotation.y += ((visitor && visitor.state === 'sit' ? 1.0 : Math.sin(now * 0.3) * 0.2) - hd.rotation.y) * 0.05;
      P.me.userData.arms[0].rotation.x = -1.1 + Math.sin(now * 14) * 0.05; P.me.userData.arms[1].rotation.x = -1.1 + Math.cos(now * 13) * 0.05;
    }
    // Phone
    if (phone.ringing) { P.handset.position.y = 0.1 + Math.abs(Math.sin(now * 30)) * 0.02 * (Math.sin(now * 3) > 0 ? 1 : 0); P.phoneLightM.color.set(Math.sin(now * 8) > 0 ? 0xff4040 : 0x331010); }
    else { P.handset.position.y = 0.1; P.phoneLightM.color.set(0x333333); }
    // Ambient motion
    P.beams.forEach(function (b, i) { b.rotation.z = Math.sin(now * 0.4 + i * 1.7) * 0.45; b.rotation.x = Math.cos(now * 0.3 + i) * 0.15; });
    if (P.snow.visible) { var a = P.snow.geometry.attributes.position; for (var i = 0; i < a.count; i++) { var y = a.getY(i) - dt * 1.2; if (y < -5) y = 20; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(now + i) * dt * 0.1); } a.needsUpdate = true; }
    if (P.tier3.visible) P.fish.forEach(function (f, i) { var s = now * (0.4 + i * 0.12) + i * 2; f.position.set(Math.sin(s * 1.3) * 0.12, 0.95 + i * 0.09 + Math.sin(s * 2) * 0.03, Math.sin(s) * 0.45); f.rotation.y = Math.cos(s) > 0 ? 0 : Math.PI; });
    if (Math.floor(now * 25) !== Math.floor((now - dt) * 25)) drawTV(dt * 2);
    // Hover
    if (pointerMoved) { pointerMoved = false; setHover(pick()); }
    // Visitor bubble
    if (bubble) {
      if (visitor && visitor.state === 'sit' && !HD.UI.modal) {
        var v = new T.Vector3(); visitor.g.userData.head.getWorldPosition(v); v.y += 0.75; v.project(camera);
        var r = renderer.domElement.getBoundingClientRect();
        bubble.style.display = 'block';
        bubble.style.left = ((v.x + 1) / 2 * r.width) + 'px'; bubble.style.top = ((1 - v.y) / 2 * r.height) + 'px';
        bubble.textContent = HD.person(visitor.pid) ? '"Got a minute?"' : '';
      } else if (phone.ringing && !HD.UI.modal) {
        var v2 = new T.Vector3(); P.phone.getWorldPosition(v2); v2.y += 0.5; v2.project(camera);
        var r2 = renderer.domElement.getBoundingClientRect();
        bubble.style.display = 'block';
        bubble.style.left = ((v2.x + 1) / 2 * r2.width) + 'px'; bubble.style.top = ((1 - v2.y) / 2 * r2.height) + 'px';
        bubble.textContent = '☎ Ring ring!';
      } else bubble.style.display = 'none';
    }
    maybeAutoOpen(now);
    renderer.render(scene, camera);
  }

  return O;
})();
