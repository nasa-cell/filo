// Ropero de Filo: la ropa que se pone segun lo que hace (dibujar, musica, buscar, dormir, comida)
// y en fechas especiales. Cada pieza tiene lo que va en la cabeza, en el cuerpo y alrededor (extra).
// Las medidas son las de la ilustracion (1024 x 1024): pelo arriba y=84, lados del pelo x 210-802,
// ojos y=450, pecho y 680-1024. La Filo 3D arma su ropa con piezas 3D (ver tres/filo-3d.js).
(function () {
  const nota = (x, y, c) => `<g class="ropa-nota" fill="${c}"><ellipse cx="${x}" cy="${y}" rx="16" ry="12" transform="rotate(-20 ${x} ${y})"/>`
    + `<rect x="${x + 11}" y="${y - 62}" width="7" height="62"/><path d="M ${x + 18} ${y - 62} q 26 10 22 34 q -8 -18 -22 -18 z"/></g>`;
  const estrella = (x, y, r, c) => `<path d="M ${x} ${y - r} L ${x + r * 0.3} ${y - r * 0.3} L ${x + r} ${y} L ${x + r * 0.3} ${y + r * 0.3} `
    + `L ${x} ${y + r} L ${x - r * 0.3} ${y + r * 0.3} L ${x - r} ${y} L ${x - r * 0.3} ${y - r * 0.3} Z" fill="${c}"/>`;
  const boina = (relleno, borde) => `
    <path d="M 300 205 C 260 120, 420 50, 560 62 C 720 72, 800 150, 760 205 C 700 235, 380 240, 300 205 Z" fill="${relleno}" stroke="${borde}" stroke-width="10" stroke-linejoin="round" transform="rotate(-8 530 150)"/>
    <path d="M 540 66 l 6 -34" stroke="${borde}" stroke-width="12" stroke-linecap="round" transform="rotate(-8 530 150)"/>`;

  window.FiloRopa = {
    // escuchando musica o un video
    audifonos: {
      cabeza: `
        <path d="M 232 470 C 215 170, 809 170, 792 470" fill="none" stroke="#ff8fb3" stroke-width="34" stroke-linecap="round"/>
        <path d="M 232 470 C 215 170, 809 170, 792 470" fill="none" stroke="#fff" stroke-width="8" opacity=".5"/>
        <path d="M 330 215 L 352 120 L 420 182 Z M 694 215 L 672 120 L 604 182 Z" fill="#ff8fb3" stroke="#e8507f" stroke-width="8" stroke-linejoin="round"/>
        <path d="M 352 150 L 365 120 M 672 150 L 659 120" stroke="#ffd1e0" stroke-width="10" stroke-linecap="round"/>
        <g fill="#ff8fb3" stroke="#e8507f" stroke-width="8"><ellipse cx="222" cy="490" rx="52" ry="82"/><ellipse cx="802" cy="490" rx="52" ry="82"/></g>
        <g fill="#fff"><ellipse cx="222" cy="490" rx="26" ry="46"/><ellipse cx="802" cy="490" rx="26" ry="46"/></g>`,
      extra: nota(880, 300, '#ff6f9f') + nota(120, 260, '#9fc2ff'),
    },
    // dibujando: boina azul y bata con manchas de pintura
    pintora: {
      cabeza: boina('#2557d6', '#0b1f5c'),
      cuerpo: `
        <path d="M 360 760 L 664 760 L 700 1024 L 324 1024 Z" fill="#fffdf6" stroke="#c9b48a" stroke-width="8" stroke-linejoin="round"/>
        <path d="M 360 760 L 330 690 M 664 760 L 694 690" stroke="#c9b48a" stroke-width="10" stroke-linecap="round"/>
        <rect x="440" y="860" width="144" height="80" rx="10" fill="none" stroke="#c9b48a" stroke-width="6"/>
        <circle cx="400" cy="820" r="18" fill="#e83f5b"/><circle cx="620" cy="880" r="14" fill="#2557d6"/><circle cx="470" cy="980" r="16" fill="#f2b705"/><circle cx="600" cy="800" r="10" fill="#34b26b"/>`,
    },
    // de vez en cuando, por su personalidad: gorro de pollito (como su forma de filolial)
    pollito: {
      cabeza: `
        <path d="M 218 330 C 200 70, 824 70, 806 330 C 760 230, 264 230, 218 330 Z" fill="#fff" stroke="#d9c7d0" stroke-width="10" stroke-linejoin="round"/>
        <path d="M 490 92 C 470 30, 520 10, 540 50 C 555 20, 600 40, 575 95" fill="#fff" stroke="#d9c7d0" stroke-width="8"/>
        <circle cx="400" cy="190" r="14" fill="#151a4f"/><circle cx="624" cy="190" r="14" fill="#151a4f"/>
        <path d="M 490 215 L 534 215 L 512 248 Z" fill="#ff9a3c" stroke="#d06b10" stroke-width="6" stroke-linejoin="round"/>
        <ellipse cx="360" cy="225" rx="26" ry="12" fill="#ffb3c7" opacity=".8"/><ellipse cx="664" cy="225" rx="26" ry="12" fill="#ffb3c7" opacity=".8"/>`,
    },
    // dormida: gorro de dormir azul con estrellas y pijama celeste a rayas
    pijama: {
      cabeza: `
        <path d="M 225 300 C 215 100, 620 40, 760 150 C 830 210, 880 330, 900 470 C 860 330, 800 260, 800 300 C 700 240, 330 240, 225 300 Z" fill="#2c4fb8" stroke="#13307a" stroke-width="10" stroke-linejoin="round"/>
        <rect x="210" y="262" width="604" height="62" rx="30" fill="#fff" stroke="#c7d3f0" stroke-width="8"/>
        <circle cx="905" cy="490" r="40" fill="#fff" stroke="#c7d3f0" stroke-width="8"/>
        ${estrella(400, 170, 22, '#ffe27a')}${estrella(560, 120, 16, '#ffe27a')}${estrella(690, 200, 20, '#ffe27a')}`,
      cuerpo: `
        <path d="M 330 700 L 470 760 L 512 720 L 554 760 L 694 700 L 720 1024 L 304 1024 Z" fill="#9fc2ff" stroke="#5b7fd6" stroke-width="8" stroke-linejoin="round"/>
        <g stroke="#fff" stroke-width="16" opacity=".7"><path d="M 330 820 L 694 820 M 320 900 L 704 900 M 315 980 L 710 980"/></g>
        <circle cx="512" cy="800" r="9" fill="#fff"/><circle cx="512" cy="860" r="9" fill="#fff"/><circle cx="512" cy="920" r="9" fill="#fff"/>`,
    },
    // buscando en internet: sombrero de detective y lupa
    detective: {
      cabeza: `
        <path d="M 250 260 C 240 110, 784 110, 774 260 Z" fill="#a0784a" stroke="#6b4b26" stroke-width="10" stroke-linejoin="round"/>
        <path d="M 200 270 C 300 230, 724 230, 824 270 C 760 300, 264 300, 200 270 Z" fill="#8a6338" stroke="#6b4b26" stroke-width="8"/>
        <path d="M 500 115 C 470 60, 560 60, 524 115" fill="none" stroke="#6b4b26" stroke-width="10"/>
        <rect x="250" y="225" width="524" height="26" fill="#3d2a14"/>`,
      extra: `<g class="ropa-flota" transform="translate(860 720) rotate(25)"><circle r="70" fill="rgba(200,230,255,.35)" stroke="#6b4b26" stroke-width="16"/>
        <rect x="-12" y="70" width="24" height="120" rx="10" fill="#6b4b26"/><path d="M -35 -25 q 15 -20 40 -18" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round"/></g>`,
    },
    // hablando de comida o carne: gorro de chef y babero
    chef: {
      cabeza: `
        <rect x="320" y="200" width="384" height="90" rx="12" fill="#fff" stroke="#c9ccd8" stroke-width="8"/>
        <path d="M 320 210 C 220 180, 250 40, 360 70 C 380 -10, 500 -20, 520 50 C 560 -10, 680 0, 670 70 C 790 50, 810 190, 704 210 Z" fill="#fff" stroke="#c9ccd8" stroke-width="8" stroke-linejoin="round"/>`,
      cuerpo: `<path d="M 400 740 Q 512 800 624 740 L 650 900 Q 512 960 374 900 Z" fill="#fff" stroke="#c9ccd8" stroke-width="8"/>
        <path d="M 470 830 l 30 30 m 0 -30 l -30 30 M 540 830 l 30 30 m 0 -30 l -30 30" stroke="#e83f5b" stroke-width="8" stroke-linecap="round"/>`,
    },
    // fechas especiales
    bruja: {
      cabeza: `
        <path d="M 180 280 C 300 230, 724 230, 844 280 C 760 320, 264 320, 180 280 Z" fill="#3a1f5e" stroke="#1e0f33" stroke-width="10"/>
        <path d="M 340 262 C 400 160, 480 60, 640 -20 C 600 60, 640 160, 690 262 Z" fill="#3a1f5e" stroke="#1e0f33" stroke-width="10" stroke-linejoin="round"/>
        <rect x="345" y="225" width="340" height="34" fill="#ff9a3c"/>${estrella(470, 170, 18, '#ffe27a')}`,
      extra: `<g class="ropa-flota" transform="translate(870 760)"><ellipse rx="70" ry="60" fill="#ff8c1a" stroke="#b35a00" stroke-width="8"/>
        <path d="M -30 -10 l 15 -12 l 15 12 Z M 15 -10 l 15 -12 l 15 12 Z M -35 20 q 35 25 70 0" fill="#3d1a00"/><path d="M 0 -60 q 6 -20 20 -24" stroke="#3a7d2c" stroke-width="10" fill="none"/></g>`,
    },
    navidad: {
      cabeza: `
        <path d="M 232 285 C 260 120, 600 60, 780 160 C 860 210, 900 330, 880 430 C 830 330, 780 280, 792 285 Z" fill="#e8243f" stroke="#a81d38" stroke-width="10" stroke-linejoin="round"/>
        <rect x="210" y="255" width="604" height="70" rx="34" fill="#fff" stroke="#e3e3e3" stroke-width="8"/>
        <circle cx="878" cy="450" r="44" fill="#fff" stroke="#e3e3e3" stroke-width="8"/>`,
    },
    fiesta: {
      cabeza: `<g transform="rotate(12 540 120)"><path d="M 430 170 L 560 -40 L 650 160 Z" fill="#ff8fb3" stroke="#e8507f" stroke-width="10" stroke-linejoin="round"/>
        <circle cx="500" cy="110" r="12" fill="#f2b705"/><circle cx="580" cy="60" r="12" fill="#2557d6"/><circle cx="600" cy="130" r="12" fill="#fff"/>
        <circle cx="560" cy="-44" r="26" fill="#f2b705" stroke="#b58500" stroke-width="6"/></g>`,
      extra: [[120, 200, '#ff8fb3'], [900, 180, '#f2b705'], [150, 420, '#2557d6'], [920, 400, '#34b26b'], [880, 620, '#ff8fb3'], [130, 640, '#f2b705']]
        .map(([x, y, c]) => `<rect class="ropa-nota" x="${x}" y="${y}" width="22" height="12" fill="${c}" transform="rotate(${x % 60} ${x} ${y})"/>`).join(''),
    },
  };

  // capas pintadas sobre la ilustracion (imagenes/ropa): se ven como parte del dibujo, no pegadas encima.
  // Las hace D:/herramientas/compilacion/filo-ropa/generar_ropa.py a partir de las piezas de arriba.
  // [x, y, ancho, alto] de cada capa recortada (las imagenes chicas gastan menos memoria en el celular)
  const CAPAS = {
    'audifonos-cabeza': [164, 98, 696, 521],
    'bruja-cabeza': [173, 0, 678, 358],
    'chef-cabeza': [253, 0, 527, 337],
    'chef-cuerpo': [326, 759, 373, 265],
    'detective-cabeza': [194, 66, 636, 274],
    'fiesta-cabeza': [394, 0, 274, 230],
    'navidad-cabeza': [204, 85, 724, 415],
    'pijama-cabeza': [204, 82, 747, 618],
    'pijama-cuerpo': [259, 689, 512, 335],
    'pintora-cabeza': [271, 23, 508, 677],
    'pintora-cuerpo': [259, 689, 512, 335],
    'pollito-cabeza': [210, 23, 604, 355],
  };
  const capa = (nombre, parte) => {
    const [x, y, w, h] = CAPAS[`${nombre}-${parte}`];
    return `<image href="imagenes/ropa/${nombre}-${parte}.webp" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
  };

  // pone una pieza en los tres grupos (cabeza, cuerpo y alrededor); null la quita.
  // conCapas: usa las capas pintadas (ilustracion). ajuste: transform para achicarla (dibujo).
  window.FiloRopa.vestir = function (grupos, nombre, { conCapas = false, conCuerpo = true, ajuste = '' } = {}) {
    const pieza = nombre ? window.FiloRopa[nombre] : null;
    const capas = conCapas && pieza ? ['cabeza', 'cuerpo'].filter((p) => CAPAS[`${nombre}-${p}`]) : [];
    const contenido = {
      cabeza: !pieza ? '' : capas.includes('cabeza') ? capa(nombre, 'cabeza') : pieza.cabeza || '',
      cuerpo: !pieza || !conCuerpo ? '' : capas.includes('cuerpo') ? capa(nombre, 'cuerpo') : pieza.cuerpo || '',
      extra: pieza ? pieza.extra || '' : '',
    };
    for (const [parte, g] of Object.entries(grupos)) {
      // el ajuste va en un grupo de adentro: la animacion de entrada mueve el de afuera sin desarmar la escala
      g.innerHTML = contenido[parte] && ajuste ? `<g transform="${ajuste}">${contenido[parte]}</g>` : contenido[parte];
      g.classList.remove('ropa-entra');
      if (contenido[parte]) { g.getBoundingClientRect(); g.classList.add('ropa-entra'); }  // reinicia la animacion de entrada
    }
  };

  // ---------- ropa del dia (atuendos.json o los que crea Filo; los pinta el servidor) ----------
  // receta.capas = { cuerpo: { url, caja: [x, y, ancho, alto] }, cabeza: {...} }; receta.dibujo = colores para la vista Dibujo.
  // grupos: { cuerpo, cuello, adorno } (ilustracion) o { adorno } (dibujo). El vestido va en «cuerpo» y una copia en
  // «cuello» (la parte que la cabeza tapa al moverse); el adorno del pelo en «adorno».
  const imagenCapa = (c, extra = '') => (c ? `<image href="${c.url}" x="${c.caja[0]}" y="${c.caja[1]}" width="${c.caja[2]}" height="${c.caja[3]}"${extra}/>` : '');
  window.FiloRopa.vestirDia = function (grupos, receta, { ajuste = '', raiz = null } = {}) {
    const capas = (receta && receta.capas) || {};
    if (grupos.cuerpo) grupos.cuerpo.innerHTML = imagenCapa(capas.cuerpo, ' mask="url(#m-cuerpo)"');
    if (grupos.cuello) grupos.cuello.innerHTML = imagenCapa(capas.cuerpo, ' mask="url(#m-cabeza)"');
    if (grupos.adorno) {
      const img = imagenCapa(capas.cabeza);
      grupos.adorno.innerHTML = img && ajuste ? `<g transform="${ajuste}">${img}</g>` : img;
    }
    if (raiz) {  // vista Dibujo: su vestido toma los colores del atuendo
      const d = receta && receta.dibujo;
      if (d) {
        raiz.style.setProperty('--vestido', d.vestido);
        raiz.style.setProperty('--vestido-osc', d.vestido_osc);
        raiz.style.setProperty('--cinta', d.cinta);
      } else ['--vestido', '--vestido-osc', '--cinta'].forEach((v) => raiz.style.removeProperty(v));
    }
  };
  // con un gorro de ocasion (pintora, chef, bruja...) el adorno del dia se esconde; con ropa de cuerpo, el cuello tambien
  window.FiloRopa.tapa = function (nombre) {
    const p = nombre ? window.FiloRopa[nombre] : null;
    return { cabeza: !!(p && p.cabeza), cuerpo: !!(p && (p.cuerpo || CAPAS[`${nombre}-cuerpo`])) };
  };

  // se cargan antes para que la ropa aparezca al instante
  for (const n of Object.keys(CAPAS)) { const i = new Image(); i.src = `imagenes/ropa/${n}.webp`; }
})();
