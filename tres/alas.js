// Alas de Filo en 3D, como las de la ilustración: un brazo que sube desde la espalda, plumas largas
// y redondas que cuelgan (las de la punta más largas), plumas chicas encima y borde rosado suave.
// Cada fila de plumas es una sola malla: liviano para el celular.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAMANOS = { chicas: .6, medianas: 1, grandes: 1.4 };
const L = .3;  // largo del brazo del ala (medianas)

// pluma redonda que apunta hacia +Y desde la base
function pluma(largo, ancho) {
  const f = new THREE.Shape();
  f.moveTo(0, 0);
  f.bezierCurveTo(ancho * .62, largo * .08, ancho * .6, largo * .86, 0, largo);
  f.bezierCurveTo(-ancho * .6, largo * .86, -ancho * .62, largo * .08, 0, 0);
  return new THREE.ShapeGeometry(f, 12);
}
// el brazo del ala: sube hacia afuera y en la punta baja un poco
const brazo = (u) => {
  const a = new THREE.Vector2(0, 0), b = new THREE.Vector2(L * .38, L * .72), c = new THREE.Vector2(L, L * .62);
  return a.multiplyScalar((1 - u) ** 2).add(b.multiplyScalar(2 * u * (1 - u))).add(c.multiplyScalar(u * u));
};
// una fila: plumas repartidas por el brazo; cada una con su largo y su ángulo (grados desde +X)
function fila(cant, desde, hasta, largo, ancho, angulo, bajar, z) {
  const relleno = [], borde = [];
  for (let i = 0; i < cant; i++) {
    const u = desde + (hasta - desde) * (cant > 1 ? i / (cant - 1) : 0), p = brazo(u), l = largo(u), a = angulo(u) * Math.PI / 180;
    for (const [lista, extra] of [[relleno, 1], [borde, 1]]) {
      const g = extra === 1 && lista === borde ? pluma(l + .012, ancho + .012) : pluma(l, ancho);
      if (lista === borde) g.translate(0, -.006, 0);
      g.rotateZ(a - Math.PI / 2); g.translate(p.x, p.y - bajar, z + i * .0006);
      lista.push(g);
    }
  }
  return { relleno: mergeGeometries(relleno), borde: mergeGeometries(borde) };
}

export function crearAlas(pecho, { tamano = 'medianas' } = {}) {
  const degrade = new THREE.DataTexture(new Uint8Array([214, 214, 214, 255, 255, 255, 255, 255]), 2, 1);
  degrade.minFilter = degrade.magFilter = THREE.NearestFilter; degrade.needsUpdate = true;
  const toon = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: degrade, side: THREE.DoubleSide });
  // el borde va en el mismo plano pero «empujado atrás» en profundidad: se ve como contorno de los dos lados
  const rosa = new THREE.MeshBasicMaterial({ color: '#d7a19b', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 6 });
  const filas = [
    // plumas largas: las de la punta más largas y casi siguiendo el brazo
    { f: fila(10, .34, 1, (u) => .14 + .18 * Math.sin(u * Math.PI * .5), .074, (u) => -98 + 104 * u ** 1.5, .004, 0), color: '#fffaf6' },
    // plumas medianas: cuelgan cerca de la espalda
    { f: fila(7, .02, .6, (u) => .13 + .06 * u, .07, (u) => -102 + 26 * u, .008, .006), color: '#fff6f1' },
    // plumitas de arriba: tapan el brazo, en escamas
    { f: fila(11, 0, .96, (u) => .07 + .03 * Math.sin(u * Math.PI), .058, (u) => -92 + 74 * u, .012, .012), color: '#fffdfb' },
  ];
  const raiz = new THREE.Group(); raiz.position.set(0, .1, -.09); pecho.add(raiz);
  const lados = [];
  for (const l of [-1, 1]) {
    const ala = new THREE.Group(); ala.position.set(l * .04, 0, 0);
    const espejo = new THREE.Group(); espejo.scale.set(l, 1, 1); ala.add(espejo);
    const capas = filas.map(({ f, color }) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(f.borde, rosa), new THREE.Mesh(f.relleno, toon(color)));
      g.children.forEach((m) => { m.frustumCulled = false; });
      espejo.add(g); return g;
    });
    raiz.add(ala); lados.push({ l, ala, capas });
  }
  let t = 0, aleteo = .35, toque = 0;
  raiz.scale.setScalar(TAMANOS[tamano] || 1);

  return {
    tamano(n) { raiz.scale.setScalar(TAMANOS[n] || 1); },
    mostrar(si) { raiz.visible = !!si; },
    tocar() { toque = 1; },
    // fuerza: 0 dormida (plegadas), .35 tranquila, 1 contenta, 1.6 emocionada; tiembla si está enojada o asustada
    actualizar(dt, { fuerza = .35, rapidez = 1, tiembla = 0 } = {}) {
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
