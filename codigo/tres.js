// Filo en 3D: carga el motor (tres/filo-3d.js) solo cuando se elige «3D» o «Las dos».
// Mientras carga, guarda lo último que pidió la página (cara, ropa, lentes) y se lo pasa al terminar.
(function () {
  const $ = (id) => document.getElementById(id);
  const caja = $('filo');
  // celulares de 4 GB o de gama media: menos nitidez y 30 cuadros por segundo
  const liviano = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
    || matchMedia('(pointer: coarse)').matches;
  let motor = null, cargando = null, mostrando = false;
  const ultimo = { expresion: null, ropa: undefined, ropaDia: undefined, lentes: false, hablar: false };
  let auto = true;
  try { auto = localStorage.getItem('filo_auto') !== 'no'; } catch (e) { /* sin memoria */ }

  // el fondo de cada reacción (rojo enojada, rosa enamorada...) cubre toda la pantalla, no solo a Filo
  const capaFondo = document.createElement('div');
  capaFondo.className = 'fondo-tres';
  ($('fondo') || document.body).append(capaFondo);
  const fotos = new Map();
  function ponerFondo(lienzo) {
    if (!lienzo) { capaFondo.classList.remove('si'); return; }
    if (!fotos.has(lienzo)) fotos.set(lienzo, lienzo.toDataURL('image/jpeg', 0.85));
    capaFondo.style.backgroundImage = `url(${fotos.get(lienzo)})`;
    capaFondo.classList.add('si');
  }

  // carga: aviso con barra mientras baja el modelo
  const carga = document.createElement('div');
  carga.className = 'tres-carga';
  carga.innerHTML = '<span>Cargando a Filo 3D…</span><div class="tres-barra"><i></i></div>';
  const barra = carga.querySelector('i');

  // botones junto a Filo: acercar, alejar, volver al tamaño normal y girar
  const botones = document.createElement('div');
  botones.className = 'tres-botones';
  [['＋', 'Acercar', () => motor && motor.zoom(1 / 1.15)], ['－', 'Alejar', () => motor && motor.zoom(1.15)],
    ['⟲', 'Volver al tamaño normal y de frente', () => motor && motor.normal()],
    ['🔄', 'Girar a Filo una vuelta entera (también puedes arrastrarla)', () => motor && motor.girar()]].forEach(([t, n, f]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = t; b.title = n; b.setAttribute('aria-label', n);
    b.addEventListener('click', f);
    botones.append(b);
  });

  // botón de arriba: 3D automática (si nadie le habla, se mueve y reacciona sola)
  const bAuto = document.createElement('button');
  bAuto.type = 'button'; bAuto.id = 'b-auto'; bAuto.className = 'vista b-auto';
  bAuto.title = '3D automática: si nadie le habla, Filo se mueve y reacciona sola';
  bAuto.innerHTML = '✨ <span class="largo">3D automática</span><span class="corto">Auto 3D</span>';
  bAuto.setAttribute('aria-pressed', auto);
  bAuto.hidden = true;
  ($('b-busqueda') || $('b-youtube')).after(bAuto);
  bAuto.addEventListener('click', () => {
    auto = bAuto.getAttribute('aria-pressed') !== 'true';
    bAuto.setAttribute('aria-pressed', auto);
    try { localStorage.setItem('filo_auto', auto ? 'si' : 'no'); } catch (e) { /* sin memoria */ }
    if (motor) motor.automatica(auto);
  });

  // celular con video abierto (diseño «lado a lado»): el video va arriba a la izquierda y Filo se corre a la derecha
  const lado = $('lado'), celular = matchMedia('(max-width: 700px)');
  function correrConVideo() {
    if (!motor) return;
    // con algo en la columna de la izquierda (video, análisis, resultados, dibujo o cámara) Filo se corre a la derecha
    const cam = $('camara'), conVideo = celular.matches && ((lado && !lado.hidden) || (cam && !cam.hidden))
      && !document.body.classList.contains('video-grande') && !document.body.classList.contains('ver-ambas')
      && !document.documentElement.classList.contains('repartir');  // con el reparto (distribucion.js) Filo ya tiene su lugar
    motor.correr(conVideo ? 0.2 : 0);
  }
  if (lado) new MutationObserver(correrConVideo).observe(lado, { attributes: true, attributeFilter: ['hidden', 'data-tipo'] });
  if ($('camara')) new MutationObserver(correrConVideo).observe($('camara'), { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(correrConVideo).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  celular.addEventListener('change', correrConVideo);

  // emociones que Filo inventó en el taller: las baja, las suma y avisa la primera vez
  let conocidas = [], primera = true;
  try { const g = localStorage.getItem('filo_emo_conocidas'); primera = g === null; conocidas = JSON.parse(g || '[]'); } catch (e) { conocidas = []; }
  function traerEmociones() {
    fetch('/emociones-nuevas').then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!d || !motor) return;
      const lista = d.emociones || [];
      motor.agregarEmociones(lista);
      const nueva = lista.find((e) => !conocidas.includes(e.id));
      if (primera) {  // la primera vez que abre la página en este equipo: no avisa de las que ya tenía
        primera = false; conocidas = lista.map((e) => e.id);
      } else if (nueva) {
        conocidas.push(nueva.id);
        estrenar(nueva);
      } else return;
      try { localStorage.setItem('filo_emo_conocidas', JSON.stringify(conocidas)); } catch (e) { /* sin memoria */ }
    }).catch(() => {});
  }
  const abierta = Date.now();
  function estrenar(e) {
    const caja = $('estado');
    const mostrar = () => {
      // espera a que termine el saludo de bienvenida y a que no esté hablando ni con otro aviso
      if (!mostrando || ultimo.hablar || motor.estado().hablando || Date.now() - abierta < 15000 || (caja && !caja.hidden)) return setTimeout(mostrar, 2000);
      if (caja) {
        caja.textContent = '✨ ¡Inventé una emoción nueva: ' + e.nombre + '!';
        caja.dataset.tipo = 'emocion'; caja.hidden = false;
        setTimeout(() => { if (caja.dataset.tipo === 'emocion') { caja.hidden = true; caja.dataset.tipo = ''; } }, 6000);
      }
      motor.reaccion(e.id, true);  // la muestra entera, sin que otra reacción la corte
      setTimeout(() => { if (motor.estado().reaccion === e.id) motor.expresion(ultimo.expresion || 'normal'); }, 5500);
    };
    mostrar();
  }

  function cargar() {
    if (cargando) return cargando;
    caja.append(carga);
    cargando = import('../tres/filo-3d.js?v=8').then((m) => m.iniciar(caja, {
      modelo: 'tres/filo.vrm?v=1', liviano,
      alAvance: (f) => { barra.style.width = Math.round(f * 100) + '%'; },
      alFondo: (l) => ponerFondo(mostrando ? l : null),
      alAgotar: () => fetch('/emociones-agotadas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {}),
    })).then((m) => {
      motor = m;
      carga.remove();
      caja.append(botones);
      m.automatica(auto);
      if (ultimo.ropaDia !== undefined) m.ropaDia(ultimo.ropaDia);
      if (ultimo.ropa !== undefined) m.ropa(ultimo.ropa);
      m.lentes(ultimo.lentes);
      if (ultimo.hablar) m.hablar(true);
      if (ultimo.expresion) m.expresion(ultimo.expresion);
      m.encender(mostrando);
      correrConVideo();
      traerEmociones();
      setInterval(traerEmociones, 10 * 60 * 1000);
      return m;
    }).catch((e) => {
      console.error('Filo 3D no cargó:', e);
      carga.querySelector('span').textContent = 'No pude cargar a Filo 3D. Revisa el internet y vuelve a elegir «3D».';
      cargando = null;
    });
    return cargando;
  }

  // la página le habla igual que a la ilustración (ver conversacion.js)
  window.FiloTres = {
    mostrar(si) {
      mostrando = !!si;
      bAuto.hidden = !si;
      if (si) cargar();
      if (motor) motor.encender(si);
      if (!si) ponerFondo(null);
    },
    expresion(n) { ultimo.expresion = n; if (motor) motor.expresion(n); },
    hablar(si) { ultimo.hablar = si; if (motor) motor.hablar(si); },
    nivel(n) { if (motor) motor.nivel(n); },
    cara() { return motor ? motor.cara() : ultimo.expresion || 'normal'; },
    toque(zona) { if (motor) motor.toque(zona); },
    lentes(si) { ultimo.lentes = si; if (motor) motor.lentes(si); },
    ropa(nombre) { ultimo.ropa = nombre; if (motor) motor.ropa(nombre); },
    ropaDia(receta) { ultimo.ropaDia = receta; if (motor) motor.ropaDia(receta); },
    zona(x, y) { return motor ? motor.zona(x, y) : null; },
    cabeza() { return motor ? motor.cabeza() : null; },
    motor: () => motor,  // para las pruebas
  };
})();
