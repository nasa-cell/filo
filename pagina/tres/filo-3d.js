// Filo en 3D para la página: la misma Filo del TikTok Live (modelo VRM) con sus reacciones,
// la ropa del día, la ropa de ocasión, los gestos de espera, zoom y giro.
// La página la carga solo cuando se elige «3D» o «Las dos» (codigo/tres.js).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { crearSimbolos, crearFondos, crearImpacto, crearBoca, ACCESORIOS, dir, sobre, pegar, pieza, lazo, flor, arco, anillo, perfil, gorroBase, orejasPuntas, estrellaGeo, tubo } from './anime.js';
import { ROPA, momentos } from './natural.js';
import { crearManos, VTUBER, REEMPLAZA, HABLANDO, desdeReceta } from './manos.js?v=2';
import { crearAlas } from './alas.js?v=3';

export async function iniciar(caja, { modelo, alas: tamanoAlas = 'medianas', liviano = false, alAvance = () => {}, alFondo = () => {}, alAgotar = () => {} } = {}) {
  const lienzo = document.createElement('canvas');
  lienzo.className = 'tres-lienzo';
  caja.append(lienzo);
  const r = new THREE.WebGLRenderer({ canvas: lienzo, alpha: true, antialias: !liviano, powerPreference: liviano ? 'low-power' : 'default' });
  const nitidez = () => Math.min(devicePixelRatio || 1, 2);  // también en celulares de 4 GB: con menos se ve pixelada
  r.setPixelRatio(nitidez()); r.outputColorSpace = THREE.SRGBColorSpace;
  const esc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(24, 1, .1, 30);
  esc.add(new THREE.HemisphereLight(0xffffff, 0xdfe6f5, 1.15));
  const sol = new THREE.DirectionalLight(0xffffff, 2.1); sol.position.set(.6, 2.2, 2.2); esc.add(sol);
  const FONDOS = crearFondos();
  esc.background = null;  // sin reacción se ve el fondo de la página
  const ponerSimbolos = crearSimbolos(esc), ponerImpacto = crearImpacto(caja), ponerBoca = crearBoca(esc);
  function medir() {
    const w = Math.max(1, caja.clientWidth), h = Math.max(1, caja.clientHeight);
    r.setPixelRatio(nitidez()); r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  new ResizeObserver(medir).observe(caja); medir();

  /* ---------- Personaje y ropa (igual que en Filo en vivo) ---------- */
  const carga = new GLTFLoader(); carga.register(p => new VRMLoaderPlugin(p));
  const vrm = (await carga.loadAsync(modelo, e => alAvance(e.total ? Math.min(1, e.loaded / e.total) : 0))).userData.vrm;
  esc.add(vrm.scene); vrm.scene.traverse(o => { o.frustumCulled = false; });
  const nodo = n => vrm.humanoid.getNormalizedBoneNode(n), crudo = n => vrm.humanoid.getRawBoneNode(n), E = vrm.expressionManager;
  vrm.scene.traverse(o => { if (!o.isMesh) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) { if (!m.isMToonMaterial) continue; const n = m.name || ''; m.shadingToonyFactor = .985; m.shadingShiftFactor = n.includes('Face') ? -.85 : n.includes('SKIN') ? -.42 : -.2; if (n.includes('HAIR')) m.shadeColorFactor.set('#ffb84a'); if (m.outlineWidthFactor > 0) { m.outlineWidthMode = 'screenCoordinates'; m.outlineWidthFactor = n.includes('HAIR') ? .0026 : .0034; m.outlineLightingMixFactor = 0; m.outlineColorFactor.set(n.includes('HAIR') ? '#8a6a14' : n.includes('SKIN') ? '#9c6a5e' : '#3a2c34'); } m.needsUpdate = true; } });
  vrm.scene.updateMatrixWorld(true);
  const yCabeza = crudo('head').getWorldPosition(new THREE.Vector3()).y;
  const foco = new THREE.Vector3(0, yCabeza - .03, 0); cam.position.set(0, yCabeza + .03, 1.55); cam.lookAt(foco);
  const mirada = new THREE.Object3D(); esc.add(mirada); if (vrm.lookAt) vrm.lookAt.target = mirada;
  const rad = g => g * Math.PI / 180, eu = new THREE.Euler();
  const fija = (n, x, y, z) => { eu.set(rad(x), rad(y), rad(z)); nodo(n).quaternion.setFromEuler(eu); };

  /* ---------- Ropa ---------- */
  const forro = { material: { color: new THREE.Color() } }, elegidos = [], EXTRAS = {};
  const materiales = {};
  vrm.scene.traverse(o => { if (!o.isMesh) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) { const n = m.name || ''; const k = n.includes('Onepiece') ? 'chaqueta' : n.includes('Bottoms') ? 'falda' : n.includes('Accessory_Tie') ? 'mono' : n.includes('Body_00_SKIN') ? 'cuerpo' : null; if (k) (materiales[k] ||= new Set()).add(m); } });
  const original = {};
  for (const k in materiales) original[k] = [...materiales[k]].map(m => ({ m, map: m.map, shade: m.shadeMultiplyTexture, color: m.color.clone(), sombra: m.shadeColorFactor ? m.shadeColorFactor.clone() : null }));
  function estampar(k, ancho, alto, o, paso) {
    if (!o.tela) return;
    k.fillStyle = o.color;
    if (o.tela === 'cuadros') { k.globalAlpha = .55; for (let y = 0; y < alto; y += paso) k.fillRect(0, y, ancho, paso * .4); for (let x = 0; x < ancho; x += paso) k.fillRect(x, 0, paso * .4, alto); k.globalAlpha = 1; return; }
    if (o.tela === 'telarana') { k.strokeStyle = o.color; k.lineWidth = Math.max(2, paso * .05); for (let y = 0; y < alto + paso; y += paso * 2) for (let x = 0; x < ancho + paso; x += paso * 2) { for (let a = 0; a < 8; a++) { k.beginPath(); k.moveTo(x, y); k.lineTo(x + Math.cos(a * Math.PI / 4) * paso, y + Math.sin(a * Math.PI / 4) * paso); k.stroke(); } for (let q = 1; q <= 3; q++) { k.beginPath(); k.arc(x, y, paso * q / 3, 0, 7); k.stroke(); } } return; }
    const dibuja = (x, y, i) => {
      k.save(); k.translate(x, y);
      if (o.colores) k.fillStyle = o.colores[Math.floor(i * 7) % o.colores.length];
      if (o.tela === 'corazones') { k.rotate(i * .3 - .8); const s = paso * .2; k.beginPath(); k.moveTo(0, s); k.bezierCurveTo(s * 1.3, s * .2, s * .9, -s * 1.05, 0, -s * .45); k.bezierCurveTo(-s * .9, -s * 1.05, -s * 1.3, s * .2, 0, s); k.fill(); }
      else if (o.tela === 'rombos') { const s = paso * .26; k.beginPath(); k.moveTo(0, -s); k.lineTo(s * .7, 0); k.lineTo(0, s); k.lineTo(-s * .7, 0); k.closePath(); k.fill(); }
      else if (o.tela === 'manchas') { k.rotate(i); k.beginPath(); k.ellipse(0, 0, paso * (.18 + .05 * (i % 2)), paso * .12, 0, 0, 7); k.fill(); }
      else if (o.tela === 'escamas') { k.beginPath(); k.arc(0, 0, paso * .3, 0, Math.PI); k.lineWidth = paso * .06; k.strokeStyle = k.fillStyle; k.stroke(); }
      else if (o.tela === 'lunares') { k.beginPath(); k.arc(0, 0, paso * .17, 0, 7); k.fill(); }
      else if (o.tela === 'brillos') { k.rotate(.4 * i); k.beginPath(); k.moveTo(-paso * .22, 0); k.quadraticCurveTo(0, 0, 0, -paso * .22); k.quadraticCurveTo(0, 0, paso * .22, 0); k.quadraticCurveTo(0, 0, 0, paso * .22); k.quadraticCurveTo(0, 0, -paso * .22, 0); k.fill(); }
      else if (o.tela === 'estrellas') { k.rotate(i); k.beginPath(); for (let n = 0; n < 10; n++) { const r = n % 2 ? paso * .1 : paso * .24, an = n * Math.PI / 5; k.lineTo(Math.sin(an) * r, -Math.cos(an) * r); } k.closePath(); k.fill(); }
      else if (o.tela === 'flores') { k.rotate(i); for (let n = 0; n < 5; n++) { const an = n / 5 * Math.PI * 2; k.beginPath(); k.ellipse(Math.cos(an) * paso * .14, Math.sin(an) * paso * .14, paso * .11, paso * .08, an, 0, 7); k.fill(); } k.fillStyle = o.color2 || o.color; k.beginPath(); k.arc(0, 0, paso * .07, 0, 7); k.fill(); k.fillStyle = o.color; }
      k.restore();
    };
    if (o.tela === 'rayas') { for (let y = 0; y < alto; y += paso) k.fillRect(0, y, ancho, paso * .28); return; }
    let i = 0; for (let y = 0, f = 0; y < alto + paso; y += paso * .87, f++) for (let x = f % 2 ? paso / 2 : 0; x < ancho + paso; x += paso) dibuja(x, y, (i++ * 1.7) % 6);
  }
  const copiaTex = (c, t) => { const n = new THREE.CanvasTexture(c); n.flipY = t.flipY; n.colorSpace = t.colorSpace; n.wrapS = t.wrapS; n.wrapT = t.wrapT; n.anisotropy = 4; return n; };
  const rgb = c => { const x = new THREE.Color(c); x.convertLinearToSRGB(); return [x.r * 255, x.g * 255, x.b * 255]; };
  function crearRopa(o) {
    const t0 = original.chaqueta[0], img = t0.map.image, ancho = img.width, alto = img.height;
    const c = document.createElement('canvas'); c.width = ancho; c.height = alto; const k = c.getContext('2d', { willReadFrequently: true });
    k.drawImage(img, 0, 0); const fuente = k.getImageData(0, 0, ancho, alto);
    k.fillStyle = o.chaqueta; k.fillRect(0, 0, ancho, alto); estampar(k, ancho, alto, o, Math.round(ancho * .05));
    const tela = k.getImageData(0, 0, ancho, alto), F = fuente.data, T = tela.data, bordeC = rgb(o.borde || o.chaqueta), mascara = new Uint8Array(ancho * alto);
    for (let i = 0, n = 0; i < F.length; i += 4, n++) mascara[n] = F[i + 3] > 128 && Math.max(F[i], F[i + 1], F[i + 2]) - Math.min(F[i], F[i + 1], F[i + 2]) >= 70 ? 1 : 0;
    const G = Math.round(ancho * .0075);
    for (let y = 0, i = 0, n = 0; y < alto; y++) for (let x = 0; x < ancho; x++, i += 4, n++) {
      if (!mascara[n]) { T[i] = F[i]; T[i + 1] = F[i + 1]; T[i + 2] = F[i + 2]; T[i + 3] = F[i + 3]; continue; }
      const orilla = x < G || y < G || x >= ancho - G || y >= alto - G || !mascara[n - G] || !mascara[n + G] || !mascara[n - G * ancho] || !mascara[n + G * ancho];
      if (orilla && o.borde) { T[i] = bordeC[0]; T[i + 1] = bordeC[1]; T[i + 2] = bordeC[2]; }
      T[i + 3] = F[i + 3];
    }
    k.putImageData(tela, 0, 0);

    const t1 = original.falda[0], im2 = t1.map.image, c2 = document.createElement('canvas'); c2.width = im2.width; c2.height = im2.height; const k2 = c2.getContext('2d');
    k2.fillStyle = o.falda; k2.fillRect(0, 0, c2.width, c2.height); if (o.falda === o.chaqueta || o.tela === 'rayas') estampar(k2, c2.width, c2.height, o.falda === o.chaqueta ? o : { ...o, tela: null }, Math.round(c2.width * .07));
    if (o.borde) { const an = (o.anchoBorde || .07) * c2.height; k2.fillStyle = o.borde; k2.fillRect(0, c2.height * .985 - an, c2.width, an); k2.fillStyle = o.falda; k2.fillRect(0, c2.height * .985 - an * .62, c2.width, an * .1); }
    k2.globalCompositeOperation = 'multiply'; k2.drawImage(im2, 0, 0); k2.globalCompositeOperation = 'destination-in'; k2.drawImage(im2, 0, 0);

    // Top y medias en la piel del modelo: solo las zonas oscuras de esas partes; el resto no cambia
    const t2 = original.cuerpo[0], im3 = t2.map.image, c3 = document.createElement('canvas'), W = im3.width, H = im3.height; c3.width = W; c3.height = H; const k3 = c3.getContext('2d', { willReadFrequently: true });
    k3.drawImage(im3, 0, 0); const D3 = k3.getImageData(0, 0, W, H), P = D3.data, cTop = rgb(o.top || '#000000'), cMed = rgb(o.medias || '#000000'), piel = (() => { const q = (Math.round(H * .4) * W + Math.round(W * .1)) * 4; return [P[q], P[q + 1], P[q + 2]]; })();
    for (let y = 0, i = 0; y < H; y++) { const v = y / H; for (let x = 0; x < W; x++, i += 4) {
      const u = x / W, lado = u < .2375 || u > .7625, centro = !lado;
      if (lado && v >= .49 && v < .6295 && Math.abs(P[i] - piel[0]) + Math.abs(P[i + 1] - piel[1]) + Math.abs(P[i + 2] - piel[2]) > 30) { P[i] = piel[0]; P[i + 1] = piel[1]; P[i + 2] = piel[2]; continue; }
      if (o.medias && lado && v >= .6295 && v < .67 && Math.abs(P[i] - piel[0]) + Math.abs(P[i + 1] - piel[1]) + Math.abs(P[i + 2] - piel[2]) > 30) { P[i] = cMed[0]; P[i + 1] = cMed[1]; P[i + 2] = cMed[2]; continue; }
      if (Math.max(P[i], P[i + 1], P[i + 2]) > 95) continue;
      if (o.top && centro && v > .09 && v < .49) { P[i] = cTop[0]; P[i + 1] = cTop[1]; P[i + 2] = cTop[2]; continue; }
      if (o.medias) { const luz = .86 + Math.max(P[i], P[i + 1], P[i + 2]) / 255 * .75; if ((lado && v >= .6295) || (centro && v >= .63 && v < .8 && !(u > .47 && u < .53 && v < .64))) { P[i] = Math.min(255, cMed[0] * luz); P[i + 1] = Math.min(255, cMed[1] * luz); P[i + 2] = Math.min(255, cMed[2] * luz); } }
    } }
    k3.putImageData(D3, 0, 0);
    return { tx: copiaTex(c, t0.map), tf: copiaTex(c2, t1.map), tb: copiaTex(c3, t2.map) };
  }
  const colorForro = forro.material.color.clone();
  const mechon = (() => { let mejor = null, alto = -9; const v = new THREE.Vector3(); for (const h of crudo('head').children) { if (!/hair/i.test(h.name)) continue; let tope = -9; h.traverse(b => { if (b.isBone) { b.getWorldPosition(v); tope = Math.max(tope, v.y); } }); if (tope > alto) { alto = tope; mejor = h; } } return mejor; })();
  const adornos = new THREE.Group(), adornosPecho = new THREE.Group(); crudo('head').add(adornos); crudo('upperChest') ? crudo('upperChest').add(adornosPecho) : crudo('chest').add(adornosPecho);
  let ropaActual = null, gorroRopa = false;
  const ajustarMechon = () => { if (!mechon) return; const e = gorroRopa || [...elegidos].some(i => EXTRAS[i].gorro) ? .001 : 1; if (mechon.scale.x !== e) { mechon.scale.setScalar(e); vrm.scene.updateMatrixWorld(true); if (vrm.springBoneManager) vrm.springBoneManager.reset(); } };
  function vaciar(g) { while (g.children.length) { const x = g.children.pop(); x.traverse(y => { if (y.isMesh) { y.geometry.dispose(); y.material.dispose(); } }); } }
  function ponerRopa(id) {
    const pedida = id && typeof id === 'object' ? id : ROPA[id];
    vaciar(adornos); vaciar(adornosPecho);
    const anterior = ropaActual; ropaActual = null;
    forro.material.color.copy(colorForro); gorroRopa = false;
    if (!pedida) { for (const k in original) for (const a of original[k]) { a.m.map = a.map; if ('shadeMultiplyTexture' in a.m) a.m.shadeMultiplyTexture = a.shade; a.m.color.copy(a.color); if (a.sombra) a.m.shadeColorFactor.copy(a.sombra); a.m.needsUpdate = true; } }
    else {
      const o = pedida, t = ropaActual = crearRopa(o), blanco = new THREE.Color(1, 1, 1);
      const pon = (lista, tex, sombra = [.82, .8, .88]) => { for (const a of lista) { a.m.map = tex; if ('shadeMultiplyTexture' in a.m) a.m.shadeMultiplyTexture = tex; a.m.color.copy(blanco); if (a.sombra) a.m.shadeColorFactor.setRGB(...sombra); a.m.needsUpdate = true; } };
      pon(original.chaqueta, t.tx); pon(original.falda, t.tf);
      for (const a of original.cuerpo) { a.m.map = t.tb; if ('shadeMultiplyTexture' in a.m && a.shade) a.m.shadeMultiplyTexture = t.tb; a.m.needsUpdate = true; }
      for (const a of original.mono) { a.m.color.set(o.mono); if (a.sombra) a.m.shadeColorFactor.set(o.mono).multiplyScalar(.75); }
      if (o.extra) { const f = ACC[o.extra] || ACCESORIOS[o.extra]; if (f) f(o, adornos, adornosPecho); }
      forro.material.color.set(o.falda).multiplyScalar(.8);
      gorroRopa = o.extra === 'bruja' || o.extra === 'navidad' || ES_GORRO(o.extra);
    }
    if (anterior) for (const n of ['tx', 'tf', 'tb']) anterior[n].dispose();
    ajustarMechon();
    document.querySelectorAll('[data-ropa]').forEach(b => b.setAttribute('aria-pressed', b.dataset.ropa === id));
  }

  /* ---------- Ropa nueva: la receta de la página (atuendos.json o la que crea Filo) pasada a 3D ---------- */
  const col = c => new THREE.Color(c || '#888888');
  const hex = c => '#' + c.getHexString();
  const mezcla = (a, b, t) => hex(col(a).lerp(col(b), t));
  const oscuro = (a, t) => hex(col(a).multiplyScalar(t));
  const luz = c => { const x = col(c); return .2126 * x.r + .7152 * x.g + .0722 * x.b; };
  // top y medias nunca blancos (se confunden con la piel)
  const noBlanco = (c, otro) => (luz(c) > .72 ? (luz(otro) > .72 ? '#5b6b8f' : otro) : c);
  const TELAS3D = { liso: null, flores: 'flores', estrellas: 'estrellas', lunares: 'lunares', corazones: 'corazones', rayas: 'rayas', cuadros: 'cuadros', rombos: 'rombos', tejido: 'cuadros', brillos: 'brillos', telarana: 'telarana', manchas: 'manchas', vaca: 'manchas', leopardo: 'manchas', cebra: 'rayas', tigre: 'rayas', escamas: 'escamas' };
  function recetaA3D(rc) {
    // el servidor manda los datos de la 3D en «tres»; si faltan, usa los colores de la vista vieja
    const d = rc.dibujo || {};
    rc = { base: d.vestido, mono: d.cinta, ...rc, ...(rc.tres || {}) };
    const base = rc.base || '#9fc2ff', mono = rc.mono || '#e83f5b', t = rc.tela || {}, ad = rc.adorno || {};
    const tela = TELAS3D[t.tipo] || null;
    const colorTela = t.color || (t.colores && t.colores[0]) || mono;
    const franja = (rc.extras || []).find(e => e.tipo === 'franja' || e.tipo === 'franjas' || e.tipo === 'banda');
    return {
      nombre: rc.nombre || rc.id || 'nueva', chaqueta: base, falda: tela ? base : oscuro(base, .86), mono,
      tela, color: colorTela, color2: t.color2 || (t.colores && t.colores[1]) || mezcla(colorTela, '#ffffff', .4), colores: t.colores,
      top: noBlanco(mezcla(base, mono, .5), oscuro(base, .7)), medias: noBlanco(oscuro(base, .72), '#3a3f5c'),
      borde: franja ? franja.color : mono, anchoBorde: franja && franja.alto > 50 ? .12 : .07,
      extra: ad.tipo && ad.tipo !== 'ninguno' ? 'receta:' + ad.tipo : null, a1: ad.color || mono, a2: ad.color2 || mezcla(ad.color || mono, '#ffffff', .5),
    };
  }
  // adornos del pelo de las recetas, hechos con piezas 3D pegadas a la forma real del pelo
  const corazonGeo = s => { const f = new THREE.Shape(); f.moveTo(0, -s); f.bezierCurveTo(s * 1.3, -s * .2, s * .9, s * 1.05, 0, s * .45); f.bezierCurveTo(-s * .9, s * 1.05, -s * 1.3, -s * .2, 0, -s); return new THREE.ExtrudeGeometry(f, { depth: s * .4, bevelEnabled: false }); };
  // marco con hueco (lentes de corazón y antifaz): se le ven los ojos
  const trazoCorazon = (f, s, hueco) => { const m = hueco ? -1 : 1; f.moveTo(0, -s); f.bezierCurveTo(s * 1.3 * m, -s * .2, s * .9 * m, s * 1.05, 0, s * .45); f.bezierCurveTo(-s * .9 * m, s * 1.05, -s * 1.3 * m, -s * .2, 0, -s); };
  const marcoCorazon = (s, g) => { const f = new THREE.Shape(); trazoCorazon(f, s, false); const h = new THREE.Path(); trazoCorazon(h, s * (1 - g), true); f.holes.push(h); return new THREE.ExtrudeGeometry(f, { depth: s * .25, bevelEnabled: false }); };
  const marcoOjo = (a, b, g) => { const f = new THREE.Shape(); f.absellipse(0, 0, a, b, 0, Math.PI * 2, false); const h = new THREE.Path(); h.absellipse(0, 0, a * (1 - g), b * (1 - g * 1.4), 0, Math.PI * 2, true); f.holes.push(h); return new THREE.ExtrudeGeometry(f, { depth: .004, bevelEnabled: false }); };
  const lunaGeo = s => { const f = new THREE.Shape(); f.absarc(0, 0, s, Math.PI * .25, Math.PI * 1.75, false); f.absarc(s * .45, 0, s * .78, Math.PI * 1.6, Math.PI * .4, true); return new THREE.ExtrudeGeometry(f, { depth: s * .35, bevelEnabled: false }); };
  function gorroAnimal(animal, c1, c2) {
    const g = gorroBase(.088); g.rotation.set(-.12, 0, 0);
    const capucha = perfil([[.138, -.035], [.136, .005], [.128, .042], [.112, .076], [.085, .104], [.048, .122], [.001, .128]], c1); g.add(capucha);
    g.add(pieza(new THREE.TorusGeometry(.137, .013, 10, 40).rotateX(Math.PI / 2), c2, 0, -.033, 0));
    const ojo = (x) => { const o = new THREE.Group(); o.position.set(x, .075, .11); o.add(pieza(new THREE.SphereGeometry(.016, 12, 10), '#ffffff'), pieza(new THREE.SphereGeometry(.008, 10, 8), '#1e1e26', 0, 0, .011)); return o; };
    const orejas = (forma, cA, cB) => { for (const l of [-1, 1]) { const o = forma === 'redonda' ? pieza(new THREE.SphereGeometry(.024, 12, 10), cA, l * .11, .1, 0) : pieza(new THREE.ConeGeometry(.022, .055, 10), cA, l * .118, .085, 0); if (forma !== 'redonda') o.rotation.z = -l * .9; o.scale.z = .5; g.add(o); if (cB && forma === 'redonda') { const i = pieza(new THREE.SphereGeometry(.013, 10, 8), cB, l * .11, .1, .008); i.scale.z = .4; g.add(i); } } };
    const cuernos = (cA, largo = .05) => { for (const l of [-1, 1]) { const m = pieza(new THREE.CylinderGeometry(.006, .009, largo, 8), cA, l * .045, .12 + largo / 2 - .01, -.01); m.rotation.z = -l * .25; g.add(m); g.add(pieza(new THREE.SphereGeometry(.012, 10, 8), cA, l * (.045 + largo * .12), .12 + largo - .01, -.01)); } };
    if (animal === 'jirafa') { orejas('punta', c1); cuernos(c2); for (const [x, y, z] of [[.05, .09, .07], [-.06, .06, .08], [.02, .115, .02], [-.03, .1, -.06]]) g.add(pieza(new THREE.SphereGeometry(.014, 8, 6), c2, x, y, z)); }
    else if (animal === 'vaca') { orejas('punta', c1); cuernos('#f2e6c8', .035); for (const [x, y, z] of [[.05, .09, .06], [-.06, .07, .07], [.0, .115, -.04]]) { const m = pieza(new THREE.SphereGeometry(.022, 8, 6), c2, x, y, z); m.scale.z = .5; g.add(m); } }
    else if (animal === 'ciervo') { orejas('punta', c1); for (const l of [-1, 1]) { g.add(tubo([[l * .04, .115, -.01], [l * .07, .17, -.01], [l * .1, .2, -.01]], .006, c2)); g.add(tubo([[l * .06, .155, -.01], [l * .03, .19, -.01]], .005, c2)); } }
    else if (animal === 'unicornio') { orejas('punta', c1); const c = pieza(new THREE.ConeGeometry(.016, .085, 12), c2, 0, .155, .06); c.rotation.x = .35; g.add(c); }
    else if (animal === 'dinosaurio') { for (let i = 0; i < 5; i++) { const a = -.6 + i * .3, m = pieza(new THREE.ConeGeometry(.016, .035, 4), c2, 0, .1 + .028 * Math.cos(a), -.02 + .11 * Math.sin(a) * -1); m.rotation.x = a; g.add(m); } g.add(ojo(-.04), ojo(.04)); }
    else if (animal === 'rana') { for (const l of [-1, 1]) { g.add(pieza(new THREE.SphereGeometry(.03, 14, 12), c1, l * .045, .12, .03)); g.add(ojo(l * .045).translateY(.05).translateZ(-.035)); } }
    else if (animal === 'pato' || animal === 'pollito') { g.add(ojo(-.035), ojo(.035)); const p = pieza(new THREE.ConeGeometry(.014, .035, 8), c2, 0, .045, .14); p.rotation.x = Math.PI / 2; p.scale.y = .8; g.add(p); if (animal === 'pollito') g.add(tubo([[0, .125, 0], [.01, .16, .01], [-.01, .175, .02]], .006, c1)); }
    else if (animal === 'panda') { orejas('redonda', c2); for (const l of [-1, 1]) { const m = pieza(new THREE.SphereGeometry(.018, 10, 8), c2, l * .035, .07, .085); m.scale.set(1, 1.3, .4); g.add(m); } g.add(ojo(-.035).translateZ(.006), ojo(.035).translateZ(.006)); }
    else if (animal === 'oso') orejas('redonda', c1, c2);
    else orejas('redonda', c1, c2);
    return g;
  }
  const ACC = {
    'receta:lazo': (o, cab) => ACCESORIOS.lazo(o, cab),
    'receta:flor': (o, cab) => ACCESORIOS.flor(o, cab),
    'receta:sakura': (o, cab) => cab.add(pegar(flor(o.a1, o.a2, 1.1), dir(-55, 28), .01), pegar(flor(o.a1, o.a2, .8), dir(-30, 40), .01)),
    'receta:girasol': (o, cab) => cab.add(pegar(flor('#ffc83a', '#7a4a1e', 1.3), dir(-55, 28), .01)),
    'receta:margarita': (o, cab) => cab.add(pegar(flor('#ffffff', '#ffd84d', 1.2), dir(-55, 28), .01)),
    'receta:hojas': (o, cab) => { for (const [a, e] of [[-62, 30], [-48, 40], [-36, 30]]) { const m = pieza(new THREE.SphereGeometry(.018, 10, 8), o.a1); m.scale.set(.6, 1.4, .3); pegar(m, dir(a, e), .008); cab.add(m); } },
    'receta:estrella': (o, cab) => { const m = pieza(estrellaGeo(.027), o.a1); pegar(m, dir(-58, 26), .007); cab.add(m); },
    'receta:luna': (o, cab) => { const m = pieza(lunaGeo(.024), o.a1); pegar(m, dir(-58, 26), .007); cab.add(m); },
    'receta:corazon': (o, cab) => { const m = pieza(corazonGeo(.024), o.a1); pegar(m, dir(-58, 26), .007); cab.add(m); },
    'receta:mariposa': (o, cab) => { const g = new THREE.Group(); for (const l of [-1, 1]) for (const [y, s] of [[.012, .022], [-.012, .016]]) { const a = pieza(new THREE.SphereGeometry(s, 10, 8), l > 0 ? o.a1 : o.a1, l * s * .9, y, 0); a.scale.z = .25; g.add(a); } g.add(pieza(new THREE.CylinderGeometry(.004, .004, .035, 6), '#3a2c34')); cab.add(pegar(g, dir(-55, 32), .01)); },
    'receta:vincha': (o, cab) => cab.add(arco(o.a1, .007)),
    'receta:tiara': (o, cab) => ACCESORIOS.tiara(o, cab),
    'receta:cofia': (o, cab) => ACCESORIOS.cofia(o, cab),
    'receta:orejeras': (o, cab) => { cab.add(arco(o.a1, .006, .02, 88)); for (const l of [-1, 1]) { const p = sobre(dir(l * 90, -10), .012); cab.add(pieza(new THREE.SphereGeometry(.034, 14, 12), o.a2, p.x, p.y, p.z)); } },
    'receta:pinzas': (o, cab) => { for (const [a, e] of [[-58, 30], [-48, 38]]) { const m = pieza(new THREE.BoxGeometry(.034, .008, .006), o.a1); pegar(m, dir(a, e), .006); cab.add(m); } },
    'receta:broches': (o, cab) => { for (const l of [-1, 1]) cab.add(pegar(pieza(new THREE.SphereGeometry(.011, 10, 8), o.a1), dir(l * 55, 30), .008)); },
    'receta:lupa': (o, cab) => { const g = new THREE.Group(); g.add(pieza(new THREE.TorusGeometry(.02, .004, 8, 24), o.a1 || '#4a3a2a')); const v = pieza(new THREE.CircleGeometry(.02, 24), '#cfe8ff'); v.material.transparent = true; v.material.opacity = .45; g.add(v); g.add(pieza(new THREE.CylinderGeometry(.004, .004, .03, 8), '#4a3a2a', .02, -.024, 0).rotateZ(.7)); cab.add(pegar(g, dir(-58, 26), .01)); },
    'receta:orejas_gato': (o, cab) => cab.add(orejasPuntas(o.a1, o.a2, .036, .068, 42, 52)),
    'receta:orejas_zorro': (o, cab) => cab.add(orejasPuntas(o.a1, o.a2, .036, .082, 42, 50, .2)),
    'receta:orejas_conejo': (o, cab) => ACCESORIOS.conejo(o, cab),
    'receta:orejas_oso': (o, cab) => { for (const l of [-1, 1]) { const p = sobre(dir(l * 40, 58), -.004); const e = pieza(new THREE.SphereGeometry(.03, 14, 12), o.a1, p.x, p.y + .01, p.z); e.scale.z = .55; const i = pieza(new THREE.SphereGeometry(.017, 12, 10), o.a2, p.x, p.y + .01, p.z + .01); i.scale.z = .4; cab.add(e, i); } },
    'receta:antifaz': (o, cab) => { const g = new THREE.Group(); for (const l of [-1, 1]) { const m = pieza(marcoOjo(.032, .021, .38), o.a1, l * .032, .05, .106); m.rotation.y = l * .18; g.add(m); } g.add(pieza(new THREE.BoxGeometry(.022, .012, .006), o.a1, 0, .055, .114)); cab.add(g); },
  };
  for (const a of ['jirafa', 'vaca', 'ciervo', 'unicornio', 'dinosaurio', 'rana', 'pato', 'pollito', 'panda', 'oso', 'gato', 'conejo', 'zorro', 'leon', 'tigre', 'perro', 'raton', 'cerdo'])
    ACC['receta:gorro_' + a] = (o, cab) => cab.add(gorroAnimal(a, o.a1, o.a2));
  const ES_GORRO = x => /^receta:gorro_/.test(x || '');

  /* ---------- Ropa de ocasión (dormida, dibujando, buscando, música, comida, fiestas) ---------- */
  const ocasion = new THREE.Group(); crudo('head').add(ocasion);
  const PIJAMA = { nombre: 'Pijama', chaqueta: '#9fc2ff', falda: '#9fc2ff', mono: '#5b7fd6', tela: 'rayas', color: '#ffffff', top: '#5b7fd6', medias: '#5b7fd6', borde: '#ffffff' };
  const OCASION = {
    audifonos: () => { ocasion.add(arco('#ff8fb3', .007, .02, 88)); for (const l of [-1, 1]) { const p = sobre(dir(l * 90, -10), 0); ocasion.add(pieza(new THREE.CylinderGeometry(.036, .036, .024, 22).rotateZ(Math.PI / 2), '#ff8fb3', p.x + l * .008, p.y, p.z), pieza(new THREE.CylinderGeometry(.022, .022, .026, 18).rotateZ(Math.PI / 2), '#ffffff', p.x + l * .011, p.y, p.z)); const o = pieza(new THREE.ConeGeometry(.016, .04, 3), '#ff8fb3'); o.position.copy(sobre(dir(l * 35, 62), .01)); o.rotation.z = -l * .3; ocasion.add(o); } return { cabeza: false }; },
    pintora: () => { const g = gorroBase(.112); g.rotation.set(-.1, 0, .25); const b = pieza(new THREE.SphereGeometry(.13, 24, 12), '#2557d6'); b.scale.set(1.08, .3, 1); g.add(b, pieza(new THREE.CylinderGeometry(.004, .004, .025, 6), '#0b1f5c', 0, .04, 0)); ocasion.add(g); return { cabeza: true }; },
    pollito: () => { ocasion.add(gorroAnimal('pollito', '#ffffff', '#ff9a3c')); return { cabeza: true }; },
    pijama: () => { const g = gorroBase(.092); g.rotation.set(-.12, 0, -.3); g.add(perfil([[.132, 0], [.127, .025], [.112, .06], [.085, .1], [.05, .15], [.018, .21], [.004, .24]], '#2c4fb8'), pieza(new THREE.TorusGeometry(.132, .016, 10, 40).rotateX(Math.PI / 2), '#ffffff'), pieza(new THREE.SphereGeometry(.024, 12, 10), '#ffffff', 0, .235, 0)); for (const [x, y, z] of [[.05, .06, .07], [-.04, .1, .05], [.02, .15, .02]]) { const e = pieza(estrellaGeo(.012), '#ffe27a', x, y, z); g.add(e); } ocasion.add(g); return { cabeza: true, ropa: PIJAMA }; },
    detective: () => { const g = gorroBase(.096); g.rotation.set(-.1, 0, 0); g.add(pieza(new THREE.CylinderGeometry(.17, .17, .006, 40), '#8a6338'), perfil([[.13, 0], [.125, .03], [.112, .058], [.085, .085], [.04, .1], [.001, .102]], '#a0784a'), pieza(new THREE.CylinderGeometry(.131, .131, .018, 36), '#6b4b26', 0, .011, 0)); ocasion.add(g); return { cabeza: true }; },
    chef: () => { const g = gorroBase(.094); g.rotation.x = -.1; g.add(pieza(new THREE.CylinderGeometry(.128, .13, .055, 32), '#ffffff', 0, .02, 0)); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(pieza(new THREE.SphereGeometry(.05, 14, 10), '#ffffff', Math.cos(a) * .07, .085, Math.sin(a) * .07)); } g.add(pieza(new THREE.SphereGeometry(.06, 14, 10), '#ffffff', 0, .11, 0)); ocasion.add(g); return { cabeza: true }; },
    bruja: () => { ACCESORIOS.bruja({ a1: '#2a1b52', a2: '#f0be3c' }, ocasion); return { cabeza: true }; },
    navidad: () => { ACCESORIOS.navidad({ a1: '#cd2d37' }, ocasion); return { cabeza: true }; },
    fiesta: () => { const g = gorroBase(.115); g.rotation.set(0, 0, .2); g.position.x = .03; g.add(perfil([[.05, 0], [.035, .05], [.018, .1], [.002, .13]], '#ff5fa2'), pieza(new THREE.SphereGeometry(.016, 10, 8), '#ffe14d', 0, .132, 0)); ocasion.add(g); return { cabeza: false }; },
  };
  // lentes de corazón («Cuéntame más»)
  const lentes = new THREE.Group(); lentes.visible = false; crudo('head').add(lentes);
  for (const l of [-1, 1]) { const m = pieza(marcoCorazon(.024, .2), '#e83f7a', l * .033, .052, .106); m.rotation.set(0, l * .18, Math.PI); const v = pieza(corazonGeo(.02), '#ff9fc0', l * .033, .052, .105); v.rotation.set(0, l * .18, Math.PI); v.scale.z = .05; v.material.transparent = true; v.material.opacity = .22; v.material.depthWrite = false; lentes.add(m, v); }
  lentes.add(pieza(new THREE.BoxGeometry(.016, .004, .004), '#e83f7a', 0, .06, .106));

  let recetaDia = null, ropaOcasion = null;
  function vestir() {
    vaciar(ocasion);
    const o = ropaOcasion && OCASION[ropaOcasion] ? OCASION[ropaOcasion]() : null;
    const dia = o && o.ropa ? o.ropa : recetaDia ? recetaA3D(recetaDia) : 'marinera';
    const conAdorno = typeof dia === 'object' && o && o.cabeza ? { ...dia, extra: null } : dia;  // con gorro de ocasión, el adorno del pelo se esconde
    ponerRopa(conAdorno);
    gorroRopa = gorroRopa || !!(o && o.cabeza) || (typeof dia === 'object' && ES_GORRO(dia.extra) && !(o && o.cabeza));
    ajustarMechon();
  }

  /* ---------- Alas: aletean según lo que siente ---------- */
  const pechoAlas = crudo('upperChest') || crudo('chest');
  const alas = crearAlas(pechoAlas, { tamano: tamanoAlas });
  const ALEGRES = ['reir', 'emocion', 'aplaudir', 'wow', 'idea', 'amor', 'orgullosa', 'hola', 'traviesa', 'guino', 'estirarse', 'animo', 'puntillas', 'v_yatta', 'v_mejillas', 'v_ganbaru', 'v_tuSenalar', 'v_saludo', 'v_corazon', 'v_gatita', 'v_paz', 'v_pulgar', 'v_gracias', 'v_abrazo', 'v_risaPanza'];
  const BAJAS = ['triste', 'llorar', 'puchero', 'aburrida', 'bostezar', 'mareada'];
  const TIEMBLA = ['enojada', 'humo', 'fuego', 'miedo', 'alma', 'asco', 'v_panico'];
  function animoAlas() {
    const id = reaccionId;
    if (id === 'dormida' || cara === 'dormida') return { fuerza: 0, rapidez: .2 };
    if (id && TIEMBLA.includes(id)) return { fuerza: .5, rapidez: 1.4, tiembla: 1 };
    if (id === 'emocion' || id === 'aplaudir' || id === 'wow' || id === 'v_yatta') return { fuerza: 1.6, rapidez: 1.8 };
    if (id && ALEGRES.includes(id)) return { fuerza: 1, rapidez: 1.2 };
    if (id && BAJAS.includes(id)) return { fuerza: .12, rapidez: .4 };
    return hablando ? { fuerza: .55, rapidez: 1 } : { fuerza: .35, rapidez: .8 };
  }

  /* ---------- Reacciones y gestos ---------- */
  const MOM = momentos(false);
  const ORDEN = ['fuego', 'vomito', 'vomitoVerde', 'humo', 'burbujas', 'alma', 'estornudo', 'baba', 'hola', 'hablar', 'pensar', 'reaccionar', 'reir', 'emocion', 'encoger', 'mirar', 'enojada', 'triste', 'amor', 'miedo', 'asco', 'orgullosa', 'guino', 'dormida', 'timida', 'confundida', 'idea', 'asentir', 'negar', 'bostezar', 'llorar', 'traviesa', 'aburrida', 'mareada', 'puchero', 'aplaudir', 'wow'];
  const DURA = { fuego: 4, vomito: 3.6, vomitoVerde: 3.6, estornudo: 2.6 };
  // Gestos de espera: cuando nadie le habla mueve manos y cuerpo (entra liso, dura, vuelve liso)
  const sn = (t, hz, f = 0) => Math.sin(t * hz * 2 * Math.PI + f), liso = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  const REPOSO = { leftUpperArm: [0, -5, -73], rightUpperArm: [0, 5, 73], leftLowerArm: [0, -13, 0], rightLowerArm: [0, 13, 0], leftHand: [5, 0, -6], rightHand: [5, 0, 6], leftShoulder: [0, 0, 0], rightShoulder: [0, 0, 0] };
  const baseG = (t, f = 1) => { const c = sn(t, .21), d = sn(t, .34, 1); return {
    hips: [0, 3 * c * f, 2.2 * d * f], spine: [1 + .8 * sn(t, .29) * f, -1.5 * c * f, -1.3 * d * f], chest: [1.2 + .8 * sn(t, .29, 1) * f, -1.4 * c * f, -.9 * d * f],
    leftUpperLeg: [-2 + 2 * d * f, 0, 0], rightUpperLeg: [-2 - 2 * d * f, 0, 0], leftLowerLeg: [4 - 4 * d * f, 0, 0], rightLowerLeg: [4 + 4 * d * f, 0, 0], leftFoot: [-2, 0, 0], rightFoot: [-2, 0, 0],
    head: [2.2 * sn(t, .31) + 1.2 * sn(t, .73, 1), 4 * sn(t, .17), 2.2 * sn(t, .23, 1)] }; };
  const DG = 6.5, curva = t => liso(t / .7) * (1 - liso((t - (DG - .8)) / .8));
  const haciaPose = (meta, a) => { const o = {}; for (const k in REPOSO) { const m = meta[k] || REPOSO[k]; o[k] = REPOSO[k].map((v, i) => v + (m[i] - v) * a); } return o; };
  const suma = (h, k, v) => { h[k] = h[k].map((x, i) => x + (v[i] || 0)); };
  const GESTOS = {
    cadera: { nombre: 'Mano en la cadera', f: (t, a) => ({ huesos: { ...haciaPose({ leftUpperArm: [0, 0, -38], leftLowerArm: [0, 0, -78], leftHand: [0, 0, -10] }, a) }, extra: { hips: [0, 0, 4 * a], head: [0, 0, -6 * a] }, cara: { happy: .45 * a } }) },
    caderas: { nombre: 'Manos en las caderas', f: (t, a) => ({ huesos: { ...haciaPose({ leftUpperArm: [0, 0, -38], leftLowerArm: [0, 0, -78], rightUpperArm: [0, 0, 38], rightLowerArm: [0, 0, 78], leftHand: [0, 0, -10], rightHand: [0, 0, 10] }, a) }, extra: { chest: [-3 * a, 0, 0], head: [-4 * a, 0, 0] }, cara: { happy: .6 * a } }) },
    estirarse: { nombre: 'Se estira', f: (t, a) => { const e = a * (.85 + .15 * sn(t, .5)); return { sube: .015 * e, huesos: { ...haciaPose({ leftUpperArm: [0, -10, 72], rightUpperArm: [0, 10, -72], leftLowerArm: [0, -25, 0], rightLowerArm: [0, 25, 0] }, e) }, extra: { spine: [-6 * e, 0, 0], chest: [-5 * e, 0, 0], head: [-10 * e, 0, 0] }, cara: { relaxed: .5 * e, oh: .25 * e } }; } },
    pelo: { nombre: 'Mano en la cabeza', f: (t, a) => ({ huesos: { ...haciaPose({ rightUpperArm: [0, 15, -25], rightLowerArm: [0, 35, -110], rightHand: [0, 0, -15 + 10 * sn(t, .8)] }, a) }, extra: { head: [0, -6 * a, -9 * a] }, cara: { happy: .35 * a }, mira: [.4, .1, 1] }) },
    juntas: { nombre: 'Manos juntas', f: (t, a) => ({ huesos: { ...haciaPose({ leftUpperArm: [0, -30, -66], rightUpperArm: [0, 30, 66], leftLowerArm: [0, -78, 0], rightLowerArm: [0, 78, 0], leftHand: [0, 0, 10], rightHand: [0, 0, -10] }, a) }, extra: { hips: [0, 7 * a * sn(t, .3), 0], head: [0, 0, 8 * a * sn(t, .3)] }, cara: { happy: .55 * a } }) },
    unas: { nombre: 'Mano al pecho', f: (t, a) => ({ huesos: { ...haciaPose({ leftUpperArm: [0, -55, -50], leftLowerArm: [0, -128, 0], leftHand: [-20, 0, 0] }, a) }, extra: { head: [12 * a, -10 * a, 0] }, mira: [-.5, -.5, 1], cara: { relaxed: .4 * a } }) },
    animo: { nombre: '¡Ánimo!', f: (t, a) => { const p = a * (.75 + .25 * Math.max(0, sn(t, 1.4))); return { sube: .01 * p, huesos: { ...haciaPose({ leftUpperArm: [0, -15, -62], rightUpperArm: [0, 15, 62], leftLowerArm: [0, -115, 0], rightLowerArm: [0, 115, 0] }, p) }, cara: { happy: .9 * a, aa: .3 * a } }; } },
    balancea: { nombre: 'Balancea los brazos', f: (t, a) => { const w = sn(t, .55); return { huesos: { ...haciaPose({ leftUpperArm: [0, -5 - 28 * w, -70], rightUpperArm: [0, 5 - 28 * w, 70], leftLowerArm: [0, -20, 0], rightLowerArm: [0, 20, 0] }, a) }, extra: { hips: [0, 6 * w * a, 0], spine: [0, -4 * w * a, 0] }, cara: { happy: .4 * a } }; } },
    puntillas: { nombre: 'Mira alrededor en puntillas', f: (t, a) => ({ sube: .025 * a * (.5 + .5 * sn(t, .4)), huesos: { ...haciaPose({ leftFoot: [20, 0, 0] }, a) }, extra: { head: [-4 * a, 28 * a * sn(t, .18), 0], leftFoot: [18 * a, 0, 0], rightFoot: [18 * a, 0, 0] }, mira: [sn(t, .18), .1, 1], cara: { surprised: .2 * a } }) }
  };
  for (const [id, g] of Object.entries(GESTOS)) {
    MOM[id] = { nombre: '✋ ' + g.nombre, plano: 'medio', tasa: 2.5, pose: t => { const a = curva(t), r = g.f(t, a), h = { ...baseG(t, .7), ...r.huesos }; for (const k in r.extra || {}) { if (!h[k]) h[k] = [0, 0, 0]; suma(h, k, r.extra[k]); } return { sube: r.sube || 0, huesos: h, mira: r.mira, cara: r.cara || {} }; } };
    DURA[id] = DG; ORDEN.push(id);
  }
  // manos de verdad: la mano va a un punto, choca con el cuerpo en vez de atravesarlo, dedos con postura;
  // reacciones de VTuber con movimiento de anime (fuerza media)
  const FUERZA = 1;
  const manos = crearManos(vrm);
  for (const [id, r] of Object.entries(VTUBER)) { MOM['v_' + id] = { ...r, pose: t => r.pose(t, FUERZA) }; DURA['v_' + id] = 5.5; if (!Object.values(REEMPLAZA).includes(id)) ORDEN.push('v_' + id); }
  const ver = id => (id && REEMPLAZA[id] ? 'v_' + REEMPLAZA[id] : id);
  const EMOCIONES = ORDEN.filter(x => !(x in GESTOS));
  let reaccionId = null, ultimaId = null, inicioR = 0, finReaccion = 0, reloj = 0, mezcla3 = 0, sostener = false;
  // cuenta qué emociones ya mostró; cuando mostró todas sin repetir, avisa (el taller inventa una nueva)
  const vistas = new Set();
  try { for (const id of JSON.parse(localStorage.getItem('filo_vistas3d') || '[]')) vistas.add(id); } catch (e) { /* sin memoria */ }
  let avisoAgotar = false;
  function anotarVista(id) {
    if (!EMOCIONES.includes(id) || vistas.has(id)) return;
    vistas.add(id);
    try { localStorage.setItem('filo_vistas3d', JSON.stringify([...vistas])); } catch (e) { /* sin memoria */ }
    revisarAgotadas();
  }
  function revisarAgotadas() {
    if (!avisoAgotar && EMOCIONES.every(x => vistas.has(x))) { avisoAgotar = true; alAgotar(); }
  }
  function lanzar(id, mantener = false) {
    if (!MOM[id]) return;
    anotarVista(id);
    if (reaccionId === id) { finReaccion = Math.max(finReaccion, reloj + (DURA[id] || 5)); sostener = mantener; return; }
    reaccionId = ultimaId = id; inicioR = reloj; finReaccion = reloj + (DURA[id] || 5); sostener = mantener;
    alFondo(fondoActual());
  }
  function soltar() { if (!reaccionId) return; sostener = false; finReaccion = Math.min(finReaccion, reloj + .35); }
  const fondoActual = () => { const f = reaccionId && MOM[ver(reaccionId)].fondo, t = f && FONDOS[f]; return t && t.image ? t.image : null; };

  // las caras que elige Gemini (las mismas de la ilustración) pasadas a reacciones 3D; cada una tiene varias para no repetir
  const CARAS = {
    feliz: ['reir', 'asentir', 'aplaudir', 'traviesa', 'guino', 'v_paz', 'v_pulgar', 'v_saludo', 'v_gatita'], risa: ['reir', 'aplaudir', 'v_risaPanza', 'v_risaPanza'],
    emocionada: ['emocion', 'aplaudir', 'idea', 'wow', 'v_yatta', 'v_ganbaru'],
    sorpresa: ['wow', 'reaccionar', 'alma', 'v_panico', 'v_tuSenalar'], pensando: ['pensar', 'v_menton'], enojada: ['enojada', 'enojada', 'humo', 'fuego'], triste: ['triste', 'llorar'],
    pena: ['puchero', 'triste', 'v_taparCara'], miedo: ['miedo', 'miedo', 'alma', 'v_panico'], asco: ['asco', 'asco', 'vomitoVerde'], timida: ['timida', 'v_mejillas', 'v_taparCara', 'unas'], guino: ['guino', 'traviesa', 'v_paz'],
    amor: ['amor', 'baba', 'v_corazon', 'v_abrazo', 'v_mejillas'], orgullosa: ['orgullosa', 'v_yatta', 'v_pulgar'], celosa: ['puchero', 'enojada'], dormida: ['dormida'],
  };
  const SOSTENIDAS = ['pensando', 'dormida'];
  let cara = 'normal';
  const azar = l => l[Math.floor(Math.random() * l.length)];

  /* ---------- Movimiento ---------- */
  const suave = { aa: 0, blink: 0, camD: 1.9, camY: -.1 };
  const qTmp = new THREE.Quaternion(), qUno = new THREE.Quaternion(), mir = new THREE.Vector3();
  const morfos = {}, escritos = {}, tocados = new Set();
  const PLANOS = { cintura: [1.9, -.1], general: [3.9, -.5] };
  let plano = 'cintura', zoom = 1, corrida = 0, corridaS = 0;
  const cajaAlas = new THREE.Box3(); let medioAlas = 0, cuentaAlas = 0;
  let parpadeo = 0, proxParpadeo = 2, tiempo = 0, hablando = false, nivelVoz = 0, bocaFalsa = 0, bocaHasta = 0, mezclaHabla = 0;
  let auto = true, quietoDesde = 0, proxima = 0, bolsa = [], bolsaG = [], turnoGesto = false, anteriorAuto = null;
  const hacia = (k, v, vel, dt) => { suave[k] += (v - suave[k]) * (1 - Math.exp(-dt * vel)); return suave[k]; };
  // modo automático: si no pasa nada, alterna una emoción y un gesto de manos y cuerpo, sin repetir hasta pasar por todos
  function autoPaso(ahora) {
    if (!auto || hablando || reaccionId || (cara !== 'normal' && cara !== 'contenta')) { quietoDesde = ahora; return; }
    if (ahora - quietoDesde < 2500 || ahora < proxima) return;
    turnoGesto = !turnoGesto;
    const b = turnoGesto ? bolsaG : bolsa;
    if (!b.length) { b.push(...(turnoGesto ? Object.keys(GESTOS) : EMOCIONES).filter(x => x !== anteriorAuto)); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } }
    const id = b.pop(); anteriorAuto = id; lanzar(id);
    proxima = ahora + (DURA[id] || 5) * 1000 + 1500 + Math.random() * 2500;
  }

  // giro de todo el cuerpo: botón (una vuelta suave) o arrastrando
  let giro = 0, giroDesde = 0, giroHasta = 0, giroT0 = -1e9, arrastre = null, volverPlano = 0;
  lienzo.style.touchAction = 'pan-y'; lienzo.style.cursor = 'grab';
  lienzo.addEventListener('pointerdown', e => { arrastre = { x: e.clientX, g: giro, movido: false }; giroT0 = -1e9; lienzo.style.cursor = 'grabbing'; });
  addEventListener('pointermove', e => { if (!arrastre) return; const dx = e.clientX - arrastre.x; if (Math.abs(dx) > 6) arrastre.movido = true; if (arrastre.movido) giro = arrastre.g + dx * .012; });
  addEventListener('pointerup', () => { arrastre = null; lienzo.style.cursor = 'grab'; });

  const curvaGiro = u => (u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  function paso(dt, ahora) {
    tiempo += dt; reloj += dt;
    if (reaccionId && reloj > finReaccion) {
      if (sostener) { inicioR = reloj; finReaccion = reloj + (DURA[reaccionId] || 5); }
      else { reaccionId = null; alFondo(fondoActual()); }
    }
    autoPaso(ahora);
    mezcla3 += ((reaccionId ? 1 : 0) - mezcla3) * (1 - Math.exp(-dt * 11));
    mezclaHabla += ((hablando && !reaccionId ? 1 : 0) - mezclaHabla) * (1 - Math.exp(-dt * 6));
    const P = ultimaId && mezcla3 > .002 ? MOM[ver(ultimaId)].pose(reloj - inicioR) : null, C = P && P.cara || {}, M2 = P && P.morfos || {}, mz = mezcla3;
    // boca: con la voz de verdad se abre según el volumen; sin medida se inventa una apertura que cambia sola
    let meta = 0;
    if (hablando) {
      if (nivelVoz < 0 && ahora > bocaHasta) { bocaFalsa = Math.random() < .2 ? 0 : .04 + Math.random() * .16; bocaHasta = ahora + 80 + Math.random() * 90; }
      const n = nivelVoz >= 0 ? nivelVoz : bocaFalsa;
      meta = n < .015 ? 0 : Math.min(1, .15 + n * 4.75);
    }
    suave.aa += (meta - suave.aa) * (meta > suave.aa ? .55 : .3);
    E.setValue('aa', Math.max((C.aa || 0) * mz, suave.aa * .9));
    E.setValue('ou', (C.ou || 0) * mz); E.setValue('oh', Math.max((C.oh || 0) * mz, hablando ? suave.aa * .25 * (.5 + .5 * Math.sin(tiempo * 5.3)) : 0));
    E.setValue('ee', 0); E.setValue('ih', (C.ih || 0) * mz);
    for (const n of ['angry', 'sad', 'surprised']) E.setValue(n, (C[n] || 0) * mz);
    // ojos abiertos; se cierran al parpadear o si la reacción lo pide
    const rb = (C.blink || 0) * mz, rbI = (C.blinkLeft || 0) * mz;
    E.setValue('blinkLeft', rbI); E.setValue('blinkRight', 0);
    proxParpadeo -= dt; if (proxParpadeo < 0) { parpadeo = .24; proxParpadeo = Math.random() < .16 ? .34 : 2.6 + Math.random() * 3.8; }
    parpadeo = Math.max(0, parpadeo - dt); const pas = .24 - parpadeo;
    E.setValue('blink', Math.max(rb, parpadeo <= 0 ? 0 : pas < .07 ? pas / .07 : pas < .1 ? 1 : 1 - ((pas - .1) / .14) ** 2));
    const cerrado = Math.max(parpadeo > 0 ? 1 : 0, rb, rbI) > .05 || M2.Fcl_EYE_Iris_Hide;
    const feliz = (C.happy || 0) * mz, calma = (C.relaxed || 0) * mz, contenta = cara === 'contenta' ? .5 : 0;
    const objetivo = { Fcl_EYE_Spread: cerrado ? 0 : .35, Fcl_MTH_Fun: Math.min(1, calma * .6 + contenta * .6), Fcl_MTH_Joy: feliz * .75, Fcl_BRW_Fun: calma * .7, Fcl_BRW_Joy: Math.max(.6 * (1 - mz), feliz * .8), Fcl_BRW_Angry: 0, Fcl_BRW_Sorrow: 0 };
    for (const n in M2) objetivo[n] = Math.max(objetivo[n] || 0, M2[n] * mz);
    for (const n of new Set([...Object.keys(morfos), ...Object.keys(objetivo)])) morfos[n] = (morfos[n] || 0) + ((objetivo[n] || 0) - (morfos[n] || 0)) * (1 - Math.exp(-dt * 22));
    // cuerpo de base: respira, mueve la cabeza y los brazos un poco
    for (const n of tocados) { const x = nodo(n); if (x) x.quaternion.identity(); }
    eu.set(rad(1.5 * Math.sin(tiempo * .9) + (hablando ? 1.6 * Math.max(0, Math.sin(tiempo * 6)) * suave.aa : 0)), rad(3 * Math.sin(tiempo * .55)), rad(1.5 * Math.sin(tiempo * .7))); qTmp.setFromEuler(eu);
    nodo('head').quaternion.copy(qUno).slerp(qTmp, .62); nodo('neck').quaternion.copy(qUno).slerp(qTmp, .24);
    eu.set(rad(1.2 * Math.sin(tiempo * 1.7)), 0, 0); nodo('chest').quaternion.setFromEuler(eu);
    const b1 = Math.sin(tiempo * 1.2), b2 = Math.sin(tiempo * 1 + 2);
    fija('leftUpperArm', 0, -5 - 1.5 * b1, -73 - 1.2 * b1); fija('rightUpperArm', 0, 5 + 1.5 * b2, 73 + 1.2 * b2); fija('leftLowerArm', 0, -13 - 1.5 * b2, 0); fija('rightLowerArm', 0, 13 + 1.5 * b1, 0);
    // al hablar mueve las manos (sin reacción encima)
    const HM = mezclaHabla > .002 ? HABLANDO(tiempo, FUERZA) : null;
    if (mezclaHabla > .002) { const H = MOM.hablar.pose(tiempo); Object.assign(H.huesos, HM.huesos); for (const [n, g] of Object.entries(H.huesos)) { const x = nodo(n); if (!x) continue; tocados.add(n); eu.set(rad(g[0]), rad(g[1]), rad(g[2])); qTmp.setFromEuler(eu); x.quaternion.slerp(qTmp, mezclaHabla); } }
    if (P) for (const [n, g] of Object.entries(P.huesos)) { const x = nodo(n); if (!x) continue; tocados.add(n); eu.set(rad(g[0]), rad(g[1]), rad(g[2])); qTmp.setFromEuler(eu); x.quaternion.slerp(qTmp, mz); }
    vrm.scene.position.y = (P && P.sube || 0) * mz;
    // giro
    const u = Math.min(1, (ahora - giroT0) / 2600);
    if (u < 1) giro = giroDesde + (giroHasta - giroDesde) * curvaGiro(u);
    vrm.scene.rotation.y = giro;
    vrm.scene.updateMatrixWorld(true); manos.aplicar(P || HM, P ? mz : mezclaHabla, dt); for (const n of manos.tocados) tocados.add(n);
    // mirada
    crudo('head').updateWorldMatrix(true, false); crudo('head').getWorldPosition(mirada.position); mir.set(0, .07, 1); if (P && P.mira) mir.lerp(new THREE.Vector3(...P.mira), mz); mirada.position.add(mir);
    alas.actualizar(dt, animoAlas());
    vrm.update(dt);
    for (const o of conCaras) { for (const n in morfos) { const i = o.morphTargetDictionary[n]; if (i === undefined) continue; const marca = o.uuid + n, ant = escritos[marca], act = o.morphTargetInfluences[i], base = ant && Math.abs(act - ant.t) < 1e-6 ? ant.b : act, t = Math.min(1, base + morfos[n]); o.morphTargetInfluences[i] = t; escritos[marca] = { t, b: base }; } }
    // encuadre: de la cintura arriba (zoom y giro lo cambian)
    // celular: la cámara se aleja lo justo para que las alas entren enteras a lo ancho (salvo que acerquen con +)
    if (alas.raiz.visible && (cuentaAlas++ % 10 === 0)) { cajaAlas.setFromObject(alas.raiz); medioAlas = Math.max(Math.abs(cajaAlas.min.x), Math.abs(cajaAlas.max.x)); }
    const dAlas = document.documentElement.classList.contains('repartir') && zoom >= 1 && alas.raiz.visible ? medioAlas * 1.04 / (Math.tan(rad(cam.fov / 2)) * cam.aspect) : 0;
    const pl = PLANOS[plano], d = hacia('camD', Math.max(pl[0] * zoom, dAlas), 5, dt), oy = hacia('camY', plano === 'general' ? pl[1] : Math.max(-.5, pl[1] - (zoom - 1) * .3), 5, dt);
    // con video en el celular Filo se corre a la derecha y la cámara se aleja un poco para que entren las alas
    corridaS += (corrida - corridaS) * (1 - Math.exp(-dt * 6));
    // y baja un poco para que la cabeza quede debajo del video, no detrás
    const dc = d * (1 + corridaS * 2), alto = 2 * dc * Math.tan(rad(cam.fov / 2)), cx = -corridaS * alto * cam.aspect, cy = corridaS * alto * 1.1;
    cam.position.set(cx, foco.y + .06 + oy + cy, dc); cam.lookAt(cx, foco.y + oy + cy, 0); cam.updateMatrixWorld(true);
    if (reaccionId) crudo('head').updateWorldMatrix(true, false);
    const M = reaccionId ? MOM[ver(reaccionId)] : null;
    ponerSimbolos(M ? M.simbolos : null, crudo('head'), tiempo);
    ponerBoca(M && P ? P.boca || null : null, crudo('head'), dt, cam);
    ponerImpacto(!!(M && (M.impacto || reaccionId === 'reaccionar')), tiempo, reaccionId);
  }

  // en celulares lentos dibuja a 30 cuadros por segundo; si no se ve, no gasta nada
  let antes = performance.now(), visible = true, encendida = true;
  const medida = { paso: 0, dibujo: 0 };
  const conCaras = []; vrm.scene.traverse(o => { if (o.morphTargetDictionary) conCaras.push(o); });  // solo las mallas con gestos de cara
  const minimo = liviano ? 1000 / 31 : 0;
  function bucle(ahora) {
    requestAnimationFrame(bucle);
    if (!encendida || !visible || document.hidden) { antes = ahora; return; }
    if (ahora - antes < minimo) return;
    const dt = Math.min(.05, (ahora - antes) / 1000); antes = ahora;
    const t0 = performance.now(); paso(dt, ahora); const t1 = performance.now(); r.render(esc, cam);
    medida.paso += (t1 - t0 - medida.paso) * .05; medida.dibujo += (performance.now() - t1 - medida.dibujo) * .05;
  }
  new IntersectionObserver(e => { visible = e[0].isIntersecting; }).observe(caja);
  vestir();
  requestAnimationFrame(bucle);

  const cabezaEnPantalla = () => { const p = crudo('head').getWorldPosition(new THREE.Vector3()); p.y += .07; p.project(cam); const q = lienzo.getBoundingClientRect(); return { x: q.left + (p.x + 1) / 2 * q.width, y: q.top + (1 - p.y) / 2 * q.height, r: q.height * .16 / zoom }; };

  // dónde están las alas en la pantalla (para tocarlas): un punto a cada lado de la espalda
  const alasEnPantalla = () => { const q = lienzo.getBoundingClientRect(), base = (crudo('upperChest') || crudo('chest')).getWorldPosition(new THREE.Vector3()); return [-1, 1].map(l => { const p = base.clone(); p.x += l * .2; p.y += .1; p.applyAxisAngle(new THREE.Vector3(0, 1, 0), giro); p.project(cam); return { x: q.left + (p.x + 1) / 2 * q.width, y: q.top + (1 - p.y) / 2 * q.height, r: q.height * .12 / zoom }; }); };

  return {
    // misma forma que la ilustración: la página le habla igual a las dos
    expresion(n) {
      cara = n;
      if (n === 'normal' || n === 'contenta') return soltar();
      const l = CARAS[n]; if (!l) return;
      lanzar(azar(l), SOSTENIDAS.includes(n));
    },
    hablar(si) { hablando = si; if (!si) nivelVoz = 0; },
    nivel(n) { nivelVoz = n; },
    cara: () => cara,
    toque(zona) { if (zona === 'alas') alas.tocar(); lanzar(zona === 'cabeza' ? azar(['timida', 'amor', 'reir']) : zona === 'alas' ? 'enojada' : azar(['reaccionar', 'reir'])); },
    lentes(si) { lentes.visible = !!si; },
    ropa(nombre) { ropaOcasion = nombre || null; vestir(); },
    ropaDia(receta) { recetaDia = receta || null; vestir(); },
    // botones de la vista 3D
    zoom(f) { if (plano === 'general') plano = 'cintura'; zoom = Math.min(2.1, Math.max(.6, zoom * f)); },
    normal() { zoom = 1; plano = 'cintura'; giroDesde = giro; giroHasta = Math.round(giro / (Math.PI * 2)) * Math.PI * 2; giroT0 = performance.now(); },
    girar() { giroDesde = giro; giroHasta = Math.round(giro / (Math.PI * 2)) * Math.PI * 2 + Math.PI * 2; giroT0 = performance.now(); plano = 'general'; clearTimeout(volverPlano); volverPlano = setTimeout(() => { plano = 'cintura'; }, 3400); },
    automatica(si) { auto = !!si; if (!auto && reaccionId && !sostener) soltar(); },
    encender(si) { encendida = !!si; },
    correr(f) { corrida = f || 0; },
    // para tocarla: ¿el dedo cayó en la cabeza o en el cuerpo?
    cabeza() { const c = cabezaEnPantalla(); return { left: c.x - c.r, right: c.x + c.r, top: c.y - c.r * 1.25, bottom: c.y + c.r * .55 }; },
    zona(x, y) { const c = cabezaEnPantalla(); if (Math.hypot(x - c.x, y - c.y) < c.r) return 'cabeza'; const a = alasEnPantalla(); return a.some(p => Math.hypot(x - p.x, y - p.y) < p.r) ? 'alas' : 'cuerpo'; },
    alas(n) { alas.tamano(n); },
    // para las pruebas
    estado: () => ({ msPaso: +medida.paso.toFixed(2), msDibujo: +medida.dibujo.toFixed(2), liviano, reaccion: reaccionId, cara, ropa: ropaOcasion, receta: recetaDia && recetaDia.id, auto, hablando }),
    reaccion: (id, mantener) => lanzar(id, mantener),
    lista: () => ({ emociones: EMOCIONES, gestos: Object.keys(GESTOS), vistas: EMOCIONES.filter(x => vistas.has(x)).length, nuevas: EMOCIONES.filter(x => MOM[x].nueva) }),
    // emociones que inventó el taller: se suman a las suyas y a su ánimo; devuelve las que no tenía
    agregarEmociones(lista) {
      const agregadas = [];
      for (const r of lista || []) {
        if (!r || !r.id || MOM[r.id]) continue;
        const M = desdeReceta(r);
        MOM[r.id] = { ...M, pose: t => M.pose(t, FUERZA) }; DURA[r.id] = 5; ORDEN.push(r.id); EMOCIONES.push(r.id);
        (CARAS[r.animo] || CARAS.feliz).push(r.id);
        agregadas.push(r.id);
      }
      if (agregadas.length) avisoAgotar = false;
      revisarAgotadas();
      return agregadas;
    },
  };
}
