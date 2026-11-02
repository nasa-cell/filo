// Filo en ilustracion: la imagen va en capas (alas, cuerpo y cabeza) y encima se dibujan
// los parpados, la boca y los simbolos. La cabeza se mueve sola (se inclina, mira, asiente)
// y el pelo se dobla con ella gracias a una mezcla suave entre la cabeza y el cuerpo.
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const contenedor = document.getElementById('ilustracion');
  function el(tipo, attrs, padre) {
    const e = document.createElementNS(NS, tipo);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (padre) padre.appendChild(e);
    return e;
  }
  const grupo = (padre, attrs = {}) => el('g', attrs, padre);
  const camino = (padre, d, attrs = {}) => el('path', Object.assign({ d }, attrs), padre);
  const mostrar = (g, si) => (g.style.display = si ? '' : 'none');

  const PIEL = '#ffefdf';
  const LINEA = '#151a4f';
  const BOCA_BORDE = '#a9524a';
  const BOCA = '#f0857a';
  const CUELLO = [512, 668];  // punto donde gira la cabeza

  const svg = el('svg', { viewBox: '-70 0 1164 1024', preserveAspectRatio: 'xMidYMax meet', role: 'img', 'aria-label': 'Filo' }, contenedor);
  // mascaras: la cabeza se ve arriba y se funde con el cuerpo entre y=630 y y=700; el cuerpo
  // queda entero debajo de esa zona (asi no se transparenta el cuello) y se desvanece abajo
  el('defs', {}, svg).innerHTML = `
    <filter id="suave" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>
    <linearGradient id="g-cabeza" gradientUnits="userSpaceOnUse" x1="0" y1="630" x2="0" y2="700"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
    <linearGradient id="g-cuerpo" gradientUnits="userSpaceOnUse" x1="0" y1="600" x2="0" y2="1024"><stop offset="0" stop-color="#000"/><stop offset=".04" stop-color="#fff"/><stop offset=".86" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
    <mask id="m-cabeza" maskUnits="userSpaceOnUse" x="-200" y="-200" width="1424" height="1424"><rect x="-200" y="-200" width="1424" height="1424" fill="url(#g-cabeza)"/></mask>
    <mask id="m-cuerpo" maskUnits="userSpaceOnUse" x="-200" y="-200" width="1424" height="1424"><rect x="-200" y="-200" width="1424" height="1424" fill="url(#g-cuerpo)"/></mask>
    <linearGradient id="g-ala-izq" gradientUnits="userSpaceOnUse" x1="150" y1="0" x2="214" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
    <linearGradient id="g-ala-der" gradientUnits="userSpaceOnUse" x1="874" y1="0" x2="811" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
    <mask id="m-ala-izq" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect width="1024" height="1024" fill="url(#g-ala-izq)"/></mask>
    <mask id="m-ala-der" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect width="1024" height="1024" fill="url(#g-ala-der)"/></mask>`;
  // las alas se desvanecen hacia adentro: asi no se ve el corte recto donde tocaban el pelo
  const todo = grupo(svg);
  const alaIzq = grupo(todo);
  const alaDer = grupo(todo);
  el('image', { href: 'imagenes/ala_izq.png', width: 1024, height: 1024 }, alaIzq);
  el('image', { href: 'imagenes/ala_der.png', width: 1024, height: 1024 }, alaDer);
  const cuerpo = grupo(todo);
  el('image', { href: 'imagenes/filo_cuerpo.png', width: 1024, height: 1024, mask: 'url(#m-cuerpo)' }, cuerpo);
  const cabeza = grupo(todo);
  el('image', { href: 'imagenes/filo_cuerpo.png', width: 1024, height: 1024, mask: 'url(#m-cabeza)' }, cabeza);
  const cara = grupo(cabeza);
  // la cara sin ojos se dibuja una vez casi invisible: asi el navegador ya la tiene lista y nunca se ve un hueco al parpadear
  el('image', { href: 'imagenes/ojos_sin.png', x: 270, y: 360, width: 510, height: 170, opacity: 0.01 }, cara);

  // tapa: muestra la misma cara sin ojos (ojos_sin.png) solo dentro de la forma d
  let nTapa = 0;
  const defs = svg.querySelector('defs');
  function tapa(padre, d) {
    const id = 'tapa' + nTapa++;
    camino(el('clipPath', { id }, defs), d);
    return el('image', { href: 'imagenes/ojos_sin.png', x: 270, y: 360, width: 510, height: 170, 'clip-path': `url(#${id})` }, padre);
  }
  const ojoEntero = (x) => `M ${x - 112} 450 A 112 76 0 1 0 ${x + 112} 450 A 112 76 0 1 0 ${x - 112} 450 Z`;
  const parche = (padre, cx, cy, rx, ry) => el('ellipse', { cx, cy, rx, ry, fill: PIEL, filter: 'url(#suave)' }, padre);
  const linea = (padre, d, ancho = 10, color = LINEA) => camino(padre, d, { fill: 'none', stroke: color, 'stroke-width': ancho, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  const corazon = (padre, x, y, r, color) => camino(padre, `M ${x} ${y + r * 0.9} C ${x - r * 1.4} ${y}, ${x - r} ${y - r}, ${x} ${y - r * 0.35} C ${x + r} ${y - r}, ${x + r * 1.4} ${y}, ${x} ${y + r * 0.9} Z`, { fill: color, stroke: '#b3123e', 'stroke-width': 3 });

  // rubor extra (feliz, timida, amor)
  const rubor = grupo(cara);
  for (const x of [370, 670]) {
    el('ellipse', { cx: x, cy: 535, rx: 62, ry: 26, fill: '#ff7f95', opacity: 0.45, filter: 'url(#suave)' }, rubor);
    linea(rubor, `M ${x - 26} 548 l 10 -20 M ${x - 6} 550 l 10 -20 M ${x + 14} 548 l 10 -20`, 4, '#e0566e');
  }

  // ojos: centro de cada ojo en la ilustracion; s = -1 izquierdo, 1 derecho (lado de afuera)
  const ojos = [[388, -1], [653, 1]].map(([x, s]) => {
    // ojo cerrado: media luna gruesa que se afina en las puntas, con pestanitas afuera
    const cerrado = grupo(cara);
    tapa(cerrado, ojoEntero(x));
    camino(cerrado, `M ${x - 82} 452 Q ${x} 512 ${x + 82} 452 Q ${x} 484 ${x - 82} 452 Z`, { fill: LINEA });
    linea(cerrado, `M ${x + s * 74} 462 l ${s * 16} -6 M ${x + s * 62} 472 l ${s * 14} 2`, 6);
    // parpado que baja: tapa la parte de arriba del ojo hasta una curva que se mueve
    const baja = grupo(cara);
    const idB = 'baja' + x;
    const curvaB = camino(el('clipPath', { id: idB }, defs), '');
    const enOjo = grupo(baja, { 'clip-path': `url(#${idB})` });
    tapa(enOjo, ojoEntero(x));
    const bordeB = camino(baja, '', { fill: LINEA });
    // medio cerrado: el parpado baja hasta la mitad (para que el parpadeo sea suave)
    const medio = grupo(cara);
    tapa(medio, `M ${x - 112} 370 L ${x + 112} 370 L ${x + 112} 440 Q ${x} 470 ${x - 112} 440 Z`);
    camino(medio, `M ${x - 84} 440 Q ${x} 478 ${x + 84} 440 Q ${x} 462 ${x - 84} 440 Z`, { fill: LINEA });
    // feliz: arco hacia arriba, tambien grueso en el medio
    const feliz = grupo(cara);
    tapa(feliz, ojoEntero(x));
    camino(feliz, `M ${x - 68} 484 Q ${x} 398 ${x + 68} 484 Q ${x} 420 ${x - 68} 484 Z`, { fill: LINEA });
    // enojo: parpado mas bajo del lado de adentro (hacia la nariz)
    const enojo = grupo(cara);
    const eIzq = s < 0 ? 404 : 454, eDer = s < 0 ? 454 : 404;
    tapa(enojo, `M ${x - 112} 370 L ${x + 112} 370 L ${x + 112} ${eDer} L ${x - 112} ${eIzq} Z`);
    linea(enojo, `M ${x - 86} ${eIzq + 2} L ${x + 86} ${eDer + 2}`);
    // triste: parpado mas bajo del lado de afuera, lagrimas que caen
    const triste = grupo(cara);
    const tIzq = s < 0 ? 446 : 404, tDer = s < 0 ? 404 : 446;
    tapa(triste, `M ${x - 112} 370 L ${x + 112} 370 L ${x + 112} ${tDer} L ${x - 112} ${tIzq} Z`);
    linea(triste, `M ${x - 86} ${tIzq + 2} Q ${x} ${(tIzq + tDer) / 2 - 8} ${x + 86} ${tDer + 2}`);
    const lagrima = camino(triste, `M ${x + s * 30} 510 C ${x + s * 22} 528, ${x + s * 22} 540, ${x + s * 30} 542 C ${x + s * 38} 540, ${x + s * 38} 528, ${x + s * 30} 510 Z`, { fill: '#bfe3ff', stroke: '#4a90d9', 'stroke-width': 3 });
    // amor: corazones sobre los ojos
    const amor = grupo(cara);
    corazon(amor, x, 450, 50, '#ff5c8a');
    el('ellipse', { cx: x - 16, cy: 432, rx: 10, ry: 7, fill: '#fff', opacity: 0.85 }, amor);
    // risa: ojos apretados «> <» y lagrimita de risa en la punta
    const risa = grupo(cara);
    tapa(risa, ojoEntero(x));
    linea(risa, `M ${x + s * 58} 418 L ${x - s * 52} 452 L ${x + s * 58} 486`, 14);
    const lagrimaRisa = camino(risa, `M ${x + s * 78} 470 c ${s * 10} 10, ${s * 14} 22, ${s * 4} 26 c ${-s * 12} 2, ${-s * 14} -12, ${-s * 4} -26 Z`, { fill: '#bfe3ff', stroke: '#4a90d9', 'stroke-width': 3 });
    // emocionada: estrellas brillantes en los ojos
    const emocion = grupo(cara);
    camino(emocion, `M ${x} 392 Q ${x + 12} 438 ${x + 58} 450 Q ${x + 12} 462 ${x} 508 Q ${x - 12} 462 ${x - 58} 450 Q ${x - 12} 438 ${x} 392 Z`, { fill: '#ffd84a', stroke: '#e0a400', 'stroke-width': 5 });
    el('circle', { cx: x - 14, cy: 436, r: 9, fill: '#fff' }, emocion);
    // asco y orgullo: parpados a media altura, rectos (mirada de «puaj» o de «yo puedo»)
    const plano = grupo(cara);
    tapa(plano, `M ${x - 112} 370 L ${x + 112} 370 L ${x + 112} 446 L ${x - 112} 446 Z`);
    linea(plano, `M ${x - 88} 446 L ${x + 88} 446`, 12);
    // miedo: pupilas chiquitas que tiemblan (se tapa el ojo y se dibuja uno blanco con punto)
    const miedo = grupo(cara);
    tapa(miedo, ojoEntero(x));
    el('ellipse', { cx: x, cy: 452, rx: 62, ry: 56, fill: '#fff', stroke: LINEA, 'stroke-width': 9 }, miedo);
    const pupila = el('circle', { cx: x, cy: 456, r: 13, fill: '#1b2a5c' }, miedo);
    return { x, s, cerrado, medio, baja, curvaB, bordeB, feliz, enojo, triste, lagrima, amor, risa, lagrimaRisa, emocion, plano, miedo, pupila };
  });

  // boca: se tapa la boca original con piel y se dibuja la forma que toca
  const boca = grupo(cara);
  parche(boca, 518, 583, 47, 33);
  const trazo = { fill: 'none', stroke: BOCA_BORDE, 'stroke-width': 4.5, 'stroke-linecap': 'round' };
  const relleno = { fill: BOCA, stroke: BOCA_BORDE, 'stroke-width': 3.5, 'stroke-linejoin': 'round' };
  function bocaAbierta(alto, ancho) {
    const g = grupo(boca);
    camino(g, `M ${518 - ancho} 572 Q 518 ${566 - ancho * 0.15} ${518 + ancho} 572 Q ${518 + ancho * 0.8} ${572 + alto} 518 ${574 + alto} Q ${518 - ancho * 0.8} ${572 + alto} ${518 - ancho} 572 Z`, relleno);
    el('ellipse', { cx: 518, cy: 572 + alto * 0.72, rx: ancho * 0.5, ry: alto * 0.2, fill: '#ff9fa6' }, g);
    return g;
  }
  const bocas = {
    sonrisa: camino(boca, 'M 499 579 Q 518 594 537 579', trazo),
    chica: bocaAbierta(14, 16),
    a: bocaAbierta(24, 23),
    grande: bocaAbierta(38, 29),
    o: el('ellipse', Object.assign({ cx: 518, cy: 584, rx: 11, ry: 15 }, relleno), boca),
    puchero: camino(boca, 'M 503 591 Q 518 578 533 591', trazo),
    triste: camino(boca, 'M 500 594 Q 518 576 536 594', trazo),
    onda: camino(boca, 'M 502 585 q 8 -8 16 0 q 8 8 16 0', trazo),
    gato: camino(boca, 'M 496 580 q 11 12 22 0 q 11 12 22 0', trazo),
    asco: camino(boca, 'M 496 590 l 7 -8 l 7 8 l 8 -8 l 7 8 l 8 -8 l 7 8', trazo),
    miedo: camino(boca, 'M 498 590 l 7 -6 l 7 6 l 7 -6 l 7 6 l 7 -6 l 7 6', Object.assign({}, trazo, { 'stroke-width': 3.5 })),
    lado: camino(boca, 'M 502 584 Q 522 590 538 574', trazo),
    risa: bocaAbierta(44, 33),
  };
  // boca al hablar: una sola forma que se abre y se estira de a poco segun la voz
  const habla = grupo(boca);
  const hablaBoca = camino(habla, '', relleno);
  const hablaLengua = el('ellipse', { cx: 518, fill: '#ff9fa6' }, habla);
  bocas.habla = habla;
  function abrirBoca(alto, ancho) {
    hablaBoca.setAttribute('d', `M ${518 - ancho} 574 Q 518 ${569 - alto * 0.1} ${518 + ancho} 574 Q ${518 + ancho * 0.85} ${574 + alto} 518 ${576 + alto} Q ${518 - ancho * 0.85} ${574 + alto} ${518 - ancho} 574 Z`);
    hablaLengua.setAttribute('cy', (574 + alto * 0.74).toFixed(1));
    hablaLengua.setAttribute('rx', (ancho * 0.5).toFixed(1));
    hablaLengua.setAttribute('ry', Math.max(0, alto * 0.2).toFixed(1));
  }
  function ponerBoca(nombre) { for (const k in bocas) mostrar(bocas[k], k === nombre); }

  // simbolos de anime alrededor de la cabeza
  const simbolos = grupo(cabeza);
  const sim = { brillos: grupo(simbolos), exclama: grupo(simbolos), pregunta: grupo(simbolos), vena: grupo(simbolos), gota: grupo(simbolos), corazones: grupo(simbolos), estrella: grupo(simbolos), penumbra: grupo(simbolos), vapor: grupo(simbolos), asco: grupo(simbolos), destellos: grupo(simbolos), susto: grupo(simbolos), nota: grupo(simbolos), zzz: grupo(simbolos) };
  const estrellita = (padre, x, y, r, attrs) => camino(padre, `M ${x} ${y - r} Q ${x + r * 0.2} ${y - r * 0.2} ${x + r} ${y} Q ${x + r * 0.2} ${y + r * 0.2} ${x} ${y + r} Q ${x - r * 0.2} ${y + r * 0.2} ${x - r} ${y} Q ${x - r * 0.2} ${y - r * 0.2} ${x} ${y - r} Z`, attrs);
  for (const [x, y, r] of [[170, 190, 26], [870, 160, 32], [905, 330, 18], [140, 380, 16]]) estrellita(sim.brillos, x, y, r, { fill: '#ffd84a', stroke: '#e0a400', 'stroke-width': 3 });
  [sim.exclama, sim.pregunta, sim.vena, sim.gota].forEach((g) => g.setAttribute('transform', 'translate(139 -44) scale(1.6)'));
  camino(sim.exclama, 'M 450 96 L 462 96 L 458 150 L 454 150 Z M 432 110 L 440 106 L 446 150 L 442 152 Z M 470 108 L 478 112 L 468 152 L 464 150 Z', { fill: '#1d4ed8' });
  el('circle', { cx: 456, cy: 166, r: 6, fill: '#1d4ed8' }, sim.exclama);
  const preg = grupo(sim.pregunta);
  linea(preg, 'M 438 120 C 438 94, 486 92, 484 120 C 482 140, 460 142, 460 162', 9, '#1d4ed8');
  el('circle', { cx: 460, cy: 182, r: 6, fill: '#1d4ed8' }, preg);
  const vena = grupo(sim.vena);
  linea(vena, 'M 420 150 Q 438 154 440 136 M 450 136 Q 452 154 470 156 M 470 166 Q 452 168 450 186 M 440 186 Q 438 168 420 166', 7, '#e2283f');
  camino(sim.gota, 'M 408 230 C 400 246, 396 256, 404 262 C 412 266, 420 258, 414 246 C 412 240, 410 236, 408 230 Z', { fill: '#bfe3ff', stroke: '#4a90d9', 'stroke-width': 2.5 });
  const corazones = [[170, 300, 22], [860, 200, 30], [890, 380, 18]].map(([x, y, r]) => { const g = grupo(sim.corazones); corazon(g, x, y, r, '#ff7aa2'); return { g, x, y }; });
  estrellita(sim.estrella, 790, 380, 30, { fill: '#ffd84a', stroke: '#e0a400', 'stroke-width': 3 });
  linea(sim.penumbra, 'M 380 330 L 380 372 M 420 322 L 420 368 M 460 318 L 460 366 M 560 318 L 560 366 M 600 322 L 600 368 M 640 330 L 640 372', 6, '#7c8ccf');
  linea(sim.vapor, 'M 820 250 q 20 -14 0 -28 q -20 -14 0 -28 M 860 270 q 18 -12 0 -24 q -18 -12 0 -24', 6, '#ff9db0');
  // asco: sombra verdosa bajo los ojos y burbujitas
  for (const x of [388, 653]) linea(sim.asco, `M ${x - 40} 500 L ${x - 40} 528 M ${x - 14} 502 L ${x - 14} 534 M ${x + 12} 502 L ${x + 12} 534 M ${x + 38} 500 L ${x + 38} 528`, 5, '#5fae6a');
  for (const [x, y, r] of [[835, 300, 16], [870, 255, 10], [850, 220, 7]]) el('circle', { cx: x, cy: y, r, fill: '#c9f0c4', stroke: '#5fae6a', 'stroke-width': 3 }, sim.asco);
  // emocionada: muchos destellos alrededor
  for (const [x, y, r] of [[150, 170, 30], [890, 140, 36], [930, 320, 22], [110, 360, 20], [250, 90, 16], [780, 80, 18]]) estrellita(sim.destellos, x, y, r, { fill: '#fff4a8', stroke: '#e0a400', 'stroke-width': 3 });
  // miedo: rayitas de susto a los costados de la cabeza
  linea(sim.susto, 'M 150 300 l -40 -10 M 150 340 l -46 4 M 160 380 l -38 18 M 880 300 l 40 -10 M 880 340 l 46 4 M 870 380 l 38 18', 7, '#1d4ed8');
  // dormida: «Z z z» que suben
  const zetas = [[800, 300, 1], [850, 240, 0.8], [890, 190, 0.6]].map(([x, y, k], i) => {
    const g = grupo(sim.zzz);
    linea(g, `M ${x} ${y} l ${44 * k} 0 l ${-44 * k} ${44 * k} l ${44 * k} 0`, 8 * k + 2, '#cfe0ff');
    return { g, i };
  });
  // orgullosa: notita musical que flota
  linea(sim.nota, 'M 860 300 L 860 230 L 900 220 L 900 290', 8, '#1d4ed8');
  el('ellipse', { cx: 848, cy: 302, rx: 16, ry: 12, fill: '#1d4ed8' }, sim.nota);
  el('ellipse', { cx: 888, cy: 292, rx: 16, ry: 12, fill: '#1d4ed8' }, sim.nota);

  // ---------- animacion ----------
  const estado = { expresion: 'normal', hablando: false, parpadeo: 0, nivel: -1, mirar: [0, 0] };
  let proximoParpadeo = performance.now() + 1500;
  const PARPADEO = 260;  // ms que dura un parpadeo completo
  const revisarOjos = new URLSearchParams(location.search).get('ojos');
  let vistazo = [0, 0], proximoVistazo = 0;
  const cab = { giro: 0, x: 0, y: 0 };
  const mov = { alto: 0, ancho: 18, metaFalsa: 0, hasta: 0 };

  document.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect();
    estado.mirar = [Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 1.2))), Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height * 0.45)) / (r.height / 1.2)))];
  });

  function cuadro(ahora) {
    requestAnimationFrame(cuadro);
    if (contenedor.hidden) return;  // si no se ve, no gasta
    const t = ahora / 1000;
    const ex = estado.expresion;
    const voz = estado.hablando ? Math.max(0, estado.nivel) : 0;
    // toque: f va de 0 a 1 en 1,2 s; k es la fuerza (fuerte al principio y se apaga)
    const tq = estado.toque, f = tq ? (t - tq.desde) / 1.2 : 1;
    const k = f >= 0 && f < 1 ? 1 - f : 0;
    const zona = k ? tq.zona : null;

    // cuerpo: respira (sube los hombros), saltitos feliz, temblor enojada, se encoge triste
    const salto = ['feliz', 'amor', 'emocionada'].includes(ex) ? Math.abs(Math.sin(t * (ex === 'emocionada' ? 10 : 7))) * (ex === 'emocionada' ? 20 : 14)
      : ex === 'risa' ? Math.abs(Math.sin(t * 13)) * 9 : 0;
    const temblor = ex === 'enojada' ? Math.sin(t * 40) * 1.5 : ex === 'miedo' ? Math.sin(t * 55) * 2.2 : 0;
    const respira = 1 + Math.sin(t * 2.1) * 0.012;
    const hundido = ex === 'triste' || ex === 'pena' ? 10 : ex === 'miedo' ? 14 : ex === 'dormida' ? 8 + Math.sin(t * 1.2) * 4 : 0;
    // cuerpo: cosquillas = se retuerce; alas = da un saltito
    const retuerce = zona === 'cuerpo' ? Math.sin(f * 40) * 3 * k : 0;
    const saltito = zona === 'alas' ? Math.sin(Math.min(f * 2, 1) * Math.PI) * 26 : 0;
    todo.setAttribute('transform', `translate(${temblor} ${hundido - salto - saltito}) rotate(${Math.sin(t * 0.9) * 0.6 + retuerce} 512 1024)`);
    cuerpo.setAttribute('transform', `translate(512 1024) scale(1 ${respira}) translate(-512 -1024)`);

    // cabeza: mira al mouse, a veces echa un vistazo sola, asiente al hablar y cambia con cada cara
    if (ahora > proximoVistazo) { vistazo = Math.random() < 0.5 ? [0, 0] : [(Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.8]; proximoVistazo = ahora + 2500 + Math.random() * 3000; }
    const [mx, my] = [estado.mirar[0] * 0.7 + vistazo[0] * 0.3, estado.mirar[1] * 0.7 + vistazo[1] * 0.3];
    let giro = mx * 3 + Math.sin(t * 1.1) * 1.2, dx = mx * 7, dy = my * 4 + Math.sin(t * 2.1) * 1.5;
    if (ex === 'pensando') giro += 6;
    if (ex === 'timida') { giro -= 5; dy += 6; }
    if (ex === 'triste') { giro += 2; dy += 10; }
    if (ex === 'sorpresa') dy -= 8;
    if (ex === 'pena') { giro += 7; dy += 6; }  // ladea la cabeza con compasion
    if (ex === 'asco') { giro -= 7; dy -= 6; dx -= 10; }  // se echa para atras
    if (ex === 'miedo') { dy += 12; giro += Math.sin(t * 30) * 1.5; }
    if (ex === 'orgullosa') { giro -= 5; dy -= 10; }  // levanta la barbilla
    if (ex === 'risa') giro += Math.sin(t * 13) * 3;
    if (ex === 'celosa') { giro -= 9; dx -= 14; }  // voltea la cara, con puchero
    if (ex === 'dormida') { giro = 9 + Math.sin(t * 1.2) * 2; dx = 0; dy = 16 + Math.sin(t * 1.2) * 4; }  // cabecea
    if (ex === 'enojada') giro += Math.sin(t * 6) * 3;  // sacude la cabeza
    if (ex === 'guino' || ex === 'amor') giro += Math.sin(t * 3) * 4;
    dy += voz * 40 + (estado.hablando ? Math.sin(t * 9) * 1.5 : 0);  // asiente con la voz
    cab.giro += (giro - cab.giro) * 0.12;
    cab.x += (dx - cab.x) * 0.12;
    cab.y += (dy - cab.y) * 0.18;
    // cabeza tocada: se aplasta un poquito como un cojin y se mece contenta
    const aplasta = zona === 'cabeza' ? Math.sin(Math.min(f * 3, 1) * Math.PI) * 0.06 + Math.sin(f * 18) * 0.015 * k : 0;
    const mece = zona === 'cabeza' ? Math.sin(f * 12) * 6 * k : 0;
    cabeza.setAttribute('transform', `translate(${cab.x.toFixed(2)} ${cab.y.toFixed(2)}) rotate(${(cab.giro + mece).toFixed(2)} ${CUELLO[0]} ${CUELLO[1]})`
      + (aplasta ? ` translate(${CUELLO[0]} ${CUELLO[1]}) scale(${1 + aplasta * 0.5} ${1 - aplasta}) translate(${-CUELLO[0]} ${-CUELLO[1]})` : ''));

    // alas: mas grandes que en la imagen (asi asoman enteras detras del pelo) y aletean
    // doblandose desde el borde del pelo, sin despegarse
    const vel = { feliz: 9, amor: 8, sorpresa: 6, triste: 1.2, pena: 1.6, emocionada: 13, risa: 10, miedo: 16, orgullosa: 4, dormida: 0.8, celosa: 3 }[ex] || 2.4;
    const fuerza = ex === 'triste' || ex === 'pena' ? 0.4 : ex === 'miedo' ? 0.5 : 1;
    // alas tocadas: se esponjan y aletean rapidisimo
    const aleteo = zona === 'alas' ? Math.sin(t * 30) * (1 + 1.5 * k) : Math.sin(t * vel) * fuerza;
    alaIzq.setAttribute('transform', `translate(214 640) skewY(${aleteo * 7 + (ex === 'triste' || ex === 'pena' ? 6 : ex === 'miedo' ? -8 : 0)}) scale(${1.32 + aleteo * 0.07} 1.18) translate(-214 -640)`);
    alaDer.setAttribute('transform', `translate(810 640) skewY(${-aleteo * 7 - (ex === 'triste' || ex === 'pena' ? 6 : ex === 'miedo' ? -8 : 0)}) scale(${1.32 + aleteo * 0.07} 1.18) translate(-810 -640)`);

    // ojos
    if (ahora > proximoParpadeo) {
      estado.parpadeo = ahora + PARPADEO;
      proximoParpadeo = ahora + (Math.random() < 0.2 ? 380 : 2000 + Math.random() * 3000);  // a veces parpadea dos veces
    }
    let parpadeando = ahora < estado.parpadeo;
    const fase = parpadeando ? 1 - (estado.parpadeo - ahora) / PARPADEO : 0;
    // cierre: baja rapido, queda cerrado un instante y sube un poco mas lento
    let cierre = fase < 0.35 ? fase / 0.35 : fase < 0.5 ? 1 : 1 - (fase - 0.5) / 0.5;
    cierre = cierre * cierre * (3 - 2 * cierre);
    let medioCerrado = false;
    if (revisarOjos) { parpadeando = true; medioCerrado = revisarOjos === 'medio'; cierre = revisarOjos === 'cerrado' ? 1 : revisarOjos === 'medio' ? 0 : Number(revisarOjos) || 0; }  // ?ojos=medio|cerrado|0.5 para revisar
    const ojosFelices = ex === 'feliz' || ex === 'timida';
    ojos.forEach((o, i) => {
      const guino = ex === 'guino' && i === 1;
      mostrar(o.feliz, ojosFelices || guino);
      mostrar(o.enojo, (ex === 'enojada' || ex === 'celosa') && !parpadeando);
      mostrar(o.triste, (ex === 'triste' || ex === 'pena') && !parpadeando);
      mostrar(o.lagrima, ex === 'triste');
      mostrar(o.amor, ex === 'amor');
      mostrar(o.risa, ex === 'risa');
      mostrar(o.emocion, ex === 'emocionada');
      mostrar(o.plano, (ex === 'asco' || ex === 'orgullosa') && !parpadeando);
      mostrar(o.miedo, ex === 'miedo');
      const especial = ['amor', 'risa', 'emocionada', 'miedo'].includes(ex);
      const duerme = ex === 'dormida';
      const puede = !ojosFelices && !guino && !especial;
      const normales = puede && !duerme && !['enojada', 'triste', 'pena', 'asco', 'orgullosa', 'celosa'].includes(ex);
      mostrar(o.cerrado, duerme || (parpadeando && !medioCerrado && puede && cierre > 0.92));
      const bajando = parpadeando && !medioCerrado && normales && cierre > 0.02 && cierre <= 0.92;
      mostrar(o.baja, bajando);
      if (bajando) {
        const yb = 372 + cierre * 82, panza = 10 + cierre * 22;  // borde del parpado, se curva mas al cerrar
        o.curvaB.setAttribute('d', `M ${o.x - 120} 340 L ${o.x + 120} 340 L ${o.x + 120} ${yb} Q ${o.x} ${yb + panza * 2} ${o.x - 120} ${yb} Z`);
        const g = 6 + cierre * 8;  // pestana gruesa en el borde
        o.bordeB.setAttribute('d', `M ${o.x - 86} ${yb + 4} Q ${o.x} ${yb + panza * 2 + g * 0.2} ${o.x + 86} ${yb + 4} Q ${o.x} ${yb + panza * 2 - g * 1.6} ${o.x - 86} ${yb + 4} Z`);
      }
      mostrar(o.medio, medioCerrado && normales);
      if (ex === 'triste') o.lagrima.setAttribute('transform', `translate(0 ${((t * 60 + i * 30) % 70).toFixed(1)})`);
      if (ex === 'risa') o.lagrimaRisa.setAttribute('transform', `translate(0 ${(Math.abs(Math.sin(t * 6 + i)) * 8).toFixed(1)})`);
      if (ex === 'emocionada') o.emocion.setAttribute('transform', `translate(${o.x} 450) rotate(${Math.sin(t * 5) * 10}) scale(${1 + Math.sin(t * 9) * 0.1}) translate(${-o.x} -450)`);
      if (ex === 'miedo') o.pupila.setAttribute('transform', `translate(${(Math.sin(t * 47 + i) * 3).toFixed(1)} ${(Math.cos(t * 39) * 2).toFixed(1)})`);
      if (ex === 'amor') o.amor.setAttribute('transform', `translate(${o.x} 450) scale(${1 + Math.sin(t * 8) * 0.08}) translate(${-o.x} -450)`);
    });

    // boca: con voz real se abre segun el volumen
    if (estado.hablando) {
      // sin medida de volumen (voz de Windows) se inventa una apertura que cambia sola
      if (estado.nivel < 0 && ahora > mov.hasta) { mov.metaFalsa = Math.random() < 0.2 ? 0 : 0.04 + Math.random() * 0.16; mov.hasta = ahora + 80 + Math.random() * 90; }
      const n = estado.nivel >= 0 ? estado.nivel : mov.metaFalsa;
      const meta = n < 0.015 ? 0 : Math.min(40, 6 + n * 190);
      mov.alto += (meta - mov.alto) * (meta > mov.alto ? 0.55 : 0.3);  // abre rapido, cierra mas lento
      const metaAncho = 15 + Math.min(14, n * 60) + Math.sin(t * 5.3) * 3;  // a veces mas redonda, a veces mas ancha
      mov.ancho += (metaAncho - mov.ancho) * 0.25;
      if (mov.alto < 3) ponerBoca('sonrisa');
      else { abrirBoca(mov.alto, mov.ancho); ponerBoca('habla'); }
    } else {
      mov.alto = 0;
      ponerBoca({ feliz: 'grande', sorpresa: 'o', enojada: 'puchero', pensando: 'onda', triste: 'triste', timida: 'onda', guino: 'gato', amor: 'gato',
        risa: 'risa', emocionada: 'grande', pena: 'triste', miedo: 'miedo', asco: 'asco', orgullosa: 'lado', celosa: 'puchero',
        dormida: 'o', contenta: 'gato' }[ex] || 'sonrisa');
    }

    mostrar(rubor, ['feliz', 'timida', 'amor', 'guino', 'risa', 'emocionada', 'orgullosa', 'celosa', 'contenta'].includes(ex));
    rubor.style.opacity = ex === 'timida' ? 0.9 + Math.sin(t * 4) * 0.1 : 0.6;
    // al acariciarle la cabeza se pone muy roja (crece el sonrojo) y le salen destellos
    const rojo = zona === 'cabeza' ? Math.min(1, k * 2.5) : 0;
    if (rojo) { mostrar(rubor, true); rubor.style.opacity = 0.6 + rojo * 0.4; }
    rubor.setAttribute('transform', rojo ? `translate(518 540) scale(${1 + rojo * 0.35} ${1 + rojo * 0.5}) translate(-518 -540)` : '');
    mostrar(sim.brillos, ex === 'feliz');
    sim.brillos.style.opacity = 0.6 + Math.sin(t * 6) * 0.4;
    mostrar(sim.exclama, ex === 'sorpresa');
    mostrar(sim.pregunta, ex === 'pensando');
    mostrar(sim.gota, ['pensando', 'timida', 'miedo', 'pena'].includes(ex));
    mostrar(sim.vena, ex === 'enojada');
    mostrar(sim.corazones, ex === 'amor' || zona === 'cabeza');
    mostrar(sim.estrella, ex === 'guino');
    mostrar(sim.penumbra, ex === 'triste' || ex === 'miedo');
    mostrar(sim.asco, ex === 'asco');
    mostrar(sim.destellos, ex === 'emocionada');
    mostrar(sim.susto, ex === 'miedo');
    mostrar(sim.nota, ex === 'orgullosa');
    mostrar(sim.zzz, ex === 'dormida');
    if (ex === 'dormida') zetas.forEach((z) => { const f = (t * 0.5 + z.i * 0.33) % 1; z.g.setAttribute('transform', `translate(${f * 30} ${-f * 60})`); z.g.style.opacity = Math.sin(f * Math.PI); });
    sim.destellos.style.opacity = 0.5 + Math.sin(t * 8) * 0.5;
    sim.asco.setAttribute('transform', `translate(0 ${(-((t * 20) % 20)).toFixed(1)})`);
    sim.nota.setAttribute('transform', `translate(0 ${(Math.sin(t * 3) * 10).toFixed(1)}) rotate(${Math.sin(t * 3) * 8} 880 260)`);
    sim.susto.style.opacity = 0.6 + Math.sin(t * 20) * 0.4;
    mostrar(sim.vapor, ex === 'timida' || ex === 'celosa');
    vena.setAttribute('transform', `translate(445 161) scale(${1 + Math.sin(t * 9) * 0.08}) translate(-445 -161)`);
    preg.setAttribute('transform', `rotate(${Math.sin(t * 3) * 6} 460 150)`);
    corazones.forEach((c, i) => c.g.setAttribute('transform', `translate(0 ${(-((t * 40 + i * 25) % 60)).toFixed(1)})`));
    sim.estrella.setAttribute('transform', `rotate(${(t * 90) % 360} 790 380)`);
    sim.penumbra.style.opacity = 0.5 + Math.sin(t * 2) * 0.2;
  }
  requestAnimationFrame(cuadro);

  // lentes de corazon rosados: se los pone en «modo nerd» («cuéntame más»)
  const corazonLente = (cx, cy, r) => `M ${cx} ${cy + r} C ${cx - r * 1.6} ${cy + r * 0.1}, ${cx - r * 1.25} ${cy - r * 1.05}, ${cx} ${cy - r * 0.45} `
    + `C ${cx + r * 1.25} ${cy - r * 1.05}, ${cx + r * 1.6} ${cy + r * 0.1}, ${cx} ${cy + r} Z`;
  const lentes = grupo(cabeza, { class: 'lentes' });
  lentes.style.opacity = 0;
  lentes.style.transition = 'opacity .35s ease';
  for (const cx of [388, 653]) {
    camino(lentes, corazonLente(cx, 470, 112), { fill: 'rgba(255,120,160,.18)', stroke: '#e83f7a', 'stroke-width': 12, 'stroke-linejoin': 'round' });
    camino(lentes, `M ${cx - 112 * 0.6} 470 l ${112 * 0.27} ${-112 * 0.2}`, { fill: 'none', stroke: '#fff', 'stroke-width': 10.2, 'stroke-linecap': 'round', opacity: 0.7 });
  }
  camino(lentes, 'M 500 430 Q 520 412 541 430', { fill: 'none', stroke: '#e83f7a', 'stroke-width': 10.2 });
  camino(lentes, 'M 268 430 L 228 410 M 773 430 L 812 410', { fill: 'none', stroke: '#e83f7a', 'stroke-width': 9.0, 'stroke-linecap': 'round' });

  // ropa del dia (codigo/ropa.js): el vestido pintado encima del cuerpo, su copia en la cabeza (zona del cuello)
  // y el adorno sobre el pelo, todos debajo de la ropa de ocasion
  const dia = { cuerpo: grupo(cuerpo, { class: 'ropa-dia' }), cuello: el('g', { class: 'ropa-dia' }), adorno: el('g', { class: 'ropa-dia' }) };
  cabeza.insertBefore(dia.cuello, cara);
  cabeza.insertBefore(dia.adorno, cara);
  // ropa segun la ocasion (codigo/ropa.js): cuerpo debajo de la cabeza, cabeza encima del pelo, extra alrededor
  const ropa = { cuerpo: grupo(cuerpo, { class: 'ropa' }), cabeza: grupo(cabeza, { class: 'ropa' }), extra: grupo(todo, { class: 'ropa' }) };

  window.FiloIlustracion = {
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
      window.FiloRopa.vestir(ropa, nombre, { conCapas: true });
      const tapa = window.FiloRopa.tapa(nombre);
      mostrar(dia.adorno, !tapa.cabeza);
      mostrar(dia.cuello, !tapa.cuerpo);
    },
    ropaDia(receta) { if (window.FiloRopa) window.FiloRopa.vestirDia(dia, receta); },
  };
})();
