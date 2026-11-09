// Celular: reparte la pantalla para que Filo se vea ENTERA siempre (2D y 3D) y nada la tape.
// Lo que Filo muestra (video, dibujo, análisis, cámara) va arriba a la izquierda; Filo va en el lugar libre más
// grande: al costado de eso o debajo. Se mide en cada celular (no hay tamaños fijos), así todos se ven igual.
(function () {
  const $ = (id) => document.getElementById(id);
  const HUECO = 8;
  const FILA = 52;  // fila de avisos debajo de los botones de arriba («Pensando…», la ropa, la nube): nunca tapan nada
  // la figura de Filo dentro del dibujo (en unidades del svg: viewBox -70 0 1164 1024)
  // x0/x1 incluyen las alas abiertas (aletean más allá del cuerpo): así nunca se cortan en los costados
  const FIG = { x0: -50, x1: 1080, y0: 80, y1: 1000, vbx: -70, vbw: 1164, vbh: 1024 };
  const celular = () => innerWidth <= 700;
  const visible = (e) => e && !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
  const caja = (e) => e.getBoundingClientRect();

  const estilo = document.createElement('style');
  estilo.id = 'distribucion-css';
  estilo.textContent = `
  /* avisos: si el lugar es angosto, el texto baja de renglón (antes se cortaba) */
  .estado { white-space: normal !important; text-wrap: balance; text-align: center; }
  @media (min-width: 701px) {
    /* PC: el video y los cuadros aprovechan el ancho libre */
    .tele { width: clamp(300px, 42vw, 820px); }
    .escenario:has(> .camara:not([hidden])) .tele, .escenario:has(> .lado:not([hidden])):has(> .camara:not([hidden])) .tele { width: clamp(300px, 40vw, 780px); }
    .escenario > .lado .resultados, .escenario > .lado .libreta { width: clamp(320px, 34vw, 560px); font-size: 15px; line-height: 1.5; }
    .escenario > .lado .resultados li { margin-bottom: 6px; }
    .escenario:has(> .lado:not([hidden])) > .camara:not([hidden]) { top: var(--cam-top, 104px) !important; }
    html.cam-derecha .escenario:has(> .lado:not([hidden])) > .camara:not([hidden]) { left: auto !important; right: 3vw !important; }
    html.aviso-chico .estado { font-size: 13px !important; padding: 5px 12px !important; }
    /* PC: el aviso («Buscando…», «Analizando…») va arriba al centro, entre los botones: no tapa a Filo ni al álbum */
    html.aviso-arriba .estado { position: fixed !important; top: var(--pc-aviso-top) !important; left: var(--pc-aviso-x) !important; transform: translateX(-50%) !important;
      margin: 0 !important; max-width: var(--pc-aviso-ancho) !important; width: max-content !important; z-index: 8; }
  }
  @media (max-width: 700px) {
    html.repartir #ilustracion { position: fixed !important; margin: 0 !important; max-width: none !important; max-height: none !important;
      transform: none !important; z-index: 1; transition: left .35s ease, top .35s ease, width .35s ease, height .35s ease; }
    html.repartir #filo { position: fixed !important; margin: 0 !important; z-index: 1; transition: left .35s ease, top .35s ease, width .35s ease, height .35s ease; }
    html.repartir .escenario > .lado:not([hidden]) { width: 54%; z-index: 4; }
    html.repartir .escenario > .lado[data-tipo="video"]:not([hidden]) { width: 56%; }
    html.repartir .escenario > .lado[data-tipo="dibujo"]:not([hidden]) { width: 48%; }
    html.repartir .escenario > .camara:not([hidden]) { width: 30vw; }
    html.repartir .escenario > .lado .resultados, html.repartir .escenario > .lado .libreta { max-height: var(--alto-cuadro, 46vh) !important; }
    html.repartir .escenario > .lado .libreta { width: 100%; }
    html.repartir #filo[data-angosta] .tres-botones { grid-auto-flow: row; gap: 8px; right: 2px; bottom: 6px; }
    html.repartir #filo[data-angosta] .tres-botones button { width: 34px; height: 34px; font-size: 15px; }
    html.repartir .lado[data-tipo="dibujo"] .polaroid { width: min(44vw, var(--ancho-foto, 44vw)); }
    html.repartir .nerd-titulo { font-size: 13px; line-height: 1.25; min-height: 0; padding-top: 6px; padding-bottom: 6px; }
    html.repartir .nerd .resultados-botones { padding: 6px 8px 8px; }
    html.repartir .nerd .resultados-botones .mq-btn { padding: 6px 12px; font-size: 13px; }
    /* fila de avisos: siempre en el mismo lugar, a lo ancho, debajo de los botones de arriba */
    html.repartir .escenario { padding-top: var(--fila-aviso, 52px) !important; }
    html.repartir .estado, html.repartir .nube-pensar { position: fixed !important; top: var(--aviso-top, 100px) !important; left: 50% !important;
      transform: translateX(-50%) !important; margin: 0 !important; max-width: calc(100vw - 16px) !important; width: max-content !important;
      white-space: normal !important; text-align: center; z-index: 8; }
    html.repartir .aviso-ropa { position: fixed !important; top: var(--aviso-top, 100px) !important; left: 8px !important; margin: 0 !important; z-index: 8; }
    /* textos con aire: líneas y párrafos separados */
    html.repartir .lado .resultados { font-size: 14px; line-height: 1.5; }
    html.repartir .lado .resultados li { margin: 0 0 6px; }
    html.repartir .lado .resultados p { margin: 0 0 8px; }
    html.repartir .burbuja-video { line-height: 1.4; padding: 10px 14px; }
    html.repartir .estado { line-height: 1.25; font-size: 13px; padding: 7px 12px; }
    html.repartir .lado .resultados-titulo { display: block; font-size: 15px; line-height: 1.3; padding-right: 40px; }
    html.repartir .lado .resultados-leidas { display: block; margin: 4px 0 0; }
    html.repartir .lado .resultado strong { font-size: 14px; line-height: 1.3; }
    html.repartir .lado .resultado span { font-size: 13px; line-height: 1.4; }
    /* con algo abierto, el álbum sube a la fila de YouTube/Buscar, a la derecha (no quita lugar a Filo ni al texto) */
    html.repartir .escenario:has(> .lado:not([hidden])) > .album, html.repartir .escenario:has(> .camara:not([hidden])) > .album {
      position: fixed !important; top: var(--album-top, 60px) !important; bottom: auto !important; left: var(--album-izq, auto) !important; right: auto !important;
      width: var(--album-lado, 40px) !important; height: var(--album-lado, 40px) !important; padding: 3px !important; z-index: 9; }
  }`;
  document.head.appendChild(estilo);

  // mejor caja para una figura de proporción a (ancho/alto) dentro de una región: tamaño y escala
  function encajar(reg, ancho, alto) {
    const w = reg.r - reg.l, h = reg.b - reg.t;
    if (w <= 40 || h <= 40) return null;
    const s = Math.min(w / ancho, h / alto);
    return { s, reg };
  }

  function repartir() {
    const html = document.documentElement;
    const b = document.body.classList;
    if (!celular()) {
      // PC: la cámara flotante va debajo del álbum (antes se pisaban)
      const al = $('album');
      if (visible(al)) html.style.setProperty('--cam-top', Math.round(caja(al).bottom + 18) + 'px'); else html.style.removeProperty('--cam-top');
      // pantalla parada (tablet): la cámara va arriba a la derecha, sobre la ventana, si ahí entra (no tapa a Filo)
      const cm = $('camara'), ldo = $('lado');
      if (innerHeight > innerWidth && visible(cm) && visible(ldo)) {
        const yaDer = html.classList.contains('cam-derecha'), c = caja(cm), v = caja(ldo);
        const entra = (yaDer ? c.bottom : (caja(al || cm).bottom + 18 + c.height)) + 10 <= v.top;
        html.classList.toggle('cam-derecha', entra);
      } else html.classList.remove('cam-derecha');
      // hueco de arriba entre «Ver: …» y los botones de modo; si es angosto (tablet), debajo de la barra de arriba
      const grupo = document.querySelector('.arriba .estilos'), yt = $('b-youtube');
      if (grupo && yt) {
        const g = caja(grupo), y = caja(yt), libre = y.left - g.right - 32;
        const mismaFila = Math.abs(g.top - y.top) < 10 && libre >= 230;
        html.classList.toggle('aviso-chico', mismaFila && libre < 330);
        const ar = caja(document.querySelector('.arriba'));
        html.style.setProperty('--pc-aviso-top', Math.round(mismaFila ? g.top - 2 : ar.bottom + 6) + 'px');
        // debajo de la barra: sobre la columna de Filo, sin pasar a la ventana de la derecha
        const ld = $('lado'), tope = visible(ld) ? caja(ld).left - 16 : innerWidth - 8;
        const izq = 90;  // a la derecha del álbum
        html.style.setProperty('--pc-aviso-x', Math.round(mismaFila ? (g.right + y.left) / 2 : (izq + tope) / 2) + 'px');
        html.style.setProperty('--pc-aviso-ancho', Math.round(mismaFila ? libre : Math.min(560, tope - izq)) + 'px');
        html.classList.add('aviso-arriba');
      }
    } else document.documentElement.classList.remove('aviso-arriba');
    if (!celular() || window.__sinRepartir || b.contains('ver-ambas') || b.contains('video-grande')) { html.classList.remove('repartir'); limpiar(); return; }
    if (!html.classList.contains('repartir')) { html.classList.add('repartir'); window.FiloTres && FiloTres.motor && FiloTres.motor() && FiloTres.motor().correr(0); }
    const esc = document.querySelector('.escenario'), barra = $('charla'), arriba = document.querySelector('.arriba');
    if (!esc || !barra) return;
    const lado = $('lado'), cam = $('camara'), globo = $('burbuja-video'), aviso = $('estado');
    // fila de avisos: alto según lo que se vea ahí (mínimo FILA, así no salta con cada «Pensando…»)
    const avisoTop = caja(arriba).bottom + 4;
    html.style.setProperty('--aviso-top', Math.round(avisoTop) + 'px');
    const enFila = [aviso, $('nube-pensar'), $('aviso-ropa')].filter(visible).map((e) => caja(e).height + 10);
    const fila = Math.max(FILA, ...enFila);
    esc.style.setProperty('--fila-aviso', Math.round(fila) + 'px');
    // álbum (con algo abierto): en la fila de YouTube/Buscar, después del último botón; si no entra, arriba de Filo
    const bb = $('b-busqueda');
    let albumArriba = 0;
    const album = $('album'), conAbierto = visible(lado) || visible(cam);
    if (bb && album) {
      const q = caja(bb), lado2 = Math.round(Math.min(40, Math.max(32, q.height)));
      const fin2 = Math.max(...[...bb.parentElement.children].filter(visible).map((e) => caja(e).right));
      html.style.setProperty('--album-lado', lado2 + 'px');
      if (fin2 + 10 + lado2 + 12 <= innerWidth) {
        html.style.setProperty('--album-top', Math.round(q.top + (q.height - lado2) / 2) + 'px');
        html.style.setProperty('--album-izq', Math.round(innerWidth - lado2 - 14) + 'px');
      } else albumArriba = conAbierto && visible(album) ? lado2 + 14 : 0;
    }
    const top0 = caja(arriba).bottom + fila, fin = caja(barra).top - HUECO;
    if (albumArriba) { html.style.setProperty('--album-top', Math.round(top0) + 'px'); html.style.setProperty('--album-izq', Math.round(innerWidth - albumArriba) + 'px'); }
    const L = HUECO, R = innerWidth - HUECO;

    const ver3d = visible($('filo')) && !visible($('ilustracion'));
    const fig = ver3d ? { w: 0.62, h: 1 } : { w: (FIG.x1 - FIG.x0) / (FIG.y1 - FIG.y0), h: 1 };
    let modo = null;  // 'costado' o 'debajo' cuando hay un cuadro de texto: se decide una vez para el cuadro y para Filo
    // cuadro de análisis: si Filo entra mejor al costado, el cuadro llega hasta la barra (se lee todo);
    // si no, el cuadro queda bajito (mínimo 200 px) y Filo va debajo
    if (visible(lado) && lado.querySelector('.resultados, .libreta')) {
      const res = lado.querySelector('.resultados, .libreta');
      const sobra = caja(lado).height - caja(res).height, arribaCuadro = caja(lado).top;
      const colR = Math.max(...[lado, cam].filter(visible).map((e) => caja(e).right));
      const sCostado = encajar({ l: colR + HUECO, r: R, t: top0 + albumArriba, b: fin }, fig.w, fig.h);
      const sDebajo = encajar({ l: L, r: R, t: arribaCuadro + sobra + 200 + HUECO, b: fin }, fig.w, fig.h);
      const alCostado = sCostado && (!sDebajo || sCostado.s >= sDebajo.s * 0.85);  // al costado salvo que debajo sea bastante más grande
      modo = alCostado ? 'costado' : 'debajo';
      const conAlbum = 0;  // el álbum va arriba a la derecha
      const max = alCostado ? fin - arribaCuadro - sobra - conAlbum : 200;
      lado.style.setProperty('--alto-cuadro', Math.floor(max) + 'px');
    } else if (lado) lado.style.removeProperty('--alto-cuadro');
    // dibujo: la foto se achica lo justo para que ella y sus botones entren sobre el álbum
    const pol = visible(lado) && lado.dataset.tipo === 'dibujo' && lado.querySelector('.polaroid');
    if (pol) {
      const conAlbum = 0;
      const sobra = caja(lado).bottom - (fin - conAlbum), w = pol.getBoundingClientRect().width;
      if (sobra > 1) lado.style.setProperty('--ancho-foto', Math.max(110, Math.floor(w - sobra - 4)) + 'px');
    } else if (lado) lado.style.removeProperty('--ancho-foto');
    // región de Filo: toda la pantalla, o al costado / debajo de lo abierto (la más grande gana)
    if (visible(globo) && window.FiloColocarBurbuja) FiloColocarBurbuja();
    // lo de arriba a la izquierda: ventana, cámara y el globo del video (va debajo del video)
    const cosas = [lado, cam, globo].filter(visible).map(caja);
    let mejor;
    if (!cosas.length) {
      mejor = encajar({ l: L, r: R, t: top0, b: fin }, fig.w, fig.h);
    } else {
      const colR = Math.max(...cosas.map((c) => c.right)), colB = Math.max(...cosas.map((c) => c.bottom));
      const costado = encajar({ l: colR + HUECO, r: R, t: top0 + albumArriba, b: fin }, fig.w, fig.h);
      const debajo = encajar({ l: L, r: R, t: colB + HUECO, b: fin }, fig.w, fig.h);
      mejor = modo === 'costado' ? costado || debajo : modo === 'debajo' ? debajo || costado : [costado, debajo].filter(Boolean).sort((a, b) => b.s - a.s)[0];
    }
    if (!mejor) return;
    const { reg } = mejor;
    const cx = (reg.l + reg.r) / 2;
    if (ver3d) {
      // 3D: la caja de Filo ocupa la región; el motor la encuadra dentro
      const t = $('filo'), alto = reg.b - reg.t, ancho = Math.min(reg.r - reg.l, alto * 0.9);
      ponerCaja(t, cx - ancho / 2, reg.t, ancho, alto);
      t.toggleAttribute('data-angosta', ancho < 210);
      $('ilustracion') && limpiarCaja($('ilustracion'));
    } else {
      // 2D: el svg completo se escala para que la figura quepa y se apoye abajo, centrada en la región
      const u = Math.min((reg.r - reg.l) / (FIG.x1 - FIG.x0), (reg.b - reg.t) / (FIG.y1 - FIG.y0));
      const ancho = FIG.vbw * u, alto = FIG.vbh * u;
      const left = cx - (((FIG.x0 + FIG.x1) / 2) - FIG.vbx) * u;
      const top = reg.b - FIG.y1 * u;
      ponerCaja($('ilustracion'), left, top, ancho, alto);
    }
  }
  let ultimo = '';
  function ponerCaja(e, l, t, w, h) {
    if (!e) return;
    const clave = [l, t, w, h].map(Math.round).join(',');
    if (e.dataset.caja === clave) return;
    e.dataset.caja = clave;
    Object.assign(e.style, { left: Math.round(l) + 'px', top: Math.round(t) + 'px', width: Math.round(w) + 'px', height: Math.round(h) + 'px' });
    if (e.id === 'filo' && ultimo !== clave) { ultimo = clave; setTimeout(() => dispatchEvent(new Event('resize')), 380); }
  }
  function limpiarCaja(e) { if (!e || !e.dataset.caja) return; delete e.dataset.caja; ['left', 'top', 'width', 'height'].forEach((k) => e.style.removeProperty(k)); }
  function limpiar() { limpiarCaja($('ilustracion')); limpiarCaja($('filo')); }

  setInterval(repartir, 300);
  addEventListener('resize', () => setTimeout(repartir, 50));
  window.FiloRepartir = repartir;
  repartir();
})();
