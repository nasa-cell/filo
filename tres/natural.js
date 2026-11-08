// Forma de moverse inspirada en la Filo ilustrada: cabeza suave, respiración, saltitos y manos tranquilas.
const s = (t, hz, f = 0) => Math.sin(t * hz * 2 * Math.PI + f);
// Sube y baja redondo, sin el golpe seco del valor absoluto
const rebote = (t, hz) => .5 - .5 * Math.cos(t * hz * 2 * Math.PI);
const entra = (t, seg) => { const x = Math.min(1, t / seg); return x * x * (3 - 2 * x); };

function boca(t, fuerza = 1) {
  const habla = s(t, .27) > -.6 ? 1 : 0;
  return { aa: Math.max(0, s(t, 2.7) * s(t, 1.05, .6)) * .55 * habla * fuerza, oh: Math.max(0, s(t, 1.9, 1) * s(t, .7)) * .3 * habla * fuerza, ih: Math.max(0, s(t, 3.7, 2)) * .14 * habla * fuerza };
}
// Peso que pasa de una pierna a otra, sin rigidez
function cuerpo(t, f = 1) {
  const c = s(t, .21), d = s(t, .34, 1);
  return {
    hips: [0, 3 * c * f, 2.2 * d * f], spine: [1 + .8 * s(t, .29) * f, -1.5 * c * f, -1.3 * d * f], chest: [1.2 + .8 * s(t, .29, 1) * f, -1.4 * c * f, -.9 * d * f],
    leftUpperLeg: [-2 + 2 * d * f, 0, 0], rightUpperLeg: [-2 - 2 * d * f, 0, 0], leftLowerLeg: [4 - 4 * d * f, 0, 0], rightLowerLeg: [4 + 4 * d * f, 0, 0], leftFoot: [-2, 0, 0], rightFoot: [-2, 0, 0]
  };
}
function brazos(t, gesto = 0, gestoI = gesto) {
  const a = s(t, .23, .4), b = s(t, .19, 2);
  return {
    leftUpperArm: [0, -5 - 2 * a - 6 * gestoI, -73 - 1.5 * a + 8 * gestoI], rightUpperArm: [0, 5 + 2 * b + 6 * gesto, 73 + 1.5 * b - 8 * gesto],
    leftLowerArm: [0, -13 - 2 * b - 34 * gestoI, 0], rightLowerArm: [0, 13 + 2 * a + 34 * gesto, 0],
    leftHand: [5 + 2 * b, 0, -6], rightHand: [5 + 2 * a, 0, 6]
  };
}
const cabeza = (t, x = 0, y = 0, z = 0, f = 1) => [x + (2.2 * s(t, .31) + 1.2 * s(t, .73, 1)) * f, y + (4 * s(t, .17) + 1.6 * s(t, .41, 2)) * f, z + (2.2 * s(t, .23, 1)) * f];

const JUNTAS = {
  D: { pos: [-.015, -.245, .15], F: [.72, -.5, .42], T: [.12, .62, .78], mano: 'relajada' },
  I: { pos: [.015, -.26, .155], F: [-.72, -.5, .42], T: [-.12, .62, .78], mano: 'relajada' }
};

// Arcada, se dobla hacia delante, y vuelve
function vomitar(t, tipo) {
  const u = t % 4, arcada = entra(Math.min(u, .7), .55), sale = u > .7 && u < 2.9 ? entra(u - .7, .14) : u >= 2.9 ? 1 - entra(u - 2.9, .6) : 0, sin = 1 - sale;
  return {
    boca: u > .78 && u < 2.9 ? tipo : null,
    huesos: { ...cuerpo(t, .2), spine: [8 * sale + 3 * arcada * sin, 0, 0], chest: [10 * sale + 4 * arcada * sin, 0, 0], head: cabeza(t, 18 * sale + 4 * arcada * sin, 0, 0, .08), leftShoulder: [0, 0, 7 * arcada * sin], rightShoulder: [0, 0, -7 * arcada * sin], ...brazos(t, .2 * sale, .2 * sale) },
    cara: { sad: .7 * arcada * sin, aa: .95 * sale, blink: sale > .4 ? 1 : 0 }, morfos: { Fcl_BRW_Sorrow: .6, Fcl_MTH_Small: .7 * arcada * sin } };
}

export function momentos(juntas) {
  const manos = juntas ? JUNTAS : {};
  const br = (t, g, gi) => (juntas ? {} : brazos(t, g, gi));
  return {
    hola: { nombre: 'Saludar', plano: 'medio', tasa: 2.6, pose: t => { const sal = t < .8 ? Math.sin(t / .8 * Math.PI) ** 2 : 0; return {
      sube: .03 * sal, huesos: { ...cuerpo(t), head: cabeza(t, 1, -3, -8 + 2 * s(t, .5)), ...brazos(t), rightUpperArm: [0, 8, -32], rightLowerArm: [0, 8, -46 + 11 * s(t, .9)], rightHand: [0, 0, -4 + 7 * s(t, .9, -.8)] },
      cara: { happy: .85, ...boca(t, .5) } }; } },
    hablar: { nombre: 'Hablar', plano: 'medio', tasa: 1.5, pose: t => { const g = Math.max(0, s(t, .37)) ** 2, gi = Math.max(0, s(t, .29, 2)) ** 2; return {
      huesos: { ...cuerpo(t), head: cabeza(t, 2 + 2.6 * Math.max(0, s(t, .95)), 0, 0, 1.6), ...br(t, g * .8, gi * .8) }, ...manos,
      cara: { happy: .14 + .1 * s(t, .2), ...boca(t) } }; } },
    pensar: { nombre: 'Pensar', plano: 'cerca', tasa: .8, pose: t => ({
      huesos: { ...cuerpo(t, .7), head: cabeza(t, -3, -9, 11, .6), ...br(t) }, ...manos,
      mira: [-.3, .28, .6], cara: { relaxed: .2, ih: .06 }, morfos: { Fcl_BRW_Sorrow: .45, Fcl_MTH_Small: .5 } }) },
    reaccionar: { nombre: 'Reaccionar', plano: 'cara', tasa: 24, rapida: true, pose: t => { const salto = Math.sin(Math.min(1, t / .42) * Math.PI), a = Math.min(1, t * 6); return {
      sube: .05 * salto, huesos: { ...cuerpo(t, .4), spine: [-5 * a, 0, 0], chest: [-3 * a, 0, 0], head: cabeza(t, -6 * a, 0, 0, .5), leftShoulder: [0, 0, 6 * a], rightShoulder: [0, 0, -6 * a], ...br(t, .85 * a, .85 * a) }, ...manos,
      cara: { surprised: 1, aa: .4 } }; } },
    reir: { nombre: 'Reírse', plano: 'medio', tasa: 3, pose: t => { const b = rebote(t, 1.2); return {
      sube: .008 * b, huesos: { ...cuerpo(t, .6), chest: [2 + 3 * b, 0, 0], spine: [1 + 2 * b, 0, 1.5 * s(t, .3)], head: cabeza(t, -5 + 5 * b, 4 * s(t, .3), 5 * s(t, .25), .5), leftShoulder: [0, 0, 2 * b], rightShoulder: [0, 0, -2 * b], ...br(t, .2 + .08 * b, .2 + .08 * b) }, ...manos,
      cara: { happy: 1, aa: .3 + .25 * b } }; } },
    emocion: { nombre: 'Saltitos de alegría', plano: 'medio', tasa: 2.2, pose: t => { const b = rebote(t, .95) ** 1.3; return {
      sube: .06 * b, huesos: { ...cuerpo(t, .4), head: cabeza(t, -3 + 3 * b, 0, 6 * s(t, .48), .5), leftUpperLeg: [-14 * (1 - b), 0, 0], rightUpperLeg: [-14 * (1 - b), 0, 0], leftLowerLeg: [28 * (1 - b), 0, 0], rightLowerLeg: [28 * (1 - b), 0, 0], leftFoot: [-14 * (1 - b) + 16 * b, 0, 0], rightFoot: [-14 * (1 - b) + 16 * b, 0, 0], ...br(t, .45 * b, .45 * b) }, ...manos,
      cara: { happy: 1, aa: .2 + .2 * b } }; } },
    encoger: { nombre: '¿Quién sabe?', plano: 'medio', tasa: 3, pose: t => { const a = .5 + .5 * s(t, .42); return {
      huesos: { ...cuerpo(t, .6), head: cabeza(t, 1, 4, -12 * a - 3, .4), leftShoulder: [0, 0, 5 + 9 * a], rightShoulder: [0, 0, -5 - 9 * a], ...br(t, .3 * a, .3 * a) }, ...manos,
      mira: [.08, .3, 1], cara: { relaxed: .3, oh: .25 } }; } },
    mirar: { nombre: 'Mira a un lado', plano: 'cerca', tasa: 1.2, pose: t => ({
      huesos: { ...cuerpo(t, .5), head: cabeza(t, 1, 20, 3, .4), chest: [1, 5, 0], ...br(t) }, ...manos,
      mira: [.9, .05, .6], cara: { relaxed: .25 } }) },
    enojada: { nombre: 'Enojada', plano: 'cerca', tasa: 18, rapida: true, simbolos: ['vena'], fondo: 'rojo', pose: t => { const a = entra(t, .22); return {
      huesos: { ...cuerpo(t, .25), chest: [6 * a, -5 * a, 0], head: cabeza(t, 7 * a, -15 * a, 4 * a, .2), leftShoulder: [0, 0, 5 * a], rightShoulder: [0, 0, -5 * a], ...br(t, .12, .12) }, ...manos,
      cara: { angry: 1, aa: .1 } }; } },
    triste: { nombre: 'Triste', plano: 'cerca', tasa: 1.6, simbolos: ['lagrimas'], fondo: 'azul', pose: t => ({
      huesos: { ...cuerpo(t, .35), spine: [6, 0, 0], chest: [6, 0, 0], head: cabeza(t, 14, 0, 2, .35), leftShoulder: [0, 0, -5], rightShoulder: [0, 0, 5], ...br(t) }, ...manos,
      mira: [0, -.25, 1], cara: { sad: 1 } }) },
    amor: { nombre: 'Enamorada', plano: 'cerca', tasa: 2, simbolos: ['corazones', 'rubor'], fondo: 'rosa', pose: t => ({
      huesos: { ...cuerpo(t, 1.4), head: cabeza(t, 3, 0, 9 * s(t, .5), .4), ...br(t, .18, .18) }, ...manos,
      cara: { happy: 1, oh: .12 } }) },
    miedo: { nombre: 'Asustada', plano: 'cerca', tasa: 18, rapida: true, simbolos: ['susto', 'gota'], fondo: 'gris', pose: t => { const a = entra(t, .2); return {
      huesos: { ...cuerpo(t, .15), spine: [-5 * a, 0, 0], chest: [6 * a, 0, 0], head: cabeza(t, 9 * a, 7 * a, 0, .2), leftShoulder: [0, 0, 10 * a], rightShoulder: [0, 0, -10 * a], ...br(t, .5 * a, .5 * a) }, ...manos,
      mira: [.3, -.05, .9], cara: { surprised: .8, sad: .35, ih: .35 } }; } },
    asco: { nombre: '¡Puaj!', plano: 'cerca', tasa: 7, simbolos: ['susto'], pose: t => ({
      huesos: { ...cuerpo(t, .4), spine: [-3, -5, 0], chest: [-3, -5, 0], head: cabeza(t, -5, -21, 5, .2), ...br(t, .25, .25) }, ...manos,
      mira: [.6, -.1, .7], cara: { angry: .45, sad: .25, ih: .4 }, morfos: { Fcl_EYE_Close: .18 } }) },
    orgullosa: { nombre: 'Orgullosa', plano: 'medio', tasa: 4, simbolos: ['notas'], fondo: 'amarillo', pose: t => ({
      huesos: { ...cuerpo(t, .8), spine: [-3, 0, 0], chest: [-5, 0, 0], head: cabeza(t, -11, 7 * s(t, .3), 4, .3), ...br(t) }, ...manos,
      cara: { happy: .85, oh: .1 } }) },
    guino: { nombre: 'Guiño', plano: 'cerca', tasa: 15, rapida: true, simbolos: ['estrellas'], pose: t => { const h = Math.sin(Math.min(1, t / .4) * Math.PI); return {
      sube: .03 * h, huesos: { ...cuerpo(t, .7), head: cabeza(t, 2, -5, -11, .3), ...br(t, .1, .1) }, ...manos,
      cara: { happy: .3, blinkLeft: t % 3 < 2 ? 1 : 0, ih: .25 } }; } },
    dormida: { nombre: 'Se duerme', plano: 'medio', tasa: 1, simbolos: ['zetas'], pose: t => { const c = Math.pow(.5 + .5 * s(t, .22), 3); return {
      huesos: { ...cuerpo(t, .25), spine: [3, 0, 0], chest: [3 + 1.5 * s(t, .28), 0, 0], head: [6 + 15 * c, 0, 10 + 5 * c], ...br(t) }, ...manos,
      cara: { blink: 1, relaxed: .5, oh: .06 } }; } },
    timida: { nombre: 'Tímida', plano: 'cerca', tasa: 2.4, simbolos: ['rubor', 'gota'], pose: t => ({
      huesos: { ...cuerpo(t, .9), head: cabeza(t, 11, 10 * s(t, .3), 8, .3), ...br(t, .1, .1) }, ...manos,
      mira: [-.4, -.2, .7], cara: { relaxed: .4 }, morfos: { Fcl_BRW_Sorrow: .4, Fcl_MTH_Small: .6 } }) },
    confundida: { nombre: 'Confundida', plano: 'medio', tasa: 3, simbolos: ['pregunta'], pose: t => ({
      huesos: { ...cuerpo(t, .6), head: cabeza(t, 1, 3, 15 + 2 * s(t, .3), .25), ...br(t) }, ...manos,
      mira: [.25, .22, .8], cara: { ou: .25 }, morfos: { Fcl_BRW_Sorrow: .55 } }) },
    asentir: { nombre: '¡Sí, sí!', plano: 'medio', tasa: 2.6, simbolos: ['notas'], pose: t => ({
      huesos: { ...cuerpo(t, .6), head: cabeza(t, 3 + 11 * rebote(t, 1.05), 0, 3, .3), ...br(t, .15, .15) }, ...manos,
      cara: { happy: .8, aa: .12 * rebote(t, 1.05) } }) },
    negar: { nombre: 'No, no', plano: 'medio', tasa: 2.6, simbolos: ['gota'], pose: t => ({
      huesos: { ...cuerpo(t, .5), head: cabeza(t, 3, 16 * s(t, .8), 0, .2), ...br(t, .12, .12) }, ...manos,
      cara: { sad: .25, ih: .2 }, morfos: { Fcl_BRW_Sorrow: .6 } }) },
    bostezar: { nombre: 'Bostezar', plano: 'cerca', tasa: 1.2, simbolos: ['suspiro'], pose: t => { const b = Math.sin(Math.min(1, (t % 4.2) / 3) * Math.PI) ** 2; return {
      huesos: { ...cuerpo(t, .4), chest: [-4 * b, 0, 0], head: cabeza(t, 2 - 15 * b, 0, 6 * b, .2), ...br(t, .08, .08) }, ...manos,
      cara: { aa: .95 * b, blink: b > .25 ? 1 : 0, relaxed: .3 } }; } },
    llorar: { nombre: 'Llora a mares', plano: 'cerca', tasa: 1.6, simbolos: ['mares'], fondo: 'azul', pose: t => { const b = rebote(t, .5); return {
      huesos: { ...cuerpo(t, .3), spine: [6, 0, 0], chest: [6 + 3 * b, 0, 0], head: cabeza(t, 12 + 4 * b, 0, 0, .25), leftShoulder: [0, 0, -3 - 3 * b], rightShoulder: [0, 0, 3 + 3 * b], ...br(t) }, ...manos,
      cara: { sad: 1, aa: .2 + .25 * b, blink: 1 } }; } },
    traviesa: { nombre: 'Traviesa', plano: 'cerca', tasa: 2.4, simbolos: ['estrellas'], pose: t => ({
      huesos: { ...cuerpo(t, .8), head: cabeza(t, 3, 11, -10, .35), ...br(t, .12, .12) }, ...manos,
      mira: [-.45, 0, .8], cara: { happy: .25 }, morfos: { Fcl_BRW_Angry: .3, Fcl_MTH_Fun: .7 } }) },
    aburrida: { nombre: 'Aburrida', plano: 'medio', tasa: 1.2, simbolos: ['suspiro'], pose: t => ({
      huesos: { ...cuerpo(t, .5), spine: [3, 0, 0], head: cabeza(t, 5, -6, 14, .25), ...br(t) }, ...manos,
      mira: [-.4, -.08, .8], cara: { relaxed: .15 }, morfos: { Fcl_EYE_Close: .28, Fcl_BRW_Sorrow: .3, Fcl_MTH_Neutral: .6 } }) },
    mareada: { nombre: 'Mareada', plano: 'cerca', tasa: 1.6, simbolos: ['espiral'], pose: t => ({
      huesos: { ...cuerpo(t, 1.2), head: [2 + 6 * s(t, .32, 1.57), 6 * s(t, .32), 7 * s(t, .32, 1.57)], ...br(t, .1, .1) }, ...manos,
      cara: { sad: .35, oh: .25 } }) },
    puchero: { nombre: 'Puchero', plano: 'cerca', tasa: 7, simbolos: ['vena'], pose: t => { const a = entra(t, .3); return {
      huesos: { ...cuerpo(t, .4), chest: [0, 8 * a, 0], head: cabeza(t, 7 * a, 19 * a, 3 * a, .2), ...br(t, .1, .1) }, ...manos,
      mira: [-.65, 0, .7], cara: { }, morfos: { Fcl_BRW_Angry: .65, Fcl_MTH_Small: .9, Fcl_MTH_Up: .4 } }; } },
    aplaudir: { nombre: 'Aplaudir', plano: 'medio', tasa: 2.6, simbolos: ['estrellas'], pose: t => { const b = rebote(t, 1.5), sep = .018 + .05 * b; return {
      
      huesos: { ...cuerpo(t, .5), head: cabeza(t, -2, 0, 4 * s(t, .4), .4), ...brazos(t), rightUpperArm: [0, 52 + 12 * b, 42], leftUpperArm: [0, -52 - 12 * b, -42], rightLowerArm: [0, 94, 0], leftLowerArm: [0, -94, 0], rightHand: [0, 0, 0], leftHand: [0, 0, 0] },
      cara: { happy: 1, aa: .25 } }; } },
    wow: { nombre: '¡Qué bonito!', plano: 'cerca', tasa: 16, rapida: true, impacto: true, simbolos: ['estrellas'], fondo: 'rosa', pose: t => { const a = entra(t, .25); return {
      huesos: { ...cuerpo(t, .5), chest: [-3 * a, 0, 0], head: cabeza(t, -5 * a, 0, 3 * a, .3), ...br(t, .4 * a, .4 * a) }, ...manos,
      cara: { happy: .3, oh: .45, surprised: .35 }, morfos: { Fcl_BRW_Joy: .4 } }; } },
    fuego: { nombre: 'Bota fuego', plano: 'medio', tasa: 7, fondo: 'rojo', pose: t => { const u = t % 4.2, toma = entra(Math.min(u, .7), .55), sopla = u > .7 && u < 3.3 ? entra(u - .7, .14) : u >= 3.3 ? 1 - entra(u - 3.3, .5) : 0; return {
      boca: u > .76 && u < 3.3 ? 'fuego' : null,
      huesos: { ...cuerpo(t, .3), spine: [-5 * toma * (1 - sopla) + 4 * sopla, 0, 0], chest: [-9 * toma * (1 - sopla) + 7 * sopla, 0, 0], head: cabeza(t, -14 * toma * (1 - sopla) + 5 * sopla, 0, 0, .1), leftShoulder: [0, 0, 6 * toma * (1 - sopla)], rightShoulder: [0, 0, -6 * toma * (1 - sopla)], ...brazos(t, .1, .1) },
      mira: [0, 0, 1], cara: { angry: .55 * sopla, aa: 1 * sopla, oh: .2 * (1 - sopla) * toma } }; } },
    vomito: { nombre: 'Vomita arcoíris', plano: 'general', tasa: 4, simbolos: ['susto', 'gota'], pose: t => vomitar(t, 'arcoiris') },
    vomitoVerde: { nombre: 'Vomita verde', plano: 'general', tasa: 4, simbolos: ['susto', 'gota'], pose: t => vomitar(t, 'verde') },
    humo: { nombre: 'Humo por las orejas', plano: 'cerca', tasa: 14, rapida: true, simbolos: ['vena'], fondo: 'rojo', pose: t => { const a = entra(t, .22); return {
      boca: 'humo', huesos: { ...cuerpo(t, .25), chest: [5 * a, 0, 0], head: cabeza(t, 6 * a, 0, 0, .15), leftShoulder: [0, 0, 7 * a], rightShoulder: [0, 0, -7 * a], ...brazos(t, .15, .15) },
      cara: { angry: 1, ih: .35 } }; } },
    burbujas: { nombre: 'Sopla burbujas', plano: 'medio', tasa: 3, pose: t => ({
      boca: 'burbujas', huesos: { ...cuerpo(t, .7), head: cabeza(t, -5, 0, 4 * s(t, .3), .3), ...brazos(t) },
      mira: [0, .12, 1], cara: { ou: .85, relaxed: .2 } }) },
    alma: { nombre: 'Se le sale el alma', plano: 'medio', tasa: 2.4, fondo: 'gris', pose: t => { const a = entra(t, .8); return {
      boca: t > .7 ? 'alma' : null, huesos: { ...cuerpo(t, .15), spine: [3 * a, 0, 0], chest: [3 * a, 0, 0], head: cabeza(t, -22 * a, 0, 7 * a, .1), leftShoulder: [0, 0, -5 * a], rightShoulder: [0, 0, 5 * a], ...brazos(t) },
      cara: { aa: .75 * a }, morfos: { Fcl_EYE_Iris_Hide: a > .5 ? 1 : 0 } }; } },
    estornudo: { nombre: '¡Achís!', plano: 'cerca', tasa: 10, simbolos: ['gota'], pose: t => { const u = t % 3.2, toma = entra(Math.min(u, .85), .8), sale = u > .85 ? Math.exp(-(u - .85) * 3) : 0; return {
      boca: u > .85 && u < 1 ? 'estornudo' : null, huesos: { ...cuerpo(t, .3), spine: [-5 * toma * (1 - sale) + 9 * sale, 0, 0], chest: [-7 * toma * (1 - sale) + 12 * sale, 0, 0], head: cabeza(t, -14 * toma * (u > .85 ? 0 : 1) + 19 * sale, 0, 0, .1), ...brazos(t) },
      cara: { aa: sale > .15 ? .8 : .25 * toma, blink: u > .55 && sale > .15 || toma > .75 ? 1 : 0, sad: .3 * toma * (u > .85 ? 0 : 1) } }; } },
    baba: { nombre: 'Se le hace agua la boca', plano: 'cerca', tasa: 2, simbolos: ['corazones'], fondo: 'rosa', pose: t => ({
      boca: 'baba', huesos: { ...cuerpo(t, .7), head: cabeza(t, 3, 0, 8 * s(t, .3), .3), ...br(t, .15, .15) }, ...manos,
      mira: [.25, .3, .8], cara: { happy: .7, aa: .28 } }) },
    idea: { nombre: '¡Tengo una idea!', plano: 'cerca', tasa: 15, rapida: true, impacto: true, simbolos: ['idea'], fondo: 'amarillo', pose: t => { const h = Math.sin(Math.min(1, t / .42) * Math.PI); return {
      sube: .055 * h, huesos: { ...cuerpo(t, .4), chest: [-3, 0, 0], head: cabeza(t, -5, 0, 0, .3), ...br(t, .4 * Math.min(1, t * 5), .15) }, ...manos,
      cara: { surprised: .5, happy: .3, aa: .4 } }; } }
  };
}

function movimiento(nombre, cuando, MOM, lista) {
  const total = lista.reduce((n, b) => n + b[1], 0);
  return { nombre, cuando, youtuber: true, suave: true, manos: 'relajada', pose: t => {
    let r = t % total, id = lista[0][0], tb = 0;
    for (const [i, d] of lista) { if (r < d) { id = i; tb = r; break; } r -= d; }
    const M = MOM[id], p = M.pose(tb);
    const serena = p.cara && (p.cara.angry || p.cara.sad || p.cara.surprised) ? {} : { Fcl_BRW_Fun: .35, Fcl_MTH_Up: .12 };
    return { huesos: p.huesos, cara: p.cara || {}, morfos: { ...serena, ...(p.morfos || {}) }, sube: p.sube || 0, naturales: true, yt: { D: p.D, I: p.I, plano: M.plano, tasa: M.tasa, rapida: !!M.rapida, mira: p.mira || null, boca: p.boca || null, simbolos: M.simbolos || null, fondo: M.fondo || null, impacto: !!M.impacto || id === 'reaccionar', id } };
  } };
}
const LISTA = [['hola', 2.4], ['hablar', 3.8], ['pensar', 3.2], ['idea', 1.8], ['hablar', 2.6], ['reaccionar', 1.9], ['reir', 2.6], ['timida', 2.4], ['hablar', 2.4], ['enojada', 2.2], ['confundida', 2.4], ['triste', 2.6], ['amor', 2.6], ['miedo', 1.9], ['asco', 2], ['orgullosa', 2.4], ['guino', 1.8], ['emocion', 2], ['fuego', 4.2], ['vomito', 4], ['humo', 2.2], ['burbujas', 2.8], ['estornudo', 3.2], ['baba', 2.4], ['alma', 3.2], ['asentir', 2], ['negar', 2], ['aplaudir', 2.4], ['traviesa', 2.2], ['puchero', 2.2], ['aburrida', 2.4], ['bostezar', 3.2], ['mareada', 2.6], ['llorar', 2.6], ['wow', 2], ['dormida', 3.4]];
const SUELTAS = momentos(false), MANOS_JUNTAS = momentos(true);
export const NATURAL = {
  natA: movimiento('A · Manos sueltas', 'Las manos cuelgan tranquilas y se mueven un poco al hablar', SUELTAS, LISTA),
  natB: movimiento('B · Manos juntas', 'Las manos quedan juntas adelante, más tímida', MANOS_JUNTAS, LISTA),
  ...Object.fromEntries(Object.entries(SUELTAS).map(([id, m]) => ['n_' + id, movimiento(m.nombre, 'Un solo gesto, para verlo con calma', SUELTAS, [[id, 6]])]))
};

// Atuendos tomados de atuendos.json de la Filo ilustrada: chaqueta, falda, moño y tela
export const ROPA = {
  kimono: { nombre: 'Kimono', chaqueta: '#eb78a0', falda: '#c81e3c', mono: '#c81e3c', tela: 'flores', color: '#ffffff', color2: '#ffc850', top: '#ffc850', medias: '#eb78a0', borde: '#ffc850', extra: 'flor', a1: '#ffaac8', a2: '#ffdc5a' },
  escolar: { nombre: 'Escolar', chaqueta: '#2d418c', falda: '#3a4d9c', mono: '#dc2832', top: '#bcd4ff', medias: '#1f2a55', borde: '#ffffff', extra: 'lazo', a1: '#dc2832' },
  idol: { nombre: 'Idol', chaqueta: '#78bef9', falda: '#ff78b4', mono: '#ff78b4', tela: 'estrellas', color: '#ffffff', top: '#ff9fcb', medias: '#ff78b4', borde: '#ffffff', extra: 'lazoGrande', a1: '#ff78b4' },
  marinera: { nombre: 'Marinera', chaqueta: '#fcfaf5', falda: '#2d418c', mono: '#d2283c', tela: 'rayas', color: '#d2283c', top: '#bcd4ff', medias: '#2d418c', borde: '#ffffff', extra: 'vincha', a1: '#2d418c' },
  gala: { nombre: 'Gala', chaqueta: '#232d73', falda: '#232d73', mono: '#c8d2f0', tela: 'brillos', color: '#c8d2f0', top: '#8fa8ff', medias: '#232d73', borde: '#c8d2f0', extra: 'tiara', a1: '#e6ecff', a2: '#8fa8ff' },
  fresa: { nombre: 'Fresa', chaqueta: '#e6374b', falda: '#e6374b', mono: '#5ab450', tela: 'lunares', color: '#ffffff', top: '#5ab450', medias: '#e6374b', borde: '#5ab450', extra: 'lazo', a1: '#5ab450' },
  angelita: { nombre: 'Angelita', chaqueta: '#fffcf0', falda: '#fffcf0', mono: '#e6be46', tela: 'brillos', color: '#e6be46', top: '#f2d675', medias: '#bcaef0', borde: '#e6be46', extra: 'alitas', a1: '#ffffff' },
  galaxia: { nombre: 'Galaxia', chaqueta: '#28286e', falda: '#28286e', mono: '#b48cff', tela: 'estrellas', color: '#ffe682', top: '#1a1a4a', medias: '#1a1a4a', borde: '#b48cff', extra: 'vincha', a1: '#b48cff' },
  primavera: { nombre: 'Primavera', chaqueta: '#b4e6a0', falda: '#b4e6a0', mono: '#ff78a0', tela: 'flores', color: '#ff78a0', color2: '#ffffff', top: '#ff9abb', medias: '#7cc86a', borde: '#ff78a0', extra: 'flor', a1: '#ff78a0', a2: '#ffffff' },
  maid: { nombre: 'Maid', chaqueta: '#2d2d3c', falda: '#2d2d3c', mono: '#ffffff', top: '#3f3f55', medias: '#2d2d3c', borde: '#ffffff', anchoBorde: .17, extra: 'cofia', a1: '#2d2d3c' },
  bruja: { nombre: 'Brujita', chaqueta: '#3d2a6e', falda: '#2a1b52', mono: '#f0be3c', tela: 'estrellas', color: '#f0be3c', top: '#ff9a3c', medias: '#2a1b52', borde: '#ff9a3c', extra: 'bruja', a1: '#2a1b52', a2: '#f0be3c' },
  gatita: { nombre: 'Gatita', chaqueta: '#ffd2e1', falda: '#ffd2e1', mono: '#e65a8c', tela: 'lunares', color: '#ffffff', top: '#ff9abb', medias: '#e65a8c', borde: '#e65a8c', extra: 'gato', a1: '#ffeef4', a2: '#ff9abb' },
  conejita: { nombre: 'Orejas de conejo', chaqueta: '#c3aaf0', falda: '#a98de0', mono: '#ffffff', top: '#a98de0', medias: '#7f63c9', borde: '#ffffff', extra: 'conejo', a1: '#ffffff', a2: '#ffc1d5' },
  navidad: { nombre: 'Navidad', chaqueta: '#cd2d37', falda: '#cd2d37', mono: '#2f8f4e', top: '#2f8f4e', medias: '#cd2d37', borde: '#ffffff', anchoBorde: .2, extra: 'navidad', a1: '#cd2d37' },
  deportivo: { nombre: 'Deportiva', chaqueta: '#326edc', falda: '#ffffff', mono: '#ffffff', tela: 'rayas', color: '#ffffff', top: '#8fc1ff', medias: '#326edc', borde: '#326edc', extra: 'vincha', a1: '#326edc' },
  hada: { nombre: 'Hada', chaqueta: '#9be6d7', falda: '#9be6d7', mono: '#ffffff', tela: 'brillos', color: '#ffffff', top: '#5fcfb8', medias: '#5fcfb8', borde: '#ffffff', extra: 'alitas', a1: '#d9fff6' }
};
