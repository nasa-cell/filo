// Alas de Filo en 3D, realistas pero que combinan con el anime: un cuerpo de ala (hueso redondo que
// nace del hombro) cubierto de plumitas y plumón, y plumas con volumen (curvas, con nervio central y
// barbas finas) encimadas como tejas, blancas con la punta rosada.
// Liviano para celulares: cada fila de plumas es una sola malla con una textura chica dibujada en el
// momento; el meneo de cada pluma lo hace la tarjeta de video.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAMANOS = { chicas: .6, medianas: 1, grandes: 1.4 };
const L = .3;  // largo del brazo del ala (medianas)

// ---------- texturas de pluma (se dibujan una vez) ----------
function texturaPluma(tipo) {
  const W = 64, H = tipo === 'larga' ? 256 : 128, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d'), cx = W / 2;
  // contorno: base angosta, panza ancha, punta redonda (el lado de afuera un poco más angosto)
  const ancho = (v) => (tipo === 'plumon' ? Math.sin(Math.PI * Math.min(1, v * 1.1)) * .5 : Math.min(1, v * 4) * (1 - Math.pow(v, 6)) * .46) * W;
  g.beginPath(); g.moveTo(cx, H);
  for (let i = 0; i <= 40; i++) { const v = i / 40; g.lineTo(cx + ancho(v) * .86, H - v * H); }
  for (let i = 40; i >= 0; i--) { const v = i / 40; g.lineTo(cx - ancho(v), H - v * H); }
  g.closePath();
  const col = g.createLinearGradient(0, H, 0, 0);
  col.addColorStop(0, '#ffffff'); col.addColorStop(.62, '#fffaf8'); col.addColorStop(.84, '#f8dcdc'); col.addColorStop(1, '#efbcbf');
  g.fillStyle = col; g.fill();
  // barbas: rayitas finas en diagonal hacia la punta
  g.save(); g.clip();
  g.lineWidth = 1;
  for (let y = H; y > -W; y -= tipo === 'larga' ? 5 : 4) {
    g.strokeStyle = 'rgba(205,175,185,.2)';
    g.beginPath(); g.moveTo(cx, y); g.lineTo(0, y - W * .55); g.moveTo(cx, y); g.lineTo(W, y - W * .5); g.stroke();
  }
  // sombra suave hacia los bordes: da volumen
  const lado = g.createLinearGradient(0, 0, W, 0);
  lado.addColorStop(0, 'rgba(200,170,185,.2)'); lado.addColorStop(.5, 'rgba(0,0,0,0)'); lado.addColorStop(1, 'rgba(200,170,185,.16)');
  g.fillStyle = lado; g.fillRect(0, 0, W, H);
  g.restore();
  // borde deshilachado: cortes finos en diagonal, como pluma de verdad
  g.globalCompositeOperation = 'destination-out';
  g.lineWidth = tipo === 'plumon' ? 2 : 1.4;
  for (let k = 0; k < (tipo === 'plumon' ? 30 : 14); k++) {
    const v = .15 + Math.random() * .8, y = H - v * H, izq = Math.random() < .5, x = cx + (izq ? -1 : .86) * ancho(v);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (izq ? 1 : -1) * W * (.08 + Math.random() * .12), y + W * .1); g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
  // nervio central
  if (tipo !== 'plumon') {
    const n = g.createLinearGradient(0, H, 0, 0);
    n.addColorStop(0, 'rgba(225,205,200,.95)'); n.addColorStop(1, 'rgba(225,190,195,.25)');
    g.strokeStyle = n; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, H); g.quadraticCurveTo(cx + 2, H * .5, cx + 1, H * .04); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2;
  return t;
}

// ---------- una pluma con volumen: curva hacia atrás a lo largo y en forma de cuchara a lo ancho ----------
function pluma(largo, ancho, curva, fase) {
  const g = new THREE.PlaneGeometry(1, 1, 2, 6);
  g.translate(0, .5, 0);
  const p = g.attributes.position, punta = new Float32Array(p.count), fases = new Float32Array(p.count).fill(fase);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), v = p.getY(i);
    p.setXYZ(i, x * ancho, v * largo, -(curva * v * v * largo) - .25 * ancho * (x * 2) ** 2 * .5);
    punta[i] = v;
  }
  g.setAttribute('punta', new THREE.BufferAttribute(punta, 1));
  g.setAttribute('fase', new THREE.BufferAttribute(fases, 1));
  g.computeVertexNormals();
  return g;
}
// el brazo del ala: sube hacia afuera y en la punta baja un poco
const brazo = (u) => {
  const a = new THREE.Vector2(0, 0), b = new THREE.Vector2(L * .38, L * .72), c = new THREE.Vector2(L, L * .62);
  return a.multiplyScalar((1 - u) ** 2).add(b.multiplyScalar(2 * u * (1 - u))).add(c.multiplyScalar(u * u));
};
// una fila de plumas a lo largo del brazo; «giro» las tuerce sobre su largo para que se encimen como tejas
function fila(cant, desde, hasta, largo, ancho, angulo, bajar, z, curva, giro = 0) {
  const lista = [];
  for (let i = 0; i < cant; i++) {
    const u = desde + (hasta - desde) * (cant > 1 ? i / (cant - 1) : 0), p = brazo(u), a = angulo(u) * Math.PI / 180;
    const g = pluma(largo(u), ancho, curva, i * 1.7 + z * 300);
    g.rotateY(giro); g.rotateZ(a - Math.PI / 2); g.translate(p.x, p.y - bajar, z - i * .0007);
    lista.push(g);
  }
  return mergeGeometries(lista);
}

// cuerpo del ala: un tubo que sigue el brazo, grueso en el hombro y fino en la punta, y una bolita en el hombro
function cuerpoAla() {
  const N = 18, R = 10, pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, p = brazo(u), r = .024 * Math.pow(1 - u, .8) + .005;
    const q = brazo(Math.min(1, u + .01)), d = brazo(Math.max(0, u - .01)), tx = q.x - d.x, ty = q.y - d.y, n = Math.hypot(tx, ty);
    const nx = -ty / n, ny = tx / n;
    for (let j = 0; j < R; j++) {
      const a = j / R * Math.PI * 2, k = Math.cos(a) * r, z = Math.sin(a) * r * 1.25;
      pos.push(p.x + nx * k, p.y + ny * k, -.012 + z);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < R; j++) {
    const a = i * R + j, b = i * R + (j + 1) % R, c = a + R, d = b + R;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  g.computeVertexNormals();
  const h = new THREE.SphereGeometry(.03, 12, 8); h.scale(1, 1, 1.2); h.translate(0, 0, -.012);
  h.deleteAttribute('uv');
  return mergeGeometries([g.toNonIndexed(), h.toNonIndexed()]);
}

// filas: [cantidad, desde, hasta, largo(u), ancho, ángulo(u), bajar, z, curva, textura, giro]
const FILAS = [
  [10, .34, 1, (u) => .14 + .18 * Math.sin(u * Math.PI * .5), .085, (u) => -98 + 104 * u ** 1.5, .004, .012, .18, 'larga', .45],
  [7, .02, .6, (u) => .13 + .06 * u, .08, (u) => -102 + 26 * u, .008, -.004, .14, 'larga', .35],
  [11, 0, .96, (u) => .075 + .03 * Math.sin(u * Math.PI), .072, (u) => -92 + 74 * u, .004, -.034, .1, 'corta', .25],
  // plumitas y plumón que cubren el hueso del ala por fuera: le dan cuerpo
  [13, 0, .92, (u) => .05 + .02 * Math.sin(u * Math.PI), .058, (u) => -70 + 62 * u, -.022, -.044, .06, 'corta', .15],
  [9, 0, .7, (u) => .04 + .012 * Math.sin(u * Math.PI), .055, (u) => -55 + 50 * u, -.03, -.05, .04, 'plumon', .1],
];

export function crearAlas(pecho, { tamano = 'medianas' } = {}) {
  const tiempo = { value: 0 }, texturas = {};
  const material = (tipo) => {
    const m = new THREE.MeshStandardMaterial({
      map: texturas[tipo] || (texturas[tipo] = texturaPluma(tipo)), side: THREE.DoubleSide, alphaTest: .45,
      roughness: .9, metalness: 0, emissive: '#fff4f4', emissiveIntensity: .32,  // sombras claras, como el anime
    });
    // cada pluma se mece un poquito en la punta
    m.onBeforeCompile = (s) => {
      s.uniforms.uTiempo = tiempo;
      s.vertexShader = 'uniform float uTiempo;\nattribute float punta;\nattribute float fase;\n' + s.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed.z += sin(uTiempo * 2.3 + fase) * .012 * punta * punta;\ntransformed.x += sin(uTiempo * 1.7 + fase * 1.3) * .004 * punta;');
    };
    return m;
  };
  const geos = FILAS.map(([n, d, h, la, an, ang, b, z, cu, , gi]) => fila(n, d, h, la, an, ang, b, z, cu, gi));
  const geoCuerpo = cuerpoAla();
  const matCuerpo = new THREE.MeshStandardMaterial({ color: '#fbf3f1', roughness: .95, emissive: '#fff4f4', emissiveIntensity: .3 });
  const raiz = new THREE.Group(); raiz.position.set(0, .1, -.09); pecho.add(raiz);
  const lados = [];
  for (const l of [-1, 1]) {
    const ala = new THREE.Group(); ala.position.set(l * .04, 0, 0);
    const espejo = new THREE.Group(); espejo.scale.set(l, 1, 1); ala.add(espejo);  // la izquierda es la derecha en espejo
    const capas = geos.map((geo, i) => {
      const m = new THREE.Mesh(geo, material(FILAS[i][9]));
      m.frustumCulled = false; espejo.add(m); return m;
    });
    const cuerpo = new THREE.Mesh(geoCuerpo, matCuerpo); cuerpo.frustumCulled = false; espejo.add(cuerpo);
    raiz.add(ala); lados.push({ l, ala, capas });
  }
  let t = 0, aleteo = .35, toque = 0;
  raiz.scale.setScalar(TAMANOS[tamano] || 1);

  return {
    raiz,
    tamano(n) { raiz.scale.setScalar(TAMANOS[n] || 1); },
    mostrar(si) { raiz.visible = !!si; },
    tocar() { toque = 1; },
    // fuerza: 0 dormida (plegadas), .35 tranquila, 1 contenta, 1.6 emocionada; tiembla si está enojada o asustada
    actualizar(dt, { fuerza = .35, rapidez = 1, tiembla = 0 } = {}) {
      tiempo.value += dt * (1 + aleteo);
      t += dt * (1.4 + rapidez * 2 + toque * 7);
      toque = Math.max(0, toque - dt * 1.2);
      aleteo += (Math.min(1.8, fuerza + toque * 1.3) - aleteo) * (1 - Math.exp(-dt * 4));
      const abre = Math.min(1, aleteo * 2.2);  // dormida: se pliegan hacia atrás
      const sube = Math.sin(t) * .3 * aleteo, temblor = tiembla ? Math.sin(t * 9) * .05 * tiembla : 0;
      for (const { l, ala, capas } of lados) {
        ala.rotation.set(.1, l * (.5 + .55 * (1 - abre)), l * (sube + temblor - .05 - .25 * (1 - abre)));
        // las plumas largas llegan un poquito después que el brazo: se ve suave, no de cartón
        capas.forEach((g, i) => { g.rotation.z = Math.sin(t - .6 - i * .35) * .05 * aleteo * (i === 0 ? 1 : .5); });
      }
    },
  };
}
