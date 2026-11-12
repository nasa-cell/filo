// Aspecto de anime: símbolos de emoción, líneas de impacto, fondos pintados y accesorios.
import * as THREE from 'three';

function lienzo(w, h, dibuja) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; dibuja(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const trazo = (k, relleno, borde, ancho) => { k.fillStyle = relleno; k.fill(); if (borde) { k.strokeStyle = borde; k.lineWidth = ancho; k.lineJoin = 'round'; k.stroke(); } };
const corazon = (k, x, y, s) => { k.beginPath(); k.moveTo(x, y + s * .35); k.bezierCurveTo(x - s * 1.05, y - s * .45, x - s * .4, y - s, x, y - s * .4); k.bezierCurveTo(x + s * .4, y - s, x + s * 1.05, y - s * .45, x, y + s * .35 + s * .45); k.closePath(); };
const estrella = (k, x, y, r) => { k.beginPath(); for (let i = 0; i < 10; i++) { const q = i % 2 ? r * .45 : r, a = i * Math.PI / 5; k.lineTo(x + Math.sin(a) * q, y - Math.cos(a) * q); } k.closePath(); };

const TEX = {
  gota: () => lienzo(128, 128, k => { k.beginPath(); k.moveTo(64, 10); k.bezierCurveTo(96, 62, 104, 80, 94, 98); k.bezierCurveTo(82, 122, 46, 122, 34, 98); k.bezierCurveTo(24, 80, 32, 62, 64, 10); trazo(k, '#a8e1ff', '#2d7fc4', 6); k.fillStyle = '#fff'; k.beginPath(); k.ellipse(52, 84, 8, 13, .3, 0, 7); k.fill(); }),
  vena: () => lienzo(128, 128, k => { k.strokeStyle = '#e8263c'; k.lineWidth = 13; k.lineCap = 'round'; for (const [a, b, c, d, e, f] of [[20, 50, 50, 50, 50, 20], [108, 50, 78, 50, 78, 20], [20, 78, 50, 78, 50, 108], [108, 78, 78, 78, 78, 108]]) { k.beginPath(); k.moveTo(a, b); k.quadraticCurveTo(c, d, e, f); k.stroke(); } }),
  corazon: () => lienzo(128, 128, k => { corazon(k, 64, 56, 46); trazo(k, '#ff6b9d', '#c2185b', 6); k.fillStyle = '#fff'; k.beginPath(); k.ellipse(44, 38, 9, 6, -.6, 0, 7); k.fill(); }),
  estrella: () => lienzo(128, 128, k => { estrella(k, 64, 66, 52); trazo(k, '#ffe066', '#e6a400', 6); }),
  nota: () => lienzo(128, 128, k => { k.font = '700 104px "Segoe UI Symbol",serif'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.lineWidth = 6; k.strokeStyle = '#fff'; k.strokeText('♪', 64, 66); k.fillStyle = '#7e57c2'; k.fillText('♪', 64, 66); }),
  pregunta: () => lienzo(128, 128, k => { k.font = '900 104px "Segoe UI",sans-serif'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.lineWidth = 10; k.strokeStyle = '#fff'; k.strokeText('?', 64, 68); k.fillStyle = '#2f6fd6'; k.fillText('?', 64, 68); }),
  exclama: () => lienzo(128, 128, k => { k.font = '900 110px "Segoe UI",sans-serif'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.lineWidth = 10; k.strokeStyle = '#fff'; k.strokeText('!', 64, 68); k.fillStyle = '#e8263c'; k.fillText('!', 64, 68); }),
  zeta: () => lienzo(128, 128, k => { k.font = '900 92px "Segoe UI",sans-serif'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.lineWidth = 8; k.strokeStyle = '#fff'; k.strokeText('Z', 64, 68); k.fillStyle = '#5c6bc0'; k.fillText('Z', 64, 68); }),
  rubor: () => lienzo(128, 64, k => { const g = k.createRadialGradient(64, 32, 4, 64, 32, 60); g.addColorStop(0, 'rgba(255,110,130,.75)'); g.addColorStop(1, 'rgba(255,110,130,0)'); k.fillStyle = g; k.fillRect(0, 0, 128, 64); k.strokeStyle = 'rgba(214,60,90,.85)'; k.lineWidth = 4; for (let i = 0; i < 5; i++) { k.beginPath(); k.moveTo(38 + i * 12, 20); k.lineTo(30 + i * 12, 44); k.stroke(); } }),
  lagrima: () => lienzo(64, 128, k => { k.beginPath(); k.moveTo(32, 6); k.bezierCurveTo(50, 50, 56, 84, 44, 106); k.bezierCurveTo(36, 122, 22, 118, 16, 104); k.bezierCurveTo(8, 84, 16, 50, 32, 6); trazo(k, 'rgba(150,215,255,.95)', '#3b8fd0', 4); }),
  espiral: () => lienzo(128, 128, k => { k.strokeStyle = '#7e57c2'; k.lineWidth = 8; k.lineCap = 'round'; k.beginPath(); for (let a = 0; a < 15; a += .2) { const r = 3 + a * 3.4; k.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } k.stroke(); }),
  suspiro: () => lienzo(128, 128, k => { k.fillStyle = '#ffffff'; k.strokeStyle = '#8fa3bf'; k.lineWidth = 5; k.beginPath(); k.arc(44, 70, 26, 0, 7); k.arc(76, 58, 30, 0, 7); k.arc(92, 82, 20, 0, 7); k.fill(); k.stroke(); k.beginPath(); k.arc(44, 70, 23, 0, 7); k.arc(76, 58, 27, 0, 7); k.arc(92, 82, 17, 0, 7); k.fill(); }),
  susto: () => lienzo(128, 128, k => { k.strokeStyle = '#3c4a66'; k.lineWidth = 7; k.lineCap = 'round'; for (let i = 0; i < 4; i++) { k.beginPath(); k.moveTo(24 + i * 27, 14 + (i % 2) * 14); k.lineTo(24 + i * 27, 84 + (i % 2) * 24); k.stroke(); } })
};

// Dónde aparece cada símbolo respecto de la cabeza, y cómo se mueve
const ESCENAS = {
  gota: [{ t: 'gota', p: [.135, .19, .03], s: .075, f: u => ({ y: -.05 * ((u * .6) % 1) }) }],
  vena: [{ t: 'vena', p: [.115, .2, .05], s: .085, f: u => ({ e: 1 + .07 * Math.sin(u * 3) }) }],
  corazones: [0, 1, 2, 3].map(i => ({ t: 'corazon', p: [[-.17, .1, .03], [.17, .13, .03], [-.14, .2, .03], [.15, .21, .03]][i], s: .06 + .015 * (i % 2), f: u => { const v = (u * .45 + i * .25) % 1; return { y: .1 * v, x: .012 * Math.sin(v * 9 + i), o: Math.min(1, (1 - v) * 3), e: .7 + .4 * Math.min(1, v * 5) }; } })),
  estrellas: [0, 1, 2].map(i => ({ t: 'estrella', p: [[.15, .18, .04], [-.17, .15, .04], [.19, .08, .04]][i], s: .055, f: u => ({ e: .85 + .25 * Math.sin(u * 1.6 + i * 1.3), g: u * .35 + i }) })),
  notas: [0, 1].map(i => ({ t: 'nota', p: [[.16, .17, .03], [-.17, .22, .03]][i], s: .07, f: u => { const v = (u * .5 + i * .5) % 1; return { y: .09 * v, x: .015 * Math.sin(v * 7), o: Math.min(1, (1 - v) * 3) }; } })),
  pregunta: [{ t: 'pregunta', p: [.15, .2, .03], s: .1, f: u => ({ g: .22 * Math.sin(u * 2.4), e: Math.min(1, u * 7) }) }],
  idea: [{ t: 'exclama', p: [.14, .27, .03], s: .13, f: u => ({ e: Math.min(1.15, u * 9) }) }, { t: 'estrella', p: [-.16, .22, .03], s: .05, f: u => ({ e: Math.min(1, u * 6) * (.9 + .1 * Math.sin(u * 2.4)) }) }],
  zetas: [0, 1, 2].map(i => ({ t: 'zeta', p: [.12, .2, .03], s: .04 + i * .018, f: u => { const v = (u * .3 + i / 3) % 1; return { x: .1 * v, y: .13 * v, o: Math.min(1, v * 5) * Math.min(1, (1 - v) * 3) }; } })),
  rubor: [{ t: 'rubor', p: [-.05, .03, .106], s: .05, an: .5 }, { t: 'rubor', p: [.05, .03, .106], s: .05, an: .5 }],
  lagrimas: [0, 1].map(i => ({ t: 'lagrima', p: [i ? .033 : -.033, .052, .118], s: .012, al: 2, f: u => { const v = (u * .8 + i * .4) % 1; return { y: -.04 * v, o: Math.min(1, (1 - v) * 3) }; } })),
  mares: [0, 1, 2, 3].map(i => ({ t: 'lagrima', p: [i % 2 ? .033 : -.033, .052, .118], s: .014, al: 2, f: u => { const v = (u * .7 + i * .25) % 1; return { y: -.055 * v, x: (i % 2 ? 1 : -1) * .012 * v, o: Math.min(1, (1 - v) * 3) }; } })),
  espiral: [0, 1].map(i => ({ t: 'espiral', p: [[-.15, .17, .03], [.15, .14, .03]][i], s: .075, f: u => ({ g: u * 1.5 * (i ? -1 : 1) }) })),
  suspiro: [{ t: 'suspiro', p: [.1, .03, .1], s: .05, f: u => { const v = (u * .4) % 1; return { x: .07 * v, y: .03 * v, e: .7 + .7 * v, o: Math.min(1, (1 - v) * 2.5) }; } }],
  susto: [{ t: 'susto', p: [-.16, .13, .03], s: .1 }, { t: 'susto', p: [.16, .13, .03], s: .1 }]
};

export function crearSimbolos(escena) {
  const texturas = {}, pool = [];
  const sprite = () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false })); s.visible = false; s.renderOrder = 20; escena.add(s); pool.push(s); return s; };
  for (let i = 0; i < 10; i++) sprite();
  const q = new THREE.Quaternion(), v = new THREE.Vector3();
  let inicio = 0, previo = '';
  return (nombres, cabeza, tiempo) => {
    const clave = (nombres || []).join();
    if (clave !== previo) { previo = clave; inicio = tiempo; }
    const u = tiempo - inicio; let n = 0;
    cabeza.getWorldQuaternion(q);
    for (const nombre of nombres || []) for (const d of ESCENAS[nombre] || []) {
      const s = pool[n++]; if (!s) break;
      const c = d.f ? d.f(u) : {};
      s.material.map = texturas[d.t] ||= TEX[d.t](); s.material.needsUpdate = false;
      if (!s.material.userData.t || s.material.userData.t !== d.t) { s.material.userData.t = d.t; s.material.needsUpdate = true; }
      v.set(d.p[0] + (c.x || 0), d.p[1] + (c.y || 0) - (d.p[2] < .09 ? .075 : 0), d.p[2]).applyQuaternion(q);
      cabeza.getWorldPosition(s.position).add(v);
      const e = d.s * (c.e == null ? 1 : c.e);
      s.scale.set(e, e * (d.an || d.al || 1), 1);
      s.material.rotation = c.g || 0; s.material.opacity = c.o == null ? 1 : Math.max(0, c.o); s.visible = true;
    }
    for (; n < pool.length; n++) pool[n].visible = false;
  };
}

/* ---------- Fondos pintados ---------- */
function nube(k, x, y, s) { k.beginPath(); for (const [a, b, r] of [[-1.5, .1, .6], [-.7, -.3, .85], [.2, -.45, 1], [1.1, -.15, .8], [1.8, .15, .5]]) k.arc(x + a * s, y + b * s, r * s, 0, 7); k.rect(x - 1.9 * s, y, 3.9 * s, .55 * s); k.fill(); }
export function crearFondos() {
  const A = 1024, B = 640;
  const azar = (() => { let n = 12345; return () => (n = (n * 16807) % 2147483647) / 2147483647; })();
  const lineas = (k, col, cant, grueso) => { k.fillStyle = col; for (let i = 0; i < cant; i++) { const x = azar() * A; k.fillRect(x, 0, azar() * grueso + 1, B); } };
  const degrade = (k, a, b, c) => { const g = k.createLinearGradient(0, 0, 0, B); g.addColorStop(0, a); g.addColorStop(.62, b); g.addColorStop(1, c || b); k.fillStyle = g; k.fillRect(0, 0, A, B); };
  return {
    cielo: lienzo(A, B, k => { degrade(k, '#5aa9ec', '#bfe3fa', '#e9f6fc'); k.fillStyle = 'rgba(255,255,255,.95)'; nube(k, 190, 150, 52); nube(k, 760, 96, 38); nube(k, 560, 245, 28); nube(k, 950, 260, 44); k.fillStyle = '#9cc9a4'; k.beginPath(); k.moveTo(0, 430); k.quadraticCurveTo(260, 330, 520, 420); k.quadraticCurveTo(790, 350, A, 425); k.lineTo(A, B); k.lineTo(0, B); k.fill(); k.fillStyle = '#b9dcae'; k.beginPath(); k.moveTo(0, 480); k.quadraticCurveTo(420, 410, A, 490); k.lineTo(A, B); k.lineTo(0, B); k.fill(); }),
    rosa: lienzo(A, B, k => { degrade(k, '#ffb7d5', '#ffe0ee'); for (let i = 0; i < 28; i++) { const x = azar() * A, y = azar() * B, s = 8 + azar() * 22; k.fillStyle = `rgba(255,255,255,${.4 + azar() * .5})`; if (i % 3) { estrella(k, x, y, s); k.fill(); } else { corazon(k, x, y, s); k.fill(); } } }),
    azul: lienzo(A, B, k => { degrade(k, '#16264e', '#3c5a8e'); lineas(k, 'rgba(180,205,240,.2)', 80, 2.5); }),
    rojo: lienzo(A, B, k => { degrade(k, '#6d0f1e', '#d6403c', '#f28b4b'); k.fillStyle = 'rgba(255,190,90,.5)'; for (let i = 0; i < 16; i++) { const x = i * 70 + azar() * 40, h = 90 + azar() * 170; k.beginPath(); k.moveTo(x - 36, B); k.quadraticCurveTo(x - 8, B - h * .6, x, B - h); k.quadraticCurveTo(x + 8, B - h * .6, x + 36, B); k.fill(); } }),
    gris: lienzo(A, B, k => { degrade(k, '#2d2f45', '#6a6c86'); lineas(k, 'rgba(12,12,25,.5)', 90, 6); }),
    amarillo: lienzo(A, B, k => { k.fillStyle = '#ffd65a'; k.fillRect(0, 0, A, B); k.fillStyle = '#ffe998'; for (let i = 0; i < 18; i += 2) { const a = i / 18 * Math.PI * 2, b = (i + 1) / 18 * Math.PI * 2; k.beginPath(); k.moveTo(A / 2, B * .4); k.lineTo(A / 2 + Math.cos(a) * 1100, B * .4 + Math.sin(a) * 1100); k.lineTo(A / 2 + Math.cos(b) * 1100, B * .4 + Math.sin(b) * 1100); k.fill(); } })
  };
}

/* ---------- Líneas de impacto sobre la imagen ---------- */
export function crearImpacto(caja) {
  const c = document.createElement('canvas'); c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2'; caja.insertBefore(c, caja.children[1]);
  const k = c.getContext('2d'); let ultimo = -1, inicio = -9, activo = false, pintadas = -1, limpio = false;
  return (encendido, tiempo, clave) => {
    if (encendido && (!activo || clave !== activo)) inicio = tiempo;
    activo = encendido ? clave : false;
    const w = caja.clientWidth, h = caja.clientHeight, cuadro = Math.floor(tiempo * 12);
    if (cuadro === ultimo) return; ultimo = cuadro;
    if (!encendido && limpio) return;  // nada que borrar: no gasta
    limpio = !encendido;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    k.clearRect(0, 0, w, h);
    const u = tiempo - inicio;
    pintadas = cuadro;
    if (!encendido || u > 1.05) return;
    if (u < .1) { k.fillStyle = 'rgba(255,255,255,.88)'; k.fillRect(0, 0, w, h); return; }
    const cx = w / 2, cy = h * .4, R = Math.hypot(w, h), o = Math.min(1, (1.05 - u) * 3);
    k.fillStyle = `rgba(25,35,60,${.8 * o})`;
    const azar = (n => () => (n = (n * 16807) % 2147483647) / 2147483647)(1 + (Math.floor(tiempo * 4) * 977) % 9973);
    for (let i = 0; i < 74; i++) {
      const a = azar() * Math.PI * 2, ini = R * (.27 + azar() * .11), d = .004 + azar() * .012;
      k.beginPath(); k.moveTo(cx + Math.cos(a) * ini, cy + Math.sin(a) * ini); k.lineTo(cx + Math.cos(a - d) * R, cy + Math.sin(a - d) * R); k.lineTo(cx + Math.cos(a + d) * R, cy + Math.sin(a + d) * R); k.fill();
    }
  };
}

/* ---------- Forma de la cabeza, medida sobre el modelo ---------- */
// Filas: altura desde -8 cm cada 2 cm. Columnas: 24 direcciones alrededor de la cabeza. Valor: distancia al eje.
const FORMA = [[0.111,0.103,0.108,0.119,0.124,0.126,0.11,0.081,0.06,0.056,0,0.051,0,0.061,0.082,0.11,0.132,0.145,0.141,0.123,0.117,0.115,0.102,0.095],[0.09,0.096,0.084,0.106,0.108,0.11,0.098,0.068,0.056,0.051,0,0.044,0,0.054,0.066,0.105,0.115,0.127,0.125,0.102,0.099,0.108,0.092,0.085],[0.069,0.083,0.048,0.052,0.06,0.066,0.043,0.059,0.029,0.042,0,0.042,0,0.043,0.054,0.074,0.071,0.103,0.078,0.059,0.088,0.089,0.031,0.031],[0.079,0.076,0.069,0.057,0.044,0.026,0.041,0.029,0.041,0.04,0.039,0.04,0.037,0.041,0.043,0,0.043,0.027,0,0.029,0.044,0.057,0.069,0.076],[0.091,0.085,0.08,0.076,0.064,0.056,0.053,0.047,0.044,0.047,0.048,0.056,0.057,0.049,0.048,0.047,0.045,0.046,0.053,0.056,0.064,0.076,0.08,0.085],[0.098,0.086,0.082,0.079,0.071,0.064,0.076,0.085,0.061,0.067,0.07,0.073,0.074,0.071,0.07,0.067,0.061,0.085,0.076,0.064,0.071,0.079,0.082,0.086],[0.088,0.081,0.08,0.094,0.077,0.071,0.075,0.09,0.073,0.075,0.076,0.087,0.089,0.087,0.076,0.075,0.073,0.09,0.075,0.071,0.077,0.094,0.08,0.081],[0.083,0.084,0.083,0.095,0.078,0.075,0.083,0.089,0.082,0.085,0.088,0.092,0.094,0.092,0.088,0.085,0.082,0.089,0.083,0.075,0.078,0.095,0.083,0.084],[0.086,0.086,0.086,0.086,0.079,0.077,0.076,0.081,0.086,0.09,0.094,0.095,0.097,0.095,0.094,0.09,0.086,0.081,0.076,0.077,0.079,0.086,0.086,0.086],[0.087,0.086,0.087,0.085,0.081,0.078,0.078,0.081,0.086,0.09,0.094,0.097,0.098,0.097,0.094,0.09,0.086,0.081,0.078,0.078,0.081,0.085,0.087,0.086],[0.086,0.084,0.084,0.083,0.08,0.077,0.077,0.079,0.083,0.089,0.092,0.094,0.095,0.094,0.092,0.089,0.083,0.079,0.077,0.077,0.08,0.083,0.084,0.084],[0.08,0.076,0.078,0.077,0.074,0.07,0.069,0.071,0.08,0.084,0.085,0.086,0.087,0.086,0.085,0.084,0.08,0.071,0.069,0.07,0.074,0.077,0.078,0.076],[0.062,0.063,0.065,0.062,0.062,0.055,0.062,0.064,0.069,0.069,0.073,0.07,0.079,0.07,0.073,0.069,0.069,0.064,0.062,0.055,0.062,0.062,0.065,0.063],[0.033,0.035,0.039,0.03,0.038,0.034,0,0.033,0.037,0.044,0.049,0.046,0.045,0.046,0.049,0.044,0.037,0.033,0,0.034,0.038,0.03,0.039,0.035],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]];
export const BOCA = [0, 0.0019, 0.0906];
const CENTRO = new THREE.Vector3(0, .08, 0), Z = new THREE.Vector3(0, 0, 1);
const fila = i => { const f = FORMA[i]; if (!f) return null; return f.map((v, a) => v || Math.max(f[(a + 1) % 24], f[(a + 23) % 24])); };
function radio(az, y) {
  const yf = (y + .08) / .02, i = Math.floor(yf); if (i < 0 || i > 13) return 0;
  const af = ((az / (Math.PI * 2) * 24) % 24 + 24) % 24, a = Math.floor(af), b = (a + 1) % 24, u = af - a, w = yf - i, f0 = fila(i), f1 = fila(i + 1);
  return (f0[a] * (1 - u) + f0[b] * u) * (1 - w) + (f1[a] * (1 - u) + f1[b] * u) * w;
}
const dir = (az, el) => { const a = az * Math.PI / 180, e = el * Math.PI / 180; return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)); };
function sobre(d, fuera = 0) { const p = new THREE.Vector3(); for (let r = .3; r > 0; r -= .001) { p.copy(CENTRO).addScaledVector(d, r); if (Math.hypot(p.x, p.z) <= radio(Math.atan2(p.x, p.z), p.y)) return p.addScaledVector(d, fuera); } return p.copy(CENTRO); }
function pegar(obj, d, fuera = .004) { obj.position.copy(sobre(d, fuera)); obj.quaternion.setFromUnitVectors(Z, d); return obj; }

/* ---------- Accesorios 3D ---------- */
const degradeToon = (() => { const c = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 255, 255, 255, 255]), 2, 1); c.minFilter = c.magFilter = THREE.NearestFilter; c.needsUpdate = true; return c; })();
const toon = c => new THREE.MeshToonMaterial({ color: c, gradientMap: degradeToon });
const pieza = (geo, col, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, toon(col)); m.position.set(x, y, z); m.castShadow = true; return m; };
function lazo(c, s = 1) {
  const g = new THREE.Group(); g.scale.setScalar(s);
  for (const l of [-1, 1]) { const a = pieza(new THREE.ConeGeometry(.026, .05, 14), c, l * .027, 0, 0); a.rotation.z = l * Math.PI / 2; a.scale.z = .45; g.add(a); }
  g.add(pieza(new THREE.SphereGeometry(.011, 12, 10), c)); return g;
}
function flor(c, c2, s = 1) {
  const g = new THREE.Group(); g.scale.setScalar(s);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, p = pieza(new THREE.SphereGeometry(.015, 10, 8), c, Math.cos(a) * .017, Math.sin(a) * .017, 0); p.scale.z = .4; g.add(p); }
  g.add(pieza(new THREE.SphereGeometry(.009, 10, 8), c2, 0, 0, .005)); return g;
}
// Banda que va sobre el pelo de un lado al otro, siguiendo su forma
function arco(c, grosor, inclina = .22, hasta = 95) {
  const pts = [], ca = Math.cos(inclina), sa = Math.sin(inclina);
  for (let f = -hasta; f <= hasta; f += 8) { const r = f * Math.PI / 180, d = new THREE.Vector3(Math.sin(r), Math.cos(r) * ca, Math.cos(r) * sa).normalize(); pts.push(sobre(d, grosor * .6)); }
  return pieza(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, grosor, 8), c);
}
function anillo(c, grosor, y, fuera = .001) {
  const pts = []; for (let a = 0; a < 360; a += 15) { const r = a * Math.PI / 180; pts.push(new THREE.Vector3(Math.sin(r) * (radio(r, y) + fuera), y, Math.cos(r) * (radio(r, y) + fuera))); }
  return pieza(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 72, grosor, 8, true), c);
}
const perfil = (pts, c) => { const m = pieza(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 36), c); m.material.side = THREE.DoubleSide; return m; };
function gorroBase(y, ancho) { const g = new THREE.Group(); g.position.set(0, y, 0); g.userData.ancho = ancho; return g; }
function orejasPuntas(c, c2, ancho, largo, az, el, abre = .24) {
  const g = new THREE.Group();
  for (const l of [-1, 1]) { const o = new THREE.Group(); o.position.copy(sobre(dir(l * az, el), -.006)); o.rotation.z = -l * abre; const e = pieza(new THREE.ConeGeometry(ancho, largo, 3), c, 0, largo / 2, 0); e.scale.z = .5; const i = pieza(new THREE.ConeGeometry(ancho * .6, largo * .68, 3), c2, 0, largo * .36, ancho * .3); i.scale.z = .35; o.add(e, i); g.add(o); }
  return g;
}
export const ACCESORIOS = {
  lazo: (o, cab) => cab.add(pegar(lazo(o.a1, 1.05), dir(-52, 46), .009)),
  lazoGrande: (o, cab) => { const g = lazo(o.a1, 1.6); g.position.copy(sobre(dir(180, 72), .002)); cab.add(g); },
  flor: (o, cab) => cab.add(pegar(flor(o.a1, o.a2 || '#ffd84d', 1.15), dir(-55, 28), .01)),
  vincha: (o, cab) => cab.add(arco(o.a1, .007)),
  tiara: (o, cab) => { const y = .15; cab.add(anillo(o.a1, .0045, y, .006)); for (let i = -2; i <= 2; i++) { const a = i * .5, h = [.06, .044, .032][Math.abs(i)], r = radio(a, y) + .007; cab.add(pieza(new THREE.ConeGeometry(.01, h, 4), o.a1, Math.sin(a) * r, y + h / 2 - .002, Math.cos(a) * r)); } const r0 = radio(0, y); cab.add(pieza(new THREE.SphereGeometry(.008, 10, 8), o.a2 || '#58c4f5', 0, y + .009, r0 + .012)); },
  gato: (o, cab) => cab.add(orejasPuntas(o.a1, o.a2 || '#ffc1d5', .036, .068, 42, 52)),
  conejo: (o, cab) => { for (const l of [-1, 1]) { const g = new THREE.Group(); g.position.copy(sobre(dir(l * 30, 62), -.008)); g.rotation.z = -l * .14; const e = pieza(new THREE.SphereGeometry(.028, 14, 12), o.a1, 0, .08, 0); e.scale.set(.75, 3.1, .4); const i = pieza(new THREE.SphereGeometry(.016, 12, 10), o.a2 || '#ffc1d5', 0, .076, .008); i.scale.set(.7, 3.4, .35); g.add(e, i); cab.add(g); } },
  bruja: (o, cab) => { const g = gorroBase(.112); g.rotation.set(-.03, 0, .05); g.add(pieza(new THREE.CylinderGeometry(.17, .17, .006, 40), o.a1), perfil([[.102, 0], [.1, .015], [.094, .035], [.087, .055], [.07, .08], [.05, .12], [.028, .18], [.004, .26]], o.a1), pieza(new THREE.CylinderGeometry(.099, .102, .026, 32), o.a2 || '#f0be3c', 0, .016, 0)); cab.add(g); },
  navidad: (o, cab) => { const g = gorroBase(.108); g.rotation.set(-.03, 0, -.1); g.add(perfil([[.102, 0], [.1, .015], [.094, .035], [.087, .055], [.068, .085], [.036, .13], [.006, .18]], o.a1), pieza(new THREE.TorusGeometry(.102, .014, 10, 36).rotateX(Math.PI / 2), '#ffffff'), pieza(new THREE.SphereGeometry(.022, 12, 10), '#ffffff', 0, .184, 0)); cab.add(g); },
  cofia: (o, cab) => { cab.add(arco('#ffffff', .006, .3, 78)); for (let f = -60; f <= 60; f += 20) { const r = f * Math.PI / 180, d = new THREE.Vector3(Math.sin(r), Math.cos(r) * .955, Math.cos(r) * .296).normalize(), p = pieza(new THREE.SphereGeometry(.021, 10, 8), '#ffffff'); p.scale.z = .4; pegar(p, d, .006); cab.add(p); } },
  alitas: (o, cab, pecho) => { pecho.add(pieza(new THREE.SphereGeometry(.03, 12, 10), o.a1, 0, .03, -.075)); for (const l of [-1, 1]) { const g = new THREE.Group(); g.position.set(l * .012, .03, -.085); g.rotation.y = l * .35; for (let i = 0; i < 4; i++) { const p = pieza(new THREE.SphereGeometry(.075, 14, 10), o.a1, l * (.06 + i * .022), .05 - i * .05, 0); p.scale.set(1.25 - i * .17, .36, .1); p.rotation.z = l * (.55 - i * .36); g.add(p); } pecho.add(g); } }
};

/* ---------- Accesorios que se combinan con cualquier ropa ---------- */
const estrellaGeo = r => { const f = new THREE.Shape(); for (let i = 0; i < 10; i++) { const q = i % 2 ? r * .45 : r, a = i * Math.PI / 5; f[i ? 'lineTo' : 'moveTo'](Math.sin(a) * q, Math.cos(a) * q); } f.closePath(); return new THREE.ExtrudeGeometry(f, { depth: r * .35, bevelEnabled: false }); };
const tubo = (puntos, grosor, col) => pieza(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(puntos.map(p => new THREE.Vector3(...p))), 20, grosor, 8), col);
export const EXTRAS = {
  lentes: { nombre: 'Lentes', pon: ({ cab }) => { const c = '#3a2c34', y = .066, z = .09; for (const l of [-1, 1]) { const a = pieza(new THREE.TorusGeometry(.025, .0026, 8, 30), c, l * .033, y, z); a.rotation.y = l * .2; const lado = sobre(dir(l * 88, -8), -.002); cab.add(a, tubo([[l * .057, y, z - .005], [l * .075, y + .001, .05], [lado.x, lado.y, lado.z]], .0022, c)); } cab.add(pieza(new THREE.BoxGeometry(.021, .0034, .004), c, 0, y + .004, z + .004)); } },
  auriculares: { nombre: 'Audífonos', pon: ({ cab }) => { cab.add(arco('#4c6fe0', .006, .02, 88)); for (const l of [-1, 1]) { const p = sobre(dir(l * 90, -10), 0); cab.add(pieza(new THREE.CylinderGeometry(.036, .036, .024, 22).rotateZ(Math.PI / 2), '#4c6fe0', p.x + l * .008, p.y, p.z), pieza(new THREE.CylinderGeometry(.023, .023, .005, 20).rotateZ(Math.PI / 2), '#ffffff', p.x + l * .021, p.y, p.z)); } } },
  halo: { nombre: 'Aureola con soporte', pon: ({ cab }) => { const b = sobre(dir(180, 58), -.003); cab.add(tubo([[b.x, b.y, b.z], [0, b.y + .03, b.z - .022], [0, .232, -.098]], .0026, '#e6c23e'), pieza(new THREE.TorusGeometry(.058, .0055, 10, 40).rotateX(Math.PI / 2), '#ffe066', 0, .232, -.04)); } },
  flores: { nombre: 'Corona de flores', pon: ({ cab }) => { const col = ['#ff8fb3', '#ffffff', '#ffd84d', '#b48cff']; for (let i = 0; i < 12; i++) cab.add(pegar(flor(col[i % 4], i % 4 === 2 ? '#ffffff' : '#ffd84d', .78), dir(i * 30, 34), .009)); } },
  sombrero: { nombre: 'Sombrero de paja', gorro: true, pon: ({ cab }) => { const g = gorroBase(.112); g.rotation.set(-.03, 0, .05); g.add(pieza(new THREE.CylinderGeometry(.165, .17, .006, 40), '#f2d894'), pieza(new THREE.CylinderGeometry(.09, .102, .09, 32), '#f2d894', 0, .047, 0), pieza(new THREE.CylinderGeometry(.1, .102, .022, 32), '#e6374b', 0, .014, 0)); cab.add(g); } },
  estrella: { nombre: 'Pinza de estrella', pon: ({ cab }) => { const m = pieza(estrellaGeo(.027), '#ffd84d'); pegar(m, dir(-58, 26), .007); cab.add(m); } },
  lazos: { nombre: 'Dos lazos', pon: ({ cab }) => { cab.add(pegar(lazo('#ff78b4', .85), dir(-62, 42), .01), pegar(lazo('#ff78b4', .85), dir(62, 42), .01)); } },
  zorro: { nombre: 'Orejas de zorro', pon: ({ cab }) => cab.add(orejasPuntas('#f08a3c', '#fff1e0', .036, .082, 42, 50, .2)) },
  cuernitos: { nombre: 'Cuernitos', pon: ({ cab }) => { for (const l of [-1, 1]) { const m = pieza(new THREE.ConeGeometry(.015, .05, 14), '#ffb26b'); m.position.copy(sobre(dir(l * 28, 62), .012)); m.rotation.z = -l * .3; cab.add(m); } } },
  bufanda: { nombre: 'Bufanda', pon: ({ cuello }) => { cuello.add(pieza(new THREE.TorusGeometry(.052, .02, 10, 28).rotateX(Math.PI / 2), '#e6374b', 0, .016, .002), pieza(new THREE.TorusGeometry(.056, .012, 8, 28).rotateX(Math.PI / 2), '#ffffff', 0, -.004, .002)); } },
  capa: { nombre: 'Capa', pon: ({ pecho }) => { const m = pieza(new THREE.CylinderGeometry(.13, .3, .66, 28, 1, true, Math.PI / 2, Math.PI), '#6a4fc9', 0, -.26, -.012); m.material.side = THREE.DoubleSide; pecho.add(m); } },
  cola: { nombre: 'Cola', pon: ({ cadera }) => { const curva = new THREE.CatmullRomCurve3([[0, .02, -.07], [0, -.07, -.17], [.03, -.04, -.27], [.06, .08, -.31]].map(p => new THREE.Vector3(...p))); cadera.add(pieza(new THREE.TubeGeometry(curva, 24, .024, 10), '#f08a3c'), pieza(new THREE.SphereGeometry(.032, 14, 12), '#fff1e0', .06, .09, -.31)); } }
};

/* ---------- Lo que sale de la boca ---------- */
const TEX_BOCA = {
  bola: () => lienzo(64, 64, k => { k.beginPath(); k.arc(32, 32, 29, 0, 7); k.fillStyle = '#fff'; k.fill(); }),
  llama: () => lienzo(128, 128, k => { const capa = (e, c) => { k.save(); k.translate(64, 92); k.scale(e, e); k.beginPath(); k.moveTo(0, -88); k.bezierCurveTo(10, -66, 40, -54, 34, -22); k.bezierCurveTo(44, -28, 46, -38, 44, -44); k.bezierCurveTo(58, -18, 48, 34, 0, 34); k.bezierCurveTo(-48, 34, -58, -18, -44, -44); k.bezierCurveTo(-46, -38, -44, -28, -34, -22); k.bezierCurveTo(-40, -54, -10, -66, 0, -88); k.fillStyle = c; k.fill(); k.restore(); }; capa(1, '#e8361b'); capa(.7, '#ff8a1f'); capa(.4, '#ffe25a'); }),
  burbuja: () => lienzo(64, 64, k => { k.beginPath(); k.arc(32, 32, 27, 0, 7); k.fillStyle = 'rgba(190,232,255,.32)'; k.fill(); k.lineWidth = 3.5; k.strokeStyle = '#6fb9e8'; k.stroke(); k.fillStyle = '#fff'; k.beginPath(); k.ellipse(23, 21, 7, 4.5, -.6, 0, 7); k.fill(); }),
  alma: () => lienzo(128, 128, k => { k.beginPath(); k.moveTo(64, 8); k.bezierCurveTo(100, 8, 108, 40, 104, 62); k.bezierCurveTo(100, 88, 82, 96, 74, 122); k.bezierCurveTo(64, 104, 42, 94, 28, 70); k.bezierCurveTo(14, 42, 28, 8, 64, 8); k.fillStyle = '#f4f8ff'; k.fill(); k.lineWidth = 4; k.strokeStyle = '#9fb3d6'; k.stroke(); k.fillStyle = '#34405c'; k.beginPath(); k.arc(50, 48, 5, 0, 7); k.arc(78, 48, 5, 0, 7); k.fill(); k.beginPath(); k.ellipse(64, 64, 6, 8, 0, 0, 7); k.fill(); }),
  gota: () => TEX.lagrima()
};
const ARCOIRIS = ['#ff4d5e', '#ff9d3c', '#ffe14d', '#5fd16a', '#4cb5f5', '#a06bf0'];
const VERDES = ['#6f9f2f', '#8fbf3f', '#a8cf4f', '#7fae35', '#9ac744', '#6f9f2f'];
// Chorro continuo que cae hasta el piso y forma un charco
function crearCinta(escena) {
  const N = 28, S = 6, total = S * (N + 1) * 2, pos = new Float32Array(total * 3), col = new Float32Array(total * 3), idx = [];
  for (let k = 0; k < S; k++) for (let i = 0; i < N; i++) { const b = k * (N + 1) * 2 + i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx);
  const malla = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false })); malla.frustumCulled = false; malla.visible = false; malla.renderOrder = 14; escena.add(malla);
  const charco = new THREE.Group(); charco.visible = false; escena.add(charco); const discos = [1, .68, .36].map((e, i) => { const d = new THREE.Mesh(new THREE.CircleGeometry(e, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ toneMapped: false })); d.position.y = .006 + i * .001; d.scale.z = .72; charco.add(d); return d; });
  let frente = 0, cola = 1, tam = 0, reloj = 0, ultimos = null; const o0 = new THREE.Vector3(), v = new THREE.Vector3(), c = new THREE.Color(), t = new THREE.Vector3(), a = new THREE.Vector3(), p = new THREE.Vector3(), vista = new THREE.Vector3();
  return (colores, boca, adelante, cam, dt) => {
    reloj += dt;
    if (colores) {
      if (colores !== ultimos) { ultimos = colores; for (let k = 0; k < S; k++) { c.set(colores[k]); for (let i = 0; i < (N + 1) * 2; i++) c.toArray(col, (k * (N + 1) * 2 + i) * 3); } geo.attributes.color.needsUpdate = true; discos.forEach((d, i) => d.material.color.set(colores[[0, 2, 4][i]])); }
      if (cola >= 1) { frente = 0; cola = 0; }
      frente = Math.min(1, frente + dt / .28); cola = 0; o0.copy(boca); v.copy(adelante).multiplyScalar(.5); v.y -= .05;
      if (frente >= 1) tam = Math.min(.24, tam + dt * .1);
    } else { if (cola < 1) cola = Math.min(1, cola + dt / .32); tam = Math.max(0, tam - dt * .14); }
    malla.visible = cola < 1 && frente > 0; charco.visible = tam > .002;
    const T = (v.y + Math.sqrt(v.y * v.y + 6 * Math.max(.01, o0.y - .008))) / 3;
    if (charco.visible) { charco.position.set(o0.x + v.x * T, 0, o0.z + v.z * T); charco.scale.setScalar(tam); }
    if (!malla.visible) return;
    for (let i = 0; i <= N; i++) {
      const u = cola + (frente - cola) * i / N, q = u * T;
      p.set(o0.x + v.x * q, o0.y + v.y * q - 1.5 * q * q, o0.z + v.z * q);
      t.set(v.x, v.y - 3 * q, v.z); vista.copy(cam.position).sub(p); a.crossVectors(t, vista).normalize();
      p.addScaledVector(a, Math.sin(u * 10 - reloj * 11) * .006 * u);
      const ancho = .013 + .03 * u;
      for (let k = 0; k < S; k++) for (const [lado, m] of [[0, k / S - .5], [1, (k + 1) / S - .5]]) { const n = (k * (N + 1) * 2 + i * 2 + lado) * 3; pos[n] = p.x + a.x * ancho * m; pos[n + 1] = p.y + a.y * ancho * m; pos[n + 2] = p.z + a.z * ancho * m; }
    }
    geo.attributes.position.needsUpdate = true;
  };
}
export function crearBoca(escena) {
  const texturas = {}, tex = n => texturas[n] ||= TEX_BOCA[n](), pool = [];
  const cinta = crearCinta(escena); let camara = null, giroLlama = 0;
  for (let i = 0; i < 140; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); s.visible = false; s.renderOrder = 15; s.userData.vida = 0; escena.add(s); pool.push(s); }
  let acum = 0, turno = 0; const o = new THREE.Vector3(), adelante = new THREE.Vector3(), lado = new THREE.Vector3(), q = new THREE.Quaternion(), V = new THREE.Vector3();
  const nace = (t, x, y, z, vx, vy, vz, vida, s0, s1, g, col, extra = {}) => { const s = pool[turno++ % pool.length]; s.material.map = tex(t); s.material.needsUpdate = true; s.material.color.set(col); s.material.opacity = 1; s.material.rotation = extra.gira || 0; s.position.set(x, y, z); s.visible = true; Object.assign(s.userData, { vx, vy, vz, vida, total: vida, s0, s1, g, cols: extra.cols || null, piso: !!extra.piso, onda: extra.onda || 0, fase: Math.random() * 6 }); s.scale.setScalar(s0); };
  const azar = (a, b) => a + Math.random() * (b - a);
  return (tipo, cabeza, dt, cam) => {
    camara = cam;
    if (tipo) {
      cabeza.getWorldQuaternion(q); adelante.set(0, 0, 1).applyQuaternion(q); lado.set(1, 0, 0).applyQuaternion(q);
      cabeza.localToWorld(o.set(BOCA[0], BOCA[1], BOCA[2] + .006));
      const ex = new THREE.Vector3().setFromMatrixColumn(camara.matrixWorld, 0), ey = new THREE.Vector3().setFromMatrixColumn(camara.matrixWorld, 1); giroLlama = Math.atan2(adelante.dot(ey), adelante.dot(ex)) - Math.PI / 2;
      const tasas = { fuego: 95, humo: 14, burbujas: 8, alma: 1.1, estornudo: 420, baba: 1.4 };
      acum += dt * (tasas[tipo] || 0);
      while (acum >= 1) { acum -= 1;
        if (tipo === 'fuego') { const d = azar(1.05, 1.5), a = azar(-.32, .32), b = azar(-.62, -.3), vx = (adelante.x + lado.x * a) * d, vy = (adelante.y + b) * d, vz = (adelante.z + lado.z * a) * d, px = vx * ex.x + vy * ex.y + vz * ex.z, py = vx * ey.x + vy * ey.y + vz * ey.z; nace('llama', o.x, o.y, o.z, vx, vy, vz, azar(.3, .46), .018, azar(.07, .115), .55, '#ffffff', { gira: Math.atan2(py, px) - Math.PI / 2 + azar(-.2, .2) }); }
        else if (tipo === 'humo') for (const l of [-1, 1]) { const p = cabeza.localToWorld(V.set(l * .088, .06, 0)); nace('bola', p.x, p.y, p.z, lado.x * l * azar(.12, .22), azar(.2, .3), lado.z * l * azar(.12, .22), azar(.5, .75), .014, azar(.04, .06), .05, '#ffffff', { cols: ['#ffffff', '#f0f0f0', '#c9ced8'] }); }
        else if (tipo === 'burbujas') nace('burbuja', o.x, o.y, o.z, adelante.x * azar(.28, .45) + lado.x * azar(-.08, .08), azar(.02, .1), adelante.z * azar(.28, .45) + lado.z * azar(-.08, .08), azar(1.6, 2.4), .012, azar(.04, .07), .1, '#ffffff', { onda: .05 });
        else if (tipo === 'alma') nace('alma', o.x, o.y + .01, o.z + .02, adelante.x * .03, .13, adelante.z * .03, 3.2, .05, .13, 0, '#ffffff', { onda: .05 });
        else if (tipo === 'estornudo') { const d = azar(.9, 2), a = azar(-.4, .4), b = azar(-.3, .3); nace('bola', o.x, o.y, o.z, (adelante.x + lado.x * a) * d, (adelante.y + b) * d, (adelante.z + lado.z * a) * d, azar(.3, .55), .007, .018, -2.6, '#d6f2ff'); }
        else if (tipo === 'baba') { const p = cabeza.localToWorld(V.set(.016, BOCA[1] - .008, BOCA[2])); nace('gota', p.x, p.y, p.z, 0, -.01, 0, .8, .016, .024, -.5, '#ffffff'); }
      }
    } else acum = 0;
    cinta(tipo === 'arcoiris' ? ARCOIRIS : tipo === 'verde' ? VERDES : null, o, adelante, cam, dt);
    for (const s of pool) { const u = s.userData; if (!(u.vida > 0)) { s.visible = false; continue; }
      u.vida -= dt; const r = 1 - u.vida / u.total;
      u.vy += u.g * dt;
      s.position.x += (u.vx + (u.onda ? Math.sin(r * 12 + u.fase) * u.onda : 0)) * dt; s.position.y += u.vy * dt; s.position.z += u.vz * dt;
      if (u.piso && s.position.y < .012) { s.position.y = .012; u.vx = u.vy = u.vz = 0; u.g = 0; u.s1 = .05; }
      const e = u.s0 + (u.s1 - u.s0) * Math.min(1, r * 1.5); s.scale.set(e, e, 1);
      if (u.cols) s.material.color.set(u.cols[Math.min(u.cols.length - 1, Math.floor(r * u.cols.length))]);
      s.material.opacity = Math.min(1, (u.vida / u.total) * 3.5);
    }
  };
}

// Para la web de Filo: piezas para armar la ropa nueva en 3D
export { radio, dir, sobre, pegar, toon, pieza, lazo, flor, arco, anillo, perfil, gorroBase, orejasPuntas, estrellaGeo, tubo };
