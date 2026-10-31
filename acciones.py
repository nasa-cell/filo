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
DIBUJOS = os.path.join(CARPETA, 'dibujos')
NAVEGADOR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

# pistas rapidas: solo si aparecen se pregunta a la IA si de verdad pide una accion
PISTAS = re.compile(r'dib[uú]j|ilustr|pint[ae]|im[aá]gen|crea(me)? una|haz(me)? una|video|v[ií]deo|youtube|canci[oó]n|m[uú]sica|'
                    r'reproduc|\bpon(me|er)?\b|busca|b[uú]scame|investiga|google|internet|noticia|[uú]ltima hora|p[aá]gina|web', re.I)

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


def planear(mensaje, pedir_json, historial=()):
    """Devuelve el plan si el mensaje pide dibujar, un video o buscar; si no, None."""
    if not PISTAS.search(mensaje):
        return None
    antes = '\n'.join(('Maestro: ' if h.get('rol') == 'usuario' else 'Filo: ') + str(h.get('texto', ''))[:200]
                      for h in list(historial)[-8:] if isinstance(h, dict))
    plan = pedir_json(PLAN, ('Conversación reciente:\n' + antes + '\n\n' if antes else '')
                      + 'El Maestro dice ahora: «' + mensaje[:400] + '»')
    if plan.get('accion') not in ('dibujo', 'video', 'buscar') or not str(plan.get('consulta', '')).strip():
        return None
    return {k: str(plan.get(k, '')).strip() for k in ('accion', 'consulta', 'titulo', 'respuesta', 'emocion', 'adivinanza')}


# ---------- dibujos ----------
def credenciales_cloudflare():
    cuenta, token = os.environ.get('CLOUDFLARE_ACCOUNT_ID'), os.environ.get('CLOUDFLARE_API_TOKEN')
    if not (cuenta and token):
        # las mismas credenciales gratis que usa el resumidor de PDF (nunca se copian a este proyecto)
        import importlib.util
        ruta = r'D:\descargas\Nueva carpeta (94)\resumidor-pdf-mvc\configuracion_local.py'
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


def _pedir_nube(accion, parametros, archivo=None):
    nube, llave, secreto = credenciales_nube()
    parametros = dict(parametros, timestamp=str(int(time.time())))
    campos = dict(parametros, api_key=llave, signature=_firmar(parametros, secreto))
    limite = '----filo' + str(int(time.time() * 1000))
    cuerpo = b''
    for k, v in campos.items():
        cuerpo += f'--{limite}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    if archivo:
        cuerpo += (f'--{limite}\r\nContent-Disposition: form-data; name="file"; filename="dibujo.jpg"\r\n'
                   'Content-Type: image/jpeg\r\n\r\n').encode() + archivo + b'\r\n'
    cuerpo += f'--{limite}--\r\n'.encode()
    pedido = urllib.request.Request(f'https://api.cloudinary.com/v1_1/{nube}/image/{accion}', data=cuerpo,
                                    headers={'Content-Type': f'multipart/form-data; boundary={limite}'})
    with urllib.request.urlopen(pedido, timeout=40) as r:
        return json.load(r)


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


def dibujar(prompt):
    cuenta, token = credenciales_cloudflare()
    datos = json.dumps({'prompt': prompt[:1500], 'steps': 6}).encode()
    pedido = urllib.request.Request(
        f'https://api.cloudflare.com/client/v4/accounts/{cuenta}/ai/run/@cf/black-forest-labs/flux-1-schnell',
        data=datos, headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(pedido, timeout=60) as r:
        imagen = base64.b64decode(json.load(r)['result']['image'])
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


# ---------- internet ----------
def buscar_web(consulta):
    pedido = urllib.request.Request('https://html.duckduckgo.com/html/?kl=es-es&q=' + urllib.parse.quote(consulta),
                                    headers={'User-Agent': NAVEGADOR})
    with urllib.request.urlopen(pedido, timeout=10) as r:
        pagina = r.read().decode('utf-8', 'replace')
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


RESPONDER_BUSQUEDA = (
    "Te paso resultados REALES de internet. Responde la pregunta del Maestro usando SOLO esa información (si no "
    "alcanza, dilo). Cita de qué página sale el dato principal (por su nombre, no la dirección). Primera frase corta "
    "que ya responda; máximo 90 palabras; sin listas ni emojis; con tu personalidad de Filo. Reacciona con la emoción "
    "que te produce lo que encontraste (feliz, risa, emocionada, sorpresa, pensando, enojada, triste, pena, miedo, "
    "asco, timida, guino, amor, orgullosa o normal). "
    'Responde SOLO con JSON: {"respuesta": "...", "emocion": "..."}.'
)


def investigar(consulta, mensaje, pedir_json):
    resultados = buscar_web(consulta)
    if not resultados:
        return {'respuesta': 'Busqué, Maestro, pero no encontré nada sobre eso. ¿Lo pruebo con otras palabras?',
                'emocion': 'triste', 'resultados': []}
    # se leen las 2 primeras paginas a la vez (si tardan, se usan solo los resumenes)
    with ThreadPoolExecutor(2) as hilos:
        lecturas = list(hilos.map(lambda r: _leer_o_nada(r['url']), resultados[:2]))
    contexto = []
    for i, r in enumerate(resultados):
        parte = f"[{i + 1}] {r['titulo']} ({urllib.parse.urlparse(r['url']).hostname}): {r['resumen']}"
        if i < 2 and lecturas[i]:
            parte += '\nTexto de la página: ' + lecturas[i][:3000]
        contexto.append(parte)
    salida = pedir_json(RESPONDER_BUSQUEDA, 'Pregunta del Maestro: «' + mensaje[:400] + '»\nBúsqueda: ' + consulta
                        + '\n\nResultados:\n' + '\n\n'.join(contexto))
    salida['resultados'] = resultados
    return salida


def _leer_o_nada(url):
    try:
        return leer_pagina(url, 6000, espera=6, respaldo=False)['texto']
    except Exception:
        return ''
