// Filo en 2D (cabeza y hombros) dibujada en SVG: parpadea, mira el cursor, respira,
// mueve el pelo y la boca cuando habla, y pone caras (feliz, sorpresa, pensando, enojada).
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const escenario = document.getElementById('filo');

  // ---------- ayudas para dibujar ----------
  function el(tipo, attrs, padre) {
    const e = document.createElementNS(NS, tipo);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (padre) padre.appendChild(e);
    return e;
  }
  const grupo = (padre, attrs = {}) => el('g', attrs, padre);
  const camino = (padre, d, clase, extra = {}) => el('path', Object.assign({ d, class: clase }, extra), padre);

  // ---------- el dibujo ----------
  const svg = el('svg', { viewBox: '0 0 600 700', preserveAspectRatio: 'xMidYMax meet', role: 'img', 'aria-label': 'Filo' }, escenario);
  const defs = el('defs', {}, svg);
  defs.innerHTML = `
    <linearGradient id="g-iris" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="iris-1"/><stop offset=".55" class="iris-2"/><stop offset="1" class="iris-3"/>
    </linearGradient>
    <radialGradient id="g-rubor"><stop offset="0" stop-color="#ff7d93" stop-opacity=".7"/><stop offset="1" stop-color="#ff7d93" stop-opacity="0"/></radialGradient>
    <linearGradient id="g-pelo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="pelo-1"/><stop offset="1" class="pelo-2"/></linearGradient>
    <clipPath id="recorte-ojo"><path d="M -36 -18 C -20 -36, 22 -38, 38 -20 C 42 10, 30 38, 2 40 C -26 38, -40 12, -36 -18 Z"/></clipPath>`;

  const cuerpo = grupo(svg, { class: 'cuerpo' });
  const cabezaAtras = grupo(cuerpo, { class: 'cabeza-atras' });
  const alas = grupo(cuerpo, { class: 'alas' });
  const cuello = grupo(cuerpo);
  const torso = grupo(cuerpo);
  const cabeza = grupo(cuerpo, { class: 'cabeza' });

  // pelo largo de atras (se mueve con la cabeza pero queda detras del cuerpo)
  const peloAtras = grupo(cabezaAtras, { class: 'pelo-atras' });
  camino(peloAtras, 'M 182 190 C 120 300, 104 410, 120 500 C 130 560, 106 610, 98 690 C 116 668, 130 664, 138 720 L 462 720 C 470 664, 484 668, 502 690 C 494 610, 470 560, 480 500 C 496 410, 480 300, 418 190 Z', 'pelo linea');
  camino(peloAtras, 'M 200 300 C 172 420, 160 560, 178 720 L 422 720 C 440 560, 428 420, 400 300 Z', 'pelo-hondo');
  camino(peloAtras, 'M 160 330 C 150 430, 150 520, 160 600 M 440 330 C 450 430, 450 520, 440 600 M 132 420 C 124 500, 126 580, 120 650 M 468 420 C 476 500, 474 580, 480 650', 'pelo-hebra');

  // alitas blancas que asoman detras de los hombros
  const listaAlas = [];
  for (const s of [-1, 1]) {
    const ala = grupo(alas, { class: 'ala', transform: (s < 0 ? 'translate(600 0) scale(-1 1) ' : '') + 'translate(-6 -64)' });
    listaAlas.push({ ala, base: (s < 0 ? 'translate(600 0) scale(-1 1) ' : '') + 'translate(-6 -64)' });
    camino(ala, 'M 372 540 C 404 492, 462 448, 520 438 C 506 458, 530 462, 510 482 C 530 488, 516 504, 496 510 C 508 522, 486 534, 462 532 C 440 548, 410 552, 388 552 Z', 'ala-pluma linea');
    camino(ala, 'M 404 540 C 432 518, 466 496, 500 480 M 412 548 C 444 534, 470 522, 490 510', 'ala-detalle');
  }

  // cuello muy corto, casi escondido bajo la barbilla (como en el anime chibi)
  camino(cuello, 'M 286 390 C 287 404, 286 418, 284 432 L 316 432 C 314 418, 313 404, 314 390 Z', 'piel linea');
  camino(cuello, 'M 286 394 Q 300 424 314 394 Z', 'piel-sombra');

  // vestido: torso con cintura, cinta celeste y falda que se abre con pliegues
  camino(torso, 'M 192 720 C 204 680, 224 634, 236 606 C 230 566, 222 524, 222 488 C 244 462, 266 444, 282 424 Q 300 434 318 424 C 334 444, 356 462, 378 488 C 378 524, 370 566, 364 606 C 376 634, 396 680, 408 720 Z', 'vestido linea');
  // sombra de anime: lado derecho del cuerpo y debajo del cuello
  camino(torso, 'M 346 472 C 362 500, 368 548, 360 600 L 340 600 C 348 556, 346 512, 334 480 Z', 'vestido-sombra');
  camino(torso, 'M 236 478 C 262 498, 338 498, 364 478 L 364 490 C 338 510, 262 510, 236 490 Z', 'vestido-sombra');
  camino(torso, 'M 362 616 C 376 646, 392 684, 402 720 L 366 720 C 362 684, 356 650, 350 620 Z M 300 624 C 298 660, 296 690, 296 720 L 318 720 C 316 690, 312 660, 306 624 Z', 'vestido-sombra');
  // pliegues de la falda que nacen de la cintura
  camino(torso, 'M 262 622 C 258 656, 252 690, 248 720 M 338 622 C 342 656, 348 690, 352 720 M 282 626 C 280 660, 278 690, 276 720', 'pliegue');
  // pinzas del pecho
  camino(torso, 'M 262 512 C 266 540, 266 570, 262 596 M 338 512 C 334 540, 334 570, 338 596', 'pliegue');
  // cinta de la cintura con nudito
  camino(torso, 'M 234 596 Q 300 610 366 596 L 368 618 Q 300 632 232 618 Z', 'cinta linea');
  camino(torso, 'M 240 602 Q 300 614 362 602', 'cinta-brillo');
  camino(torso, 'M 290 610 C 284 626, 286 640, 292 650 L 300 636 L 308 650 C 314 640, 316 626, 310 610 Z', 'cinta linea');
  el('ellipse', { cx: 300, cy: 612, rx: 9, ry: 8, class: 'cinta linea' }, torso);
  // cuello del vestido redondo con borde celeste
  for (const s of [-1, 1]) {
    const solapa = grupo(torso, { transform: s > 0 ? 'translate(600 0) scale(-1 1)' : '' });
    camino(solapa, 'M 283 424 C 264 436, 240 448, 228 462 C 242 484, 274 484, 300 454 Z', 'vestido linea');
    camino(solapa, 'M 232 464 C 246 480, 272 480, 296 456', 'cinta-fina');
  }
  // brazos: forma que se afina hacia la muneca, con codo y sombra; manos dibujadas
  const capaBrazosAtras = grupo(torso);
  const capaBrazosAdelante = grupo(cuerpo);  // va encima de la cabeza (brazos levantados)
  const capsula = (x1, y1, x2, y2, r) => {
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * r, ny = (dx / l) * r;
    return `M ${x1 + nx} ${y1 + ny} L ${x2 + nx} ${y2 + ny} A ${r} ${r} 0 0 0 ${x2 - nx} ${y2 - ny} L ${x1 - nx} ${y1 - ny} A ${r} ${r} 0 0 0 ${x1 + nx} ${y1 + ny} Z`;
  };
  // la mano se dibuja hacia abajo desde la muneca; el pulgar queda del lado de adentro (+x)
  function dibujarMano(padre, tipo) {
    const g = grupo(padre);
    if (tipo === 'abierta') {
      // dedos un poco curvos y de distinto largo: menique, anular, medio, indice
      for (const [x1, y1, x2, y2, r] of [[-9, 15, -11.5, 30, 3.1], [-3.5, 17, -4.6, 36, 3.4], [2, 17, 2.7, 38, 3.5], [7.5, 16, 9.6, 34, 3.3]]) camino(g, capsula(x1, y1, x2, y2, r), 'piel linea');
      camino(g, 'M -12.5 0 C -14 7, -14 15, -11 21 C -5 24, 5 24, 11 20 C 13 14, 13 6, 11.5 0 Z', 'piel');
      camino(g, 'M -12.5 0 C -14 7, -14 14, -12 19 M 11.5 0 C 13 6, 13 12, 12 16', 'contorno-piel');
      camino(g, 'M -12 2 C -13 8, -13 14, -11 18 L -8 18 C -10 13, -10 8, -9 2 Z', 'piel-sombra');
      camino(g, 'M -4 11 Q 0 14 5 11', 'mano-linea');
      camino(g, capsula(10, 5, 18, 17, 4), 'piel linea');
    } else {
      // puno: nudillos redondos, palma y pulgar cruzado encima
      for (const x of [-9, -3, 3, 9]) el('circle', { cx: x, cy: 22, r: 4.6, class: 'piel linea' }, g);
      camino(g, 'M -13 0 C -15 7, -15 16, -12 22 L 12 22 C 15 16, 14 7, 12.5 0 Z', 'piel');
      camino(g, 'M -13 0 C -15 7, -15 15, -13 20 M 12.5 0 C 14 7, 15 14, 13 20', 'contorno-piel');
      camino(g, 'M -12 2 C -13 9, -13 15, -11 20 L -8 20 C -10 15, -10 9, -9 2 Z', 'piel-sombra');
      camino(g, 'M -6 24 L -6 27 M 0 24.5 L 0 27.5 M 6 24 L 6 27', 'mano-linea');
      camino(g, capsula(12, 9, 1, 17, 4.2), 'piel linea');
    }
    return g;
  }
  const brazos = [-1, 1].map((s) => {
    const g = grupo(capaBrazosAtras, { transform: s < 0 ? 'translate(200 478)' : 'translate(400 478) scale(-1 1)' });
    const mano = grupo(g);
    const forma = camino(g, '', 'piel linea');
    const sombra = camino(g, '', 'piel-sombra');
    const tipos = { abierta: dibujarMano(mano, 'abierta'), puno: dibujarMano(mano, 'puno') };
    return { g, s, forma, sombra, mano, tipos, h: 6, c: -6, adelante: false };
  });
  // contorno del brazo por hombro, codo y muneca: curvas suaves, mas lleno del lado de afuera
  function contornoBrazo(p, esc = 1, lado = [1, -1]) {
    const dir = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
    const d0 = dir(p[0], p[1]), d2 = dir(p[1], p[2]);
    const n0 = [-d0[1], d0[0]], n2 = [-d2[1], d2[0]];
    let nb = [n0[0] + n2[0], n0[1] + n2[1]];
    const lb = Math.hypot(nb[0], nb[1]) || 1, kb = Math.min(1.5, 2 / lb);
    nb = [(nb[0] / lb) * kb, (nb[1] / lb) * kb];
    const ancho = (tramo, t, f) => tramo === 0
      ? 15.5 - 3 * t + Math.sin(Math.PI * t) * (f > 0 ? 2.2 : 1)
      : 12.5 - 4 * t + Math.sin(Math.PI * Math.min(1, t * 1.3)) * (f > 0 ? 2 : 0.8);
    const entre = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const muestras = [[0, 0], [0, 0.25], [0, 0.5], [0, 0.75], [1, 0], [2, 0.25], [2, 0.5], [2, 0.75], [2, 1]];
    const borde = (f) => muestras.map(([tr, t]) => {
      const [base, n, w] = tr === 0 ? [entre(p[0], p[1], t), n0, ancho(0, t, f)] : tr === 1 ? [p[1], nb, ancho(1, 0, f)] : [entre(p[1], p[2], t), n2, ancho(1, t, f)];
      return [base[0] + n[0] * w * f * esc, base[1] + n[1] * w * f * esc];
    });
    const a = borde(lado[0]), b = borde(lado[1]).reverse();
    const f = (q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
    const curva = (q) => {
      let txt = '';
      for (let i = 0; i < q.length - 1; i++) {
        const q0 = q[i - 1] || q[i], q1 = q[i], q2 = q[i + 1], q3 = q[i + 2] || q2;
        txt += ` C ${f([q1[0] + (q2[0] - q0[0]) / 6, q1[1] + (q2[1] - q0[1]) / 6])} ${f([q2[0] - (q3[0] - q1[0]) / 6, q2[1] - (q3[1] - q1[1]) / 6])} ${f(q2)}`;
      }
      return txt;
    };
    const fin = 9.5 * esc, ini = 16 * esc;
    const ae = a[a.length - 1], b0 = b[0], bf = b[b.length - 1];
    return `M ${f(a[0])}${curva(a)} C ${f([ae[0] + d2[0] * fin, ae[1] + d2[1] * fin])} ${f([b0[0] + d2[0] * fin, b0[1] + d2[1] * fin])} ${f(b0)}${curva(b)} C ${f([bf[0] - d0[0] * ini, bf[1] - d0[1] * ini])} ${f([a[0][0] - d0[0] * ini, a[0][1] - d0[1] * ini])} ${f(a[0])} Z`;
  }

  // mangas abullonadas (giran un poco y suben con el hombro)
  const mangas = [-1, 1].map((s) => {
    const x = 300 + s * 100;
    const manga = grupo(torso);
    camino(manga, `M ${x - 44} 528 C ${x - 52} 486, ${x - 28} 456, ${x} 456 C ${x + 28} 456, ${x + 50} 482, ${x + 44} 526 C ${x + 22} 540, ${x - 22} 542, ${x - 44} 528 Z`, 'vestido linea');
    camino(manga, s > 0 ? `M ${x + 10} 462 C ${x + 40} 474, ${x + 46} 504, ${x + 40} 524 C ${x + 30} 530, ${x + 20} 532, ${x + 12} 532 C ${x + 22} 510, ${x + 20} 484, ${x + 10} 462 Z` : `M ${x - 6} 532 C ${x - 18} 532, ${x - 30} 530, ${x - 40} 526 C ${x - 40} 518, ${x - 36} 508, ${x - 30} 502 C ${x - 26} 516, ${x - 18} 526, ${x - 6} 532 Z`, 'vestido-sombra');
    camino(manga, `M ${x - 18} 464 Q ${x - 22} 494 ${x - 16} 524 M ${x + 14} 464 Q ${x + 20} 494 ${x + 16} 528`, 'pliegue');
    camino(manga, `M ${x - 42} 524 C ${x - 20} 538, ${x + 22} 538, ${x + 44} 524`, 'cinta-fina');
    return manga;
  });
  const lazo = grupo(torso, { class: 'lazo', transform: 'translate(300 460) scale(.7) translate(-300 -551)' });
  camino(lazo, 'M 300 548 C 270 520, 244 532, 252 556 C 258 574, 284 566, 300 552 Z', 'cinta linea');
  camino(lazo, 'M 300 548 C 330 520, 356 532, 348 556 C 342 574, 316 566, 300 552 Z', 'cinta linea');
  camino(lazo, 'M 292 552 L 278 602 L 290 596 L 296 606 L 300 556 Z M 308 552 L 322 602 L 310 596 L 304 606 L 300 556 Z', 'cinta linea');
  el('ellipse', { cx: 300, cy: 551, rx: 10, ry: 9, class: 'cinta linea' }, lazo);

  // cara: mejillas llenas y barbilla chica redondeada
  camino(cabeza, 'M 196 228 C 194 322, 238 398, 300 404 C 362 398, 406 322, 404 228 C 404 160, 358 118, 300 118 C 242 118, 196 160, 196 228 Z', 'piel linea');
  camino(cabeza, 'M 198 236 C 220 262, 250 270, 276 262 Q 300 280 324 262 C 350 270, 380 262, 402 236 L 402 220 L 198 220 Z', 'piel-sombra');
  // sonrojo fuerte: solo cuando le acarician la cabeza (mejillas muy rojas)
  const sonrojo = grupo(cabeza);
  sonrojo.style.filter = 'blur(4px)';
  sonrojo.style.opacity = 0;
  for (const x of [232, 368]) el('ellipse', { cx: x, cy: 346, rx: 46, ry: 22, fill: '#ff5f7e' }, sonrojo);
  const rubor = grupo(cabeza, { class: 'rubor' });
  for (const x of [232, 368]) {
    el('ellipse', { cx: x, cy: 348, rx: 30, ry: 14, fill: 'url(#g-rubor)' }, rubor);
    camino(rubor, `M ${x - 12} 352 l 6 -10 M ${x - 2} 354 l 6 -10 M ${x + 8} 352 l 6 -10`, 'rubor-rayas');
  }
  camino(cabeza, 'M 302 340 l -3 7', 'nariz');

  // ojos (se dibujan para el ojo derecho y el izquierdo es su espejo)
  const ojos = [];
  for (const [x, s] of [[253, -1], [347, 1]]) {
    const ojo = grupo(cabeza, { transform: `translate(${x} 304) scale(${s * 0.84} 0.86)` });
    const abierto = grupo(ojo, { class: 'ojo-abierto' });
    camino(abierto, 'M -36 -18 C -20 -36, 22 -38, 38 -20 C 42 10, 30 38, 2 40 C -26 38, -40 12, -36 -18 Z', 'blanco-ojo');
    const dentro = grupo(abierto, { 'clip-path': 'url(#recorte-ojo)' });
    const mira = grupo(dentro, { class: 'mira' });
    el('ellipse', { cx: 2, cy: 5, rx: 26, ry: 34, fill: 'url(#g-iris)', class: 'iris-borde' }, mira);
    el('ellipse', { cx: 3, cy: 3, rx: 11, ry: 17, class: 'pupila' }, mira);
    el('ellipse', { cx: 2, cy: 24, rx: 17, ry: 9, class: 'iris-luz' }, mira);
    el('ellipse', { cx: -8, cy: -9, rx: 8, ry: 10, class: 'brillo' }, mira);
    el('circle', { cx: 13, cy: 21, r: 4, class: 'brillo' }, mira);
    camino(dentro, 'M -40 -40 L 44 -40 L 44 -12 C 20 -26, -18 -26, -40 -8 Z', 'sombra-parpado');
    camino(abierto, 'M -38 -20 C -20 -44, 24 -46, 42 -26 L 50 -32 C 47 -18, 42 -13, 37 -10 C 22 -32, -18 -32, -36 -12 Z', 'pestana');
    camino(abierto, 'M 10 40 Q 28 36 36 20', 'pestana-baja');
    const parpado = grupo(abierto);
    camino(parpado, 'M -48 -52 L 56 -52 L 56 -24 L -44 -2 Z', 'piel');
    camino(parpado, 'M -42 -3 L 50 -25', 'trazo-ojo');
    const cerrado = grupo(ojo, { class: 'ojo-cerrado' });
    camino(cerrado, 'M -36 -2 Q 0 16 38 -4 M 36 -4 L 48 -12', 'trazo-ojo');
    const feliz = grupo(ojo, { class: 'ojo-feliz' });
    camino(feliz, 'M -32 8 Q 0 -24 34 8', 'trazo-ojo');
    const enojo = grupo(ojo, { class: 'ojo-enojo' });
    camino(enojo, 'M -30 -14 L 30 4 M -26 10 Q 0 22 30 8', 'trazo-ojo');
    const risa = grupo(ojo);  // «> <» al reirse
    camino(risa, 'M 30 -24 L -24 2 L 30 28', 'trazo-ojo', { 'stroke-width': 9, fill: 'none', 'stroke-linejoin': 'round' });
    const estrella = grupo(ojo);  // emocionada
    camino(estrella, 'M 2 -34 Q 8 -6 38 2 Q 8 10 2 40 Q -4 10 -34 2 Q -4 -6 2 -34 Z', '', { fill: '#ffd84a', stroke: '#e0a400', 'stroke-width': 4 });
    el('circle', { cx: -6, cy: -6, r: 6, fill: '#fff' }, estrella);
    const enamorado = grupo(ojo);  // amor: corazones
    camino(enamorado, 'M 2 34 C -40 6, -28 -30, 2 -10 C 32 -30, 44 6, 2 34 Z', '', { fill: '#ff5c8a', stroke: '#b3123e', 'stroke-width': 3 });
    el('ellipse', { cx: -10, cy: -6, rx: 7, ry: 5, fill: '#fff', opacity: 0.85 }, enamorado);
    const triste = grupo(ojo);  // triste y pena: el parpado cae hacia afuera
    camino(triste, 'M -48 -56 L 56 -56 L 56 -4 L -44 -28 Z', 'piel');
    camino(triste, 'M -42 -28 L 50 -6', 'trazo-ojo');
    const lagrima = camino(triste, 'M 30 40 C 24 54, 24 62, 30 64 C 36 62, 36 54, 30 40 Z', '', { fill: '#bfe3ff', stroke: '#4a90d9', 'stroke-width': 2.5 });
    const plano = grupo(ojo);  // asco y orgullo: parpado a media altura
    camino(plano, 'M -48 -56 L 56 -56 L 56 -2 L -48 -2 Z', 'piel');
    camino(plano, 'M -40 -2 L 46 -2', 'trazo-ojo');
    ojos.push({ abierto, cerrado, feliz, enojo, mira, parpado, risa, estrella, enamorado, triste, lagrima, plano });
  }

  // boca: varias formas, se muestra una
  const boca = grupo(cabeza, { transform: 'translate(300 372)' });
  const bocas = {
    sonrisa: camino(boca, 'M -15 -3 Q 0 9 15 -3', 'trazo-boca'),
    a: camino(boca, 'M -12 -4 Q 0 -6 12 -4 Q 9 12 0 13 Q -9 12 -12 -4 Z', 'boca-dentro'),
    o: el('ellipse', { cx: 0, cy: 3, rx: 8, ry: 11, class: 'boca-dentro' }, boca),
    grande: camino(boca, 'M -20 -5 Q 0 -8 20 -5 Q 17 22 0 24 Q -17 22 -20 -5 Z', 'boca-dentro'),
    puchero: camino(boca, 'M -10 4 Q 0 -4 10 4', 'trazo-boca'),
    onda: camino(boca, 'M -12 2 q 6 -6 12 0 q 6 6 12 0', 'trazo-boca'),
    triste: camino(boca, 'M -14 9 Q 0 -6 14 9', 'trazo-boca'),
    gato: camino(boca, 'M -14 -2 q 7 9 14 0 q 7 9 14 0', 'trazo-boca'),
    asco: camino(boca, 'M -17 5 l 5 -6 l 6 6 l 6 -6 l 6 6 l 6 -6 l 5 6', 'trazo-boca'),
    miedo: camino(boca, 'M -14 5 l 5 -4 l 5 4 l 5 -4 l 5 4 l 5 -4 l 4 4', 'trazo-boca'),
    lado: camino(boca, 'M -12 2 Q 6 9 17 -7', 'trazo-boca'),
  };
  const lengua = el('ellipse', { cx: 0, cy: 15, rx: 11, ry: 5, class: 'lengua' }, boca);
  const colmillo = camino(boca, 'M -11 -5 L -5 -5 L -8 3 Z', 'colmillo');

  // pelo de adelante: casco, mechones a los lados, flequillo, brillo y mechon parado
  const peloAdelante = grupo(cabeza, { class: 'pelo-adelante' });
  camino(peloAdelante, 'M 184 262 C 168 150, 230 86, 300 86 C 370 86, 432 150, 416 262 C 400 200, 360 170, 300 170 C 240 170, 200 200, 184 262 Z', 'pelo');
  camino(peloAdelante, 'M 184 262 C 168 150, 230 86, 300 86 C 370 86, 432 150, 416 262', 'pelo-contorno');
  const lados = [];
  for (const s of [-1, 1]) {
    const lado = grupo(peloAdelante, { transform: s > 0 ? 'translate(600 0) scale(-1 1)' : '' });
    camino(lado, 'M 200 176 C 176 232, 164 300, 176 362 C 186 412, 160 452, 170 504 C 178 544, 158 574, 142 606 C 182 582, 206 544, 200 498 C 196 452, 218 414, 212 362 C 204 306, 212 248, 236 196 Z', 'pelo linea');
    camino(lado, 'M 218 204 C 202 262, 198 330, 208 392 C 214 432, 200 472, 188 514 C 214 484, 230 442, 224 392 C 218 336, 224 274, 242 216 Z', 'pelo linea');
    camino(lado, 'M 236 196 C 212 248, 204 306, 212 362 C 218 414, 196 452, 200 498 L 192 506 C 188 456, 208 414, 202 362 C 194 304, 206 246, 230 200 Z', 'pelo-sombra');
    camino(lado, 'M 186 280 C 180 330, 190 380, 182 430 M 214 300 C 210 340, 216 370, 212 400 M 176 460 C 172 500, 168 540, 156 580', 'pelo-hebra');
    lados.push(lado);
  }
  // flequillo: bloque de pelo y mechones curvos con puntas (con raya en el medio)
  camino(peloAdelante, 'M 186 222 C 184 144, 240 104, 300 104 C 360 104, 416 144, 414 222 Q 300 186 186 222 Z', 'pelo');
  const MECHONES = [[204, 266, 46, -10], [230, 262, 50, -7], [262, 254, 52, -4], [290, 246, 40, -1], [314, 248, 40, 3], [344, 256, 52, 5], [372, 262, 50, 8], [398, 268, 46, 11]];
  for (const [xp, yp, w, inc] of MECHONES) {
    const xb = xp - inc * 4;
    // relleno sin borde arriba (asi no se ve una caja) y borde solo a los lados del mechon
    const lados = `M ${xb - w / 2} 150 C ${xb - w / 2} 200, ${xp - 10 - inc} ${yp - 40}, ${xp} ${yp} C ${xp + 4 - inc} ${yp - 42}, ${xb + w / 2} 210, ${xb + w / 2} 150`;
    camino(peloAdelante, lados + ' Z', 'pelo');
    camino(peloAdelante, lados.replace(/^M ([\d.-]+) 150 C ([\d.-]+) 200/, (m, x1, x2) => `M ${x1} 176 C ${x2} 200`), 'pelo-contorno');
    const lado = inc < 0 ? 1 : -1;  // la sombra va del lado de la raya del medio
    const xs = xb + lado * w / 2;
    camino(peloAdelante, `M ${xs} 172 C ${xs} 206, ${xp + lado * 4} ${yp - 36}, ${xp} ${yp - 2} C ${xp + lado * 6} ${yp - 30}, ${xs - lado * w * 0.28} 208, ${xs - lado * w * 0.3} 172 Z`, 'pelo-sombra');
    camino(peloAdelante, `M ${xb} 176 C ${xb} 206, ${(xb + xp) / 2} ${yp - 34}, ${(xb + xp * 2) / 3} ${yp - 18}`, 'pelo-hebra');
  }
  for (let i = -5; i <= 5; i++) {
    if (i === 0) continue;  // la raya del medio queda sin brillo
    const a = i * 0.15, x = 300 + Math.sin(a) * 112, y = 250 - Math.cos(a) * 92;
    const largo = 26 - Math.abs(i) * 2.2;
    camino(peloAdelante, `M 0 ${-largo / 2} C 4 ${-largo / 4}, 4 ${largo / 4}, 0 ${largo / 2} C -4 ${largo / 4}, -4 ${-largo / 4}, 0 ${-largo / 2} Z`, 'pelo-brillo-anillo', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(a * 57.3).toFixed(1)})` });
  }
  camino(peloAdelante, 'M 300 106 C 298 130, 300 150, 298 176', 'pelo-hebra');
  camino(peloAdelante, 'M 268 200 C 276 226, 274 248, 262 272 M 336 204 C 330 230, 334 250, 344 270', 'pelo-suelto');
  camino(peloAdelante, 'M 236 196 L 240 240 M 300 182 L 298 236 M 360 194 L 358 238', 'pelo-hebra');
  const ahoge = grupo(peloAdelante, { class: 'ahoge' });
  camino(ahoge, 'M 294 104 C 282 64, 300 28, 338 22 C 364 18, 376 38, 360 50 C 356 32, 330 34, 318 56 C 310 72, 310 88, 314 104 Z', 'pelo linea');
  const cejas = [[248, -1], [352, 1]].map(([x, s]) => {
    const g = grupo(cabeza);
    camino(g, s < 0 ? `M ${x + 24} 252 Q ${x} 244 ${x - 24} 254` : `M ${x - 24} 252 Q ${x} 244 ${x + 24} 254`, 'ceja');
    return { g, x, s, dy: 0, ang: 0 };
  });

  // simbolos de anime que aparecen con cada expresion
  const simbolos = grupo(cabeza, { class: 'simbolos' });
  const sim = { brillos: grupo(simbolos), exclama: grupo(simbolos), pregunta: grupo(simbolos), vena: grupo(simbolos), gota: grupo(simbolos),
    corazones: grupo(simbolos), asco: grupo(simbolos), susto: grupo(simbolos), penumbra: grupo(simbolos), nota: grupo(simbolos), estrella: grupo(simbolos), zzz: grupo(simbolos) };
  for (const [x, y, r] of [[150, 170, 16], [452, 140, 20], [470, 230, 11], [128, 260, 10]]) {
    camino(sim.brillos, `M ${x} ${y - r} Q ${x + r * 0.2} ${y - r * 0.2} ${x + r} ${y} Q ${x + r * 0.2} ${y + r * 0.2} ${x} ${y + r} Q ${x - r * 0.2} ${y + r * 0.2} ${x - r} ${y} Q ${x - r * 0.2} ${y - r * 0.2} ${x} ${y - r} Z`, 'simbolo-brillo');
  }
  camino(sim.exclama, 'M 450 96 L 462 96 L 458 150 L 454 150 Z M 432 110 L 440 106 L 446 150 L 442 152 Z M 470 108 L 478 112 L 468 152 L 464 150 Z', 'simbolo-linea');
  el('circle', { cx: 456, cy: 166, r: 6, class: 'simbolo-linea' }, sim.exclama);
  camino(sim.pregunta, 'M 438 120 C 438 94, 486 92, 484 120 C 482 140, 460 142, 460 162', 'simbolo-trazo');
  el('circle', { cx: 460, cy: 182, r: 6, class: 'simbolo-punto' }, sim.pregunta);
  camino(sim.vena, 'M 420 150 Q 438 154 440 136 M 450 136 Q 452 154 470 156 M 470 166 Q 452 168 450 186 M 440 186 Q 438 168 420 166', 'simbolo-vena');
  camino(sim.gota, 'M 408 230 C 400 246, 396 256, 404 262 C 412 266, 420 258, 414 246 C 412 240, 410 236, 408 230 Z', 'simbolo-gota');
  const corazoncitos = [[140, 200, 14], [460, 150, 18], [478, 250, 11]].map(([x, y, r]) => {
    const g = grupo(sim.corazones);
    camino(g, `M ${x} ${y + r * 0.9} C ${x - r * 1.4} ${y}, ${x - r} ${y - r}, ${x} ${y - r * 0.35} C ${x + r} ${y - r}, ${x + r * 1.4} ${y}, ${x} ${y + r * 0.9} Z`, '', { fill: '#ff7aa2', stroke: '#b3123e', 'stroke-width': 2 });
    return g;
  });
  for (const x of [253, 347]) camino(sim.asco, `M ${x - 22} 330 L ${x - 22} 346 M ${x - 7} 331 L ${x - 7} 350 M ${x + 8} 331 L ${x + 8} 350 M ${x + 23} 330 L ${x + 23} 346`, '', { stroke: '#5fae6a', 'stroke-width': 3.5, 'stroke-linecap': 'round', fill: 'none' });
  for (const [x, y, r] of [[452, 200, 10], [470, 168, 7], [458, 142, 5]]) el('circle', { cx: x, cy: y, r, fill: '#c9f0c4', stroke: '#5fae6a', 'stroke-width': 2 }, sim.asco);
  camino(sim.susto, 'M 160 210 l -30 -8 M 160 240 l -34 3 M 166 270 l -28 13 M 440 210 l 30 -8 M 440 240 l 34 3 M 434 270 l 28 13', '', { stroke: '#1d4ed8', 'stroke-width': 5, 'stroke-linecap': 'round', fill: 'none' });
  camino(sim.penumbra, 'M 254 196 L 254 222 M 277 190 L 277 220 M 300 188 L 300 220 M 323 190 L 323 220 M 346 196 L 346 222', '', { stroke: '#7c8ccf', 'stroke-width': 4, 'stroke-linecap': 'round', fill: 'none' });
  camino(sim.nota, 'M 450 190 L 450 140 L 478 132 L 478 182', '', { stroke: '#1d4ed8', 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' });
  el('ellipse', { cx: 442, cy: 192, rx: 11, ry: 8, fill: '#1d4ed8' }, sim.nota);
  el('ellipse', { cx: 470, cy: 184, rx: 11, ry: 8, fill: '#1d4ed8' }, sim.nota);
  const zetas = [[430, 230, 1], [458, 196, 0.8], [482, 168, 0.6]].map(([x, y, k], i) => {
    const g = grupo(sim.zzz);
    camino(g, `M ${x} ${y} l ${26 * k} 0 l ${-26 * k} ${26 * k} l ${26 * k} 0`, '', { stroke: '#cfe0ff', 'stroke-width': 5 * k + 1, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    return { g, i };
  });
  camino(sim.estrella, 'M 440 230 Q 444 246 460 250 Q 444 254 440 270 Q 436 254 420 250 Q 436 246 440 230 Z', 'simbolo-brillo');

  const rasgos = grupo(cabeza);
  cabeza.insertBefore(rasgos, peloAdelante);
  [...cabeza.children].slice(2).filter((h) => h !== rasgos && h !== peloAdelante && h !== simbolos && !cejas.some((c) => c.g === h)).forEach((h) => rasgos.appendChild(h));
  const grupoCejas = grupo(cabeza);
  cabeza.insertBefore(grupoCejas, simbolos);
  cejas.forEach((c) => grupoCejas.appendChild(c.g));

  // ---------- estados y animacion ----------
  const estado = { expresion: 'normal', hablando: false, mirar: [0, 0], parpadeo: 0, nivel: -1 };
  let proximoParpadeo = performance.now() + 1800;

  function mostrar(g, si) { g.style.display = si ? '' : 'none'; }
  function ponerBoca(nombre) {
    for (const k in bocas) mostrar(bocas[k], k === nombre);
    mostrar(lengua, nombre === 'a' || nombre === 'grande');
    mostrar(colmillo, nombre === 'grande' || nombre === 'a');
  }

  document.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect();
    estado.mirar = [Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 1.2))), Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height * 0.43)) / (r.height / 1.2)))];
  });

  const visemas = ['a', 'o', 'a', 'grande', 'sonrisa', 'a', 'o'];
  let visemaHasta = 0, visemaActual = 'sonrisa';

  function cuadro(ahora) {
    const t = ahora / 1000;
    // toque: f va de 0 a 1 en 1,2 s; k es la fuerza (fuerte al principio y se apaga)
    const tq = estado.toque, f = tq ? (t - tq.desde) / 1.2 : 1;
    const k = f >= 0 && f < 1 ? 1 - f : 0;
    const zona = k ? tq.zona : null;
    // respirar y balancear la cabeza
    const e0 = estado.expresion;
    const giro = Math.sin(t * 0.9) * 1.6 + ({ pensando: 8, feliz: -4, sorpresa: -2, pena: 9, triste: 4, asco: -8, orgullosa: -6, timida: -6, celosa: -9, dormida: 10 }[e0] || 0)
      + (e0 === 'risa' ? Math.sin(t * 13) * 4 : 0) + (e0 === 'miedo' ? Math.sin(t * 30) * 1.5 : 0) + (['guino', 'amor'].includes(e0) ? Math.sin(t * 3) * 4 : 0);
    const respira = Math.sin(t * 2.1) * 1.6
      - (['feliz', 'amor'].includes(e0) ? Math.abs(Math.sin(t * 7)) * 8 : e0 === 'emocionada' ? Math.abs(Math.sin(t * 10)) * 12 : e0 === 'risa' ? Math.abs(Math.sin(t * 13)) * 6 : 0)
      + (e0 === 'enojada' ? Math.sin(t * 40) * 0.8 : e0 === 'miedo' ? 6 + Math.sin(t * 55) * 1.4 : ['triste', 'pena'].includes(e0) ? 5 : e0 === 'dormida' ? 6 + Math.sin(t * 1.2) * 3 : 0);
    const saltito = zona === 'alas' ? Math.sin(Math.min(f * 2, 1) * Math.PI) * 18 : 0;
    const retuerce = zona === 'cuerpo' ? Math.sin(f * 40) * 3 * k : 0;
    cuerpo.setAttribute('transform', `translate(0 ${respira - saltito}) rotate(${retuerce} 300 690)`);
    const aplasta = zona === 'cabeza' ? Math.sin(Math.min(f * 3, 1) * Math.PI) * 0.06 + Math.sin(f * 18) * 0.015 * k : 0;
    const mece = zona === 'cabeza' ? Math.sin(f * 12) * 6 * k : 0;
    const tc = `rotate(${giro + mece} 300 420)` + (aplasta ? ` translate(300 420) scale(${1 + aplasta * 0.5} ${1 - aplasta}) translate(-300 -420)` : '');
    cabeza.setAttribute('transform', tc);
    cabezaAtras.setAttribute('transform', tc + ` skewX(${Math.sin(t * 1.3) * 0.8})`);
    ahoge.setAttribute('transform', `rotate(${Math.sin(t * 2.7) * 6} 302 96)`);
    lados.forEach((l, i) => {
      const base = (i ? 'translate(600 0) scale(-1 1) ' : '') + 'translate(-18 0) ';  // mechones algo afuera para que se vean las mejillas
      l.setAttribute('transform', base + `rotate(${Math.sin(t * 1.6 + i) * 1.2} 210 190)`);
    });
    alas.setAttribute('transform', `translate(0 ${Math.sin(t * 4) * 2})`);
    // alas tocadas: aletean rapidisimo desde el hombro
    listaAlas.forEach(({ ala, base }) => ala.setAttribute('transform', base + (zona === 'alas' ? ` rotate(${Math.sin(t * 30) * 14 * (0.4 + k)} 372 540)` : '')));

    // ojos: parpadeo, expresion y mirada
    if (ahora > proximoParpadeo) { estado.parpadeo = ahora + 130; proximoParpadeo = ahora + 2000 + Math.random() * 3000; }
    const parpadeando = ahora < estado.parpadeo;
    const ex = estado.expresion;
    const [mx, my] = ex === 'pensando' ? [0.8, -0.9] : estado.mirar;
    ojos.forEach((o, i) => {
      const contento = ex === 'feliz' || ex === 'timida' || (ex === 'guino' && i === 1);
      const especial = { risa: o.risa, emocionada: o.estrella, amor: o.enamorado }[ex];
      const tapado = contento || especial;
      const duerme = ex === 'dormida';
      mostrar(o.abierto, !parpadeando && !tapado && !duerme);
      mostrar(o.cerrado, duerme || (parpadeando && !tapado));
      mostrar(o.feliz, contento);
      mostrar(o.enojo, false);
      mostrar(o.parpado, ex === 'enojada' || ex === 'celosa');
      for (const g of [o.risa, o.estrella, o.enamorado]) mostrar(g, g === especial);
      mostrar(o.triste, (ex === 'triste' || ex === 'pena') && !parpadeando);
      mostrar(o.lagrima, ex === 'triste');
      mostrar(o.plano, (ex === 'asco' || ex === 'orgullosa') && !parpadeando);
      if (ex === 'triste') o.lagrima.setAttribute('transform', `translate(0 ${((t * 50 + i * 25) % 50).toFixed(1)})`);
      if (especial) especial.setAttribute('transform', `scale(${1 + Math.sin(t * (ex === 'risa' ? 13 : 8)) * 0.08})`);
      o.abierto.setAttribute('transform', ex === 'sorpresa' || ex === 'miedo' ? 'scale(1.08 1.12)' : '');
      const escala = ex === 'sorpresa' ? 0.6 : ex === 'miedo' ? 0.42 : 1;
      const tiembla = ex === 'miedo' ? Math.sin(t * 47 + i) * 2.5 : 0;
      o.mira.setAttribute('transform', `translate(${(i ? 1 : -1) * mx * 6 + tiembla} ${my * 5}) translate(2 4) scale(${escala}) translate(-2 -4)`);
    });
    // cejas: arriba con sorpresa, en V con enojo, una arriba al pensar
    cejas.forEach((c) => {
      let dy = 0, ang = 0;
      if (ex === 'sorpresa') dy = -12;
      else if (ex === 'enojada') { dy = 8; ang = c.s < 0 ? -18 : 18; }
      else if (ex === 'pensando') { dy = c.s > 0 ? -10 : 2; ang = c.s > 0 ? -6 : 0; }
      else if (ex === 'feliz' || ex === 'emocionada' || ex === 'risa') dy = -4;
      else if (ex === 'triste' || ex === 'pena') { dy = -2; ang = c.s < 0 ? 16 : -16; }
      else if (ex === 'miedo') { dy = -10; ang = c.s < 0 ? 14 : -14; }
      else if (ex === 'asco') { dy = c.s > 0 ? -8 : 6; ang = c.s < 0 ? -10 : 0; }
      else if (ex === 'orgullosa') dy = -6;
      else if (ex === 'celosa') { dy = 6; ang = c.s < 0 ? -12 : 12; }
      c.dy += (dy - c.dy) * 0.25;
      c.ang += (ang - c.ang) * 0.25;
      const adentro = c.x - c.s * 22;
      c.g.setAttribute('transform', `translate(0 ${c.dy}) rotate(${c.ang} ${adentro} 250)`);
    });
    rubor.style.opacity = ['feliz', 'enojada', 'amor', 'timida', 'risa', 'emocionada', 'orgullosa', 'celosa', 'contenta'].includes(ex) ? 1 : ex === 'miedo' || ex === 'asco' ? 0.2 : 0.65;
    // al acariciarle la cabeza se pone muy roja y le salen corazoncitos
    const rojo = zona === 'cabeza' ? Math.min(1, k * 2.5) : 0;
    if (rojo) rubor.style.opacity = 1;
    sonrojo.style.opacity = (rojo * 0.75).toFixed(2);
    mostrar(sim.corazones, ex === 'amor' || zona === 'cabeza');
    corazoncitos.forEach((g, i) => g.setAttribute('transform', `translate(0 ${(-((t * 40 + i * 25) % 60)).toFixed(1)})`));
    mostrar(sim.asco, ex === 'asco');
    mostrar(sim.susto, ex === 'miedo');
    sim.susto.style.opacity = 0.6 + Math.sin(t * 20) * 0.4;
    mostrar(sim.penumbra, ex === 'triste' || ex === 'miedo');
    mostrar(sim.nota, ex === 'orgullosa');
    mostrar(sim.zzz, ex === 'dormida');
    if (ex === 'dormida') zetas.forEach((z) => { const f = (t * 0.5 + z.i * 0.33) % 1; z.g.setAttribute('transform', `translate(${f * 18} ${-f * 36})`); z.g.style.opacity = Math.sin(f * Math.PI); });
    sim.nota.setAttribute('transform', `translate(0 ${(Math.sin(t * 3) * 8).toFixed(1)})`);
    mostrar(sim.estrella, ex === 'guino');
    sim.estrella.setAttribute('transform', `rotate(${(t * 90) % 360} 440 250)`);
    mostrar(sim.brillos, ex === 'feliz' || ex === 'emocionada' || ex === 'risa');
    sim.brillos.style.opacity = 0.6 + Math.sin(t * 6) * 0.4;
    mostrar(sim.exclama, ex === 'sorpresa');
    mostrar(sim.pregunta, ex === 'pensando');
    mostrar(sim.gota, ['pensando', 'timida', 'miedo', 'pena'].includes(ex));
    mostrar(sim.vena, ex === 'enojada');
    sim.vena.setAttribute('transform', `translate(445 161) scale(${1 + Math.sin(t * 9) * 0.08}) translate(-445 -161)`);
    sim.pregunta.setAttribute('transform', `rotate(${Math.sin(t * 3) * 6} 460 150)`);

    // brazos y manos segun la expresion: [hombro, codo, mano, encima de la cabeza]
    const quieto = [6 + Math.sin(t * 2.1) * 1.5, -8, 'abierta', false];
    const poses = {
      normal: [quieto, quieto],
      feliz: [[150 + Math.sin(t * 7) * 8, 25, 'puno', true], [150 + Math.sin(t * 7 + 1) * 8, 25, 'puno', true]],
      sorpresa: [[60, 110, 'abierta', true], [60, 110, 'abierta', true]],
      pensando: [quieto, [-48, -116, 'puno', true]],
      enojada: [[40 + Math.sin(t * 30) * 1.5, -80, 'puno', false], [40 + Math.sin(t * 30) * 1.5, -80, 'puno', false]],
      emocionada: [[160 + Math.sin(t * 10) * 10, 15, 'abierta', true], [160 + Math.sin(t * 10 + 1) * 10, 15, 'abierta', true]],
      risa: [[24 + Math.sin(t * 13) * 4, -96, 'abierta', false], [24 + Math.sin(t * 13) * 4, -96, 'abierta', false]],
      amor: [[-48, -116, 'puno', true], [-48, -116, 'puno', true]],
      timida: [[-48, -116, 'abierta', true], [-48, -116, 'abierta', true]],
      triste: [[2, -4, 'abierta', false], [2, -4, 'abierta', false]],
      pena: [quieto, [-48, -116, 'abierta', true]],
      miedo: [[60 + Math.sin(t * 50) * 2, 110, 'abierta', true], [60 + Math.sin(t * 50) * 2, 110, 'abierta', true]],
      asco: [[70, 100, 'abierta', true], quieto],
      orgullosa: [[30, -150, 'puno', false], [30, -150, 'puno', false]],
      celosa: [[30, -150, 'puno', false], [30, -150, 'puno', false]],
      dormida: [[2, -4, 'abierta', false], [2, -4, 'abierta', false]],
      guino: [quieto, [150 + Math.sin(t * 6) * 6, 25, 'puno', true]],
    };
    let pose = poses[ex] || poses.normal;
    if (estado.hablando && ex === 'normal') pose = [[14 + Math.sin(t * 3) * 6, -40 + Math.sin(t * 5) * 18, 'abierta', false], [150, Math.sin(t * 9) * 28, 'abierta', true]];
    const G = Math.PI / 180;
    brazos.forEach((b, i) => {
      const [ph, pc, tipo, adelante] = pose[i];
      b.h += (ph - b.h) * 0.16;
      b.c += (pc - b.c) * 0.16;
      const ex1 = -Math.sin(b.h * G) * 86, ey1 = Math.cos(b.h * G) * 86;
      const ex2 = ex1 - Math.sin((b.h + b.c) * G) * 70, ey2 = ey1 + Math.cos((b.h + b.c) * G) * 70;
      const x0 = -Math.sin(b.h * G) * 20, y0 = Math.cos(b.h * G) * 20;
      const pts = [[x0, y0], [ex1, ey1], [ex2, ey2]];
      b.forma.setAttribute('d', contornoBrazo(pts));
      b.sombra.setAttribute('d', contornoBrazo(pts, 0.94, [-1, -0.35]));
      b.mano.setAttribute('transform', `translate(${ex2} ${ey2}) rotate(${b.h + b.c}) translate(0 -5) scale(1.22)`);
      mostrar(b.tipos.abierta, tipo === 'abierta');
      mostrar(b.tipos.puno, tipo === 'puno');
      // levantado va encima de la cabeza; abajo, detras del pelo
      const quiere = adelante && b.h > 40 || (adelante && ex === 'pensando');
      if (quiere !== b.adelante) { (quiere ? capaBrazosAdelante : capaBrazosAtras).appendChild(b.g); b.adelante = quiere; }
      const sube = Math.max(0, Math.min(1, b.h / 150)) * 7;
      mangas[i].setAttribute('transform', `translate(0 ${-sube}) rotate(${(i ? -1 : 1) * b.h * 0.22} ${i ? 400 : 200} 478)`);
    });
    // la cara se corre un poco hacia donde mira y el pelo de adelante un poco menos
    const [vx, vy] = estado.mirar;
    rasgos.setAttribute('transform', `translate(${vx * 5} ${vy * 3})`);
    grupoCejas.setAttribute('transform', `translate(${vx * 5} ${vy * 3})`);
    peloAdelante.setAttribute('transform', `translate(${vx * 2} ${vy * 1})`);
    torso.setAttribute('transform', `rotate(${Math.sin(t * 0.9 + 0.6) * 0.6} 300 700)`);

    // boca
    if (estado.hablando && estado.nivel >= 0) {
      // con voz real: la boca se abre segun el volumen
      ponerBoca(estado.nivel < 0.04 ? 'sonrisa' : estado.nivel < 0.12 ? 'a' : 'grande');
    } else if (estado.hablando) {
      if (ahora > visemaHasta) { visemaActual = visemas[Math.floor(Math.random() * visemas.length)]; visemaHasta = ahora + 90 + Math.random() * 90; }
      ponerBoca(visemaActual);
    } else {
      ponerBoca({ feliz: 'grande', sorpresa: 'o', enojada: 'puchero', pensando: 'onda', risa: 'grande', emocionada: 'grande', amor: 'gato',
        guino: 'gato', timida: 'onda', triste: 'triste', pena: 'triste', miedo: 'miedo', asco: 'asco', orgullosa: 'lado',
        celosa: 'puchero', dormida: 'o', contenta: 'gato' }[ex] || 'sonrisa');
    }
    requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);

  // lentes de corazon rosados: se los pone en «modo nerd» («cuéntame más»)
  const corazonLente = (cx, cy, r) => `M ${cx} ${cy + r} C ${cx - r * 1.6} ${cy + r * 0.1}, ${cx - r * 1.25} ${cy - r * 1.05}, ${cx} ${cy - r * 0.45} `
    + `C ${cx + r * 1.25} ${cy - r * 1.05}, ${cx + r * 1.6} ${cy + r * 0.1}, ${cx} ${cy + r} Z`;
  const lentes = grupo(cabeza, { class: 'lentes' });
  lentes.style.opacity = 0;
  lentes.style.transition = 'opacity .35s ease';
  for (const cx of [253, 347]) {
    camino(lentes, corazonLente(cx, 308, 36), { fill: 'rgba(255,120,160,.18)', stroke: '#e83f7a', 'stroke-width': 4.5, 'stroke-linejoin': 'round' });
    camino(lentes, `M ${cx - 36 * 0.6} 308 l ${36 * 0.27} ${-36 * 0.2}`, { fill: 'none', stroke: '#fff', 'stroke-width': 3.8249999999999997, 'stroke-linecap': 'round', opacity: 0.7 });
  }
  camino(lentes, 'M 288 293 Q 300 286 312 293', { fill: 'none', stroke: '#e83f7a', 'stroke-width': 3.8249999999999997 });
  camino(lentes, 'M 214 293 L 200 287 M 386 293 L 400 287', { fill: 'none', stroke: '#e83f7a', 'stroke-width': 3.375, 'stroke-linecap': 'round' });

  // ropa segun la ocasion (codigo/ropa.js): las piezas estan hechas para la ilustracion y aqui se achican
  // para que los ojos de las dos coincidan (ilustracion: ojos 388/653, y 460; dibujo: 254/356, y 309)
  const AJUSTE = 'translate(305 292) scale(0.41) translate(-520 -460)';  // un poco mas arriba: su cabeza es mas alta
  const dia = { adorno: grupo(cabeza, { class: 'ropa-dia' }) };  // adorno del pelo de la ropa del dia (debajo de los gorros)
  const ropa = { cuerpo: grupo(cuerpo, { class: 'ropa' }), cabeza: grupo(cabeza, { class: 'ropa' }), extra: grupo(cuerpo, { class: 'ropa' }) };

  window.FiloDibujo = {
    expresion(n) {
      // la alegria cambia: a veces ojos cerrados, a veces se rie, a veces se emociona o guina
      if (n === 'feliz') n = ['feliz', 'feliz', 'risa', 'emocionada', 'guino'][Math.floor(Math.random() * 5)];
      estado.expresion = n;
    },
    hablar(si) { estado.hablando = si; },
    cara() { return estado.expresion; },
    // reaccion del cuerpo al tocarla (antes de hablar): cabeza, alas o cuerpo
    toque(zona) { estado.toque = { zona, desde: performance.now() / 1000 }; },
    nivel(n) { estado.nivel = n; },
    lentes(si) { lentes.style.opacity = si ? 1 : 0; },
    ropa(nombre) {
      if (!window.FiloRopa) return;
      window.FiloRopa.vestir(ropa, nombre, { conCuerpo: false, ajuste: AJUSTE });
      dia.adorno.style.display = window.FiloRopa.tapa(nombre).cabeza ? 'none' : '';
    },
    ropaDia(receta) { if (window.FiloRopa) window.FiloRopa.vestirDia(dia, receta, { ajuste: AJUSTE, raiz: document.getElementById('filo') }); },
  };
})();
