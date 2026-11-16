// Maracanã em 3D com as proporções reais do estádio, usado como radar de notícias.
// Campo 105 x 68 m; casca externa de cerca de 317 x 279 m; duas arquibancadas e a cobertura em anel.
// O modelo é construído aqui, em código, a partir dessas medidas (não é um escaneamento do estádio).
import * as THREE from "./vendor/three.module.min.js";

const DEG = Math.PI / 180;
const P = 0.38;                    // fração do raio que corresponde ao gramado (últimas 6 h)
const A0 = 72, B0 = 54;            // meio-eixos da borda do gramado
const A1 = 140, B1 = 123;          // meio-eixos da borda superior da arquibancada
const ROOF_IN = [122, 107, 50];    // borda interna da cobertura: a, b, altura
const ROOF_OUT = [158, 139, 44];   // borda externa da cobertura
const FACADE_BASE = [152, 134];
const RING_HOURS = [[P, "6 h"], [0.627, "24 h"], [0.836, "3 dias"], [1, "7 dias"]];

// altura da arquibancada ao longo do raio: inferior, passarela e superior
function altura(r) {
  if (r <= 0.66) { const t = (r - P) / (0.66 - P); return 1.5 + 15 * Math.pow(t, 1.15); }
  if (r <= 0.72) { const t = (r - 0.66) / 0.06; return 16.5 + 2.5 * t; }
  const t = (r - 0.72) / 0.28; return 19 + 21 * Math.pow(t, 1.1);
}
function eixos(r) { const t = (r - P) / (1 - P); return [A0 + (A1 - A0) * t, B0 + (B1 - B0) * t]; }
function superficie(rho, th) {
  if (rho <= P) { const k = rho / P; return [Math.cos(th) * A0 * k, 0, Math.sin(th) * B0 * k]; }
  const r = Math.min(rho, 1), ab = eixos(r);
  return [Math.cos(th) * ab[0], altura(r), Math.sin(th) * ab[1]];
}
function corDaArquibancada(r) {
  if (r < 0.66) return [0.22, 0.36, 0.66];
  if (r < 0.72) return [0.62, 0.61, 0.60];
  return [0.17, 0.28, 0.55];
}

function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function tex(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}

function texturaCampo(logo) {
  const W = 1050, H = 680, c = canvas(W, H), x = c.getContext("2d");
  for (let i = 0; i < 21; i++) { x.fillStyle = i % 2 ? "#2e7a40" : "#36874a"; x.fillRect(i * W / 21, 0, W / 21 + 1, H); }
  x.strokeStyle = "rgba(255,255,255,.92)"; x.lineWidth = 3; x.fillStyle = "rgba(255,255,255,.92)";
  x.strokeRect(2, 2, W - 4, H - 4);
  x.beginPath(); x.moveTo(W / 2, 2); x.lineTo(W / 2, H - 2); x.stroke();
  x.beginPath(); x.arc(W / 2, H / 2, 91.5, 0, 2 * Math.PI); x.stroke();
  x.beginPath(); x.arc(W / 2, H / 2, 4, 0, 2 * Math.PI); x.fill();
  [0, 1].forEach(function (lado) {
    x.strokeRect(lado ? W - 165 : 2, (H - 403) / 2, 163, 403);
    x.strokeRect(lado ? W - 55 : 2, (H - 183) / 2, 53, 183);
    x.beginPath(); x.arc(lado ? W - 110 : 110, H / 2, 4, 0, 2 * Math.PI); x.fill();
    const cx = lado ? W - 110 : 110, ang = Math.acos(55 / 91.5);
    x.beginPath();
    if (lado) x.arc(cx, H / 2, 91.5, Math.PI - ang, Math.PI + ang); else x.arc(cx, H / 2, 91.5, -ang, ang);
    x.stroke();
  });
  const t = tex(c); t.anisotropy = 8;
  if (logo) {
    const pintar = function () { x.globalAlpha = 0.9; const w = 150, h = w * logo.height / logo.width; x.drawImage(logo, W / 2 - w / 2, H / 2 - h / 2, w, h); x.globalAlpha = 1; t.needsUpdate = true; };
    if (logo.complete && logo.naturalWidth) pintar(); else logo.addEventListener("load", pintar);
  }
  return t;
}

function texturaAssentos() {
  const c = canvas(64, 32), x = c.getContext("2d");
  x.fillStyle = "#ffffff"; x.fillRect(0, 0, 64, 32);
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 4 === 0 ? "rgba(0,0,0,.28)" : "rgba(0,0,0,.12)"; x.fillRect(i * 8, 0, 1, 32); }
  x.fillStyle = "rgba(0,0,0,.34)"; x.fillRect(0, 27, 64, 5);
  x.fillStyle = "rgba(255,255,255,.14)"; x.fillRect(0, 0, 64, 3);
  return tex(c, true);
}

function texturaFachada() {
  const c = canvas(256, 256), x = c.getContext("2d");
  x.fillStyle = "#e2dcd2"; x.fillRect(0, 0, 256, 256);
  x.fillStyle = "#b9b2a7"; x.fillRect(0, 0, 256, 22); x.fillRect(0, 232, 256, 24);
  for (let i = 0; i < 8; i++) {
    const px = i * 32 + 9;
    x.fillStyle = "#3b3433";
    x.beginPath(); x.moveTo(px, 224); x.lineTo(px, 70); x.quadraticCurveTo(px + 7, 46, px + 14, 70); x.lineTo(px + 14, 224); x.closePath(); x.fill();
    x.fillStyle = "rgba(255,255,255,.35)"; x.fillRect(px - 3, 30, 2, 194);
  }
  return tex(c, true);
}

function rotulo(texto, w, h, cor, fonte) {
  const c = canvas(512, 128), x = c.getContext("2d");
  x.font = "800 " + (fonte || 54) + 'px Archivo, "Arial Narrow", Arial, sans-serif';
  x.textAlign = "center"; x.textBaseline = "middle";
  x.lineJoin = "round"; x.lineWidth = 12; x.strokeStyle = "rgba(15,8,10,.92)";
  x.strokeText(texto, 256, 66); x.fillStyle = cor; x.fillText(texto, 256, 66);
  const m = new THREE.SpriteMaterial({ map: tex(c), transparent: true, depthTest: false, depthWrite: false });
  const s = new THREE.Sprite(m); s.scale.set(w, h, 1); s.renderOrder = 20; return s;
}

function grade(nr, nt, ponto, uvEscala, cor) {
  const pos = [], uv = [], col = [], idx = [];
  for (let i = 0; i <= nr; i++) for (let j = 0; j <= nt; j++) {
    const p = ponto(i / nr, j / nt * 2 * Math.PI); pos.push(p[0], p[1], p[2]);
    uv.push(j / nt * uvEscala[0], i / nr * uvEscala[1]);
    if (cor) { const k = cor(i / nr); col.push(k[0], k[1], k[2]); }
  }
  for (let i = 0; i < nr; i++) for (let j = 0; j < nt; j++) {
    const a = i * (nt + 1) + j, b = a + 1, c = a + nt + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  if (cor) g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

function laco(pontos, cor, opac) {
  const g = new THREE.BufferGeometry().setFromPoints(pontos);
  return new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color: cor, transparent: opac < 1, opacity: opac }));
}
function tubo(a, b, y, raio, cor) {
  const pts = []; for (let j = 0; j < 160; j++) { const t = j / 160 * 2 * Math.PI; pts.push(new THREE.Vector3(a * Math.cos(t), y, b * Math.sin(t))); }
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 240, raio, 6, true), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.6 }));
}

function montarEstadio(cena, logo) {
  const g = new THREE.Group(); cena.add(g);
  // chão e esplanada
  const chao = new THREE.Mesh(new THREE.CircleGeometry(900, 64), new THREE.MeshStandardMaterial({ color: 0x140b0e, roughness: 1 }));
  chao.rotation.x = -Math.PI / 2; chao.position.y = -0.3; g.add(chao);
  const espl = new THREE.Mesh(new THREE.CircleGeometry(1, 128), new THREE.MeshStandardMaterial({ color: 0x2a1d20, roughness: 1 }));
  espl.scale.set(210, 186, 1); espl.rotation.x = -Math.PI / 2; espl.position.y = -0.1; g.add(espl);
  // gramado: faixa de escape e campo
  const esc = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshStandardMaterial({ color: 0x1f5a31, roughness: 1 }));
  esc.scale.set(A0, B0, 1); esc.rotation.x = -Math.PI / 2; esc.position.y = 0.02; g.add(esc);
  const campo = new THREE.Mesh(new THREE.PlaneGeometry(105, 68), new THREE.MeshStandardMaterial({ map: texturaCampo(logo), roughness: 0.95 }));
  campo.rotation.x = -Math.PI / 2; campo.position.y = 0.06; g.add(campo);
  // arquibancadas
  const assentos = texturaAssentos(); assentos.repeat.set(1, 1);
  const bacia = new THREE.Mesh(
    grade(72, 192, function (u, th) { return superficie(P + (1 - P) * u, th); }, [96, 54], function (u) { return corDaArquibancada(P + (1 - P) * u); }),
    new THREE.MeshStandardMaterial({ map: assentos, vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }));
  g.add(bacia);
  // muro de fundo da arquibancada e fachada
  const fach = texturaFachada(); fach.repeat.set(1, 1);
  const fachada = new THREE.Mesh(
    grade(1, 192, function (u, th) {
      const a = FACADE_BASE[0] + (ROOF_OUT[0] - FACADE_BASE[0]) * u, b = FACADE_BASE[1] + (ROOF_OUT[1] - FACADE_BASE[1]) * u;
      return [a * Math.cos(th), ROOF_OUT[2] * u, b * Math.sin(th)];
    }, [44, 1]),
    new THREE.MeshStandardMaterial({ map: fach, roughness: 0.8, side: THREE.DoubleSide }));
  g.add(fachada);
  // cobertura em anel
  const cob = new THREE.Mesh(
    grade(1, 192, function (u, th) {
      const a = ROOF_IN[0] + (ROOF_OUT[0] - ROOF_IN[0]) * u, b = ROOF_IN[1] + (ROOF_OUT[1] - ROOF_IN[1]) * u, y = ROOF_IN[2] + (ROOF_OUT[2] - ROOF_IN[2]) * u;
      return [a * Math.cos(th), y, b * Math.sin(th)];
    }, [1, 1]),
    new THREE.MeshStandardMaterial({ color: 0xf4efe8, roughness: 0.7, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false }));
  cob.renderOrder = 3; g.add(cob);
  const nervuras = [];
  for (let k = 0; k < 120; k++) {
    const th = k / 120 * 2 * Math.PI, c = Math.cos(th), s = Math.sin(th);
    nervuras.push(new THREE.Vector3(ROOF_IN[0] * c, ROOF_IN[2], ROOF_IN[1] * s), new THREE.Vector3(ROOF_OUT[0] * c, ROOF_OUT[2], ROOF_OUT[1] * s));
  }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(nervuras), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })));
  g.add(tubo(ROOF_OUT[0], ROOF_OUT[1], ROOF_OUT[2], 1.5, 0xf0ebe3));
  g.add(tubo(ROOF_IN[0], ROOF_IN[1], ROOF_IN[2], 1.1, 0xe6e0d8));
  // anéis de tempo e divisórias dos setores, sobre a arquibancada
  RING_HOURS.slice(1).forEach(function (r) {
    const pts = []; for (let j = 0; j < 180; j++) { const p = superficie(r[0], j / 180 * 2 * Math.PI); pts.push(new THREE.Vector3(p[0], p[1] + 0.6, p[2])); }
    g.add(laco(pts, 0xff3b55, 0.55));
  });
  const pg = []; for (let j = 0; j < 120; j++) { const p = superficie(P, j / 120 * 2 * Math.PI); pg.push(new THREE.Vector3(p[0], 0.3, p[2])); }
  g.add(laco(pg, 0xff3b55, 0.55));
  const div = [];
  for (let k = 0; k < 6; k++) {
    const th = (-120 + 60 * k) * DEG;
    for (let i = 0; i < 40; i++) {
      const a = superficie(P + (1 - P) * i / 40, th), b = superficie(P + (1 - P) * (i + 1) / 40, th);
      div.push(new THREE.Vector3(a[0], a[1] + 0.6, a[2]), new THREE.Vector3(b[0], b[1] + 0.6, b[2]));
    }
  }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(div), new THREE.LineBasicMaterial({ color: 0xff3b55, transparent: true, opacity: 0.4 })));
  RING_HOURS.forEach(function (r) {
    const p = superficie(r[0], -120 * DEG), s = rotulo(r[1], 36, 9, "#e6d9dc", 50);
    s.position.set(p[0], p[1] + 4, p[2]); g.add(s);
  });
  return g;
}

export function createStadium(host, opcoes) {
  const op = opcoes || {};
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x150c0e, 1);
  const cv = renderer.domElement;
  cv.style.cssText = "display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab";
  cv.setAttribute("role", "img");
  cv.setAttribute("aria-label", "Maracanã em 3D com as notícias como marcadores. Arraste para girar.");
  host.appendChild(cv);

  const cena = new THREE.Scene();
  cena.fog = new THREE.Fog(0x150c0e, 520, 1100);
  const cam = new THREE.PerspectiveCamera(38, 1, 5, 2400);
  cena.add(new THREE.AmbientLight(0xffffff, 1.05));
  cena.add(new THREE.HemisphereLight(0xc9d6ff, 0x3a2128, 0.9));
  const sol = new THREE.DirectionalLight(0xfff0dc, 2.4); sol.position.set(-180, 300, 160); cena.add(sol);

  let logo = null;
  if (op.logoUrl) { logo = new Image(); logo.src = op.logoUrl; }
  const est = montarEstadio(cena, logo);

  // rótulos dos setores, acima da cobertura
  const setores = [];
  (op.setores || []).forEach(function (nome, i) {
    const th = (-90 + 60 * i) * DEG, s = rotulo(nome.toUpperCase(), 62, 15.5, "#f4ecec", 52);
    s.position.set(Math.cos(th) * 182, 58, Math.sin(th) * 160); s.userData.setor = i; cena.add(s); setores.push(s);
  });

  // câmera orbital
  const alvo = new THREE.Vector3(0, 8, 0);
  const cs = { yaw: 0, pit: 0.9, dist: 520, auto: !matchMedia("(prefers-reduced-motion: reduce)").matches, t0: performance.now() };
  let distBase = 520, w = 1, h = 1;
  function posicionar() {
    const cp = Math.cos(cs.pit);
    cam.position.set(alvo.x + cs.dist * Math.sin(cs.yaw) * cp, alvo.y + cs.dist * Math.sin(cs.pit), alvo.z + cs.dist * Math.cos(cs.yaw) * cp);
    cam.lookAt(alvo);
  }
  function ajustar() {
    w = Math.max(80, host.clientWidth); h = Math.max(80, host.clientHeight);
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    const novo = Math.max(360, 660 / Math.min(1.35, w / h));
    if (Math.abs(cs.dist - distBase) < 1) cs.dist = novo; distBase = novo;
    pronto = true; sujo = true;
  }
  let pronto = false, sujo = true;

  // marcadores das notícias
  const marcas = new THREE.Group(); cena.add(marcas);
  let lista = [], fresco = [];
  const matLinha = new THREE.MeshBasicMaterial({ color: 0xff7a8c, transparent: true, opacity: 0.75 });
  const geoLinha = new THREE.CylinderGeometry(0.45, 0.45, 1, 6); geoLinha.translate(0, 0.5, 0);
  const geoEsfera = new THREE.SphereGeometry(3.3, 20, 14);
  const geoBase = new THREE.RingGeometry(2.6, 4.2, 28); geoBase.rotateX(-Math.PI / 2);
  const geoHit = new THREE.SphereGeometry(7.5, 8, 6);
  const matHit = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const matBase = new THREE.MeshBasicMaterial({ color: 0xff3b55, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  const geoAnel = new THREE.TorusGeometry(6.2, 0.7, 8, 32);
  const matAnel = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const matCheia = new THREE.MeshBasicMaterial({ color: 0xff3b55 });
  const matFraca = new THREE.MeshBasicMaterial({ color: 0xff3b55, transparent: true, opacity: 0.2, depthWrite: false });
  const matLinhaFraca = new THREE.MeshBasicMaterial({ color: 0xff7a8c, transparent: true, opacity: 0.15 });
  const alvos = [];

  function atualizar(itens) {
    while (marcas.children.length) marcas.remove(marcas.children[0]);
    alvos.length = 0; fresco.length = 0; lista = itens || [];
    lista.forEach(function (it) {
      const seg = 60, th = (-90 - 30 + it.cat * seg + seg * (0.15 + 0.7 * it.frac)) * DEG;
      const p = superficie(Math.min(1, Math.max(0.04, it.rho)), th);
      const sobCobertura = it.rho > 0.9, topo = sobCobertura ? 56 : p[1] + (it.rho <= P ? 15 : 13);
      const m = new THREE.Group(); m.position.set(p[0], p[1], p[2]);
      const lin = new THREE.Mesh(geoLinha, it.vis ? matLinha : matLinhaFraca); lin.scale.set(1, Math.max(4, topo - p[1]), 1); m.add(lin);
      const base = new THREE.Mesh(geoBase, it.vis ? matBase : matFraca); base.position.y = 0.5; m.add(base);
      const esf = new THREE.Mesh(geoEsfera, it.vis ? matCheia : matFraca); esf.position.y = topo - p[1]; esf.renderOrder = 8; m.add(esf);
      if (it.hot) {
        esf.scale.setScalar(1.55);
        const an = new THREE.Mesh(geoAnel, matAnel); an.position.y = topo - p[1]; an.rotation.x = Math.PI / 2; m.add(an);
      }
      const hit = new THREE.Mesh(geoHit, matHit); hit.position.y = topo - p[1]; hit.userData.id = it.id; hit.userData.itz = it; m.add(hit);
      marcas.add(m); alvos.push(hit);
      if (it.vis && it.rho < 0.75) fresco.push({ esf: esf, ph: it.frac * 6.28, base: it.hot ? 1.55 : 1 });
    });
    sujo = true;
  }

  // tooltip
  const dica = document.createElement("div");
  dica.style.cssText = "position:absolute;z-index:3;pointer-events:none;max-width:230px;padding:6px 9px;font:600 12px/1.3 Archivo,system-ui,sans-serif;color:#f4ecec;background:rgba(21,12,14,.94);border-left:3px solid #ff3b55;border-radius:2px;display:none";
  host.appendChild(dica);

  const ray = new THREE.Raycaster(), pt = new THREE.Vector2();
  function pegar(ev) {
    const r = cv.getBoundingClientRect();
    pt.set((ev.clientX - r.left) / r.width * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pt, cam);
    const s = ray.intersectObjects(setores, false)[0];
    const a = ray.intersectObjects(alvos, false)[0];
    if (s && (!a || s.distance < a.distance)) return { setor: s.object.userData.setor };
    return a ? { item: a.object.userData.itz } : null;
  }
  function mostrarDica(ev, item) {
    if (!item) { dica.style.display = "none"; return; }
    const r = host.getBoundingClientRect();
    dica.textContent = item.titulo; dica.style.display = "block";
    const x = Math.min(ev.clientX - r.left + 12, r.width - 240), y = Math.max(8, ev.clientY - r.top - 36);
    dica.style.left = Math.max(8, x) + "px"; dica.style.top = y + "px";
  }

  // gestos
  const dedos = new Map(); let inicio = null, distPinca = 0;
  function parar() { cs.auto = false; }
  cv.addEventListener("pointerdown", function (e) {
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    if (dedos.size === 1) inicio = { x: e.clientX, y: e.clientY, t: performance.now(), mexeu: false };
    if (dedos.size === 2) { const v = Array.from(dedos.values()); distPinca = Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y); if (inicio) inicio.mexeu = true; }
    cv.style.cursor = "grabbing";
  });
  cv.addEventListener("pointermove", function (e) {
    const d = dedos.get(e.pointerId);
    if (!d) { const p = pegar(e); cv.style.cursor = p ? "pointer" : "grab"; mostrarDica(e, p && p.item); return; }
    const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY;
    if (dedos.size === 2) {
      const v = Array.from(dedos.values()), nova = Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y);
      if (distPinca) cs.dist = Math.min(760, Math.max(150, cs.dist * distPinca / nova)); distPinca = nova; parar(); sujo = true; return;
    }
    if (inicio && Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 6) { inicio.mexeu = true; parar(); dica.style.display = "none"; }
    if (inicio && inicio.mexeu) {
      cs.yaw -= dx * 0.0065;
      if (e.pointerType === "mouse") cs.pit = Math.min(1.35, Math.max(0.3, cs.pit + dy * 0.005));
      sujo = true;
    }
  });
  function soltar(e) {
    const tinha = dedos.has(e.pointerId); dedos.delete(e.pointerId); distPinca = 0; cv.style.cursor = "grab";
    if (tinha && inicio && !inicio.mexeu && dedos.size === 0 && e.type === "pointerup" && performance.now() - inicio.t < 600) {
      const p = pegar(e);
      if (p && p.item && op.onPick) op.onPick(p.item.id);
      else if (p && p.setor != null && op.onSector) op.onSector(p.setor);
    }
    if (dedos.size === 0) inicio = null;
  }
  cv.addEventListener("pointerup", soltar); cv.addEventListener("pointercancel", soltar);
  cv.addEventListener("pointerleave", function () { dica.style.display = "none"; });
  cv.addEventListener("wheel", function (e) { e.preventDefault(); parar(); cs.dist = Math.min(760, Math.max(150, cs.dist * Math.exp(e.deltaY * 0.0012))); sujo = true; }, { passive: false });

  // laço de desenho: pausa quando a aba está escondida ou o radar fora da tela
  let visivel = true, ultimo = 0;
  if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { visivel = es[0].isIntersecting; }).observe(host);
  function quadro(agora) {
    if (!visivel || document.hidden || !pronto) return;
    if (agora - ultimo < 32) return; ultimo = agora;
    const t = agora / 1000;
    if (cs.auto) { cs.yaw = Math.sin((agora - cs.t0) / 4200) * 0.22; sujo = true; }
    fresco.forEach(function (f) { f.esf.scale.setScalar(f.base * (1 + 0.16 * Math.sin(t * 2.4 + f.ph))); sujo = true; });
    if (!sujo) return; sujo = false;
    posicionar(); renderer.render(cena, cam);
  }
  renderer.setAnimationLoop(quadro);
  const ro = new ResizeObserver(ajustar); ro.observe(host);
  ajustar(); posicionar();

  return {
    update: atualizar,
    resize: ajustar,
    // posição do marcador na tela (para testes e acessibilidade)
    project: function (id) {
      const a = alvos.filter(function (x) { return x.userData.id === id; })[0]; if (!a) return null;
      const v = a.getWorldPosition(new THREE.Vector3()).project(cam), r = cv.getBoundingClientRect();
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
    },
    dispose: function () { renderer.setAnimationLoop(null); ro.disconnect(); renderer.dispose(); cv.remove(); dica.remove(); }
  };
}
