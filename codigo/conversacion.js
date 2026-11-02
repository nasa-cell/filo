// Controla la pagina: cambia entre ilustracion y dibujo, los botones de caras y la
// conversacion (Gemini piensa la respuesta y Filo la dice con su voz de Fish Audio).
(function () {
  const $ = (id) => document.getElementById(id);
  const vistas = { ilustracion: $('ilustracion'), dibujo: $('filo') };
  const filos = () => [window.FiloIlustracion, window.FiloDibujo].filter(Boolean);

  function ver(nombre) {
    for (const k in vistas) vistas[k].hidden = nombre !== 'ambas' && k !== nombre;
    document.body.classList.toggle('ver-ambas', nombre === 'ambas');
    document.querySelectorAll('[data-vista]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.vista === nombre));
    localStorage.setItem('filo_vista', nombre);
  }
  document.querySelectorAll('[data-vista]').forEach((b) => b.addEventListener('click', () => ver(b.dataset.vista)));
  ver(['dibujo', 'ambas'].includes(localStorage.getItem('filo_vista')) ? localStorage.getItem('filo_vista') : 'ilustracion');

  let quitarCara = null;
  // cara de descanso segun el animo que le quedo (contenta, enojada, celosa o triste por un rato)
  const REPOSO = { feliz: 'contenta', enojada: 'enojada', celosa: 'celosa', triste: 'pena' };
  let reposo = 'normal', finReposo = null;
  // el animo (enojada, celosa, triste, contenta) se pasa solo: nunca se queda asi para siempre
  // vigilante: ninguna emocion dura mas de 10 s en la cara, pase lo que pase
  // (salvo «pensando» mientras espera la respuesta y «dormida» mientras duerme)
  const LIBRES = ['normal', 'pensando', 'dormida'];
  let caraDesde = 0, caraVista = 'normal';
  setInterval(() => {
    const f0 = filos().find((f) => f.cara);
    const c = f0 ? f0.cara() : 'normal';
    if (LIBRES.includes(c)) { caraDesde = 0; caraVista = c; return; }
    if (c !== caraVista || !caraDesde) { caraDesde = Date.now(); caraVista = c; return; }  // otra emocion: cuenta de nuevo
    if (Date.now() - caraDesde < 10000) return;
    caraDesde = 0;
    reposo = 'normal';
    if (caraPendiente && !LIBRES.includes(caraPendiente)) caraPendiente = 'normal';
    clearTimeout(quitarCara);
    filos().forEach((f) => f.expresion('normal'));
  }, 500);
  function ponerReposo(cara, ms = 10000) {
    reposo = cara;
    clearTimeout(finReposo);
    if (cara !== 'normal' && cara !== 'dormida') finReposo = setTimeout(() => {
      if (reposo !== cara) return;
      reposo = 'normal';
      if (audio.paused) filos().forEach((f) => f.expresion('normal'));
    }, ms);
  }
  function expresion(nombre, ms = 2800) {
    filos().forEach((f) => f.expresion(nombre));
    clearTimeout(quitarCara);
    if (nombre !== reposo) quitarCara = setTimeout(() => filos().forEach((f) => f.expresion(reposo)), ms);
  }
  const hablar = (si) => filos().forEach((f) => f.hablar(si));
  const nivel = (n) => filos().forEach((f) => f.nivel(n));

  function terminar() {
    hablar(false);
    nivel(-1);
    clearTimeout(quitarCara);
    quitarCara = setTimeout(() => filos().forEach((f) => f.expresion(reposo)), 900);
  }

  // voz de Filo (Fish Audio): el audio llega por partes y empieza a sonar enseguida;
  // la boca se abre segun el volumen que mide el analizador
  const audio = new Audio();
  let analizador = null, datos = null;
  // el canal de audio se crea y se despierta en el momento del clic o la tecla:
  // si se crea despues, el navegador lo deja en silencio
  let ctx = null;
  function prepararAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new AudioContext();
    analizador = ctx.createAnalyser();
    analizador.fftSize = 512;
    datos = new Uint8Array(analizador.fftSize);
    ctx.createMediaElementSource(audio).connect(analizador);
    analizador.connect(ctx.destination);
  }
  function medir() {
    if (audio.paused || audio.ended) return;
    analizador.getByteTimeDomainData(datos);
    let suma = 0;
    for (const v of datos) suma += ((v - 128) / 128) ** 2;
    nivel(Math.sqrt(suma / datos.length));
    requestAnimationFrame(medir);
  }
  // la cara que eligio Gemini se pone cuando empieza a sonar la voz y dura mientras habla
  let caraPendiente = null;
  function ponerCaraAlHablar() {
    if (caraPendiente) { expresion(caraPendiente, 600000); caraPendiente = null; }
  }
  audio.addEventListener('playing', () => { ponerCaraAlHablar(); hablar(true); medir(); });
  ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, () => location.protocol !== 'file:' && prepararAudio()));

  // Filo habla SIEMPRE con su voz (Fish Audio); si no se puede, avisa en vez de usar otra voz
  function sinVoz() {
    ponerCaraAlHablar();
    terminar();
    aviso('La voz de Filo no respondió. Inténtalo otra vez.', 'error');
    setTimeout(() => aviso(''), 6000);
  }

  // aviso de lo que esta haciendo Filo: Pensando… → Generando voz… → ¡Lista!
  function aviso(texto, tipo = '') {
    const caja = $('estado');
    caja.hidden = !texto;
    caja.textContent = texto;
    caja.dataset.tipo = tipo;
  }

  // corta la respuesta en frases (las muy cortas se juntan con la siguiente)
  function enFrases(texto) {
    const sueltas = texto.match(/[^.!?…]+[.!?…]*\s*/g) || [texto];
    const frases = [];
    // la primera va sola aunque sea corta: se genera rapido y Filo empieza a hablar antes
    for (const f of sueltas) {
      const ultima = frases[frases.length - 1];
      const juntar = frases.length && ultima.length < (frases.length === 1 ? 12 : 45);
      if (juntar) frases[frases.length - 1] += f;
      else frases.push(f);
    }
    return frases.map((f) => f.trim()).filter(Boolean);
  }
  const pedirVoz = (frase, emocion) => fetch('/voz?texto=' + encodeURIComponent(frase) + '&emocion=' + encodeURIComponent(emocion || ''))
    .then((r) => { if (!r.ok) throw new Error('sin voz'); return r.blob(); })
    .then((voz) => { if (voz.size < 1000) throw new Error('voz vacia'); return voz; });
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  let grabadas = {};
  fetch('voces/indice.json').then((r) => (r.ok ? r.json() : {})).then((d) => { grabadas = d || {}; }).catch(() => {});
  // voces grabadas por el taller de Filo (frases nuevas y frases de sus atuendos nuevos): estan en Cloudinary
  const grabadasNube = {};
  const vozGrabada = (texto, emocion) => {
    const archivo = grabadas[texto + '|' + emocion];
    const url = archivo ? 'voces/' + archivo : grabadasNube[texto + '|' + emocion];
    return url ? fetch(url).then((r) => { if (!r.ok) throw new Error('sin archivo'); return r.blob(); }) : null;
  };
  // si falla (corte breve de internet o del servidor) lo intenta dos veces mas
  const bajarVoz = (frase, emocion) => pedirVoz(frase, emocion)
    .catch(() => esperar(800).then(() => pedirVoz(frase, emocion)))
    .catch(() => esperar(2000).then(() => pedirVoz(frase, emocion)));
  function sonar(voz) {
    return new Promise((listo, fallo) => {
      if (audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src);
      audio.onended = listo;
      audio.onerror = fallo;
      audio.src = URL.createObjectURL(voz);
      audio.play().catch(fallo);
    });
  }
  let turno = 0;  // si llega otra respuesta o se toca el microfono, la anterior se calla
  function callar() { turno++; audio.pause(); }

  // la voz de todas las frases se pide a la vez; Filo habla en cuanto la primera esta completa
  // y mientras la dice se terminan las demas (Fish genera mas rapido de lo que dura la voz)
  async function decir(texto, emocion = 'normal') {
    const mio = ++turno;
    caraPendiente = emocion;  // sigue pensando hasta que llegue la voz
    if (location.protocol === 'file:') return sinVoz();
    prepararAudio();
    const grabada = vozGrabada(texto, emocion);
    const frases = grabada ? [texto] : enFrases(texto);
    if (!grabada) aviso('Generando voz…', 'voz');
    const voces = grabada ? [grabada.catch(() => bajarVoz(texto, emocion)).catch(() => null)]
      : frases.map((f) => bajarVoz(f, emocion).catch(() => null));
    const primera = await voces[0];
    if (mio !== turno) return;
    if (!primera) return sinVoz();
    if (!grabada) {  // las grabadas suenan al instante, sin aviso
      aviso('¡Lista!', 'lista');
      await new Promise((r) => setTimeout(r, 250));
      if (mio !== turno) return;
      aviso('');
    }
    for (let i = 0; i < voces.length; i++) {
      const voz = await voces[i];
      if (mio !== turno) return;
      if (!voz) return sinVoz();
      try {
        await sonar(voz);
        nivel(0);  // boca cerrada entre una frase y otra
      } catch (e) {
        if (mio === turno) terminar();
        return;
      }
      if (mio !== turno) return;
    }
    terminar();
  }

  // ---------- habla sola si el Maestro no le habla, y luego se duerme ----------
  const FF = window.FrasesFilo;
  // saca frases de una bolsa: no repite ninguna hasta haberlas dicho todas
  const bolsas = new Map();
  // frases nuevas que Filo escribio y grabo sola (taller del servidor): se dicen PRIMERO, antes que las de siempre
  const TIPO_DE = new Map([[FF.sola, 'sola'], [FF.saludo, 'saludo'], [FF.esperando.pensando, 'pensando'], [FF.esperando.sigue, 'sigue'], [FF.despertar, 'despertar']]);
  let nuevas = [];
  const dichasAqui = new Set();
  function cargarNuevas() {
    fetch('/frases-nuevas').then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!d) return;
      nuevas = d.frases || [];
      nuevas.forEach((f) => { grabadasNube[f.texto + '|' + f.emocion] = f.url; });
    }).catch(() => {});
  }
  cargarNuevas();
  setInterval(cargarNuevas, 10 * 60000);
  function sacar(lista) {
    const tipo = TIPO_DE.get(lista);
    const nueva = tipo && nuevas.find((f) => f.tipo === tipo && !f.dicha && !dichasAqui.has(f.id));
    if (nueva) {
      dichasAqui.add(nueva.id);
      fetch('/frase-dicha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: nueva.id }) }).catch(() => {});
      return [nueva.texto, nueva.emocion];
    }
    let b = bolsas.get(lista);
    if (!b || !b.length) {
      b = lista.map((_, n) => n).sort(() => Math.random() - 0.5);
      if (lista.length > 1 && b[0] === lista.ultima) b.push(b.shift());
      bolsas.set(lista, b);
    }
    lista.ultima = b.shift();
    return lista[lista.ultima];
  }
  let detalleUltimo = '';  // explicacion larga de la ultima busqueda o enlace («cuéntame más»)
  let quieta = null, avisosSolos = 0, dormida = false;
  // lo que Filo penso mientras el Maestro no estaba (lo trae /al-volver): se lo cuenta al tocarla
  let porContar = null;
  const ocupada = () => boton.disabled || !audio.paused || (A() && A().estaSonando && A().estaSonando());
  window.FiloOcupada = ocupada;  // para las pruebas automaticas
  function contarQuieta() {
    clearTimeout(quieta);
    quieta = setTimeout(hablarSola, avisosSolos < 2 ? 90000 : 60000);
  }
  function hablarSola() {
    if (ocupada()) return contarQuieta();
    if (avisosSolos < 2) {
      avisosSolos++;
      quizasPollito(0.5);
      decir(...sacar(FF.sola));
      return contarQuieta();
    }
    dormida = true;
    antesDeDormir = reposo;
    reposo = 'dormida';  // al terminar de hablar se queda dormida
    decir(...sacar(FF.dormir)).then(() => { if (dormida) aviso('Filo se quedó dormida… 💤 (háblale o tócala para despertarla)'); });
  }
  let antesDeDormir = 'normal';

  // ---------- modo YouTube: todo lo que pide el Maestro se busca en YouTube ----------
  // «Filo, ponte modo YouTube» lo enciende y «sal del modo YouTube» lo apaga (tambien el boton de arriba)
  // modo búsqueda: todo lo que pregunta el Maestro se busca en internet. Solo un modo a la vez.
  // Se encienden solos si pide un video o una búsqueda, y se apagan solos tras 5 min sin usarlos.
  let modo = 'normal';
  try {
    modo = localStorage.getItem('filo_modo') || (localStorage.getItem('filo_modo_youtube') === '1' ? 'youtube' : 'normal');
  } catch (e) { /* nada */ }
  if (!['normal', 'youtube', 'busqueda'].includes(modo)) modo = 'normal';
  let usoModo = Date.now();
  const AVISO_MODO = { youtube: '▶ Modo YouTube: dime qué canción o video pongo…', busqueda: '🔍 Modo búsqueda: pregúntame lo que quieras y lo busco…', normal: 'Escríbele algo a Filo…' };
  function ponerModo(nuevo, conVoz) {
    modo = nuevo;
    usoModo = Date.now();
    try { localStorage.setItem('filo_modo', nuevo); } catch (e) { /* nada */ }
    $('b-youtube').setAttribute('aria-pressed', nuevo === 'youtube');
    $('b-busqueda').setAttribute('aria-pressed', nuevo === 'busqueda');
    document.body.classList.toggle('modo-youtube', nuevo === 'youtube');
    document.body.classList.toggle('modo-busqueda', nuevo === 'busqueda');
    $('mensaje').placeholder = AVISO_MODO[nuevo];
    vestirse();
    if (conVoz) return decir(...sacar(FF.modos[nuevo]));
    return Promise.resolve();
  }
  const ponerModoYoutube = (si, conVoz) => ponerModo(si ? 'youtube' : 'normal', conVoz);
  // se apaga solo si lleva 5 min sin pedir videos ni busquedas (y no hay un video sonando)
  setInterval(() => {
    if (modo === 'normal') return;
    if (A() && A().estaSonando && A().estaSonando()) { usoModo = Date.now(); return; }
    if (Date.now() - usoModo > 5 * 60000) ponerModo('normal', false);
  }, 30000);

  // ---------- ropa del dia: un atuendo distinto cada dia (lo elige el servidor; atuendos.json o los que crea Filo) ----------
  let ropaDia = null, modosRopa = {}, estrenoPendiente = false;
  function vestirse() {
    const receta = modo === 'youtube' ? modosRopa.youtuber : modo === 'busqueda' ? modosRopa.buscadora : ropaDia;
    if (receta) filos().forEach((f) => f.ropaDia && f.ropaDia(receta));
  }
  function anotarVoz(r) { if (r && r.voz) grabadasNube[r.frase + '|' + r.emocion] = r.voz; }
  function cargarRopa() {
    fetch('/ropa-dia').then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!d || !d.id) return;
      const cambio = !ropaDia || ropaDia.id !== d.id;
      ropaDia = d;
      modosRopa = d.modos || {};
      anotarVoz(d);
      Object.values(modosRopa).forEach(anotarVoz);
      if (cambio) estrenoPendiente = !!d.estreno;
      // las capas se cargan antes de ponerlas: asi no se ve a Filo a medio vestir
      const urls = [d, ...Object.values(modosRopa)].flatMap((r) => Object.values((r && r.capas) || {}).map((c) => c.url));
      Promise.all(urls.map((u) => new Promise((ok) => { const i = new Image(); i.onload = i.onerror = ok; i.src = u; }))).then(vestirse);
    }).catch(() => {});
  }
  cargarRopa();
  setInterval(cargarRopa, 20 * 60000);  // a medianoche cambia sola
  // la primera vez que hablan ese dia, Filo comenta su ropa nueva (solo si esta libre)
  function decirEstreno() {
    if (!estrenoPendiente || !ropaDia || modo !== 'normal' || !audio.paused || boton.disabled) return;
    estrenoPendiente = false;
    fetch('/ropa-frase-dicha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
    setTimeout(() => { if (audio.paused && !boton.disabled) decir(ropaDia.frase, ropaDia.emocion || 'feliz'); }, 600);
  }
  async function cambiarRopa(pedido, original) {
    callar();
    expresion('pensando', 4000);
    try {
      const d = await postJson('/ropa-cambiar', { pedido });
      if (d.no_encontre) {
        if (original) { saltarOrden = true; return preguntar(original, true); }  // no era ropa suya: lo piensa la IA
        return decir(...sacar(FF.avisos.sinEsaRopa));
      }
      ropaDia = Object.assign({}, ropaDia, d);
      anotarVoz(d);
      estrenoPendiente = false;
      if (modo !== 'normal') ponerModo('normal', false);
      ocasion.pedidaHasta = 0;
      vestirse();
      return decir(d.frase, d.emocion || 'feliz');
    } catch (e) {
      return decir(...sacar(FF.avisos.sinEsaRopa));
    }
  }

  // ---------- ropa segun la ocasion (codigo/ropa.js) ----------
  // dormida: pijama; dibujando: boina y bata; buscando: detective; con musica o video: audifonos;
  // hablando de comida: chef; de vez en cuando: gorro de pollito; y en fechas especiales su ropa de fiesta
  const ocasion = { dibujando: false, buscando: false, chefHasta: 0, pollitoHasta: 0, cumple: false, pedida: null, pedidaHasta: 0, sinFecha: false };
  const COMIDA = /(?<!\p{L})(carne|comida|comer|com[ií]|comiste|hambre|cocin\p{L}*|receta\p{L}*|postre|almuerzo|cena|desayuno|pizza|pollo|rocoto|ceviche|golosinas?|pastel|torta|helado)(?!\p{L})/iu;
  function fechaEspecial() {
    if (ocasion.sinFecha) return null;
    const hoy = new Date();
    if (hoy.getMonth() === 9 && hoy.getDate() === 31) return 'bruja';
    if (hoy.getMonth() === 11) return 'navidad';
    return ocasion.cumple ? 'fiesta' : null;
  }
  function elegirRopa() {
    const ahora = Date.now();
    if (dormida) return 'pijama';
    if (ocasion.dibujando) return 'pintora';
    if (ocasion.buscando && modo !== 'busqueda') return 'detective';  // en modo búsqueda ya lleva su ropa de investigadora
    if (ocasion.pedidaHasta > ahora) return ocasion.pedida;  // la que le pidio el Maestro
    if (modo === 'youtube') return 'audifonos';
    if (A() && A().estaSonando && A().estaSonando()) return 'audifonos';
    if (ocasion.chefHasta > ahora) return 'chef';
    if (ocasion.pollitoHasta > ahora) return 'pollito';
    return fechaEspecial();
  }
  let ropaPuesta;
  setInterval(() => {
    const r = elegirRopa();
    if (r === ropaPuesta) return;
    ropaPuesta = r;
    filos().forEach((f) => f.ropa && f.ropa(r));
  }, 500);
  // de vez en cuando se pone su gorro de pollito un ratito
  const quizasPollito = (prob) => { if (Math.random() < prob) ocasion.pollitoHasta = Date.now() + 25000; };
  const fijarseComida = (...textos) => { if (textos.some((t) => COMIDA.test(t || ''))) ocasion.chefHasta = Date.now() + 15000; };
  // conVoz: si la despiertan tocandola dice algo; si le hablan, responde al mensaje
  function despertar(conVoz = false) {
    avisosSolos = 0;
    if (dormida) {
      dormida = false;
      reposo = antesDeDormir;
      aviso('');
      if (porContar) mostrarLoPensado();
      if (conVoz && porContar) contarLoPensado();
      else if (conVoz) decir(...sacar(FF.despertar));
      else expresion('sorpresa', 1500);
    }
    contarQuieta();
  }
  // libretita al lado con lo que penso; se marca como contado para que no lo repita en otra visita
  function mostrarLoPensado() {
    const p = porContar;
    if (!p || !A() || !A().mostrarNota) return;
    A().mostrarNota('📝 Lo que pensé mientras no estabas', p.puntos, 'Filo lo pensó ' + cuandoFue(p.cuando));
    fetch('/pensado-contado', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
  }
  function contarLoPensado() {
    const p = porContar;
    porContar = null;
    if (!p) return;
    aviso('');
    decir(p.dicho, 'feliz');
  }
  function cuandoFue(t) {
    const d = new Date(t * 1000), hoy = new Date(), ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);
    const hora = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === hoy.toDateString()) return 'hoy a las ' + hora;
    if (d.toDateString() === ayer.toDateString()) return 'ayer a las ' + hora;
    return 'el ' + d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }) + ' a las ' + hora;
  }
  // volvio el mismo dia despues de irse: la encuentra dormida (se despierta al tocarla o escribirle)
  function dormirAlVolver() {
    clearTimeout(quieta);
    dormida = true;
    antesDeDormir = reposo;
    reposo = 'dormida';
    filos().forEach((f) => f.expresion('dormida'));
    aviso('Filo se durmió cuando te fuiste… 💤 Tócala o escríbele para despertarla', 'siente');
  }
  ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, () => { if (!dormida) { avisosSolos = 0; contarQuieta(); } }, { passive: true }));
  contarQuieta();

  // ---------- caricias: tocar o pasar el mouse por la cabeza, las alas o el cuerpo ----------
  const CARICIAS = FF.caricias;
  let ultimaCaricia = 0, toquesAla = [], frotado = 0, ultimoPunto = null;
  function zonaDe(e) {
    if (e.target.closest('#filo')) {  // dibujo
      if (e.target.closest('.ala, .alas')) return 'alas';
      // el ala se mueve al tocarla: se cuenta toda su zona, aunque el dedo caiga en el pelo de al lado
      const sd = e.target.closest('svg');
      if (sd && sd.getScreenCTM()) {
        const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(sd.getScreenCTM().inverse());
        if (q.y > 350 && q.y < 510 && (q.x < 205 || q.x > 395)) return 'alas';
      }
      if (e.target.closest('.cabeza, .cabeza-atras')) return 'cabeza';
      return e.target.closest('svg') ? 'cuerpo' : null;
    }
    const svg = e.target.closest('#ilustracion svg');
    if (!svg || !svg.getScreenCTM()) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    if (((p.x - 512) / 250) ** 2 + ((p.y - 390) / 270) ** 2 < 1) return 'cabeza';
    if (p.y > 380 && p.y < 950 && (p.x < 330 || p.x > 700)) return 'alas';
    if (p.x > 330 && p.x < 700 && p.y > 600) return 'cuerpo';
    return null;
  }
  function reaccionar(zona) {
    const ahora = Date.now();
    if (zona === 'alas') {
      toquesAla = toquesAla.filter((t) => ahora - t < 6000).concat(ahora);
      if (toquesAla.length >= 3) { zona = 'alasMucho'; toquesAla = []; }
    }
    // el enojo por las alas no espera la pausa: si no, el tercer toque rapido se perdia
    if (zona !== 'alasMucho' && ahora - ultimaCaricia < 1500) { filos().forEach((f) => f.toque && f.toque(zona === 'alasMucho' ? 'alas' : zona)); return; }
    ultimaCaricia = ahora;
    if (dormida) { filos().forEach((f) => f.toque && f.toque(zona === 'alasMucho' ? 'alas' : zona)); return despertar(true); }
    if (porContar) { filos().forEach((f) => f.toque && f.toque(zona === 'alasMucho' ? 'alas' : zona)); despertar(); return contarLoPensado(); }
    despertar();
    const lista = CARICIAS[zona];
    const [texto, cara] = sacar(lista);
    if (zona === 'alasMucho') ponerReposo('enojada', 10000);
    // si esta respondiendo al Maestro o hay video, solo cambia la cara (no lo interrumpe);
    // si esta diciendo otra caricia, la corta y dice la nueva con su voz
    filos().forEach((f) => f.toque && f.toque(zona === 'alasMucho' ? 'alas' : zona));  // reaccion al instante, como un juguete vivo
    const enCaricia = !audio.paused && reaccionar.hasta > ahora;
    if (ocupada() && !enCaricia) return expresion(cara, 1800);
    reaccionar.hasta = ahora + 6000;
    expresion(cara, 1800);
    decir(texto, cara);  // la voz tarda un momento: mientras, se ve la reaccion
  }
  document.addEventListener('pointerdown', (e) => { const z = zonaDe(e); if (z) reaccionar(z); });
  // con el mouse: frotar la cabeza un ratito cuenta como caricia
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || zonaDe(e) !== 'cabeza') { frotado = 0; ultimoPunto = null; return; }
    if (ultimoPunto) frotado += Math.hypot(e.clientX - ultimoPunto[0], e.clientY - ultimoPunto[1]);
    ultimoPunto = [e.clientX, e.clientY];
    if (frotado > 700) { frotado = 0; reaccionar('cabeza'); }
  }, { passive: true });

  // saludo (la cara la elige Gemini con cada respuesta)
  // saludo: presentacion ya grabada, suena al instante (no espera a la IA)
  $('b-hablar').onclick = () => { despertar(); prepararAudio(); decir(...sacar(FF.saludo)).then(decirEstreno); };

  // conversacion
  const historial = [];
  // cada navegador tiene su id: con el, Filo recuerda a su Maestro en el servidor (Neon)
  const idMaestro = window.FiloId || '';  // lo crea acciones.js
  if (idMaestro) fetch('/preparar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: idMaestro }) }).catch(() => {});
  const abierta = Date.now();  // para que Filo sepa cuanto tiempo llevan juntos hoy

  // ---------- al cerrar la pagina Filo piensa en el Maestro y se duerme (servidor.py: revisar_ida) ----------
  // cada pestaña avisa cada 30 s que sigue abierta y al cerrarse dice «me voy»; si en 2 min no queda ninguna
  // abierta, el servidor hace que Filo piense que va a necesitar el Maestro y lo guarda en su memoria
  const pestana = 'p' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  const enviarPestana = (ruta) => fetch(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pestana }) });
  if (location.protocol !== 'file:') {
    setInterval(() => enviarPestana('/presente').catch(() => {}), 30000);
    addEventListener('pageshow', (e) => { if (e.persisted) enviarPestana('/presente').catch(() => {}); });
    addEventListener('pagehide', () => {
      try { navigator.sendBeacon('/me-voy', new Blob([JSON.stringify({ pestana })], { type: 'application/json' })); } catch (e) { /* sin aviso */ }
    });
    enviarPestana('/al-volver').then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!d) return;
      if (d.pensado && d.pensado.puntos && d.pensado.dicho) porContar = d.pensado;
      const fuera = d.se_fue ? d.ahora - d.se_fue : 0;
      // volvio el mismo dia: dormida; otro dia: despierta, con la libretita y le cuenta al tocarla
      if (fuera >= (d.espera || 120) && new Date(d.se_fue * 1000).toDateString() === new Date().toDateString()) return dormirAlVolver();
      if (porContar) {
        mostrarLoPensado();
        aviso('Filo pensó algo para ti mientras no estabas 📝 Tócala para que te lo cuente', 'siente');
      }
    }).catch(() => {});
  }
  const horaMaestro = () => new Date().toLocaleString('es', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const entrada = $('mensaje');
  const boton = $('b-enviar');
  $('charla').addEventListener('submit', (e) => {
    e.preventDefault();
    const mensaje = entrada.value.trim();
    if (!mensaje && !fotoAdjunta) return;
    entrada.value = '';
    if (porContar && !dormida) { porContar = null; aviso(''); }  // le escribio: responde eso (la libretita queda)
    preguntar(mensaje || 'Mira esta imagen y dime qué ves.', true);
  });

  // ---------- frases propias de Filo: varias versiones para que no repita siempre lo mismo ----------
  const frase = (clave) => sacar(FF.avisos[clave]);
  const decirFrase = (clave) => { esperandoAhora++; return decir(...frase(clave)); };  // corta las frases de espera

  // ---------- ordenes rapidas: se cumplen al instante, sin preguntar a la IA ----------
  const A = () => window.FiloAcciones;
  const corta = (m) => m.trim().split(/\s+/).length <= 5;
  // ---------- adelantar / atrasar el video ----------
  const NUMEROS = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50 };
  const PALABRA_NUM = '(\\d+|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte|treinta|cuarenta|cincuenta)';
  const reloj = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  const valor = (n) => (/^\d+$/.test(n) ? +n : NUMEROS[n]);
  // "1:30", "2 minutos", "medio minuto", "diez segundos", "un minuto y 20 segundos"; sin unidad: null
  function segundosDe(t) {
    const mmss = t.match(/\b(\d{1,2}):(\d{2})\b/);
    if (mmss) return +mmss[1] * 60 + +mmss[2];
    let total = 0, hay = false;
    if (/medio minuto/.test(t)) { total += 30; hay = true; }
    for (const [, n, u] of t.matchAll(new RegExp('\\b' + PALABRA_NUM + '\\s*(minutos?|min|segundos?|seg)\\b', 'g'))) {
      total += /^min/.test(u) ? valor(n) * 60 : valor(n); hay = true;
    }
    return hay ? total : null;
  }
  function ordenDeTiempo(t) {
    if (/\b(desde el (principio|inicio)|al (principio|inicio)|reinicia(lo)?|empieza de nuevo)\b/.test(t)) return { ir: 0 };
    const s = segundosDe(t);
    const suelto = t.match(new RegExp('\\b' + PALABRA_NUM + '\\b'));
    if (/(adelant|avanz|p[aá]sale|m[aá]s adelante|hacia adelante)/.test(t)) return { mover: s ?? (suelto ? valor(suelto[1]) : 10) };
    if (/(atras|atr[aá]s|retroce|regres|rebobina|devu[eé]lve)/.test(t)) return { mover: -(s ?? (suelto ? valor(suelto[1]) : 10)) };
    // "ve al minuto 2", "ponlo en el 1:30", "salta al segundo 40"
    const minuto = t.match(new RegExp('\\b(al|en el) minuto ' + PALABRA_NUM));
    if (/\b(ve|ir|ll[eé]va(lo)?|p[oó]n(lo)?|ponlo|salta|anda)\b/.test(t)) {
      if (/\d{1,2}:\d{2}/.test(t)) return { ir: s };
      if (minuto) return { ir: valor(minuto[2]) * 60 };
      if (s !== null) return { ir: s };
    }
    return null;
  }

  function ordenRapida(m) {
    const t = m.toLowerCase().trim().replace(/[.!¡¿?]+/g, '');
    // modo YouTube (acepta como suene o se escriba: youtube, yotube, youtuber, yutub…)
    const modoYT = /\bmodo\s+(y[a-z]*t[a-z]*b[a-z]*|you ?tube\w*|m[uú]sica|dj)\b/;
    if (modoYT.test(t) || /^(filo,?\s*)?(youtube|yotube|youtuber)$/.test(t)) {
      const apagar = /\b(sal|s[aá]l(te|ir)?|quita(lo)?|apaga(lo)?|desactiva(lo)?|termina|cierra|deja|sin|no)\b/.test(t);
      ponerModoYoutube(!apagar, true);
      return true;
    }
    // modo búsqueda: «Filo, modo búsqueda», «modo investigadora», «modo google» (y «sal del modo búsqueda»)
    if (/\bmodo\s+(b[uú]squeda|busca\w*|investiga\w*|google|detective)\b/.test(t)) {
      const apagar = /\b(sal|s[aá]l(te|ir)?|quita(lo)?|apaga(lo)?|desactiva(lo)?|termina|cierra|deja|sin|no)\b/.test(t);
      ponerModo(apagar ? 'normal' : 'busqueda', true);
      return true;
    }
    if (modo !== 'normal' && /\bmodo normal\b|^(ya )?no m[aá]s (m[uú]sica|videos?|b[uú]squedas?)$/.test(t)) { ponerModo('normal', true); return true; }
    // ropa del dia: «cámbiate», «ponte otra ropa», «otro atuendo»
    if (/^(filo,?\s*)?(c[aá]mbiate( de ropa)?|cambia(te)? de ropa|ponte otra ropa|otra ropa|otro atuendo|ponte otro atuendo|quiero verte con otra ropa)(,? filo)?$/.test(t)) {
      cambiarRopa(t);
      return true;
    }
    // «cuéntame más»: explica con detalle lo ultimo que busco o la pagina que leyo (sin volver a preguntar a la IA)
    if (detalleUltimo && /^(filo,?\s*)?((cu[eé]ntame|dime|expl[ií]ca(me)?|sigue) (m[aá]s|un poco m[aá]s)|m[aá]s detalles?|dame m[aá]s detalles?|y qu[eé] m[aá]s)(,? filo)?$/.test(t)) {
      contarMas(detalleUltimo);
      return true;
    }
    // «ponte la ropa navideña», «vístete de bruja», «quítate el disfraz»: se cambia de ropa cuando se lo piden
    if (/(qu[ií]ta(te)?|s[aá]ca(te)?) (la ropa|el gorro|el disfraz|eso|los aud[ií]fonos|el sombrero|la boina)|sin disfraz/.test(t)) {
      ocasion.pedidaHasta = 0;
      ocasion.sinFecha = true;  // si pidio quitarselo, hoy tampoco vuelve el disfraz de la fecha
      decir('¡Listo, Maestro! Ya me lo quité.', 'feliz');
      return true;
    }
    if (/\b(ponte|p[oó]nte|v[ií]stete|usa|ll[eé]va|disfr[aá]zate|cambia(te)? (a|de))\b/.test(t)) {
      const ROPAS = [
        ['navidad', /navide|navidad|santa|pap[aá] noel/, '¡Jo, jo, jo! ¡Ya tengo mi gorro de Navidad, Maestro! ¿Me veo bonita?'],
        ['bruja', /bruja|halloween/, '¡Ji, ji, ji! ¡Soy una brujita! ¡Dulce o truco, Maestro!'],
        ['pijama', /pijama|ropa de dormir/, '¡Ya tengo mi pijama! Aunque todavía no tengo sueño… creo.'],
        ['pintora', /pintora|boina|bata|pintar/, '¡Lista para pintar! ¿Qué dibujamos, Maestro?'],
        ['detective', /detective|lupa/, '¡La detective Filo está lista para investigar!'],
        ['chef', /chef|cociner|delantal/, '¡La chef Filo! ¿Me preparas carne, Maestro? ¡Digo… yo cocino!'],
        ['pollito', /pollito|filolial/, '¡Pío, pío! ¡Mira mi gorrito de pollito!'],
        ['audifonos', /aud[ií]fonos|cascos/, '¡Mis audífonos con orejitas! ¿Ponemos música?'],
        ['fiesta', /fiesta|cumplea|gorrito/, '¡Es hora de la fiesta, Maestro!'],
      ];
      const ropa = ROPAS.find(([, regla]) => regla.test(t));
      if (ropa) {
        ocasion.pedida = ropa[0];
        ocasion.pedidaHasta = Date.now() + 10 * 60000;  // la lleva 10 minutos
        decir(ropa[2], 'feliz');
        return true;
      }
      // «ponte el kimono», «vístete de princesa»: uno de sus atuendos del dia (si no lo tiene, lo dice)
      if (/^(filo,?\s*)?(ponte|p[oó]nte|v[ií]stete( de)?|usa|ll[eé]va) (el |la |tu |de |un |una )?[\wáéíóúñ ]{3,30}$/.test(t)) {
        cambiarRopa(t, m);
        return true;
      }
    }
    // «saluda», «preséntate», «¿quién eres?»: presentacion ya grabada, al instante
    const sinNombre = t.replace(/^(hola,?\s*)?(filo,?\s*)?/, '').replace(/,?\s*filo$/, '').trim();
    if (/^(sal[uú]da(me|nos)?|pres[eé]ntate|pres[eé]ntate por favor|qui[eé]n eres( t[uú])?|c[oó]mo te llamas|dime qui[eé]n eres)$/.test(sinNombre)) {
      quizasPollito(0.3);
      decir(...sacar(FF.saludo));
      return true;
    }
    // «Filo, enciende el micrófono / la cámara» y «apágalo»: lo hace ella misma
    const aparato = /micr[oó]fono|\bmicro\b/.test(t) ? $('b-micro') : /c[aá]mara/.test(t) ? $('b-camara') : null;
    if (aparato && t.split(/\s+/).length <= 8) {
      const prendido = aparato.getAttribute('aria-pressed') === 'true';
      const quiere = /\b(enciende|enci[eé]ndel[oa]|prende|pr[eé]ndel[oa]|activa|act[ií]val[oa]|abre|usa|pon)\b/.test(t) ? true
        : /\b(apaga|ap[aá]gal[oa]|desactiva|cierra|ci[eé]rral[oa]|quita)\b/.test(t) ? false : null;
      if (quiere !== null) {
        if (aparato.disabled) { aviso('Este navegador no deja usar el micrófono. Abre la página en Chrome.', 'error'); setTimeout(() => aviso(''), 4000); return true; }
        if (quiere !== prendido) aparato.click();
        const que = aparato.id === 'b-micro' ? '🎤 Micrófono' : '📷 Cámara';
        if (!(quiere && aparato.id === 'b-camara')) { aviso(que + (quiere ? ' encendido: te escucho' : ' apagado'), 'lista'); setTimeout(() => aviso(''), 2000); }
        return true;
      }
    }
    if (A().hayVideo()) {
      if (/\b(pausa|pausar|p[aá]usalo|det[eé]n(lo)?|stop)\b/.test(t) || /^para(lo)?( el video)?$/.test(t)) { A().pausar(); aviso('⏸ En pausa', 'lista'); setTimeout(() => aviso(''), 1500); return true; }
      if (corta(t) && /\b(contin[uú]a|sigue|reanuda|play|dale|reproduce(lo)?|qu[ií]tale la pausa)\b/.test(t)) { A().seguir(); return true; }
      if (/\b(otro video|siguiente|pon otro|cambia(lo)?)\b/.test(t) && corta(t)) {
        if (!A().otroVideo()) decirFrase('sinMasVideos');
        return true;
      }
      const salto = ordenDeTiempo(t);
      if (salto) {
        const nuevo = salto.ir !== undefined ? A().irA(salto.ir) : A().mover(salto.mover);
        if (nuevo !== null) {
          aviso((salto.mover < 0 ? '⏪ ' : '⏩ ') + 'Ahora en ' + reloj(nuevo), 'lista'); setTimeout(() => aviso(''), 1800);
          return true;
        }
      }
      if (/\b(m[aá]s grande|agr[aá]nda(lo)?|pantalla completa)\b/.test(t)) { A().agrandar(true); return true; }
      if (/\b(m[aá]s (peque[nñ]o|chico)|ach[ií]ca(lo)?)\b/.test(t)) { A().agrandar(false); return true; }
    }
    const dibujoEnPantalla = A().dibujoVisible();
    if (dibujoEnPantalla && /\b(elimina|elim[ií]nalo|borra|b[oó]rralo)\b/.test(t) && (/\b(dibujo|imagen|foto)\b/.test(t) || corta(t))) {
      A().eliminarDibujo(dibujoEnPantalla);
      decirFrase('borrado');
      return true;
    }
    if (/^(busca otra cosa|otra cosa|cambia de tema)$/.test(t)) { A().cerrarLado(); decirFrase('otraCosa'); return true; }
    if (corta(t) && /\b(quita|qu[ií]talo|elimina|elim[ií]nalo|cierra|ci[eé]rralo|borra|saca|apaga)\b/.test(t)) { A().cerrarLado(); A().cerrarGrande(); return true; }
    const dibujo = A().dibujoVisible();
    if (dibujo && corta(t) && /\b(gu[aá]rda(lo)?|desc[aá]rga(lo)?|b[aá]ja(lo)?)\b/.test(t)) { A().descargar(dibujo); decirFrase('guardado'); return true; }
    if (dibujo && /\botra versi[oó]n\b|\bhazlo de nuevo\b|\botra vez\b/.test(t) && corta(t)) { dibujarOtraVez(dibujo); return true; }
    return false;
  }

  // ---------- lo que Filo hace: dibujar, poner un video, buscar en internet ----------
  const postJson = async (url, datos) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'error');
    return d;
  };
  // frase de espera: la respuesta espera a que termine (como mucho 4 s) para no cortarla a la mitad
  let relleno = null, esperandoAhora = 0;
  const terminaRelleno = async () => { esperandoAhora++; if (relleno) { await Promise.race([relleno, esperar(4000)]); relleno = null; } };
  // mientras espera (IA, dibujo, busqueda) sigue hablando cada 2,5 s; se corta solo cuando llega la respuesta
  async function seguirHablando(primera, despues) {
    const mio = ++esperandoAhora;
    relleno = decir(...sacar(primera));
    while (true) {
      await relleno;
      await esperar(2500);
      if (mio !== esperandoAhora) return;
      relleno = decir(...sacar(despues));
    }
  }
  async function hacer(d, mensaje) {
    const acc = d.accion;
    if (acc.tipo === 'dibujo') {
      await terminaRelleno();
      seguirHablando(FF.esperando.dibujando, FF.esperando.sigueDibujo);
      aviso('Dibujando…', 'voz');
      ocasion.dibujando = true;
      try {
        const { url } = await postJson('/dibujar', { prompt: acc.consulta });
        await terminaRelleno();
        A().nuevoDibujo(url, acc.adivinanza ? '¿Qué será? 🤔' : acc.titulo, acc.consulta);
        return await decir(d.respuesta || '¡Ya está, mira!', d.emocion);
      } finally { setTimeout(() => { ocasion.dibujando = false; }, 3000); }
    }
    if (acc.tipo === 'video') {
      await terminaRelleno();
      seguirHablando(FF.esperando.video, FF.esperando.sigue);
      aviso('Buscando en YouTube…', 'voz');
      const r = await fetch('/youtube?q=' + encodeURIComponent(acc.consulta));
      const { videos } = await r.json();
      if (!videos || !videos.length) return decirFrase('sinVideos');
      await terminaRelleno();
      const ok = await A().mostrarVideo(videos, acc.titulo);
      if (!ok) return decirFrase('videoBloqueado');
      await decir(d.respuesta || '¡Listo, aquí está!', d.emocion);
      return A().seguir();  // primero avisa y despues empieza el video
    }
    if (acc.tipo === 'buscar') {
      await terminaRelleno();
      seguirHablando(FF.esperando.buscando, FF.esperando.sigue);
      aviso('Buscando en internet…', 'voz');
      const leyendo = setTimeout(() => aviso('Leyendo las páginas…', 'voz'), 2500);
      ocasion.buscando = true;
      try {
        const res = await postJson('/buscar', { consulta: acc.consulta, mensaje });
        await terminaRelleno();
        detalleUltimo = res.detalle || '';
        if (res.resultados && res.resultados.length) A().mostrarResultados(acc.consulta, res.resultados, { leidas: res.leidas, resumen: res.respuesta, detalle: detalleUltimo });
        fijarseComida(acc.consulta, res.respuesta);
        return await decir(res.respuesta, res.emocion);
      } finally { clearTimeout(leyendo); ocasion.buscando = false; }
    }
  }
  // el Maestro le pasa un enlace: Filo lee la pagina, muestra su foto y la explica
  async function explicarEnlace(url, mensaje) {
    seguirHablando(FF.esperando.buscando, FF.esperando.sigue);
    aviso('Leyendo la página…', 'voz');
    ocasion.buscando = true;
    try {
      const d = await postJson('/explicar', { url, mensaje });
      await terminaRelleno();
      detalleUltimo = d.detalle || '';
      A().mostrarEnlace(d);
      historial.push({ rol: 'usuario', texto: mensaje }, { rol: 'filo', texto: d.respuesta });
      return await decir(d.respuesta, d.emocion);
    } finally { ocasion.buscando = false; }
  }
  function contarMas(detalle) {
    detalleUltimo = '';  // ya lo conto: si lo vuelven a pedir, pregunta a la IA
    historial.push({ rol: 'usuario', texto: 'Cuéntame más' }, { rol: 'filo', texto: detalle });
    callar();
    const ponerLentes = (si) => filos().forEach((f) => f.lentes && f.lentes(si));
    ponerLentes(true);  // modo nerd: se pone sus lentes de corazon mientras explica
    decir(detalle, 'orgullosa').finally(() => ponerLentes(false));
  }
  window.FiloAcciones.alPedirMas(contarMas);
  async function dibujarOtraVez(dibujo) {
    callar();
    expresion('pensando', 90000);
    aviso('Dibujando otra versión…', 'voz');
    ocasion.dibujando = true;
    setTimeout(() => { ocasion.dibujando = false; }, 20000);
    try {
      const { url } = await postJson('/dibujar', { prompt: dibujo.prompt || dibujo.titulo });
      A().nuevoDibujo(url, dibujo.titulo, dibujo.prompt);
      decirFrase('otraVersion');
    } catch (e) {
      decirFrase('noDibujo');
    }
  }
  window.FiloAcciones.alPedirOtraVersion(dibujarOtraVez);
  // 15 s antes de quitar el dibujo de la pantalla, Filo avisa (con voz si no esta hablando)
  $('b-youtube').addEventListener('click', () => ponerModo(modo === 'youtube' ? 'normal' : 'youtube', true));
  $('b-busqueda').addEventListener('click', () => ponerModo(modo === 'busqueda' ? 'normal' : 'busqueda', true));
  ponerModo(modo, false);
  window.FiloAcciones.alAvisarQuitar(() => {
    const libre = audio.paused && !boton.disabled;
    if (libre) decirFrase('alAlbum');
    else { aviso('📒 El dibujo se guardará en el álbum: ahí lo encontrarás.', 'voz'); setTimeout(() => aviso(''), 5000); }
  });
  // Filo «ve» el video: Gemini lo mira entero (imagen y sonido) apenas empieza. Mientras lo ven opina con su voz
  // al 25 %, 50 % y 75 % (en videos de menos de 1 minuto, solo a la mitad): el video no se pausa, baja el volumen
  // mientras habla y sale una burbujita con lo que dijo. Al terminar dice con su voz lo que sintio.
  const sentidos = {};  // id -> { listo: promesa, datos, dichos: Set }
  window.FiloAcciones.alEmpezarVideo((v) => {
    if (sentidos[v.id]) return;
    const s = sentidos[v.id] = { datos: null, dichos: new Set() };
    s.listo = fetch('/sentir-video?' + new URLSearchParams({ id: v.id, titulo: v.titulo, duracion: v.duracion || '' }))
      .then((r) => (r.ok ? r.json() : null)).then((d) => {
        s.datos = d && d.final ? d : null;
        // su voz se baja antes, UNA POR UNA (Fish corta si se le piden varias a la vez): asi en cada momento
        // habla al instante, sin «Generando voz…»
        ((s.datos && s.datos.momentos) || []).reduce((cola, o) => cola.then(() => bajarVoz(o.texto, o.emocion)
          .then((voz) => { grabadasNube[o.texto + '|' + o.emocion] = URL.createObjectURL(voz); }).catch(() => {})), Promise.resolve());
        return s.datos;
      })
      .catch(() => null);
  });
  const burbuja = $('burbuja-video');
  let opinando = false;
  // la burbuja va debajo del video y del mismo ancho; si no cabe antes de la barra de escribir, la letra
  // se achica (hasta 13 px) y si aun asi no cabe, va arriba del video. Nunca tapa el video ni la barra
  function colocarBurbuja() {
    if (burbuja.hidden) return;
    const lado = $('lado');
    const tele = (!lado.hidden && (lado.querySelector('.tele') || lado)) || null;
    const grande = document.body.classList.contains('video-grande');
    const piso = $('charla').getBoundingClientRect().top - 10;
    const b = burbuja.style;
    b.fontSize = ''; burbuja.classList.remove('arriba-del-video', 'sobre-el-video');
    if (!tele) { b.left = '50%'; b.top = '64px'; b.width = 'max-content'; return; }
    const v = tele.getBoundingClientRect();
    b.left = Math.round(v.left + v.width / 2) + 'px';
    b.width = Math.round(Math.min(v.width, innerWidth - 16)) + 'px';
    const abajo = v.bottom + 14;
    let letra = parseFloat(getComputedStyle(burbuja).fontSize);
    while (burbuja.offsetHeight > piso - abajo && letra > 13) { letra = Math.max(13, letra - 1); b.fontSize = letra + 'px'; }
    if (burbuja.offsetHeight <= piso - abajo) { b.top = Math.round(abajo) + 'px'; return; }
    // arriba del video, sin subir sobre los botones de arriba (con el video en grande, hasta el borde)
    const techo = grande ? 8 : lado.closest('.escenario').getBoundingClientRect().top;
    const arriba = v.top - burbuja.offsetHeight - 14;
    if (arriba >= techo) { burbuja.classList.add('arriba-del-video'); b.top = Math.round(arriba) + 'px'; return; }
    // video en grande que llena la pantalla: va sobre la parte de abajo del video, como subtitulo
    burbuja.classList.add('sobre-el-video');
    b.top = Math.round(Math.min(v.bottom, piso) - burbuja.offsetHeight - 12) + 'px';
  }
  async function opinarDelVideo(o) {
    opinando = true;
    burbuja.textContent = '💭 ' + o.texto;
    burbuja.hidden = false;
    colocarBurbuja();
    const sigue = setInterval(colocarBurbuja, 400);  // por si agranda el video o gira el celular mientras habla
    A().bajarVolumen(true);
    try {
      await decir(o.texto, o.emocion);
    } finally {
      A().bajarVolumen(false);
      clearInterval(sigue);
      burbuja.hidden = true;
      opinando = false;
    }
  }
  setInterval(() => {
    const m = A() && A().momento && A().momento();
    if (!m || !m.total || !A().estaSonando()) return;
    const s = sentidos[m.id];
    const momentos = (s && s.datos && s.datos.momentos) || [];
    if (!momentos.length) return;
    // en que momento toca opinar, y cual de sus 3 opiniones dice ahi
    const puntos = m.total < 60 ? [[0.5, Math.min(1, momentos.length - 1)]] : [[0.25, 0], [0.5, 1], [0.75, 2]];
    for (const [p, i] of puntos) {
      if (s.dichos.has(p) || m.va < m.total * p) continue;
      // si todavia dice la opinion anterior, espera (hasta 20 s; despues se salta esta)
      if (opinando && m.va <= m.total * p + 20) break;
      s.dichos.add(p);
      const o = momentos[i];
      // si ya paso de largo (adelanto el video) o el Maestro le esta hablando, se salta esa opinion
      if (!o || opinando || m.va > m.total * p + 20 || boton.disabled || !audio.paused) continue;
      opinarDelVideo(o);
      vivenciaVideo(m, o);
      break;
    }
  }, 1000);
  function vivenciaVideo(m, o) {
    historial.push({ rol: 'filo', texto: `(viendo el video con el Maestro dije) ${o.texto}` });
  }
  window.FiloAcciones.alTerminarVideo(async (v) => {
    const s = sentidos[v.id];
    const datos = s ? await Promise.race([s.listo, new Promise((r) => setTimeout(() => r(null), 8000))]) : null;
    if (datos) {
      historial.push({ rol: 'filo', texto: `(vi con el Maestro el video «${v.titulo}»: ${datos.resumen}) ${datos.final}` });
      decir(datos.final, datos.emocion_final);
    } else {
      preguntar(`(El video «${v.titulo}» que te pidió el Maestro acaba de terminar. Dile qué te pareció con tu personalidad y tu emoción (si te gustó, te dio risa, miedo o pena) y pregúntale si quiere ver otro o hacer otra cosa.)`, false, true);
    }
  });

  // pregunta a la IA y Filo dice la respuesta (o hace lo que le piden)
  let saltarOrden = false;
  async function preguntar(mensaje, guardar, sinAccion = false) {
    despertar();
    const conOrden = !saltarOrden;
    saltarOrden = false;
    if (guardar && conOrden && ordenRapida(mensaje)) return;
    if (boton.disabled) return;
    boton.disabled = true;
    callar();
    terminar();
    if (A().estaSonando()) A().pausar();  // si hay un video sonando, se pausa para escuchar a Filo
    expresion('pensando', 90000);
    try {
      if (location.protocol === 'file:') throw new Error('sin servidor');
      const enlace = guardar && (mensaje.match(/https?:\/\/[^\s<>"]+/i) || [])[0];
      if (enlace) return await explicarEnlace(enlace, mensaje);
      const imagen = await fotoParaEnviar(mensaje);
      aviso(imagen ? 'Mirando y pensando…' : 'Pensando…', 'piensa');
      // mientras la IA piensa, Filo dice algo con su voz grabada (solo cuando el Maestro le habla)
      if (guardar) seguirHablando(FF.esperando[imagen ? 'mirando' : 'pensando'], FF.esperando.sigue);
      const d = await postJson('/hablar', { mensaje, historial: historial.slice(-16), imagen, lugar, sin_accion: sinAccion, modo: guardar ? modo : 'normal', id: idMaestro, hora: horaMaestro(), minutos: Math.round((Date.now() - abierta) / 60000) });
      if (d.animo) ponerReposo(REPOSO[d.animo] || 'normal', 10000);
      if (d.cumple) ocasion.cumple = true;
      fijarseComida(mensaje, d.respuesta);
      quizasPollito(0.08);
      const secreto = d.accion && d.accion.adivinanza ? `(dibujé en secreto: ${d.accion.titulo}; el Maestro tiene que adivinarlo) ` : '';
      if (guardar) historial.push({ rol: 'usuario', texto: mensaje + (imagen ? ' [le mostré una imagen]' : '') }, { rol: 'filo', texto: secreto + (d.respuesta || '(' + (d.accion ? d.accion.titulo : '') + ')') });
      if (d.accion) {
        boton.disabled = false;
        const quiere = d.accion.tipo === 'video' ? 'youtube' : d.accion.tipo === 'buscar' ? 'busqueda' : null;
        if (quiere && guardar && modo !== quiere) {
          await terminaRelleno();
          await ponerModo(quiere, false);
          await decir(...sacar(FF.modos[quiere === 'youtube' ? 'autoYoutube' : 'autoBusqueda']));
        }
        if (quiere) usoModo = Date.now();
        await hacer(d, mensaje);
      } else {
        await terminaRelleno();
        decir(d.respuesta, d.emocion).then(() => { if (guardar) decirEstreno(); });
      }
    } catch (err) {
      esperandoAhora++;  // ya no sigue con frases de espera
      decir(location.protocol === 'file:' ? 'Para conversar, ábreme con «iniciar.cmd».' : 'Uy, no pude hacerlo. ¿Lo intentas otra vez?', 'sorpresa');
    } finally {
      boton.disabled = false;
      entrada.focus();
    }
  }

  // ---------- ojos de Filo: foto adjunta o camara ----------
  // achica la imagen (maximo 1024 px) y la deja en JPEG para enviarla rapido
  function aJpeg(fuente, ancho, alto) {
    const k = Math.min(1, 1024 / Math.max(ancho, alto));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(ancho * k);
    lienzo.height = Math.round(alto * k);
    lienzo.getContext('2d').drawImage(fuente, 0, 0, lienzo.width, lienzo.height);
    return lienzo.toDataURL('image/jpeg', 0.8);
  }
  let fotoAdjunta = null;
  function adjuntar(archivo) {
    if (!archivo || !archivo.type.startsWith('image/')) return;
    const img = new Image();
    img.onload = () => {
      fotoAdjunta = aJpeg(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(img.src);
      $('adjunto-img').src = fotoAdjunta;
      $('adjunto').hidden = false;
      entrada.placeholder = '¿Qué quieres que mire en la foto?';
      entrada.focus();
    };
    img.src = URL.createObjectURL(archivo);
  }
  function quitarAdjunto() {
    fotoAdjunta = null;
    $('adjunto').hidden = true;
    $('archivo').value = '';
    entrada.placeholder = 'Escríbele algo a Filo…';
  }
  $('b-adjuntar').onclick = () => $('archivo').click();
  $('archivo').onchange = (e) => adjuntar(e.target.files[0]);
  $('adjunto-quitar').onclick = quitarAdjunto;
  window.FiloAcciones.alUsarDibujo(async (d) => {
    try {
      const r = await fetch(d.url);
      adjuntar(await r.blob());
      // despues de que la foto quede adjunta (adjuntar pone su propio texto)
      setTimeout(() => { entrada.placeholder = '¿Qué hago con «' + d.titulo + '»? (coméntalo, cámbialo…)'; entrada.focus(); }, 500);
    } catch (e) { aviso('No pude abrir ese dibujo. Revisa el internet.', 'error'); setTimeout(() => aviso(''), 4000); }
  });
  // arrastrar y soltar una foto en cualquier parte, o pegarla con Ctrl+V
  const barra = $('charla');
  document.addEventListener('dragover', (e) => { e.preventDefault(); barra.classList.add('soltar'); });
  document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) barra.classList.remove('soltar'); });
  document.addEventListener('drop', (e) => { e.preventDefault(); barra.classList.remove('soltar'); adjuntar(e.dataTransfer.files[0]); });
  document.addEventListener('paste', (e) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    if (item) { e.preventDefault(); adjuntar(item.getAsFile()); }
  });

  // camara: mientras esta encendida, cada mensaje lleva una foto de lo que se ve
  const video = $('camara');
  const botonCamara = $('b-camara');
  let flujo = null;
  botonCamara.onclick = async () => {
    if (flujo) {
      flujo.getTracks().forEach((t) => t.stop());
      flujo = null;
      video.hidden = true;
      botonCamara.setAttribute('aria-pressed', 'false');
      return;
    }
    try {
      flujo = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
      video.srcObject = flujo;
      video.hidden = false;
      botonCamara.setAttribute('aria-pressed', 'true');
      entrada.placeholder = 'Dile «observa» o «mira» para que vuelva a mirarte…';
      // apenas se enciende, Filo mira y dice lo que estas haciendo (espera la primera imagen nitida)
      await new Promise((listo) => (video.readyState >= 2 ? listo() : video.addEventListener('loadeddata', listo, { once: true })));
      await new Promise((r) => setTimeout(r, 700));
      if (flujo) preguntar('Observa por la cámara lo que estoy haciendo ahora y coméntalo como Filo, reaccionando con lo que sientes al verlo.', true);
    } catch (e) {
      entrada.placeholder = e.name === 'NotAllowedError' ? 'Permite la cámara en el candado de la barra de direcciones.' : 'No encuentro una cámara conectada.';
    }
  };
  // con la camara encendida, Filo solo mira cuando se lo piden; si no, responde al instante
  const PIDE_MIRAR = /observ|m[ií]ra|mirar|\bves\b|\bve\b|\bveo\b|f[ií]jate|qu[eé] (estoy|hago|tengo|llevo|es esto)|esto\b|aqu[ií]|c[aá]mara|c[oó]mo me veo|mi (cara|ropa|cuarto|mano)|adivina/i;
  async function fotoParaEnviar(mensaje) {
    if (fotoAdjunta) { const f = fotoAdjunta; quitarAdjunto(); return f; }
    if (flujo && video.videoWidth && PIDE_MIRAR.test(mensaje)) return aJpeg(video, video.videoWidth, video.videoHeight);
    return null;
  }

  // ubicacion (solo para el clima): se pide una vez; si no la dan, Filo pregunta la ciudad
  let lugar = null;
  try {
    const guardado = JSON.parse(localStorage.getItem('filo_lugar') || 'null');
    if (guardado) lugar = guardado;
  } catch (e) { /* sin memoria del navegador */ }
  if (!lugar && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((p) => {
      lugar = { lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3) };
      try { localStorage.setItem('filo_lugar', JSON.stringify(lugar)); } catch (e) { /* nada */ }
    }, () => {}, { timeout: 15000, maximumAge: 3600000 });
  }

  // microfono: se toca para encenderlo y queda encendido hasta que el Maestro lo apague
  // (con el boton o diciendo «apaga el micrófono»). Puede hacer pausas para pensar: lo dicho se
  // envia cuando se queda callado 2,5 s. Lo que se oye mientras Filo habla no se toma (es su voz).
  const micro = $('b-micro');
  const Reconocer = window.SpeechRecognition || window.webkitSpeechRecognition;
  const ESCRIBE = 'Escríbele algo a Filo…';
  const OYENDO = 'Te escucho… (toca 🎤 para apagar)';
  const PAUSA = 2500;
  if (!Reconocer) {
    micro.disabled = true;
    micro.title = 'Este navegador no reconoce la voz. Abre la página en Chrome.';
  } else {
    let oido = null, encendido = false, juntado = '', enviar = null, fallos = 0;
    const escuchando = (si) => micro.setAttribute('aria-pressed', si);
    const filoHabla = () => !audio.paused;
    function mandar() {
      clearTimeout(enviar);
      const texto = juntado.trim();
      juntado = '';
      if (!texto) return;
      entrada.value = '';
      preguntar(texto, true);
    }
    function arrancar() {
      oido = new Reconocer();
      oido.lang = 'es-PE';
      oido.continuous = true;
      oido.interimResults = true;
      let usados = 0;  // frases terminadas que ya se tomaron (o se descartaron) en esta escucha
      oido.onresult = (e) => {
        fallos = 0;
        if (filoHabla()) {
          // mientras Filo habla lo que se oye no se toma (seria su propia voz), salvo dos ordenes
          const oido_ = Array.from(e.results).slice(usados).filter((r) => r.isFinal).map((r) => r[0].transcript.toLowerCase()).join(' ');
          usados = e.results.length;
          if (/\b(apaga|ap[aá]galo|desactiva|quita)\b.*micr[oó]fono|micr[oó]fono.*\b(apaga|ap[aá]galo)\b/.test(oido_)) return apagar();
          if (/\b(c[aá]llate|silencio|para|basta|calla)\b/.test(oido_)) { callar(); terminar(); }
          return;
        }
        let parcial = '';
        for (let k = usados; k < e.results.length; k++) {
          const r = e.results[k];
          if (r.isFinal && k === usados) { juntado += (juntado ? ' ' : '') + r[0].transcript.trim(); usados++; }
          else parcial += r[0].transcript;
        }
        entrada.value = (juntado + ' ' + parcial).trim();
        clearTimeout(enviar);
        enviar = setTimeout(mandar, PAUSA);  // si sigue callado 2,5 s, se envia
      };
      oido.onerror = (e) => {
        let msg = '';
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { msg = 'Permite el micrófono en el candado de la barra de direcciones.'; permitido = false; apagar(); }
        else if (e.error === 'network') msg = 'Sin internet no puedo entender la voz.';
        else if (e.error === 'audio-capture') { msg = 'No encuentro un micrófono conectado.'; permitido = false; apagar(); }
        if (msg) entrada.placeholder = msg;
      };
      // Chrome corta la escucha cada tanto (silencio largo): si el Maestro no lo apago, vuelve a escuchar
      oido.onend = () => {
        oido = null;
        if (!encendido) return;
        if (++fallos > 20) { apagar(); entrada.placeholder = 'El micrófono se detuvo. Toca 🎤 para encenderlo otra vez.'; return; }
        setTimeout(() => { if (encendido && !oido) { try { arrancar(); } catch (err) { /* lo intenta en el siguiente corte */ } } }, 300);
      };
      oido.onstart = () => { permitido = true; };
      oido.start();
    }
    function apagar() {
      encendido = false;
      escuchando(false);
      entrada.placeholder = permitido ? ESPERANDO : ESCRIBE;
      if (juntado.trim()) mandar();  // lo que alcanzo a decir no se pierde
      if (oido) { const o = oido; oido = null; try { o.stop(); } catch (e) { /* ya estaba parado */ } }
      setTimeout(esperarPalabra, 700);  // queda atento solo a «enciende el micrófono»
    }
    function encender() {
      pararEspera();
      callar();
      terminar();
      encendido = true;
      fallos = 0;
      juntado = '';
      entrada.value = '';
      entrada.placeholder = OYENDO;
      escuchando(true);
      setTimeout(() => { if (encendido && !oido) { try { arrancar(); } catch (e) { apagar(); } } }, 250);
    }
    micro.addEventListener('click', () => (encendido ? apagar() : encender()));

    // ---------- microfono apagado: queda atento SOLO a «Filo, enciende el micrófono» ----------
    // no envia nada de lo que oye; al escuchar esa frase se enciende (solo si ya diste permiso al micrófono)
    const ESPERANDO = 'Escribe, o di «Filo, enciende el micrófono»';
    const DESPIERTA = /(enci[eé]nde(lo)?|prende(lo)?|pr[eé]ndelo|activa(lo)?|abre)\b.*micr[oó]fono|micr[oó]fono.*(enci[eé]nde|prende|activa)|esc[uú]chame/;
    let espera = null, esperaFallos = 0, permitido = false;
    function esperarPalabra() {
      if (encendido || espera || !permitido || document.hidden) return;
      const r = new Reconocer();
      espera = r;
      r.lang = 'es-PE';
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (e) => {
        esperaFallos = 0;
        const oye = Array.from(e.results).slice(e.resultIndex).map((x) => x[0].transcript.toLowerCase()).join(' ');
        if (!DESPIERTA.test(oye)) return;
        encender();
        aviso('🎤 Micrófono encendido: te escucho', 'lista');
        setTimeout(() => aviso(''), 2000);
      };
      r.onerror = (e) => { if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(e.error)) { permitido = false; entrada.placeholder = ESCRIBE; } };
      r.onend = () => {
        if (espera === r) espera = null;
        if (!encendido && permitido && ++esperaFallos < 300) setTimeout(esperarPalabra, esperaFallos > 5 ? 3000 : 400);
      };
      try { r.start(); entrada.placeholder = ESPERANDO; } catch (e) { espera = null; }
    }
    function pararEspera() {
      const r = espera;
      espera = null;
      if (r) { r.onend = null; try { r.abort(); } catch (e) { /* ya estaba parado */ } }
    }
    // si el micrófono ya tiene permiso, desde que se abre la pagina queda atento a la frase
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' }).then((p) => { if (p.state === 'granted') { permitido = true; esperarPalabra(); } }).catch(() => {});
    }
    // al volver a la pestaña retoma la espera (Chrome la corta cuando la pestaña no se ve)
    document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(esperarPalabra, 500); });
  }
})();
