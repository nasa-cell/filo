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

  function acomodar() {
    const celular = innerWidth <= 700;
    const hayLado = visible(lado) && !document.body.classList.contains('video-grande');
    lado.style.marginTop = '';
    globos.forEach((g) => { g.style.marginTop = ''; g.style.left = ''; g.style.maxWidth = ''; });
    const activos = globos.filter(visible);
    if (!activos.length && !(celular && hayLado && visible(album))) return;
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
    // globos entre si: el de mas abajo baja hasta dejar el hueco
    const orden = activos.slice().sort((a, b) => caja(a).top - caja(b).top);
    for (let i = 1; i < orden.length; i++) {
      const arriba = caja(orden[i - 1]), este = caja(orden[i]);
      const se_cruzan = este.left < arriba.right && arriba.left < este.right;
      if (se_cruzan && este.top < arriba.bottom + HUECO) orden[i].style.marginTop = (arriba.bottom + HUECO - este.top) + 'px';
    }
    // celular: la ventana de arriba baja si algun globo la tapa
    if (celular && hayLado) {
      const v = caja(lado);
      const tapan = activos.map(caja);
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
