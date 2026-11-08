// Globos y avisos (aviso de arriba, nube de lo que piensa, burbuja del video) nunca chocan entre ellos
// ni con lo que Filo muestra al lado (tarjeta modo nerd, libretita, video, resultados): siempre queda un hueco.
// En PC los globos se centran sobre la columna de Filo y no pasan de su ancho; en celular, si un globo
// queda encima de la ventana de arriba, la ventana baja lo justo.
(function () {
  const HUECO = 10;
  const $ = (id) => document.getElementById(id);
  const escenario = document.querySelector('.escenario');
  const lado = $('lado');
  const globos = ['estado', 'nube-pensar', 'burbuja-video'].map($).filter(Boolean);
  const avisoRopa = $('aviso-ropa');  // aviso de la ropa que se esta haciendo: fijo arriba a la izquierda
  const album = $('album');  // cuadrito del album, arriba a la izquierda: los globos y la ventana lo esquivan
  if (!escenario || !lado) return;

  const visible = (e) => e && !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
  const caja = (e) => e.getBoundingClientRect();

  function columnaDeFilo() {
    const partes = ['ilustracion', 'filo'].map($).filter(visible).map(caja);
    if (!partes.length) return null;
    const izq = Math.min(...partes.map((r) => r.left)), der = Math.max(...partes.map((r) => r.right));
    return { izq, der, centro: (izq + der) / 2, ancho: der - izq };
  }

  const cruza = (a, b, g = 0) => a.left < b.right + g && b.left < a.right + g && a.top < b.bottom + g && b.top < a.bottom + g;
  // caja de la cabeza: del punto mas alto (pelo u orejas) hasta los ojos, en la vista que se ve
  function cabezaDeFilo() {
    const ilu = $('ilustracion');
    if (visible(ilu)) {
      const svg = ilu.querySelector('svg'), img = svg && svg.querySelector('image');
      const m = img && img.getScreenCTM();
      if (!m) return null;
      const punto = (x, y) => { const q = svg.createSVGPoint(); q.x = x; q.y = y; return q.matrixTransform(m); };
      const a = punto(230, 85), b = punto(800, 470);
      const tope = [...ilu.querySelectorAll('.ropa-dia, .ropa')].map(caja).filter((r) => r.height && r.bottom > a.y && r.top < b.y);
      return { left: a.x, right: b.x, top: Math.min(a.y, ...tope.map((r) => r.top)), bottom: b.y };
    }
    const tres = $('filo');  // Filo 3D: la cabeza se mide en la pantalla (se mueve, gira y hace zoom)
    if (visible(tres)) {
      const c = window.FiloTres && window.FiloTres.cabeza();
      if (c) return c;
      const r = caja(tres);
      return { left: r.left + r.width * 0.3, right: r.right - r.width * 0.3, top: r.top, bottom: r.top + r.height * 0.4 };
    }
    return null;
  }

  function acomodar() {
    const celular = innerWidth <= 700;
    const hayLado = visible(lado) && !document.body.classList.contains('video-grande');
    lado.style.marginTop = '';
    globos.forEach((g) => { g.style.marginTop = ''; g.style.left = ''; g.style.maxWidth = ''; });
    if (avisoRopa) avisoRopa.style.marginTop = '';
    const conAviso = visible(avisoRopa);
    const activos = globos.filter(visible);
    if (!activos.length && !conAviso && !(celular && hayLado && visible(album))) return;
    // el aviso de la ropa: si el album esta en su esquina, baja hasta dejar el hueco
    if (conAviso && visible(album)) {
      const A = caja(album), r = caja(avisoRopa);
      if (r.left < A.right + HUECO && A.left < r.right + HUECO && r.top < A.bottom + HUECO && A.top < r.bottom + HUECO)
        avisoRopa.style.marginTop = Math.ceil(A.bottom + HUECO - r.top) + 'px';
    }
    const filo = columnaDeFilo();
    // PC con ventana al lado: los globos van sobre Filo y no invaden la columna de la ventana
    if (!celular && hayLado && filo) {
      const base = caja(escenario);
      activos.forEach((g) => {
        const fijo = getComputedStyle(g).position === 'fixed';
        g.style.left = (fijo ? filo.centro : filo.centro - base.left) + 'px';
        g.style.maxWidth = Math.max(200, Math.min(filo.ancho, caja(lado).left - filo.izq) - 2 * HUECO) + 'px';
      });
    }
    // el album: el globo que lo pisa se angosta (sigue centrado); si quedaria muy angosto, baja
    if (visible(album)) {
      const A = caja(album);
      activos.forEach((g) => {
        const r = caja(g);
        if (!(r.left < A.right + HUECO && A.left < r.right && r.top < A.bottom + HUECO && A.top < r.bottom)) return;
        const centro = (r.left + r.right) / 2;
        const ancho = 2 * (centro - (A.right + HUECO));
        if (ancho >= 220) g.style.maxWidth = Math.floor(ancho) + 'px';
        else g.style.marginTop = Math.ceil(A.bottom + HUECO - r.top) + 'px';
      });
    }
    // globos entre si: el de mas abajo baja hasta dejar el hueco (el aviso de la ropa se queda en su esquina)
    const orden = (conAviso ? [avisoRopa, ...activos] : activos).sort((a, b) => (a === avisoRopa ? -1 : b === avisoRopa ? 1 : caja(a).top - caja(b).top));
    for (let i = 1, vueltas = 0; i < orden.length; i++) {
      for (let j = 0; j < i && vueltas < 30; j++, vueltas++) {
        const arriba = caja(orden[j]), este = caja(orden[i]);
        const se_cruzan = este.left < arriba.right + HUECO && arriba.left < este.right + HUECO;
        if (se_cruzan && este.top < arriba.bottom + HUECO && este.bottom > arriba.top) {
          orden[i].style.marginTop = (parseFloat(orden[i].style.marginTop) || 0) + Math.ceil(arriba.bottom + HUECO - este.top) + 'px';
          j = -1;  // se movio: se revisa otra vez contra todos los de arriba
        }
      }
    }
    // la cabeza de Filo (pelo y lo que lleve encima, como orejas) nunca queda tapada: si hay lugar, el globo va al lado
    const cab = cabezaDeFilo();
    if (cab) {
      const base = caja(escenario);
      const ventana = hayLado ? caja(lado) : null;
      orden.forEach((g) => {
        if (g === avisoRopa) return;
        const r = caja(g);
        if (!cruza(r, cab, HUECO)) return;
        const fijo = getComputedStyle(g).position === 'fixed';
        const finDer = ventana && ventana.left > cab.right ? ventana.left - HUECO : innerWidth - HUECO;
        const lados = [[cab.right + HUECO, finDer], [conAviso ? caja(avisoRopa).right + HUECO : HUECO, cab.left - HUECO]];
        for (const [desde, hasta] of lados) {
          const ancho = Math.min(r.width, hasta - desde);
          if (ancho < 170) continue;
          const centro = desde < cab.left ? hasta - ancho / 2 : desde + ancho / 2;
          g.style.maxWidth = Math.floor(ancho) + 'px';
          g.style.left = (fijo ? centro : centro - base.left) + 'px';
          const nuevo = caja(g);
          if (!orden.some((o) => o !== g && cruza(nuevo, caja(o), HUECO - 1))) return;
        }
        g.style.left = ''; g.style.maxWidth = '';  // sin lugar al costado (celular angosto): se queda donde estaba
      });
    }
    // celular: la ventana de arriba baja si algun globo la tapa
    if (celular && hayLado) {
      const v = caja(lado);
      const tapan = (conAviso ? [avisoRopa, ...activos] : activos).map(caja);
      if (visible(album)) tapan.push(caja(album));
      const fondo = Math.max(...tapan.filter((g) => g.left < v.right && v.left < g.right && g.top < v.bottom).map((g) => g.bottom), -Infinity);
      if (fondo > -Infinity && fondo + HUECO > v.top) lado.style.marginTop = Math.ceil(fondo + HUECO - v.top) + 'px';
    }
  }

  let pendiente = false;
  const pedir = () => { if (!pendiente) { pendiente = true; requestAnimationFrame(() => { pendiente = false; acomodar(); }); } };
  new MutationObserver(pedir).observe(escenario, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'class', 'data-tipo'], characterData: true });
  new MutationObserver(pedir).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  addEventListener('resize', pedir);
  window.FiloAcomodar = acomodar;  // para las pruebas automaticas
  pedir();
})();
