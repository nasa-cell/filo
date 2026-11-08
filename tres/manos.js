// Manos de Filo: la mano va a un punto (el esqueleto calcula hombro y codo), choca con bolitas
// invisibles del cuerpo y de la otra mano en vez de atravesarlas, y los dedos toman posturas.
// También trae reacciones de VTuber con movimiento de anime (impulso, se pasa y rebota, se queda).
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rad = g => g * Math.PI / 180;

/* ---------- Posturas de dedos: [base, medio, punta] en grados; pulgar [cruza, dobla]; abre = separación ---------- */
const D = (i, m, a, me, p, abre = [6, 1, -3, -7]) => ({ indice: i, medio: m, anular: a, menique: me, pulgar: p, abre });
export const DEDOS = {
  relajada: D([14, 18, 10], [18, 22, 12], [22, 26, 14], [26, 30, 16], [14, 10]),
  abierta: D([2, 2, 1], [2, 2, 1], [3, 3, 1], [4, 3, 2], [-4, 0], [10, 2, -5, -12]),
  palma: D([0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [8, 0], [2, 0, -1, -2]),
  puno: D([88, 96, 58], [90, 98, 60], [92, 98, 60], [94, 98, 60], [48, 42], [0, 0, 0, 0]),
  punoSuave: D([68, 78, 42], [72, 80, 44], [76, 82, 46], [80, 84, 48], [34, 28], [0, 0, 0, 0]),
  senalar: D([0, 0, 0], [90, 98, 60], [92, 98, 60], [94, 98, 60], [42, 36], [3, 0, 0, 0]),
  paz: D([0, 0, 0], [0, 0, 0], [92, 98, 60], [94, 98, 60], [52, 46], [12, -10, 0, 0]),
  pulgar: D([88, 96, 58], [90, 98, 60], [92, 98, 60], [94, 98, 60], [-18, -14], [0, 0, 0, 0]),
  garra: D([48, 62, 42], [50, 64, 44], [52, 64, 44], [54, 64, 44], [26, 22], [4, 0, -2, -4]),
  corazon: D([20, 55, 45], [24, 58, 46], [40, 70, 50], [50, 76, 50], [-12, 0], [0, 0, 0, 0]),
  oreja: D([22, 26, 16], [24, 28, 16], [26, 30, 18], [28, 32, 18], [10, 8], [0, 0, 0, 0]),
  menton: D([22, 38, 22], [64, 84, 50], [70, 86, 50], [74, 88, 52], [22, 18], [0, 0, 0, 0]),
};
const DEDO = ['Index', 'Middle', 'Ring', 'Little'], CLAVE = ['indice', 'medio', 'anular', 'menique'], FALANGE = ['Proximal', 'Intermediate', 'Distal'];
const mezclaDedos = (a, b, t) => { const o = {}; for (const k of [...CLAVE, 'pulgar', 'abre']) o[k] = a[k].map((v, i) => v + (b[k][i] - v) * t); return o; };

/* ---------- Bolitas del cuerpo: hueso, centro respecto del hueso en reposo, radio (medidas del modelo) ---------- */
const BOLITAS = [
  ['upperChest', [.05, -.008, .056], .066], ['upperChest', [-.05, -.008, .056], .066],
  ['chest', [0, .029, .013], .088], ['spine', [0, .039, .015], .082], ['hips', [0, -.015, -.004], .12],
  ['neck', [0, .011, .021], .045], ['head', [0, .079, -.001], .098],
  ['upperChest', [.13, .032, -.134], .075], ['upperChest', [-.13, .032, -.134], .075],  // alas
];
// puntos de la mano que chocan (en el hueso de la mano, izquierda; la derecha va en espejo)
const PUNTOS = [[.035, -.012, 0, .026], [.0, -.004, 0, .022], [.09, -.006, -.008, .012]];
const CENTRO_PALMA = [.035, -.012, 0];

export function crearManos(vrm) {
  const nodo = n => vrm.humanoid.getNormalizedBoneNode(n);
  const LADOS = { I: { pre: 'left', s: 1 }, D: { pre: 'right', s: -1 } };
  const tocados = new Set();
  const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), q3 = new THREE.Quaternion(), m = new THREE.Matrix4();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e = new THREE.Vector3(), w = new THREE.Vector3();
  const actual = { I: DEDOS.relajada, D: DEDOS.relajada };

  const mundoQ = (n, q) => n.getWorldQuaternion(q);
  // gira el hueso para que su dirección «desde» apunte a «hacia» (en el mundo)
  function apuntar(n, desde, hacia) {
    q1.setFromUnitVectors(desde.clone().normalize(), hacia.clone().normalize());
    mundoQ(n, q2); q2.premultiply(q1); mundoQ(n.parent, q3).invert();
    n.quaternion.copy(q3.multiply(q2)); n.updateMatrixWorld(true);
  }
  // pone la mano con los dedos hacia F y la palma hacia N (en el mundo)
  function orientar(lado, F, N) {
    const s = LADOS[lado].s, f = F.clone().normalize(), n = N.clone().addScaledVector(f, -N.dot(f)).normalize();
    const X = f.clone().multiplyScalar(s), Y = n.clone().negate(), Z = new THREE.Vector3().crossVectors(X, Y);
    m.makeBasis(X, Y, Z); return new THREE.Quaternion().setFromRotationMatrix(m);
  }
  const palmaMundo = (lado, qMano, pos) => { const s = LADOS[lado].s; return pos.clone().add(V(CENTRO_PALMA[0] * s, CENTRO_PALMA[1], CENTRO_PALMA[2]).applyQuaternion(qMano)); };

  // IK de dos huesos: lleva la muñeca a T con el codo hacia «codo»; deja la mano con la orientación qMano (mundo)
  function alcanzar(lado, T, codo, qMano, peso) {
    const p = LADOS[lado].pre, U = nodo(p + 'UpperArm'), L = nodo(p + 'LowerArm'), H = nodo(p + 'Hand');
    const u0 = U.quaternion.clone(), l0 = L.quaternion.clone(), h0 = H.quaternion.clone();
    U.updateWorldMatrix(true, true);
    U.getWorldPosition(a); L.getWorldPosition(b); H.getWorldPosition(c);
    const la = a.distanceTo(b), lb = b.distanceTo(c);
    const d = T.clone().sub(a), largo = THREE.MathUtils.clamp(d.length(), Math.abs(la - lb) + 1e-3, la + lb - 1e-4); d.normalize();
    const pol = codo.clone().addScaledVector(d, -codo.dot(d)); if (pol.lengthSq() < 1e-6) pol.set(0, -1, 0); pol.normalize();
    const cosA = THREE.MathUtils.clamp((la * la + largo * largo - lb * lb) / (2 * la * largo), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    e.copy(a).addScaledVector(d, la * cosA).addScaledVector(pol, la * sinA);
    apuntar(U, b.clone().sub(a), e.clone().sub(a));
    L.getWorldPosition(b); H.getWorldPosition(c);
    w.copy(a).addScaledVector(d, largo);
    apuntar(L, c.clone().sub(b), w.clone().sub(b));
    if (qMano) {
      mundoQ(L, q3).invert(); H.quaternion.copy(q3.multiply(qMano.clone()));
      // la mitad del giro de la muñeca pasa al antebrazo (si no, la muñeca se retuerce)
      const eje = V(1, 0, 0), hq = H.quaternion, proy = eje.multiplyScalar(eje.dot(V(hq.x, hq.y, hq.z)));
      const giro = new THREE.Quaternion(proy.x, proy.y, proy.z, hq.w).normalize(), medio = new THREE.Quaternion().slerp(giro, .5);
      L.quaternion.multiply(medio); H.quaternion.premultiply(medio.invert());
    }
    if (peso < 1) { U.quaternion.copy(u0.slerp(U.quaternion, peso)); L.quaternion.copy(l0.slerp(L.quaternion, peso)); H.quaternion.copy(h0.slerp(H.quaternion, peso)); }
    U.updateMatrixWorld(true);
    for (const x of ['UpperArm', 'LowerArm', 'Hand']) tocados.add(p + x);
  }

  // dedos: mezcla suave hacia la postura pedida
  function ponerDedos(lado, meta, dt, peso) {
    const s = LADOS[lado].s, p = LADOS[lado].pre;
    const objetivo = peso < 1 ? mezclaDedos(DEDOS.relajada, meta, peso) : meta;
    actual[lado] = mezclaDedos(actual[lado], objetivo, 1 - Math.exp(-dt * 14));
    const f = actual[lado], eu = new THREE.Euler();
    DEDO.forEach((dd, i) => FALANGE.forEach((fa, j) => {
      const n = nodo(p + dd + fa); if (!n) return;
      eu.set(0, j === 0 ? rad(-f.abre[i] * s) : 0, rad(-f[CLAVE[i]][j] * s)); n.quaternion.setFromEuler(eu); tocados.add(p + dd + fa);
    }));
    const cruza = rad(f.pulgar[0]), dobla = rad(f.pulgar[1]);
    const ejeD = V(.8, 0, -.6 * s).normalize();
    ['ThumbMetacarpal', 'ThumbProximal', 'ThumbDistal'].forEach((fa, j) => {
      const n = nodo(p + fa); if (!n) return;
      q1.setFromAxisAngle(V(0, 1, 0), cruza * s * (j === 0 ? .6 : .2)); q2.setFromAxisAngle(ejeD, dobla * (j === 0 ? .3 : .6));
      n.quaternion.copy(q1).multiply(q2); tocados.add(p + fa);
    });
  }

  // choques: empuja la mano fuera de las bolitas del cuerpo y de la otra mano
  const bolas = BOLITAS.map(([h, o, r]) => ({ n: nodo(h), o: V(...o), r, c: new THREE.Vector3() }));
  function puntosMano(lado) {
    const s = LADOS[lado].s, H = nodo(LADOS[lado].pre + 'Hand'); H.updateWorldMatrix(true, false);
    return PUNTOS.map(([x, y, z, r]) => ({ p: H.localToWorld(V(x * s, y, z)), r }));
  }
  function choques(veces = 2) {
    for (const bo of bolas) bo.n.localToWorld(bo.c.copy(bo.o));
    for (let k = 0; k < veces; k++) {
      const empuje = { I: new THREE.Vector3(), D: new THREE.Vector3() }, pts = { I: puntosMano('I'), D: puntosMano('D') };
      for (const lado of ['I', 'D']) for (const pt of pts[lado]) for (const bo of bolas) {
        const dd = pt.p.clone().sub(bo.c), dist = dd.length(), min = bo.r + pt.r;
        if (dist < min) { const v = dd.normalize().multiplyScalar(min - dist); if (v.length() > empuje[lado].length()) empuje[lado].copy(v); }
      }
      // mano con mano: las palmas se tocan, no se cruzan
      const pi = pts.I[0], pd = pts.D[0], dd = pi.p.clone().sub(pd.p), dist = dd.length(), min = .03;
      if (dist < min) { const v = (dist > 1e-5 ? dd.normalize() : V(1, 0, 0)).multiplyScalar((min - dist) / 2); empuje.I.add(v); empuje.D.sub(v); }
      let algo = false;
      for (const lado of ['I', 'D']) {
        if (empuje[lado].lengthSq() < 1e-8) continue; algo = true;
        const H = nodo(LADOS[lado].pre + 'Hand'), qm = H.getWorldQuaternion(new THREE.Quaternion()), T = H.getWorldPosition(new THREE.Vector3()).add(empuje[lado].multiplyScalar(1.05));
        alcanzar(lado, T, codoPorDefecto(lado), qm, 1);
      }
      if (!algo) break;
    }
  }
  const codoPorDefecto = lado => { const ch = nodo('chest'); return V(.55 * LADOS[lado].s, -.7, -.45).applyQuaternion(ch.getWorldQuaternion(new THREE.Quaternion())); };

  // aplica lo que pide la reacción (ik, dedos) con su peso, y siempre los choques
  function aplicar(P, peso, dt) {
    const ch = nodo('chest'); ch.updateWorldMatrix(true, false);
    const qc = ch.getWorldQuaternion(new THREE.Quaternion());
    const aMundo = v => V(...v).applyQuaternion(qc);
    for (const lado of ['I', 'D']) {
      const pedido = P && P.ik && P.ik[lado];
      const nombreDedos = (P && P.dedos && P.dedos[lado]) || (pedido && pedido.dedos) || 'relajada';
      ponerDedos(lado, DEDOS[nombreDedos] || DEDOS.relajada, dt, pedido || (P && P.dedos) ? peso : 1);
      if (!pedido || peso < .002) continue;
      const qm = pedido.dedo ? orientar(lado, aMundo(pedido.dedo), aMundo(pedido.palma || [0, 0, -1])) : nodo(LADOS[lado].pre + 'Hand').getWorldQuaternion(new THREE.Quaternion());
      // el punto pedido es el centro de la palma; la muñeca queda un poco atrás
      const palma = ch.localToWorld(V(...pedido.p)), s = LADOS[lado].s;
      const muneca = palma.sub(V(CENTRO_PALMA[0] * s, CENTRO_PALMA[1], CENTRO_PALMA[2]).applyQuaternion(qm));
      alcanzar(lado, muneca, pedido.codo ? aMundo(pedido.codo) : codoPorDefecto(lado), qm, Math.min(1, peso * (pedido.peso ?? 1)));
    }
    choques();
  }
  function soltar() { for (const n of tocados) { const x = nodo(n); if (x && /Thumb|Index|Middle|Ring|Little/.test(n)) x.quaternion.identity(); } actual.I = actual.D = DEDOS.relajada; }
  return { aplicar, soltar, tocados, palmaMundo };
}

/* ---------- Movimiento de anime: impulso antes, se pasa y rebota, se queda un instante ---------- */
const liso = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
// llega pasándose un poco (más con más fuerza) y vuelve
const golpe = (t, dur, k) => { const x = Math.min(1, Math.max(0, t / dur)), s = 1.7 * k; return 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2; };
// se echa para atrás antes de moverse
const impulso = (t, dur, k) => (t < dur ? -.14 * k * Math.sin(Math.PI * t / dur) : 0);
const ida = (t, antes, dur, k) => (t < antes ? impulso(t, antes, k) : golpe(t - antes, dur, k));
const sn = (t, hz, f = 0) => Math.sin(t * hz * 2 * Math.PI + f);
const mix = (p, q, x) => p.map((v, i) => v + (q[i] - v) * x);
// pose de reposo de la palma (como cuelga la mano), para salir desde ahí
const ABAJO = { I: [.2, -.2, .0], D: [-.2, -.2, .0] };
const cuerpo = (t, f = 1) => ({ hips: [0, 3 * sn(t, .21) * f, 2 * sn(t, .34, 1) * f], spine: [1, -1.5 * sn(t, .21) * f, 0], chest: [1, -1.2 * sn(t, .21) * f, 0] });
const cab = (t, x = 0, y = 0, z = 0, f = 1) => [x + 2 * sn(t, .31) * f, y + 3 * sn(t, .17) * f, z + 2 * sn(t, .23, 1) * f];

// cada reacción: pose(t, k) con k = fuerza del movimiento (suave .65, medio 1, fuerte 1.4)
export const VTUBER = {
  aplaudir: { nombre: 'Aplaudir', simbolos: ['estrellas'], plano: 'medio', pose: (t, k) => {
    const sube = ida(t, .12, .35, k), hz = 2.2 + .5 * k, u = ((t - .3) * hz) % 1, abre = t < .3 ? .16 : .16 * Math.pow(Math.sin(Math.PI * u), .8);
    const y = .14 + .02 * Math.sin(Math.PI * u) * k;
    return { sube: .006 * k * (1 - abre / .16),
      huesos: { ...cuerpo(t, .6), chest: [-2 - 2 * k * (1 - abre / .16), 0, 0], head: cab(t, -3 - 3 * k * (1 - abre / .16), 0, 4 * sn(t, .4), .5) },
      ik: { I: { p: mix(ABAJO.I, [abre / 2, y, .23], sube), dedo: [-.15, .8, .58], palma: [-1, 0, 0] }, D: { p: mix(ABAJO.D, [-abre / 2, y, .23], sube), dedo: [.15, .8, .58], palma: [1, 0, 0] } },
      dedos: { I: 'palma', D: 'palma' }, cara: { happy: 1, aa: .25 + .15 * (1 - abre / .16) } }; } },
  pecho: { nombre: 'Mano al pecho', simbolos: ['rubor'], plano: 'cerca', pose: (t, k) => {
    const x = ida(t, .2, .55, k * .7), resp = .006 * sn(t, .35);
    return { huesos: { ...cuerpo(t, .5), chest: [-2 * x, 0, 0], head: cab(t, 10 * x, -8 * x, 6 * x, .3) },
      ik: { I: { p: mix(ABAJO.I, [.035, .085 + resp, .095], x), dedo: [-.75, .62, .1], palma: [0, 0, -1] } },
      dedos: { I: 'abierta' }, mira: [-.3, -.4, 1], cara: { relaxed: .6, happy: .3 } }; } },
  yatta: { nombre: '¡Lo logré!', simbolos: ['estrellas'], fondo: 'amarillo', impacto: true, plano: 'medio', pose: (t, k) => {
    const x = ida(t, .28, .3, k), salto = t < .28 ? -.4 * Math.sin(Math.PI * t / .28) : Math.max(0, Math.sin(Math.PI * Math.min(1, (t - .28) / .55))), bomba = t > .9 ? .5 + .5 * sn(t - .9, 1.6) : 1;
    return { sube: .05 * k * salto,
      huesos: { ...cuerpo(t, .3), spine: [-4 * x, 0, 0], chest: [-6 * x, 0, 0], head: cab(t, -12 * x, 0, 0, .3), leftUpperLeg: [-12 * Math.max(0, -salto), 0, 0], rightUpperLeg: [-12 * Math.max(0, -salto), 0, 0], leftLowerLeg: [24 * Math.max(0, -salto), 0, 0], rightLowerLeg: [24 * Math.max(0, -salto), 0, 0] },
      ik: { I: { p: mix(ABAJO.I, [.22, .3 + .05 * bomba, .1], x), dedo: [.25, 1, .1], palma: [0, 0, 1], codo: [1, -.3, -.4] }, D: { p: mix(ABAJO.D, [-.22, .3 + .05 * bomba, .1], x), dedo: [-.25, 1, .1], palma: [0, 0, 1], codo: [-1, -.3, -.4] } },
      dedos: { I: 'puno', D: 'puno' }, cara: { happy: 1, aa: .6 } }; } },
  mejillas: { nombre: '¡Kyaa!', simbolos: ['rubor', 'corazones'], fondo: 'rosa', plano: 'cerca', pose: (t, k) => {
    const x = ida(t, .15, .4, k), lado = sn(t, .7) * k;
    return { huesos: { ...cuerpo(t, .4), hips: [0, 6 * lado, 3 * lado], chest: [2, -4 * lado, 0], head: cab(t, 6, 6 * lado, 12 * lado, .3), leftShoulder: [0, 0, 8 * x], rightShoulder: [0, 0, -8 * x] },
      ik: { I: { p: mix(ABAJO.I, [.075, .27, .085], x), dedo: [-.1, 1, .25], palma: [-1, 0, -.3] }, D: { p: mix(ABAJO.D, [-.075, .27, .085], x), dedo: [.1, 1, .25], palma: [1, 0, -.3] } },
      dedos: { I: 'abierta', D: 'abierta' }, cara: { happy: 1, blink: .9 } }; } },
  taparCara: { nombre: '¡Qué vergüenza!', simbolos: ['rubor', 'gota'], plano: 'cerca', pose: (t, k) => {
    const x = ida(t, .12, .35, k), u = t % 2.6, espia = u > 1.5 && u < 2.3 ? liso((u - 1.5) / .2) * (1 - liso((u - 2.1) / .2)) : 0;
    return { huesos: { ...cuerpo(t, .3), spine: [4 * x, 0, 0], chest: [5 * x, 0, 0], head: cab(t, 12 * x - 6 * espia, 0, 0, .2), leftShoulder: [0, 0, 10 * x], rightShoulder: [0, 0, -10 * x] },
      ik: { I: { p: mix(ABAJO.I, [.03 + .05 * espia, .32, .1], x), dedo: [-.2, 1, .05], palma: [-.2 * espia, 0, -1] }, D: { p: mix(ABAJO.D, [-.03 - .05 * espia, .32, .1], x), dedo: [.2, 1, .05], palma: [.2 * espia, 0, -1] } },
      dedos: { I: espia > .5 ? 'abierta' : 'palma', D: espia > .5 ? 'abierta' : 'palma' }, mira: [0, -.1, 1], cara: { sad: .3, blink: 1 - espia }, morfos: { Fcl_BRW_Sorrow: .6 } }; } },
  ganbaru: { nombre: '¡Vamos!', simbolos: ['estrellas'], plano: 'medio', pose: (t, k) => {
    const x = ida(t, .15, .3, k), u = (t * 1.8) % 1, golpeA = u < .25 ? liso(u / .25) : 1 - liso((u - .25) / .75);
    return { sube: .008 * golpeA * k,
      huesos: { ...cuerpo(t, .4), chest: [3 * golpeA * k, 0, 0], head: cab(t, 6 * golpeA * k - 3, 0, 0, .3) },
      ik: { I: { p: mix(ABAJO.I, [.1, .14 - .04 * golpeA * k, .2], x), dedo: [-.15, 1, .2], palma: [-.5, 0, -.85] }, D: { p: mix(ABAJO.D, [-.1, .14 - .04 * golpeA * k, .2], x), dedo: [.15, 1, .2], palma: [.5, 0, -.85] } },
      dedos: { I: 'punoSuave', D: 'punoSuave' }, cara: { happy: .8, aa: .35 * golpeA }, morfos: { Fcl_BRW_Angry: .25 } }; } },
  tuSenalar: { nombre: '¡Tú!', simbolos: ['idea'], impacto: true, plano: 'cerca', pose: (t, k) => {
    const atras = liso(t / .25), x = t < .25 ? 0 : golpe(t - .25, .22, k * 1.2);
    return { huesos: { ...cuerpo(t, .3), spine: [3 * x, 6 * x, 0], chest: [3 * x, 6 * x, 0], head: cab(t, 2, -4 * x, -6 * x, .2) },
      ik: { D: { p: x > 0 ? mix([-.16, .1, .1], [-.05, .2, .32], x) : mix(ABAJO.D, [-.16, .1, .1], atras), dedo: [.12, .1, 1], palma: [.6, -.8, 0] }, I: { p: mix(ABAJO.I, [.15, -.13, .01], atras), dedo: [-.1, -.5, 1], palma: [-1, 0, 0], codo: [1, 0, -.6] } },
      dedos: { D: 'senalar', I: 'palma' }, cara: { happy: .6, blinkLeft: x > .5 ? 1 : 0 }, morfos: { Fcl_MTH_Fun: .5 } }; } },
  saludo: { nombre: '¡Holi, chat!', simbolos: ['notas'], plano: 'medio', pose: (t, k) => {
    const x = ida(t, .12, .32, k), ola = sn(t, 2 + .6 * k) * (.35 + .25 * k);
    return { sube: .01 * Math.max(0, sn(t, 1)), huesos: { ...cuerpo(t, .6), head: cab(t, 0, -4, -10 * x, .4) },
      ik: { D: { p: mix(ABAJO.D, [-.17 + .02 * ola, .34, .13], x), dedo: [ola * .6, 1, 0], palma: [0, 0, 1] }, I: { p: mix(ABAJO.I, [.07, .07, .17], x), dedo: [-.3, 1, .2], palma: [-.6, 0, -.8] } },
      dedos: { D: 'abierta', I: 'punoSuave' }, cara: { happy: 1, aa: .3 + .2 * Math.max(0, sn(t, 2.4)) } }; } },
  corazon: { nombre: 'Corazón con las manos', simbolos: ['corazones', 'rubor'], fondo: 'rosa', plano: 'cerca', pose: (t, k) => {
    const x = ida(t, .2, .45, k), late = 1 + .04 * k * Math.max(0, sn(t, 1.3)) ** 4;
    return { huesos: { ...cuerpo(t, .5), chest: [-2, 0, 0], head: cab(t, 4, 0, 10, .3) },
      ik: { I: { p: mix(ABAJO.I, [.045 * late, .13, .24], x), dedo: [-.55, .83, 0], palma: [0, 0, 1] }, D: { p: mix(ABAJO.D, [-.045 * late, .13, .24], x), dedo: [.55, .83, 0], palma: [0, 0, 1] } },
      dedos: { I: 'corazon', D: 'corazon' }, cara: { happy: 1 } }; } },
  gatita: { nombre: 'Nya~', simbolos: ['notas'], plano: 'cerca', pose: (t, k) => {
    const x = ida(t, .12, .35, k), p1 = Math.max(0, sn(t, 1.3)) * k, p2 = Math.max(0, sn(t, 1.3, Math.PI)) * k;
    return { huesos: { ...cuerpo(t, .5), head: cab(t, 3, 0, 10 * (p1 - p2), .3) },
      ik: { I: { p: mix(ABAJO.I, [.1, .27 + .03 * p1, .16], x), dedo: [0, 1, .1], palma: [0, -.35, 1] }, D: { p: mix(ABAJO.D, [-.1, .27 + .03 * p2, .16], x), dedo: [0, 1, .1], palma: [0, -.35, 1] } },
      dedos: { I: 'garra', D: 'garra' }, cara: { happy: .7 }, morfos: { Fcl_MTH_Fun: .8 } }; } },
  paz: { nombre: 'V de victoria', simbolos: ['estrellas'], plano: 'cerca', pose: (t, k) => {
    const x = ida(t, .12, .3, k);
    return { sube: .02 * k * Math.max(0, Math.sin(Math.PI * Math.min(1, t / .5))),
      huesos: { ...cuerpo(t, .5), hips: [0, 0, -4 * x], head: cab(t, 2, -6 * x, -12 * x, .3) },
      ik: { D: { p: mix(ABAJO.D, [-.12, .35, .12], x), dedo: [-.25, 1, 0], palma: [0, 0, 1] }, I: { p: mix(ABAJO.I, [.15, -.13, .01], x), dedo: [-.1, -.5, 1], palma: [-1, 0, 0], codo: [1, 0, -.6] } },
      dedos: { D: 'paz', I: 'palma' }, cara: { happy: .9, blinkLeft: 1, ih: .2 } }; } },
  pulgar: { nombre: '¡Buenísimo!', simbolos: ['estrellas'], plano: 'medio', pose: (t, k) => {
    const x = ida(t, .15, .3, k);
    return { huesos: { ...cuerpo(t, .5), chest: [-3 * x, 0, 0], head: cab(t, -4 * x, 0, 6 * x, .3) },
      ik: { D: { p: mix(ABAJO.D, [-.08, .13, .27], x), dedo: [1, 0, .25], palma: [0, 0, -1] } },
      dedos: { D: 'pulgar' }, cara: { happy: .9, blinkLeft: 1 } }; } },
  menton: { nombre: 'Mmm…', simbolos: ['pregunta'], plano: 'cerca', pose: (t, k) => {
    const x = ida(t, .25, .55, k * .6), tam = .005 * sn(t, 1.1);
    return { huesos: { ...cuerpo(t, .5), head: cab(t, -4, -8, 10, .3) },
      ik: { D: { p: mix(ABAJO.D, [-.03, .245 + tam, .1], x), dedo: [.35, .85, .3], palma: [0, .6, -.8] }, I: { p: mix(ABAJO.I, [-.06, .02, .17], x), dedo: [-1, .1, 0], palma: [0, 1, 0] } },
      dedos: { D: 'menton', I: 'relajada' }, mira: [-.35, .35, .7], cara: { relaxed: .2 }, morfos: { Fcl_BRW_Sorrow: .4, Fcl_MTH_Small: .5 } }; } },
  panico: { nombre: '¡¿Dejé el directo abierto?!', simbolos: ['susto', 'gota'], fondo: 'gris', impacto: true, plano: 'cerca', pose: (t, k) => {
    const x = ida(t, .08, .22, k * 1.2), mira = Math.sign(sn(t, .9)) * liso(Math.abs(sn(t, .9)) * 3) * k;
    return { huesos: { ...cuerpo(t, .2), spine: [-3, 0, 0], chest: [-4, 0, 0], head: cab(t, -4, 22 * mira, 0, .1), leftShoulder: [0, 0, 12 * x], rightShoulder: [0, 0, -12 * x] },
      ik: { I: { p: mix(ABAJO.I, [.095, .43, .0], x), dedo: [-.35, 1, 0], palma: [-1, 0, 0], codo: [1, .2, -.2] }, D: { p: mix(ABAJO.D, [-.095, .43, .0], x), dedo: [.35, 1, 0], palma: [1, 0, 0], codo: [-1, .2, -.2] } },
      dedos: { I: 'garra', D: 'garra' }, mira: [mira * .8, 0, 1], cara: { surprised: 1, aa: .7 } }; } },
  gracias: { nombre: '¡Gracias por el súper chat!', simbolos: ['notas', 'estrellas'], plano: 'medio', pose: (t, k) => {
    const x = ida(t, .12, .35, k), u = (t % 2.2) / 2.2, reve = u < .3 ? liso(u / .3) : u < .55 ? 1 : 1 - liso((u - .55) / .3);
    return { huesos: { ...cuerpo(t, .3), spine: [8 * reve * k, 0, 0], chest: [8 * reve * k, 0, 0], head: cab(t, 10 * reve, 0, 0, .2) },
      ik: { I: { p: mix(ABAJO.I, [0, .13, .2], x), dedo: [-.1, 1, .3], palma: [-1, 0, 0] }, D: { p: mix(ABAJO.D, [0, .13, .2], x), dedo: [.1, 1, .3], palma: [1, 0, 0] } },
      dedos: { I: 'palma', D: 'palma' }, cara: { happy: 1, blink: reve > .5 ? 1 : 0 } }; } },
  leerChat: { nombre: '¿Qué dice el chat?', simbolos: ['pregunta'], plano: 'cerca', pose: (t, k) => {
    const x = ida(t, .15, .4, k);
    return { huesos: { ...cuerpo(t, .4), spine: [3 * x, -6 * x, -3 * x], chest: [3 * x, -6 * x, 0], head: cab(t, 4, -14 * x, 10 * x, .2) },
      ik: { D: { p: mix(ABAJO.D, [-.11, .34, .0], x), dedo: [.1, 1, -.2], palma: [.15, 0, 1], codo: [-1, -.3, 0] } },
      dedos: { D: 'oreja' }, mira: [-.6, 0, .8], cara: { ou: .25 }, morfos: { Fcl_BRW_Sorrow: .3 } }; } },
  abrazo: { nombre: 'Abrazo al chat', simbolos: ['corazones'], fondo: 'rosa', plano: 'medio', pose: (t, k) => {
    const abre = ida(t, .1, .4, k), cierra = t > 1 ? golpe(t - 1, .35, k) : 0;
    const pI = mix([.34, .12, .14], [.07, .13, .3], cierra), pD = mix([-.34, .12, .14], [-.07, .13, .3], cierra);
    return { huesos: { ...cuerpo(t, .4), chest: [-4 * abre + 6 * cierra, 0, 0], head: cab(t, -6 * abre + 8 * cierra, 0, 6 * cierra, .3) },
      ik: { I: { p: mix(ABAJO.I, pI, abre), dedo: mix([1, .2, .3], [-.6, 0, .8], cierra), palma: mix([0, 0, 1], [-.7, 0, -.4], cierra) }, D: { p: mix(ABAJO.D, pD, abre), dedo: mix([-1, .2, .3], [.6, 0, .8], cierra), palma: mix([0, 0, 1], [.7, 0, -.4], cierra) } },
      dedos: { I: 'abierta', D: 'abierta' }, cara: { happy: 1, blink: cierra > .5 ? 1 : 0 } }; } },
  risaPanza: { nombre: '¡Me muero de risa!', simbolos: ['notas'], fondo: 'amarillo', plano: 'medio', pose: (t, k) => {
    const x = ida(t, .1, .3, k), b = .5 - .5 * Math.cos(t * 2.4 * 2 * Math.PI);
    return { sube: .006 * b * k, huesos: { ...cuerpo(t, .3), spine: [(8 + 4 * b) * k * x, 0, 0], chest: [(6 + 4 * b) * k * x, 0, 0], head: cab(t, 4 - 10 * b, 0, 6 * sn(t, .5), .2) },
      ik: { I: { p: mix(ABAJO.I, [.06, -.08, .12], x), dedo: [-.8, -.3, .1], palma: [0, 0, -1] }, D: { p: mix(ABAJO.D, [-.06, -.08, .12], x), dedo: [.8, -.3, .1], palma: [0, 0, -1] } },
      dedos: { I: 'abierta', D: 'abierta' }, cara: { happy: 1, aa: .45 + .3 * b, blink: 1 } }; } },
};
// Al hablar: las manos acompañan lo que dice (explica, se señala, levanta el dedo, se encoge...) y cambian solas
const AL_HABLAR = [
  { I: { p: [.14, .07, .22], dedo: [-.2, .25, 1], palma: [-.3, 1, 0] }, D: { p: [-.14, .07, .22], dedo: [.2, .25, 1], palma: [.3, 1, 0] }, dedos: 'abierta' },
  { D: { p: [-.15, .13, .22], dedo: [.15, .6, .8], palma: [.5, .6, .2] }, dedos: 'abierta' },
  null,
  { D: { p: [-.03, .08, .1], dedo: [.75, .62, .1], palma: [0, 0, -1] }, dedos: 'abierta' },
  { D: { p: [-.15, .2, .14], dedo: [0, 1, .1], palma: [0, 0, 1] }, dedos: 'senalar' },
  { I: { p: [.2, .05, .2], dedo: [.4, .2, 1], palma: [0, 1, 0] }, D: { p: [-.2, .05, .2], dedo: [-.4, .2, 1], palma: [0, 1, 0] }, dedos: 'abierta', encoge: 1 },
  { I: { p: [.14, .11, .21], dedo: [-.2, .4, 1], palma: [-.4, .9, 0] }, dedos: 'abierta' },
  null,
  { I: { p: [.1, .12, .19], dedo: [-.15, 1, .2], palma: [-.5, 0, -.85] }, D: { p: [-.1, .12, .19], dedo: [.15, 1, .2], palma: [.5, 0, -.85] }, dedos: 'punoSuave' },
];
const TRAMO = 2.2;
export const HABLANDO = (t, k) => {
  const n = Math.floor(t / TRAMO), u = t - n * TRAMO, g = AL_HABLAR[(n * 5) % AL_HABLAR.length];
  const w = liso(u / .35) * (1 - liso((u - (TRAMO - .4)) / .35)), pulso = .012 * k * sn(t, 1.7);
  const ik = {}, dedos = {};
  if (g) for (const lado of ['I', 'D']) { const h = g[lado]; if (!h) continue; ik[lado] = { ...h, p: [h.p[0], h.p[1] + pulso, h.p[2]], peso: w }; if (w > .3) dedos[lado] = g.dedos; }
  const e = g && g.encoge ? w : 0;
  return { ik, dedos, huesos: { leftShoulder: [0, 0, 7 * e], rightShoulder: [0, 0, -7 * e] } };
};
// gestos de hoy que se reemplazan por la versión con manos de verdad
export const REEMPLAZA = { aplaudir: 'aplaudir', unas: 'pecho' };
