# Cosas que Filo puede HACER ademas de conversar: dibujar, buscar videos de YouTube,
# buscar en internet y leer una pagina. Todo con servicios gratis:
#   dibujos  -> Cloudflare Workers AI (flux-1-schnell, plan gratis)
#   videos   -> la pagina de resultados de YouTube (sin clave)
#   internet -> DuckDuckGo (sin clave) y r.jina.ai para leer las paginas (sin clave)
import base64
import hashlib
import html
import ipaddress
import json
import os
import re
import socket
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

CARPETA = os.path.dirname(os.path.abspath(__file__))
DIBUJOS = os.path.join(os.path.dirname(os.path.dirname(CARPETA)), 'pagina', 'dibujos')
NAVEGADOR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

# pistas rapidas: solo si aparecen se pregunta a la IA si de verdad pide una accion
PISTAS = re.compile(r'dib[uú]j|ilustr|pint[ae]|im[aá]gen|crea(me)? una|haz(me)? una|video|v[ií]deo|youtube|canci[oó]n|m[uú]sica|'
                    r'reproduc|\bpon(me|er|la|lo|las)?\b|esc[uú]cha|\btoca(me)?\b|opening|ending|\bost\b|\brola\b|playlist|lista de reproducci|cantante|\bbanda\b|\bcanta\b|busca|b[uú]scame|investiga|google|internet|noticia|[uú]ltima hora|p[aá]gina|web', re.I)

PLAN = (
    "Decide si el Maestro te pide HACER algo. accion puede ser: 'dibujo' (que dibujes, pintes o crees una imagen), "
    "'video' (buscar o poner un video o canción de YouTube), 'buscar' (buscar en internet información, noticias, "
    "precios, datos actuales o una página) o 'ninguna' (solo conversa o pregunta algo que ya sabes). "
    "consulta: para 'dibujo' una descripción detallada EN INGLÉS para un generador de imágenes (estilo ilustración "
    "anime colorida, salvo que pida otro estilo); para 'video' lo que hay que buscar en YouTube; para 'buscar' la "
    "búsqueda en español, corta y precisa. titulo: nombre corto en español de lo que harás (máx. 5 palabras). "
    "respuesta: lo que dirás cuando YA ESTÉ HECHO, 1 o 2 frases cortas con tu personalidad de Filo: di qué "
    "dibujaste o qué video es y REACCIONA a eso como lo sentirías tú (si es un bicho te da asco pero lo hiciste "
    "igual, si es comida te da hambre, si da miedo te asustas, si es tierno te enternece (emoción amor, no pena), si es de tu Maestro te "
    "emocionas). No empieces siempre igual (varía: '¡Mira!', '¡Ya está!', '¡Aquí tienes!', 'Puaj, pero aquí "
    "está…', etc.). Para buscar o ninguna deja respuesta vacía. Si pide música o un video de TU persona, cantante o "
    "canción favorita, elige tú según tus gustos de Filo (por ejemplo canciones de 'El héroe del escudo' como "
    "'RISE' de MADKID, o algo sobre tu Maestro Naofumi). Si pide de SU (del Maestro) persona, cantante o canción "
    "favorita, busca la que diga la conversación; si la conversación no lo dice, accion 'ninguna' (le preguntarás). "
    "Si el Maestro quiere jugar a adivinar qué dibujas, elige TÚ algo sencillo y reconocible (un animal, una "
    "comida, un objeto), accion 'dibujo', adivinanza true, titulo = lo que dibujaste (secreto) y respuesta: "
    "pregúntale qué cree que es, SIN decirlo. En los demás casos adivinanza false. "
    "Responde SOLO con JSON: "
    '{"accion": "...", "consulta": "...", "titulo": "...", "respuesta": "...", "emocion": "feliz", "adivinanza": false}. La emoción va con lo que pide (feliz, emocionada, risa, asco, miedo, pena, enojada, amor u orgullosa), no siempre feliz.'
)


MODOS = {
    'youtube': ("ESTÁS EN MODO YOUTUBE: si pide música, una canción, un artista, un anime o algo para ver o escuchar "
                "(aunque no diga 'video' ni 'pon'), accion 'video'. Pero si PREGUNTA información (qué es, cómo, por qué, "
                "cuándo, quién fue, noticias, datos, precios), accion 'buscar'. Si pide un dibujo, 'dibujo'. Si solo "
                "conversa contigo (saludo, cómo estás, cariño, juegos, contarte algo), 'ninguna'. "),
    'busqueda': ("ESTÁS EN MODO BÚSQUEDA: si pregunta algo o pide información, datos o noticias, accion 'buscar' aunque "
                 "creas saberlo. Si pide música o un video, 'video'. Si pide un dibujo, 'dibujo'. Si solo conversa "
                 "contigo (saludo, cómo estás, cariño, juegos, contarte algo), 'ninguna'. "),
}


PREGUNTA = re.compile(r'[¿?]|^\s*(qu[eé]|c[oó]mo|por ?qu[eé]|cu[aá]ndo|cu[aá]nt[oa]s?|qui[eé]n(es)?|d[oó]nde|cu[aá]l(es)?)\b|'
                      r'\b(qu[eé] es|significa|noticias?|precio|datos? de|informaci[oó]n)\b', re.I)
MUSICA = re.compile(r'\b(pon(me|nos)?|m[uú]sica|canci[oó]n|video|opening|ending|escuchar|ver el|reproduce|playlist)\b', re.I)


# charla con ella (no se busca): «¿cómo estás?», «¿qué haces?», «¿me quieres?»...
CHARLA = re.compile(r'\b(c[oó]mo est[aá]s|qu[eé] (haces|tal|cuentas|te gusta|piensas|sientes)|me quieres|est[aá]s bien|'
                    r'te acuerdas|qui[eé]n eres|c[oó]mo te (llamas|sientes|fue)|filo)\b', re.I)


def _buscar_tal_cual(mensaje):
    m = re.sub(r'^\s*(filo,?\s*)?(busca(me)?|investiga|averigua)\s+', '', mensaje.strip(), flags=re.I).strip() or mensaje.strip()
    return {'accion': 'buscar', 'consulta': m[:200], 'titulo': m.strip('¿?¡! ')[:40], 'respuesta': '',
            'emocion': 'pensando', 'adivinanza': 'false'}


NO_REPETIR = (
    " Si pide OTRA, MÁS, LA SIGUIENTE o algo DEL MISMO autor/artista/anime: usa el mismo artista o tema del último "
    "video puesto y en consulta pon el nombre de OTRA canción o video suyo que NO esté en la lista de ya puestos "
    "(si no conoces otra, pon el artista y la palabra canciones). Nunca pidas una que ya esté en la lista. "
)


def _ya_puestos(puestos):
    """Lista corta para la IA: los ultimos videos que Filo ya puso (el mas nuevo al final)."""
    lista = [f"«{v.get('titulo', '')}» de {v.get('canal', '')}" for v in list(puestos or [])[-15:] if isinstance(v, dict)]
    return ('Videos que ya le pusiste (no los repitas; el último es el más reciente): ' + '; '.join(lista) + '\n\n') if lista else ''


def planear(mensaje, pedir_json, historial=(), modo='normal', puestos=()):
    """Devuelve el plan si el mensaje pide dibujar, un video o buscar; si no, None.
    En modo YouTube o búsqueda la IA decide siempre (sin pistas), con preferencia por ese modo."""
    if modo not in MODOS and not PISTAS.search(mensaje):
        return None
    antes = '\n'.join(('Maestro: ' if h.get('rol') == 'usuario' else 'Filo: ') + str(h.get('texto', ''))[:200]
                      for h in list(historial)[-8:] if isinstance(h, dict))
    try:
        plan = pedir_json(MODOS.get(modo, '') + PLAN + NO_REPETIR, _ya_puestos(puestos)
                          + ('Conversación reciente:\n' + antes + '\n\n' if antes else '')
                          + 'El Maestro dice ahora: «' + mensaje[:400] + '»')
    except Exception as e:
        # sin IA: una pregunta de informacion va a busqueda y un pedido de musica a video, en cualquier modo
        if modo == 'youtube' and not PREGUNTA.search(mensaje):
            return planear_video(mensaje, pedir_json, historial, puestos)
        if modo == 'busqueda' and MUSICA.search(mensaje):
            return planear_video(mensaje, pedir_json, historial, puestos)
        if modo in MODOS:
            return _buscar_tal_cual(mensaje)
        raise e
    if plan.get('accion') not in ('dibujo', 'video', 'buscar') or not str(plan.get('consulta', '')).strip():
        # en modo YouTube o búsqueda, una pregunta de información siempre se busca (aunque la IA crea saberla)
        if modo in MODOS and PREGUNTA.search(mensaje) and not CHARLA.search(mensaje):
            return _buscar_tal_cual(mensaje)
        return None
    return {k: str(plan.get(k, '')).strip() for k in ('accion', 'consulta', 'titulo', 'respuesta', 'emocion', 'adivinanza')}


PLAN_VIDEO = (
    "Estás en MODO YOUTUBE: todo lo que pide el Maestro es música o un video para buscar en YouTube, aunque no diga "
    "'video' ni 'canción'. consulta: lo que hay que buscar en YouTube (nombre de la canción, cantante, anime, tema), "
    "corregido si lo escribió mal. titulo: nombre corto en español (máx. 5 palabras). respuesta: 1 frase corta y "
    "alegre de Filo para cuando ya suene, reaccionando a lo que es (varía cómo empiezas). Si pide TU favorita elige "
    "tú (por ejemplo 'RISE' de MADKID); si pide la SUYA, la que diga la conversación. "
    'Responde SOLO con JSON: {"consulta": "...", "titulo": "...", "respuesta": "...", "emocion": "feliz"}. '
    "La emoción va con lo que pide (feliz, emocionada, risa, miedo, pena, amor u orgullosa)."
)


def planear_video(mensaje, pedir_json, historial=(), puestos=()):
    antes = '\n'.join(('Maestro: ' if h.get('rol') == 'usuario' else 'Filo: ') + str(h.get('texto', ''))[:200]
                      for h in list(historial)[-6:] if isinstance(h, dict))
    try:
        plan = pedir_json(PLAN_VIDEO + NO_REPETIR, _ya_puestos(puestos)
                          + ('Conversación reciente:\n' + antes + '\n\n' if antes else '')
                          + 'El Maestro pide: «' + mensaje[:400] + '»')
    except Exception as e:
        print('planear_video fallo:', str(e)[:150])
        plan = {}
    # si la IA falla, se busca tal cual lo que dijo (sin «filo,» ni «pon»)
    limpio = re.sub(r'^(filo,?\s*)?((pon(me|la|lo)?|reproduce|toca(me)?|quiero (escuchar|ver|o[ií]r)|busca(me)?)\s+)?', '',
                    mensaje.strip(), flags=re.I).strip() or mensaje.strip()
    consulta = str(plan.get('consulta') or '').strip() or limpio
    return {'accion': 'video', 'consulta': consulta, 'titulo': str(plan.get('titulo') or consulta[:40]).strip(),
            'respuesta': str(plan.get('respuesta') or '').strip(), 'emocion': str(plan.get('emocion') or 'feliz').strip(),
            'adivinanza': 'false'}


# ---------- dibujos ----------
def credenciales_cloudflare():
    cuenta, token = os.environ.get('CLOUDFLARE_ACCOUNT_ID'), os.environ.get('CLOUDFLARE_API_TOKEN')
    if not (cuenta and token):
        # las mismas credenciales gratis que usa el resumidor de PDF (nunca se copian a este proyecto)
        import importlib.util
        ruta = r'D:\descargas\Nueva carpeta (94)\resumidor-pdf-mvc\configuracion_local.py'
        if not os.path.exists(ruta):
            return None, None
        spec = importlib.util.spec_from_file_location('cfg_cloudflare', ruta)
        cfg = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cfg)
        cuenta, token = cfg.CLOUDFLARE_ACCOUNT_ID, cfg.CLOUDFLARE_API_TOKEN
    return cuenta, token


# ---------- Cloudinary: copia de los dibujos en la nube ----------
# Misma cuenta gratis que el probador de ropa SENATI, pero en su propia carpeta «filo-dibujos».
# Asi los dibujos no se pierden cuando la pagina este en Render (su disco se borra al reiniciar).
# Sin las variables CLOUDINARY_* todo sigue igual: los dibujos quedan solo en la carpeta «dibujos».
NUBE_CARPETA = 'filo-dibujos'


def _variable(nombre):
    valor = os.environ.get(nombre)
    if not valor and os.name == 'nt':
        import winreg
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, 'Environment') as k:
                valor = winreg.QueryValueEx(k, nombre)[0]
        except OSError:
            valor = None
    return valor


def credenciales_nube():
    datos = [_variable(k) for k in ('CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET')]
    return datos if all(datos) else None


def _firmar(parametros, secreto):
    texto = '&'.join(f'{k}={v}' for k, v in sorted(parametros.items()))
    return hashlib.sha1((texto + secreto).encode()).hexdigest()


def _pedir_nube(accion, parametros, archivo=None, tipo='image', mime='image/jpeg', nombre_archivo='dibujo.jpg'):
    nube, llave, secreto = credenciales_nube()
    parametros = dict(parametros, timestamp=str(int(time.time())))
    campos = dict(parametros, api_key=llave, signature=_firmar(parametros, secreto))
    limite = '----filo' + str(int(time.time() * 1000))
    cuerpo = b''
    for k, v in campos.items():
        cuerpo += f'--{limite}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    if archivo:
        cuerpo += (f'--{limite}\r\nContent-Disposition: form-data; name="file"; filename="{nombre_archivo}"\r\n'
                   f'Content-Type: {mime}\r\n\r\n').encode() + archivo + b'\r\n'
    cuerpo += f'--{limite}--\r\n'.encode()
    pedido = urllib.request.Request(f'https://api.cloudinary.com/v1_1/{nube}/{tipo}/{accion}', data=cuerpo,
                                    headers={'Content-Type': f'multipart/form-data; boundary={limite}'})
    with urllib.request.urlopen(pedido, timeout=40) as r:
        return json.load(r)


def subir_archivo(datos, carpeta, nombre, tipo='image', mime='image/webp', nombre_archivo='archivo.webp'):
    """Sube un archivo cualquiera (ropa de Filo en webp; voces en mp3 con tipo 'video') y devuelve su direccion.
    Lanza error si no hay nube o falla: quien llama lo intenta mas tarde."""
    if not credenciales_nube():
        raise RuntimeError('sin Cloudinary')
    res = _pedir_nube('upload', {'folder': carpeta, 'public_id': nombre}, datos, tipo, mime, nombre_archivo)
    return res['secure_url']


def subir_a_nube(imagen, nombre):
    """Sube el dibujo; devuelve su direccion en la nube o None si no hay nube o fallo."""
    if not credenciales_nube():
        return None
    try:
        res = _pedir_nube('upload', {'folder': NUBE_CARPETA, 'public_id': nombre.rsplit('.', 1)[0]}, imagen)
        return res.get('secure_url')
    except Exception as e:
        print('nube: no se pudo subir', str(e)[:150])
        return None


def _dibujar_cloudflare(prompt):
    cuenta, token = credenciales_cloudflare()
    if not (cuenta and token):
        raise RuntimeError('sin claves de Cloudflare')
    datos = json.dumps({'prompt': prompt[:1500], 'steps': 6}).encode()
    pedido = urllib.request.Request(
        f'https://api.cloudflare.com/client/v4/accounts/{cuenta}/ai/run/@cf/black-forest-labs/flux-1-schnell',
        data=datos, headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(pedido, timeout=60) as r:
        return base64.b64decode(json.load(r)['result']['image'])


def dibujar(prompt):
    imagen = _dibujar_cloudflare(prompt)
    os.makedirs(DIBUJOS, exist_ok=True)
    nombre = time.strftime('dibujo-%Y%m%d-%H%M%S') + '.jpg'
    with open(os.path.join(DIBUJOS, nombre), 'wb') as f:
        f.write(imagen)
    return subir_a_nube(imagen, nombre) or '/dibujos/' + nombre


def borrar_dibujo(url):
    """Borra un dibujo de la carpeta dibujos y de la nube (solo nombres creados por Filo, nada mas)."""
    nombre = url.rsplit('/', 1)[-1]
    if not re.fullmatch(r'dibujo-\d{8}-\d{6}\.jpg', nombre):
        return False
    borrado = False
    ruta = os.path.join(DIBUJOS, nombre)
    if os.path.isfile(ruta):
        os.remove(ruta)
        borrado = True
    if credenciales_nube() and ('/' + NUBE_CARPETA + '/') in url:
        try:
            res = _pedir_nube('destroy', {'public_id': NUBE_CARPETA + '/' + nombre.rsplit('.', 1)[0]})
            borrado = borrado or res.get('result') == 'ok'
        except Exception as e:
            print('nube: no se pudo borrar', str(e)[:150])
    return borrado


# ---------- YouTube ----------
def _buscar_claves(nodo, clave, encontrados):
    if isinstance(nodo, dict):
        for k, v in nodo.items():
            if k == clave:
                encontrados.append(v)
            else:
                _buscar_claves(v, clave, encontrados)
    elif isinstance(nodo, list):
        for v in nodo:
            _buscar_claves(v, clave, encontrados)
    return encontrados


def buscar_youtube(consulta):
    url = 'https://www.youtube.com/results?hl=es&search_query=' + urllib.parse.quote(consulta)
    pedido = urllib.request.Request(url, headers={'User-Agent': NAVEGADOR, 'Accept-Language': 'es-ES,es;q=0.9'})
    with urllib.request.urlopen(pedido, timeout=10) as r:
        pagina = r.read().decode('utf-8', 'replace')
    m = re.search(r'var ytInitialData = (\{.*?\});</script>', pagina, re.S)
    if not m:
        return []
    videos = []
    for v in _buscar_claves(json.loads(m.group(1)), 'videoRenderer', []):
        duracion = (v.get('lengthText') or {}).get('simpleText')
        if not v.get('videoId') or not duracion:  # sin duracion = en vivo
            continue
        videos.append({
            'id': v['videoId'],
            'titulo': ''.join(t.get('text', '') for t in (v.get('title') or {}).get('runs', [])),
            'canal': ''.join(t.get('text', '') for t in (v.get('ownerText') or {}).get('runs', [])),
            'duracion': duracion,
        })
        if len(videos) >= 8:
            break
    return videos


def buscar_sin_repetir(consulta, ya_puestos):
    """Videos de YouTube que Filo todavia no puso. Si todos ya sonaron, prueba otras dos busquedas parecidas.
    Devuelve (videos, agotado): agotado es True si ya puso todo lo que encontro."""
    vistos = set(ya_puestos)
    nuevos, juntos = [], set()
    for intento in (consulta, consulta + ' canciones', consulta + ' en vivo'):
        try:
            encontrados = buscar_youtube(intento)
        except Exception as e:
            print('youtube fallo:', str(e)[:150])
            continue
        for v in encontrados:
            if v['id'] not in vistos and v['id'] not in juntos:
                juntos.add(v['id'])
                nuevos.append(v)
        if len(nuevos) >= 3:
            break
    return nuevos[:8], not nuevos


# ---------- internet ----------
def buscar_web(consulta):
    """Varios buscadores gratis a la vez; se usa el primero de la lista con resultados que de verdad hablen
    de lo pedido (en Render, DuckDuckGo directo no responde y Bing a veces devuelve cosas sin relacion)."""
    rapidos = (_buscar_duckduckgo, _buscar_duckduckgo_jina, _buscar_bing, _buscar_duckduckgo_lite)
    hilos = ThreadPoolExecutor(len(rapidos))
    tareas = [hilos.submit(b, consulta) for b in rapidos]
    hilos.shutdown(wait=False)
    limite = time.time() + 9
    for buscador, tarea in zip(rapidos, tareas):
        try:
            resultados = _relevantes(consulta, tarea.result(timeout=max(0.1, limite - time.time())))
            print(f'buscar: {buscador.__name__} dio {len(resultados)} relevantes', flush=True)
            if resultados:
                return resultados
        except Exception as e:
            print(buscador.__name__, 'fallo:', str(e)[:150] or type(e).__name__, flush=True)
    try:
        resultados = _relevantes(consulta, _buscar_wikipedia(consulta))
        print(f'buscar: wikipedia dio {len(resultados)} relevantes', flush=True)
        return resultados
    except Exception as e:
        print('wikipedia fallo:', str(e)[:150], flush=True)
    return []


_VACIAS = set('que qué cual cuál como cómo donde dónde cuando cuándo quien quién para por sobre busca buscar buscame búscame '
              'dime decir informacion información noticias hoy esta este esto estos estas una uno unos unas los las del '
              'con sin hay son eres tiene tienen hace hacer'.split())


def _sin_tildes(texto):
    return texto.lower().translate(str.maketrans('áéíóúüñ', 'aeiouun'))


def _relevantes(consulta, resultados):
    """Solo resultados que nombran alguna palabra importante de lo buscado."""
    palabras = [p for p in re.findall(r'\w{3,}', _sin_tildes(consulta)) if p not in {_sin_tildes(v) for v in _VACIAS}]
    if not palabras:
        return resultados
    buenos = []
    for r in resultados or []:
        texto = _sin_tildes(' '.join((r.get('titulo', ''), r.get('resumen', ''), r.get('url', ''))))
        if any(p in texto for p in palabras):
            buenos.append(r)
    return buenos


_limpio = lambda s: html.unescape(re.sub(r'<[^>]+>', '', s or '')).strip()


def _buscar_duckduckgo_lite(consulta):
    pedido = urllib.request.Request('https://lite.duckduckgo.com/lite/', data=urllib.parse.urlencode({'q': consulta, 'kl': 'es-es'}).encode(),
                                    headers={'User-Agent': NAVEGADOR, 'Content-Type': 'application/x-www-form-urlencoded'})
    with urllib.request.urlopen(pedido, timeout=6) as r:
        pagina = r.read().decode('utf-8', 'replace')
    enlaces = re.findall(r"<a[^>]+href=\"([^\"]+)\"[^>]*class='result-link'[^>]*>(.*?)</a>", pagina, re.S)
    resumenes = re.findall(r"<td class='result-snippet'>(.*?)</td>", pagina, re.S)
    resultados = []
    for i, (url, titulo) in enumerate(enlaces[:6]):
        url = html.unescape(url)
        if 'uddg=' in url:
            url = urllib.parse.unquote(urllib.parse.parse_qs(urllib.parse.urlparse(url).query)['uddg'][0])
        if url.startswith('//'):
            url = 'https:' + url
        resultados.append({'titulo': _limpio(titulo), 'url': url, 'resumen': _limpio(resumenes[i] if i < len(resumenes) else '')})
    return resultados


def _buscar_bing(consulta):
    pedido = urllib.request.Request('https://www.bing.com/search?setlang=es&cc=PE&mkt=es-PE&q=' + urllib.parse.quote(consulta),
                                    headers={'User-Agent': NAVEGADOR, 'Accept-Language': 'es-PE,es;q=0.9'})
    with urllib.request.urlopen(pedido, timeout=10) as r:
        pagina = r.read().decode('utf-8', 'replace')
    resultados = []
    for bloque in re.findall(r'<li class="b_algo".*?</li>', pagina, re.S):
        enlace = re.search(r'<h2[^>]*>.*?<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', bloque, re.S)
        if not enlace:
            continue
        url = html.unescape(enlace.group(1))
        if '/ck/a?' in url:  # enlace de Bing que redirige: la direccion real va en «u» (base64)
            u = urllib.parse.parse_qs(urllib.parse.urlparse(url).query).get('u', [''])[0]
            if u.startswith('a1'):
                try:
                    url = base64.urlsafe_b64decode(u[2:] + '=' * (-len(u[2:]) % 4)).decode()
                except Exception:
                    continue
        if not url.startswith('http'):
            continue
        resumen = re.search(r'<p[^>]*>(.*?)</p>', bloque, re.S)
        resultados.append({'titulo': _limpio(enlace.group(2)), 'url': url, 'resumen': _limpio(resumen.group(1) if resumen else '')})
        if len(resultados) >= 6:
            break
    return resultados


def _buscar_wikipedia(consulta):
    url = 'https://es.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=5&srsearch=' + urllib.parse.quote(consulta)
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Filo2D/1.0'}), timeout=10) as r:
        datos = json.load(r)
    limpio = lambda s: html.unescape(re.sub(r'<[^>]+>', '', s or '')).strip()
    return [{'titulo': d['title'], 'url': 'https://es.wikipedia.org/wiki/' + urllib.parse.quote(d['title'].replace(' ', '_')),
             'resumen': limpio(d.get('snippet'))} for d in datos.get('query', {}).get('search', [])]


def _buscar_duckduckgo(consulta):
    pedido = urllib.request.Request('https://html.duckduckgo.com/html/?kl=es-es&q=' + urllib.parse.quote(consulta),
                                    headers={'User-Agent': NAVEGADOR})
    with urllib.request.urlopen(pedido, timeout=6) as r:
        return _leer_duckduckgo(r.read().decode('utf-8', 'replace'))


def _buscar_duckduckgo_jina(consulta):
    """La misma pagina de DuckDuckGo pedida a traves de r.jina.ai (gratis, sin clave): funciona desde Render."""
    pedido = urllib.request.Request('https://r.jina.ai/https://html.duckduckgo.com/html/?kl=es-es&q=' + urllib.parse.quote(consulta),
                                    headers={'Accept': 'text/plain', 'X-Return-Format': 'html', 'User-Agent': 'Filo2D/1.0'})
    with urllib.request.urlopen(pedido, timeout=9) as r:
        return _leer_duckduckgo(r.read().decode('utf-8', 'replace'))


def _leer_duckduckgo(pagina):
    resultados = []
    for bloque in re.findall(r'<div class="result results_links.*?(?=<div class="result results_links|\Z)', pagina, re.S):
        if 'result--ad' in bloque:
            continue
        enlace = re.search(r'class="result__a" href="([^"]+)"[^>]*>(.*?)</a>', bloque, re.S)
        if not enlace:
            continue
        destino = html.unescape(enlace.group(1))
        if 'uddg=' in destino:
            destino = urllib.parse.unquote(urllib.parse.parse_qs(urllib.parse.urlparse(destino).query)['uddg'][0])
        if destino.startswith('//'):
            destino = 'https:' + destino
        resumen = re.search(r'class="result__snippet"[^>]*>(.*?)</a>', bloque, re.S)
        limpio = lambda s: html.unescape(re.sub(r'<[^>]+>', '', s or '')).strip()
        resultados.append({'titulo': limpio(enlace.group(2)), 'url': destino, 'resumen': limpio(resumen.group(1) if resumen else '')})
        if len(resultados) >= 6:
            break
    return resultados


def es_publica(url):
    """Solo se leen paginas de internet (no el PC ni la red de la casa)."""
    partes = urllib.parse.urlparse(url)
    if partes.scheme not in ('http', 'https') or not partes.hostname:
        return False
    try:
        for info in socket.getaddrinfo(partes.hostname, None):
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                return False
    except OSError:
        return False
    return True


def leer_pagina(url, limite=20000, espera=12, respaldo=True):
    """Texto limpio de una pagina (vista de lectura)."""
    if not es_publica(url):
        raise ValueError('direccion no permitida')
    pedido = urllib.request.Request('https://r.jina.ai/' + url, headers={'User-Agent': NAVEGADOR, 'Accept': 'text/plain'})
    try:
        with urllib.request.urlopen(pedido, timeout=espera) as r:
            texto = r.read().decode('utf-8', 'replace')
        titulo = re.search(r'^Title:\s*(.+)$', texto, re.M)
        cuerpo = texto.split('Markdown Content:', 1)[-1]
        cuerpo = re.sub(r'!\[[^\]]*\]\([^)]*\)', '', cuerpo)            # sin imagenes
        cuerpo = re.sub(r'\[([^\]]*)\]\((?:[^()]|\([^)]*\))*\)', r'\1', cuerpo)  # enlaces -> solo texto
        cuerpo = re.sub(r'\n{3,}', '\n\n', cuerpo).strip()
        # se salta el menu de arriba: el texto empieza en el primer titulo de la pagina
        titulo_md = re.search(r'^#{1,2} \S', cuerpo[:4000], re.M)
        if titulo_md:
            cuerpo = cuerpo[titulo_md.start():]
        return {'titulo': titulo.group(1).strip() if titulo else url, 'texto': cuerpo[:limite]}
    except Exception:
        if not respaldo:
            raise
        # respaldo: bajar la pagina directo y quitar las etiquetas
        pedido = urllib.request.Request(url, headers={'User-Agent': NAVEGADOR})
        with urllib.request.urlopen(pedido, timeout=10) as r:
            crudo = r.read(2_000_000).decode('utf-8', 'replace')
        titulo = re.search(r'<title[^>]*>(.*?)</title>', crudo, re.S | re.I)
        crudo = re.sub(r'(?is)<(script|style|nav|footer|header|noscript)[^>]*>.*?</\1>', ' ', crudo)
        texto = html.unescape(re.sub(r'<[^>]+>', '\n', crudo))
        texto = re.sub(r'\n\s*\n+', '\n\n', re.sub(r'[ \t]+', ' ', texto)).strip()
        return {'titulo': html.unescape(titulo.group(1).strip()) if titulo else url, 'texto': texto[:limite]}


# «cuéntame más»: Filo se pone sus lentes y explica como una nerd entusiasmada
MODO_NERD = (
    "El «detalle» es tu TARJETA MODO NERD, escrita como una experta (como ChatGPT): se muestra en pantalla, no se lee "
    "en voz alta. Entre 100 y 300 palabras, sin emojis. Formato: la PRIMERA línea empieza con «= » y es la respuesta "
    "directa y exacta (el dato principal); luego secciones que empiezan con «## Título», listas con «- » o «1. », "
    "tablas con filas «| a | b |» (la primera fila es el encabezado) y lo importante en **negrita**. Datos exactos "
    "(números, fechas, medidas, nombres, unidades), el porqué y, si sirve, una comparación. Todo sacado del texto que "
    "te paso, sin inventar; si un dato no está, dilo. Tu personalidad de Filo solo en una frase corta al final. "
    "titulo: nombre corto del tema (máx. 6 palabras). "
)
RESPONDER_BUSQUEDA = (
    "Te paso resultados REALES de internet (varias páginas leídas). Responde la pregunta del Maestro usando SOLO esa "
    "información (si no alcanza, dilo). En «respuesta» (se lee en voz alta) va la respuesta EXACTA: 1 a 3 frases, "
    "máximo 45 palabras, con los datos concretos (números, nombres, fechas) y de qué página sale (por su nombre, no "
    "la dirección); sin rodeos, sin listas ni emojis. En «detalle» juntas lo que dicen las distintas páginas. "
    + MODO_NERD +
    "Reacciona con la emoción que te produce lo que encontraste (feliz, risa, emocionada, sorpresa, pensando, enojada, "
    "triste, pena, miedo, asco, timida, guino, amor, orgullosa o normal). "
    'Responde SOLO con JSON: {"respuesta": "...", "detalle": "...", "titulo": "...", "emocion": "..."}.'
)
EXPLICAR_ENLACE = (
    "El Maestro te pasó el enlace de una página y te pide que se la expliques. Te paso el texto REAL de esa página. "
    "Explica usando SOLO ese texto (si casi no tiene texto o no se pudo leer, dilo). En «respuesta» (se lee en voz "
    "alta) va de qué trata la página y lo más importante, exacto: 1 a 3 frases, máximo 45 palabras, sin listas ni "
    "emojis. En «detalle» explicas la página a fondo. " + MODO_NERD + "Si el Maestro pregunta algo concreto "
    "sobre la página, responde eso primero. Emoción: la que te produce. "
    'Responde SOLO con JSON: {"respuesta": "...", "detalle": "...", "titulo": "...", "emocion": "..."}.'
)
PAGINAS_A_LEER = 4  # se leen a la vez; si alguna tarda, se usa solo su resumen


def investigar(consulta, mensaje, pedir_json):
    resultados = buscar_web(consulta)
    if not resultados:
        return {'respuesta': 'Busqué, Maestro, pero no encontré nada sobre eso. ¿Lo pruebo con otras palabras?',
                'emocion': 'triste', 'resultados': []}
    primeros = resultados[:PAGINAS_A_LEER]
    with ThreadPoolExecutor(len(primeros)) as hilos:
        lecturas = list(hilos.map(lambda r: _leer_o_nada(r['url']), primeros))
    contexto = []
    for i, r in enumerate(resultados):
        parte = f"[{i + 1}] {r['titulo']} ({urllib.parse.urlparse(r['url']).hostname}): {r['resumen']}"
        if i < len(lecturas) and lecturas[i]:
            parte += '\nTexto de la página: ' + lecturas[i][:2500]
        contexto.append(parte)
    salida = pedir_json(RESPONDER_BUSQUEDA, 'Pregunta del Maestro: «' + mensaje[:400] + '»\nBúsqueda: ' + consulta
                        + '\n\nResultados:\n' + '\n\n'.join(contexto), sin_groq=True, max_tokens=1800)
    salida['resultados'] = resultados
    salida['leidas'] = [bool(x) for x in lecturas]
    return salida


def captura_pagina(url):
    """Foto de la pagina hecha por r.jina.ai (gratis, sin clave). Devuelve la direccion de la imagen o ''."""
    pedido = urllib.request.Request('https://r.jina.ai/' + url, headers={'Accept': 'application/json', 'X-Return-Format': 'screenshot'})
    try:
        with urllib.request.urlopen(pedido, timeout=25) as r:
            enlace = str((json.load(r).get('data') or {}).get('screenshotUrl') or '')
        return enlace if enlace.startswith('https://') else ''
    except Exception as e:
        print('captura fallo:', str(e)[:150], flush=True)
        return ''


def explicar_enlace(url, mensaje, pedir_json):
    url = url.strip().rstrip(".,;)»\"'")  # quita la puntuacion pegada al final del enlace
    if not es_publica(url):
        raise ValueError('direccion no permitida')
    with ThreadPoolExecutor(2) as hilos:
        foto = hilos.submit(captura_pagina, url)
        lectura = hilos.submit(lambda: leer_pagina(url, 12000, espera=15))
        try:
            pagina = lectura.result()
        except Exception as e:
            print('explicar: no se pudo leer', str(e)[:150], flush=True)
            pagina = {'titulo': urllib.parse.urlparse(url).hostname or url, 'texto': ''}
        captura = foto.result()
    sitio = (urllib.parse.urlparse(url).hostname or '').removeprefix('www.')
    if pagina['texto'].strip():
        salida = pedir_json(EXPLICAR_ENLACE, 'Lo que dice el Maestro: «' + mensaje[:400] + '»\nPágina: ' + pagina['titulo']
                            + ' (' + sitio + ')\n\nTexto de la página:\n' + pagina['texto'][:7000], sin_groq=True, max_tokens=1800)
    else:
        salida = {'respuesta': 'Uy, Maestro, esa página no me dejó leerla. Puedes abrirla tú con el botón, ¿sí?',
                  'detalle': '', 'emocion': 'pena'}
    salida.update(titulo=pagina['titulo'][:160], url=url, sitio=sitio, captura=captura)
    return salida


def _leer_o_nada(url):
    try:
        return leer_pagina(url, 6000, espera=6, respaldo=False)['texto']
    except Exception:
        return ''
