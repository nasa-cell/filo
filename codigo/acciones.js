// Lo que Filo muestra junto a ella: el dibujo (foto que flota), el video de YouTube, los
// resultados de una busqueda y la ventana grande (dibujo en grande o una pagina para leer).
// La conversacion (conversacion.js) decide cuando usar cada cosa.
(function () {
  const $ = (id) => document.getElementById(id);
  const lado = $('lado');
  const album = $('album');
  const grande = $('grande');
  const escenario = document.querySelector('.escenario');
  const crear = (tipo, clase, texto) => { const e = document.createElement(tipo); if (clase) e.className = clase; if (texto) e.textContent = texto; return e; };
  const boton = (texto, titulo, alHacer, clase = 'mini') => { const b = crear('button', clase, texto); b.type = 'button'; if (titulo) { b.title = titulo; b.setAttribute('aria-label', titulo); } b.onclick = alHacer; return b; };

  // ---------- ventana grande ----------
  function abrirGrande(contenido, acciones) {
    grande.replaceChildren();
    const ventana = crear('div', 'ventana');
    ventana.setAttribute('role', 'dialog');
    ventana.setAttribute('aria-modal', 'true');
    ventana.append(...contenido);
    const barra = crear('div', 'ventana-acciones');
    barra.append(...acciones, boton('✕ Cerrar', '', cerrarGrande, 'mq-btn'));
    ventana.append(barra);
    grande.append(ventana);
    grande.hidden = false;
  }
  function cerrarGrande() { grande.hidden = true; grande.replaceChildren(); }
  grande.addEventListener('click', (e) => { if (e.target === grande) cerrarGrande(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !grande.hidden) cerrarGrande(); });

  function cerrarLado() {
    if (reproductor) { try { reproductor.destroy(); } catch (e) { /* ya no existe */ } reproductor = null; }
    video = null;
    pararReloj();
    lado.hidden = true;
    lado.replaceChildren();
    document.body.classList.remove('video-grande');
  }

  // ---------- quien es el Maestro ----------
  // Filo es de un solo Maestro: el servidor usa una sola memoria y un solo album para todos los equipos
  const ID_VALIDO = /^[a-zA-Z0-9-]{8,64}$/;
  const idMaestro = (() => {
    try {
      let id = localStorage.getItem('filo_id') || '';
      if (!ID_VALIDO.test(id)) {
        id = 'm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
        localStorage.setItem('filo_id', id);
      }
      return id;
    } catch (e) { return ''; }
  })();
  window.FiloId = idMaestro;

  // ---------- dibujos ----------
  const MAXIMO = 500;  // dibujos que guarda el album
  let dibujos = [];
  try { dibujos = JSON.parse(localStorage.getItem('filo_dibujos') || '[]'); } catch (e) { dibujos = []; }
  let dibujoActual = null;
  let alPedirOtraVersion = null;
  // el album se guarda en el navegador y tambien en la memoria del servidor (asi se ve en otros equipos)
  let subirAlbum = null;
  const pedir = (url, datos) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
  function guardarLista() {
    try { localStorage.setItem('filo_dibujos', JSON.stringify(dibujos.slice(0, MAXIMO))); } catch (e) { /* sin memoria */ }
    if (!idMaestro || location.protocol === 'file:') return;
    clearTimeout(subirAlbum);
    subirAlbum = setTimeout(() => pedir('/album-guardar', { id: idMaestro, lista: dibujos.slice(0, MAXIMO) }).catch(() => {}), 800);
  }
  // al abrir: junta el album del servidor con el de este navegador
  if (idMaestro && location.protocol !== 'file:') {
    pedir('/album-leer', { id: idMaestro }).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!d || !Array.isArray(d.lista)) return;
      const ya = new Set(dibujos.map((x) => x.url));
      const nuevos = d.lista.filter((x) => x && x.url && !ya.has(x.url));
      const faltanAlla = dibujos.length && dibujos.some((x) => !d.lista.find((y) => y.url === x.url));
      if (nuevos.length) { dibujos = dibujos.concat(nuevos).slice(0, MAXIMO); pintarGaleria(); }
      if (nuevos.length || faltanAlla) guardarLista();
    }).catch(() => {});
  }
  function descargar(d) {
    const a = crear('a');
    // en Cloudinary «fl_attachment» hace que se descargue con un clic en vez de abrirse
    a.href = d.url.includes('res.cloudinary.com') ? d.url.replace('/upload/', '/upload/fl_attachment/') : d.url;
    a.download = (d.titulo || 'dibujo de Filo').replace(/[^\wáéíóúñ ]+/gi, '') + '.jpg';
    document.body.append(a); a.click(); a.remove();
  }
  // ---------- album: todos los dibujos guardados ----------
  function pintarGaleria() {
    album.hidden = dibujos.length === 0;
    $('album-n').textContent = dibujos.length;
    if (dibujos.length) $('album-tapa').src = dibujos[0].url;
    if (!grande.hidden && grande.querySelector('.album-grilla')) abrirAlbum();  // si esta abierto, se actualiza
  }
  function abrirAlbum() {
    const titulo = crear('div', 'ventana-titulo', '📒 Álbum de Filo · ' + dibujos.length + (dibujos.length === 1 ? ' dibujo' : ' dibujos'));
    const grilla = crear('div', 'album-grilla');
    // con cientos de dibujos no se pintan todos de golpe: van de 30 en 30 al bajar (scroll)
    let pintados = 0;
    const marca = crear('div', 'album-marca');
    const pintarMas = () => {
      for (const d of dibujos.slice(pintados, pintados + 30)) grilla.insertBefore(fichaDe(d), marca);
      pintados = Math.min(dibujos.length, pintados + 30);
      if (pintados >= dibujos.length) marca.remove();
    };
    grilla.append(marca);
    pintarMas();
    grilla.addEventListener('scroll', () => {
      if (pintados < dibujos.length && grilla.scrollTop + grilla.clientHeight > grilla.scrollHeight - 600) pintarMas();
    }, { passive: true });
    const acciones = dibujos.length > 1 ? [boton('⬇ Descargar todos', '', descargarTodos, 'mq-btn lleno')] : [];
    abrirGrande([titulo, grilla], acciones);
    grande.firstChild.classList.add('ventana-album');
  }
  // miniatura liviana: Cloudinary la achica (300 px); los del PC se cargan solo al verse
  const miniatura = (url) => (url.includes('res.cloudinary.com') ? url.replace('/upload/', '/upload/c_fill,w_300,h_300,q_auto,f_auto/') : url);
  function fichaDe(d) {
      // diseño B: descargar y eliminar como iconos sobre la foto; abajo, «Usar con Filo»
      const ficha = crear('div', 'ficha');
      const ver = boton('', 'Ver «' + d.titulo + '» en grande', () => { mostrarDibujo(d); verDibujoGrande(d); }, 'ficha-ver');
      const img = crear('img'); img.loading = 'lazy'; img.decoding = 'async'; img.src = miniatura(d.url); img.alt = d.titulo;
      ver.append(img);
      const sobre = crear('div', 'ficha-sobre');
      sobre.append(boton('⬇', 'Descargar «' + d.titulo + '»', () => descargar(d), 'mini icono bajar'), botonEliminar(d, 'mini icono'));
      const usar = boton('✨ Usar con Filo', 'Mostrarle este dibujo a Filo', () => usarDibujo(d), 'mq-btn usar');
      ficha.append(ver, sobre, crear('b', '', d.titulo), usar);
      return ficha;
  }
  // de uno en uno con una pausa: el navegador puede preguntar una vez si permite varias descargas
  async function descargarTodos() {
    for (const d of dibujos) { descargar(d); await new Promise((r) => setTimeout(r, 400)); }
  }
  album.onclick = abrirAlbum;
  // «Usar con Filo»: vuelve a mostrar el dibujo y se lo pasa a Filo como foto adjunta
  let alUsarDibujo = null;
  function usarDibujo(d) {
    cerrarGrande();
    mostrarDibujo(d);
    if (alUsarDibujo) alUsarDibujo(d);
  }
  // boton Eliminar: el primer toque pide confirmar, el segundo borra de verdad
  function botonEliminar(d, clase) {
    const b = boton(clase.startsWith('mini') ? '🗑' : '🗑 Eliminar', 'Eliminar el dibujo', () => {
      // en el album y en la foto: la pregunta tapa toda la imagen y se queda hasta que elija
      const caja = b.closest('.ficha, .polaroid');
      if (caja) {
        if (caja.querySelector('.confirmar')) return;
        const capa = document.createElement('div');
        capa.className = 'confirmar';
        capa.addEventListener('click', (e) => e.stopPropagation());
        const texto = document.createElement('p');
        texto.textContent = '¿Eliminar este dibujo?';
        capa.append(texto,
          boton('Sí, eliminar', 'Eliminar el dibujo para siempre', () => eliminarDibujo(d), 'mq-btn chico si'),
          boton('No', 'No eliminar', () => capa.remove(), 'mq-btn chico no'));
        caja.append(capa);
        capa.querySelector('.no').focus();
        return;
      }
      if (!b.classList.contains('seguro')) {
        b.classList.add('seguro');
        b.textContent = '¿Eliminar? Toca otra vez';
        setTimeout(() => { b.classList.remove('seguro'); b.textContent = clase.startsWith('mini') ? '🗑' : '🗑 Eliminar'; }, 4000);
        return;
      }
      eliminarDibujo(d);
    }, clase + ' borrar');
    return b;
  }
  async function eliminarDibujo(d) {
    try {
      await fetch('/borrar-dibujo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: d.url }) });
    } catch (e) { /* si el servidor no responde, igual se quita de la lista */ }
    dibujos = dibujos.filter((x) => x.url !== d.url);
    guardarLista();
    if (dibujoActual && dibujoActual.url === d.url) { cerrarLado(); dibujoActual = null; }
    const enAlbum = !grande.hidden && grande.querySelector('.album-grilla');
    if (enAlbum && dibujos.length) abrirAlbum(); else cerrarGrande();
    pintarGaleria();
  }
  function verDibujoGrande(d) {
    reiniciarReloj(d);  // si lo esta mirando, el dibujo se queda 2 minutos mas
    const img = crear('img', 'ventana-img'); img.src = d.url; img.alt = d.titulo;
    const titulo = crear('div', 'ventana-titulo', '🎨 ' + d.titulo);
    abrirGrande([titulo, img], [
      boton('⬇ Guardar', '', () => descargar(d), 'mq-btn lleno'),
      boton('🔁 Otra versión', '', () => { cerrarGrande(); alPedirOtraVersion && alPedirOtraVersion(d); }, 'mq-btn'),
      botonEliminar(d, 'mq-btn'),
    ]);
  }

  // regla: el dibujo se queda unos 2 minutos en pantalla; antes de quitarlo Filo avisa.
  // Quitarlo de la pantalla NO lo borra: sigue en el album.
  const DURA = 120000, AVISA_ANTES = 15000;
  let relojAviso = null, relojQuitar = null, alAvisarQuitar = null;
  function pararReloj() { clearTimeout(relojAviso); clearTimeout(relojQuitar); }
  function reiniciarReloj(d) {
    pararReloj();
    relojAviso = setTimeout(() => { if (dibujoActual === d && alAvisarQuitar) alAvisarQuitar(d); }, DURA - AVISA_ANTES);
    relojQuitar = setTimeout(() => {
      if (dibujoActual !== d || lado.dataset.tipo !== 'dibujo') return;
      if (!grande.hidden) { reiniciarReloj(d); return; }  // si lo esta viendo en grande, espera
      cerrarLado();
    }, DURA);
  }
  function mostrarDibujo(d) {
    cerrarLado();
    dibujoActual = d;
    const foto = crear('figure', 'polaroid');
    const img = crear('img'); img.src = d.url; img.alt = d.titulo;
    const pie = crear('figcaption', '', d.titulo);
    foto.append(img, pie);
    foto.tabIndex = 0;
    foto.title = 'Tocar para ver en grande';
    foto.onclick = () => verDibujoGrande(d);
    foto.onkeydown = (e) => { if (e.key === 'Enter') verDibujoGrande(d); };
    lado.dataset.tipo = 'dibujo';
    const botones = crear('div', 'polaroid-acciones');
    botones.append(boton('⬇', 'Guardar el dibujo', () => descargar(d)), botonEliminar(d, 'mini'));
    lado.append(foto, botones, boton('✕', 'Quitar el dibujo de la pantalla', cerrarLado, 'mini cerrar'));
    lado.hidden = false;
    pintarGaleria();
    reiniciarReloj(d);
  }
  function nuevoDibujo(url, titulo, prompt) {
    const d = { url, titulo: titulo || 'Dibujo de Filo', prompt };
    dibujos.unshift(d);
    guardarLista();
    mostrarDibujo(d);
    return d;
  }
  pintarGaleria();

  // ---------- video de YouTube ----------
  let reproductor = null, video = null, alTerminarVideo = null, alEmpezarVideo = null;
  let apiYouTube = null;
  function cargarApi() {
    if (apiYouTube) return apiYouTube;
    apiYouTube = new Promise((listo, fallo) => {
      window.onYouTubeIframeAPIReady = () => listo(window.YT);
      const s = crear('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = fallo;
      document.head.append(s);
    });
    return apiYouTube;
  }
  // muestra el video (sin reproducir todavia); si un video no deja verse fuera de YouTube, prueba el siguiente
  async function mostrarVideo(lista, titulo) {
    cerrarLado();
    const YT = await cargarApi();
    video = { lista, i: 0, titulo };
    const tele = crear('div', 'tele');
    const marco = crear('div'); marco.id = 'yt';
    const barra = crear('div', 'tele-barra');
    const nombre = crear('span', 'tele-nombre');
    barra.append(nombre,
      boton('⏯', 'Pausa o seguir', () => (estaSonando() ? pausar() : seguir())),
      boton('⤢', 'Más grande o más pequeño', () => agrandar(!document.body.classList.contains('video-grande'))),
      boton('⏭', 'Otro video', () => otroVideo()),
      boton('✕', 'Quitar el video', cerrarLado));
    tele.append(marco, barra);
    lado.dataset.tipo = 'video';
    lado.append(tele);
    lado.hidden = false;
    return new Promise((listo) => {
      const poner = () => { const v = video.lista[video.i]; nombre.textContent = v.titulo + ' · ' + v.canal; return v.id; };
      reproductor = new YT.Player('yt', {
        videoId: poner(),
        playerVars: { rel: 0, playsinline: 1, hl: 'es', modestbranding: 1 },
        events: {
          onReady: () => listo(true),
          onError: () => {
            if (!video || video.i >= video.lista.length - 1) { listo(false); return; }
            video.i++;
            reproductor.cueVideoById(poner());
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.ENDED && alTerminarVideo && video) alTerminarVideo(video.lista[video.i]);
            if (e.data === YT.PlayerState.PLAYING && alEmpezarVideo && video) alEmpezarVideo(video.lista[video.i]);
          },
        },
      });
      video.poner = poner;
    });
  }
  const estaSonando = () => reproductor && reproductor.getPlayerState && reproductor.getPlayerState() === 1;
  function seguir() { if (reproductor && reproductor.playVideo) reproductor.playVideo(); }
  function pausar() { if (reproductor && reproductor.pauseVideo) reproductor.pauseVideo(); }
  // mientras Filo opina, el video sigue pero mas bajito (30 % de su volumen) y luego vuelve como estaba
  let volumenAntes = null;
  function bajarVolumen(si) {
    if (!reproductor || !reproductor.setVolume) return;
    if (si && volumenAntes === null) {
      volumenAntes = reproductor.getVolume ? reproductor.getVolume() : 100;
      reproductor.setVolume(Math.round(volumenAntes * 0.3));
    } else if (!si && volumenAntes !== null) {
      reproductor.setVolume(volumenAntes);
      volumenAntes = null;
    }
  }
  // adelantar o retroceder (segundos, + o -) e ir a un momento exacto; devuelve el nuevo segundo
  function mover(seg) {
    if (!reproductor || !reproductor.getCurrentTime) return null;
    return irA(reproductor.getCurrentTime() + seg);
  }
  function irA(seg) {
    if (!reproductor || !reproductor.seekTo) return null;
    const total = reproductor.getDuration ? reproductor.getDuration() : 0;
    const destino = Math.max(0, total ? Math.min(seg, total - 1) : seg);
    reproductor.seekTo(destino, true);
    return destino;
  }
  function otroVideo() {
    if (!video || !reproductor) return false;
    if (video.i >= video.lista.length - 1) return false;
    video.i++;
    reproductor.loadVideoById(video.poner());
    return true;
  }
  function agrandar(si) { if (video) document.body.classList.toggle('video-grande', si); }

  // ---------- resultados de busqueda y vista de lectura ----------
  // resumen: lo que Filo dijo; leidas: que paginas leyo enteras; detalle: lo que cuenta con «Cuéntame más»
  function mostrarResultados(consulta, resultados, extra = {}) {
    cerrarLado();
    const caja = crear('div', 'resultados');
    const cabeza = crear('div', 'resultados-titulo', '🔎 ' + consulta);
    const leidas = (extra.leidas || []).filter(Boolean).length;
    if (leidas) cabeza.append(crear('small', 'resultados-leidas', `leyó ${leidas} ${leidas === 1 ? 'página' : 'páginas'}`));
    caja.append(cabeza);
    const lista = crear('ol');
    resultados.forEach((r, i) => {
      const li = crear('li');
      const b = boton('', 'Abrir «' + r.titulo + '» aquí', () => leerPagina(r));
      b.className = 'resultado';
      b.append(crear('strong', '', r.titulo), crear('small', '', sitioDe(r.url)), crear('span', '', r.resumen));
      if (extra.leidas && extra.leidas[i]) b.append(crear('em', 'leida', '✓ leída'));
      li.append(b);
      lista.append(li);
    });
    caja.append(lista);
    agregarResumen(caja, extra.resumen, extra.detalle);
    lado.dataset.tipo = 'resultados';
    lado.append(caja, boton('✕', 'Quitar los resultados', cerrarLado, 'mini cerrar'));
    lado.hidden = false;
  }
  function sitioDe(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }
  function agregarResumen(caja, resumen, detalle, enlace) {
    if (resumen) caja.append(crear('p', 'resultados-resumen', resumen));
    const botones = crear('div', 'resultados-botones');
    if (detalle) botones.append(boton('💬 Cuéntame más', 'Que Filo te explique con más detalle', () => alPedirMas && alPedirMas(detalle), 'mq-btn lleno'));
    if (enlace) {
      const abrir = crear('a', 'mq-btn', '↗ Abrir página');
      abrir.href = enlace; abrir.target = '_blank'; abrir.rel = 'noopener';
      botones.append(abrir);
    }
    if (botones.children.length) caja.append(botones);
  }
  // tarjeta de un enlace que el Maestro le paso: foto de la pagina, resumen y botones
  function mostrarEnlace(d) {
    cerrarLado();
    const caja = crear('div', 'resultados tarjeta-enlace');
    const cabeza = crear('div', 'resultados-titulo', '🔗 ' + (d.titulo || d.sitio));
    cabeza.append(crear('small', 'resultados-leidas', d.sitio || ''));
    caja.append(cabeza);
    if (d.captura) {
      const foto = crear('img', 'enlace-foto');
      foto.src = d.captura;
      foto.alt = 'Foto de la página ' + (d.titulo || '');
      foto.title = 'Ver la foto en grande';
      foto.onerror = () => foto.remove();
      foto.onclick = () => { const g = crear('img', 'ventana-img'); g.src = d.captura; g.alt = foto.alt; abrirGrande([crear('div', 'ventana-titulo', '🔗 ' + (d.titulo || d.sitio)), g], []); };
      caja.append(foto);
    }
    agregarResumen(caja, d.respuesta, d.detalle, d.url);
    lado.dataset.tipo = 'resultados';
    lado.append(caja, boton('✕', 'Quitar la página', cerrarLado, 'mini cerrar'));
    lado.hidden = false;
  }
  // ---------- tarjeta modo nerd: la respuesta completa de experta, escrita ----------
  // el texto viene con marcas simples: «= » respuesta directa, «## » titulo, «- » o «1. » listas,
  // «| a | b |» tablas y **negrita**. Todo se arma con textContent: nada del texto se vuelve codigo.
  function conNegrita(padre, texto) {
    texto.split(/(\*\*[^*]+\*\*)/).forEach((trozo) => {
      if (/^\*\*[^*]+\*\*$/.test(trozo)) padre.append(crear('strong', '', trozo.slice(2, -2)));
      else if (trozo) padre.append(document.createTextNode(trozo.replace(/\*\*/g, '')));
    });
    return padre;
  }
  function armarNerd(texto) {
    const cuerpo = crear('div', 'nerd-cuerpo');
    let lista = null, tabla = null;
    const cerrar = () => { lista = null; tabla = null; };
    texto.split('\n').map((l) => l.trim()).forEach((l) => {
      if (!l) return cerrar();
      if (/^\|.*\|$/.test(l)) {
        if (/^\|[\s:|-]+\|$/.test(l)) return;  // fila de rayitas debajo del encabezado
        const celdas = l.slice(1, -1).split('|').map((c) => c.trim());
        if (!tabla) { lista = null; tabla = crear('table', 'nerd-tabla'); cuerpo.append(crear('div', 'nerd-tabla-caja')); cuerpo.lastChild.append(tabla); }
        const fila = crear('tr');
        const encabezado = !tabla.rows.length;
        celdas.forEach((c) => fila.append(conNegrita(crear(encabezado ? 'th' : 'td'), c)));
        tabla.append(fila);
        return;
      }
      tabla = null;
      const punto = l.match(/^(?:[-•*]|(\d+)[.)])\s+(.*)$/);
      if (punto) {
        const tipo = punto[1] ? 'ol' : 'ul';
        if (!lista || lista.tagName.toLowerCase() !== tipo) { lista = crear(tipo); cuerpo.append(lista); }
        lista.append(conNegrita(crear('li'), punto[2]));
        return;
      }
      lista = null;
      if (l.startsWith('= ')) return cuerpo.append(conNegrita(crear('p', 'nerd-directa'), l.slice(2)));
      if (/^#{1,4}\s/.test(l)) return cuerpo.append(crear('h4', 'nerd-sub', l.replace(/^#+\s*/, '').replace(/\*\*/g, '')));
      cuerpo.append(conNegrita(crear('p'), l));
    });
    return cuerpo;
  }
  // d: {titulo, texto, fuentes: [{titulo, url, resumen}], leidas, enlace, captura}
  function mostrarNerd(d) {
    cerrarLado();
    const caja = crear('div', 'resultados nerd');
    const cabeza = crear('div', 'nerd-titulo', '🤓 Modo nerd' + (d.titulo ? ' · ' + d.titulo : ''));
    caja.append(cabeza);
    if (d.captura) {
      const foto = crear('img', 'enlace-foto');
      foto.src = d.captura;
      foto.alt = 'Foto de la página ' + (d.titulo || '');
      foto.onerror = () => foto.remove();
      foto.onclick = () => { const g = crear('img', 'ventana-img'); g.src = d.captura; g.alt = foto.alt; abrirGrande([crear('div', 'ventana-titulo', '🔗 ' + (d.titulo || '')), g], []); };
      caja.append(foto);
    }
    caja.append(armarNerd(String(d.texto || '')));
    if (d.fuentes && d.fuentes.length) {
      caja.append(crear('h4', 'nerd-sub', 'Fuentes'));
      const lista = crear('ol', 'nerd-fuentes');
      d.fuentes.forEach((r, i) => {
        const b = boton('', 'Abrir «' + r.titulo + '» aquí', () => leerPagina(r));
        b.className = 'resultado';
        b.append(crear('strong', '', r.titulo), crear('small', '', sitioDe(r.url)));
        if (d.leidas && d.leidas[i]) b.append(crear('em', 'leida', '✓ leída'));
        const li = crear('li');
        li.append(b);
        lista.append(li);
      });
      caja.append(lista);
    }
    // «Cuéntame más» siempre: Filo se pone los lentes y lo explica en voz alta
    const botones = crear('div', 'resultados-botones');
    botones.append(boton('🤓 Cuéntame más', 'Que Filo se ponga los lentes y te lo explique en voz alta', () => alPedirMas && alPedirMas(String(d.texto || '')), 'mq-btn lleno'));
    if (d.enlace) {
      const abrir = crear('a', 'mq-btn', '↗ Abrir página');
      abrir.href = d.enlace; abrir.target = '_blank'; abrir.rel = 'noopener';
      botones.append(abrir);
    }
    caja.append(botones);
    lado.dataset.tipo = 'resultados';
    lado.append(caja, boton('✕', 'Cerrar el modo nerd', cerrarLado, 'mini cerrar'));
    lado.hidden = false;
  }
  // libretita con lo que Filo penso mientras el Maestro no estaba (se cierra con ✕)
  function mostrarNota(titulo, puntos, pie) {
    cerrarLado();
    const caja = crear('div', 'libreta');
    caja.append(crear('h3', 'libreta-titulo', titulo));
    const lista = crear('ul');
    puntos.forEach((p) => lista.append(crear('li', '', p)));
    caja.append(lista);
    if (pie) caja.append(crear('div', 'libreta-pie', pie));
    lado.dataset.tipo = 'nota';
    lado.append(caja, boton('✕', 'Cerrar la libretita', cerrarLado, 'mini cerrar'));
    lado.hidden = false;
  }
  let alPedirMas = null;
  async function leerPagina(r) {
    const titulo = crear('div', 'ventana-titulo', '📄 ' + r.titulo);
    const texto = crear('div', 'lectura', 'Abriendo la página…');
    const abrir = crear('a', 'mq-btn lleno', '↗ Abrir en pestaña nueva');
    abrir.href = r.url; abrir.target = '_blank'; abrir.rel = 'noopener';
    abrirGrande([titulo, texto], [abrir]);
    try {
      const resp = await fetch('/leer?url=' + encodeURIComponent(r.url));
      const d = await resp.json();
      if (!resp.ok) throw new Error(d.error);
      titulo.textContent = '📄 ' + d.titulo;
      texto.textContent = d.texto || 'La página no tiene texto para leer aquí. Ábrela en una pestaña nueva.';
    } catch (e) {
      texto.textContent = 'Esta página no se deja leer aquí. Ábrela en una pestaña nueva.';
    }
  }

  window.FiloAcciones = {
    nuevoDibujo, mostrarVideo, mostrarResultados, mostrarEnlace, mostrarNota, mostrarNerd, cerrarLado, cerrarGrande,
    alPedirMas(f) { alPedirMas = f; },
    volumen: () => (reproductor && reproductor.getVolume ? reproductor.getVolume() : null),
    seguir, pausar, bajarVolumen, otroVideo, agrandar, estaSonando, descargar,
    hayVideo: () => !!video,
    mover, irA,
    dibujoVisible: () => (lado.dataset.tipo === 'dibujo' && !lado.hidden ? dibujoActual : null),
    alTerminarVideo(f) { alTerminarVideo = f; },
    alEmpezarVideo(f) { alEmpezarVideo = f; },
    momento: () => (reproductor && reproductor.getCurrentTime && video
      ? { id: video.lista[video.i].id, va: reproductor.getCurrentTime(), total: reproductor.getDuration() } : null),
    alPedirOtraVersion(f) { alPedirOtraVersion = f; },
    alAvisarQuitar(f) { alAvisarQuitar = f; },
    alUsarDibujo(f) { alUsarDibujo = f; },
    eliminarDibujo,
  };
})();
