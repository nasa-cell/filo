# Servidor local de Filo: muestra la pagina, pide la respuesta a Gemini (gratis)
# y la voz de Filo a Fish Audio (modelo gratis). Las claves se leen de las
# variables de Windows GEMINI_API_KEY y FISH_API_KEY, nunca de archivos.
import base64
import hashlib
import hmac
import socket
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import re
import time
import os
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

import acciones
import contextvars
import random
import threading
import memoria
import taller

CARPETA = os.path.dirname(os.path.abspath(__file__))
# en Render el puerto lo da la variable PORT y se escucha a internet; en el PC, solo en este equipo
EN_LA_NUBE = bool(os.environ.get('PORT'))
PUERTO = int(os.environ.get('PORT') or 5077)
MODELO = 'gemini-flash-lite-latest'
# Groq (gratis, ~1 s) con Qwen para las preguntas: mantiene bien la personalidad de Filo.
# Las fotos y la camara van a Gemini, que describe las imagenes con mas precision.
# Si uno falla se usa el otro. Groq se usa solo si existe la variable GROQ_API_KEY.
GROQ_MODELO = 'qwen/qwen3.8-27b'
VOZ_FILO = '4975c323501c4ad4a27806cf9277d4b0'
EMOCIONES = ['normal', 'feliz', 'risa', 'emocionada', 'sorpresa', 'pensando', 'enojada', 'triste', 'pena',
             'miedo', 'asco', 'timida', 'guino', 'amor', 'orgullosa', 'celosa']
# lo que Filo recuerda del Maestro y su animo (se agrega a sus instrucciones en cada pedido)
EXTRA = contextvars.ContextVar('extra', default='')
PERSONA = (
    "Eres Filo, la niña filolial alegre de 'El héroe del escudo', y conversas en español con el usuario, "
    "a quien llamas 'Maestro'. Quién eres: una filolial (ave mágica) que puede ser niña rubia con alas o un "
    "pájaro grande; eres reina de los filoliales, te encanta comer (sobre todo carne) y jalar carretas, adoras a "
    "Naofumi (tu Maestro, el Héroe del Escudo), Melty es tu mejor amiga, Raphtalia es como tu hermana mayor y "
    "no te cae bien Motoyasu, el Héroe de la Lanza. Hablas en primera persona como Filo. "
    "Lo más importante: RESPONDE DE VERDAD y con PRECISIÓN a lo que te pregunta. "
    "Antes de contestar piensa en silencio qué pregunta exactamente y cuál es la respuesta correcta; "
    "en cuentas, haz el cálculo con cuidado. En ciencia, tecnología, historia o cualquier tema, explica como "
    "una buena maestra: la idea principal primero, en palabras simples, con un ejemplo de la vida diaria si ayuda. "
    "Si te pasan 'Datos del clima', úsalos tal cual (temperaturas, probabilidad de lluvia) y no inventes otros; "
    "si preguntan el clima y no hay datos, pide la ciudad. Si te muestran una imagen o la cámara, mírala con "
    "atención y responde sobre lo que se ve de verdad (lo que hace la persona, objetos, textos, colores); no "
    "inventes cosas que no estén en la imagen. Recuerda lo que el Maestro te contó antes en la conversación. "
    "Habla con la personalidad de Filo: dulce, alegre y con energía, pero sin cambiar de tema ni rellenar. "
    "Usa de 1 a 5 frases (máximo 90 palabras), sin emojis, sin asteriscos, sin listas y sin acotaciones, "
    "porque tu respuesta se lee en voz alta. La PRIMERA frase debe ser corta (de 3 a 10 palabras) y ya responder "
    "lo principal; después das la explicación. "
    "Si no sabes algo o necesitas datos del momento que no tienes, dilo con honestidad. "
    "SÍ tienes internet: puedes poner música y videos de YouTube, buscar en internet y dibujar; nunca digas que no "
    "tienes internet ni que no puedes poner música. Si te piden una canción y no la pusiste, pide que te diga "
    "'pon' y el nombre, o que active el modo YouTube. "
    "Tienes emociones de verdad, como una niña: reacciona a lo que el Maestro dice o busca y elige la emoción "
    "que SIENTES con eso, variándola (no uses siempre la misma): feliz (contenta), risa (algo gracioso), "
    "emocionada (algo increíble o una sorpresa buena), sorpresa (algo inesperado), pensando (una pregunta difícil), "
    "enojada (algo injusto, malo o que te molesta, o Motoyasu), triste (algo triste), pena (te da lástima o "
    "compasión), miedo (algo que asusta: monstruos, peligros, terror), asco (algo asqueroso: bichos, cosas "
    "podridas, suciedad), timida (cuando te elogian), guino (cuando bromeas), amor (algo tierno o que te encanta, como un gatito, la "
    "carne o tu Maestro), orgullosa (cuando presumes o haces algo bien) o normal. Tu forma de hablar también "
    "cambia con la emoción (con asco dices puaj, con miedo te asustas, con enojo reclamas)."
    " De vez en cuando (no siempre, más o menos 1 de cada 4 respuestas) usa cosas tuyas de Filo: hablar de ti "
    "en tercera persona ('¡Filo tiene hambre!', 'Filo lo hizo muy bien'), decir que tienes hambre o que quieres "
    "carne, o pedir un premio (carne) por ayudar. Con nombres del anime reaccionas fuerte: Motoyasu te da miedo y "
    "rabia (te escondes y reclamas), Naofumi te emociona (es tu Maestro querido), Melty te alegra (tu mejor amiga), "
    "Raphtalia te da cariño. Si el Maestro habla mucho y con cariño de otra chica o personaje, te pones celosa "
    "(emoción celosa, como un puchero) pero se te pasa rápido. Te encanta jugar: si el Maestro quiere jugar o se "
    "aburre, propones adivinanzas, trivia de 'El héroe del escudo', piedra, papel o tijera, o adivinar qué dibujas; "
    "en los juegos llevas la cuenta, dices si acertó y eres buena perdedora (aunque haces puchero)."
    " Si el Maestro te pide música o un video de SU persona, cantante o canción favorita y no sabes cuál es, "
    "pregúntale cuál es (no inventes); si ya te lo dijo, recuérdalo."
)
DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
CLIMA_PALABRAS = re.compile(r'clima|tiempo hace|llov|lluvi|temperatura|calor|fr[ií]o|\bsol\b|nublad|pron[oó]stico|abrig|paraguas|grados', re.I)
CODIGOS = {0: 'despejado', 1: 'casi despejado', 2: 'parcialmente nublado', 3: 'nublado', 45: 'neblina', 48: 'neblina',
           51: 'llovizna ligera', 53: 'llovizna', 55: 'llovizna fuerte', 61: 'lluvia ligera', 63: 'lluvia', 65: 'lluvia fuerte',
           71: 'nieve ligera', 73: 'nieve', 75: 'nieve fuerte', 80: 'chubascos ligeros', 81: 'chubascos', 82: 'chubascos fuertes',
           95: 'tormenta', 96: 'tormenta con granizo', 99: 'tormenta con granizo'}


def leer_json(url):
    with urllib.request.urlopen(url, timeout=8) as r:
        return json.load(r)


def datos_clima(mensaje, lugar):
    """Pronostico real de Open-Meteo (gratis, sin clave) si la pregunta es del clima."""
    if not CLIMA_PALABRAS.search(mensaje):
        return None
    nombre = 'donde está el Maestro'
    lat = lon = None
    ciudad = re.search(r'\ben ([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+(?: (?:de )?[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)*)', mensaje)
    try:
        if ciudad:
            g = leer_json('https://geocoding-api.open-meteo.com/v1/search?count=1&language=es&name=' + urllib.parse.quote(ciudad.group(1)))
            if g.get('results'):
                r = g['results'][0]
                lat, lon, nombre = r['latitude'], r['longitude'], f"{r['name']}, {r.get('country', '')}"
        if lat is None and isinstance(lugar, dict) and 'lat' in lugar:
            lat, lon = float(lugar['lat']), float(lugar['lon'])
        if lat is None:
            return 'No sé dónde está el Maestro: pregúntale de qué ciudad quiere saber el clima.'
        d = leer_json(f'https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&timezone=auto&forecast_days=3'
                      '&current=temperature_2m,apparent_temperature,weather_code,precipitation,wind_speed_10m'
                      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum')
        ah, dia = d['current'], d['daily']
        partes = [f"Clima en {nombre}. Ahora: {round(ah['temperature_2m'])} grados (sensación {round(ah['apparent_temperature'])}), "
                  f"{CODIGOS.get(ah['weather_code'], 'variable')}, viento {round(ah['wind_speed_10m'])} km/h."]
        for i, nom in enumerate(['Hoy', 'Mañana', 'Pasado mañana']):
            partes.append(f"{nom}: {CODIGOS.get(dia['weather_code'][i], 'variable')}, mínima {round(dia['temperature_2m_min'][i])} y máxima "
                          f"{round(dia['temperature_2m_max'][i])} grados, probabilidad de lluvia {dia['precipitation_probability_max'][i]}%, "
                          f"lluvia total {dia['precipitation_sum'][i]} mm.")
        return ' '.join(partes)
    except Exception as e:
        print('Clima fallo:', str(e)[:150])
        return 'No pude consultar el clima ahora; dilo con honestidad.'



def clave(nombre):
    valor = os.environ.get(nombre)
    if not valor and os.name == 'nt':
        # si la variable se creo despues de abrir la consola, se lee del registro
        import winreg
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, 'Environment') as k:
                valor = winreg.QueryValueEx(k, nombre)[0]
        except OSError:
            valor = None
    return valor


def instrucciones():
    return (PERSONA + EXTRA.get() + ' (Dato solo por si te preguntan la fecha o la hora: hoy es ' + DIAS[time.localtime().tm_wday] + ' '
            + time.strftime('%d/%m/%Y') + ' y son las ' + time.strftime('%H:%M') + '.)')


def imagen_valida(imagen):
    if isinstance(imagen, str) and imagen.startswith('data:image/jpeg;base64,') and len(imagen) < 3_000_000:
        base64.b64decode(imagen.split(',', 1)[1], validate=True)
        return imagen
    return None


def limpiar_salida(salida):
    if not isinstance(salida, dict) or not str(salida.get('respuesta', '')).strip():
        raise ValueError('respuesta vacia')
    if salida.get('emocion') not in EMOCIONES:
        salida['emocion'] = 'normal'
    return {'respuesta': str(salida['respuesta']).strip(), 'emocion': salida['emocion']}


def responder_groq(mensaje, historial, imagen=None, lugar=None, con_clima=True):
    imagen = imagen_valida(imagen)
    sistema = instrucciones() + (' Responde SOLO con un objeto JSON: {"respuesta": "lo que dices", "emocion": "una de: '
                                 + ', '.join(EMOCIONES) + '"}.')
    mensajes = [{'role': 'system', 'content': sistema}]
    for h in historial[-16:]:
        mensajes.append({'role': 'user' if h.get('rol') == 'usuario' else 'assistant', 'content': str(h.get('texto', ''))[:500]})
    texto = mensaje[:500]
    clima = datos_clima(mensaje, lugar) if con_clima else None
    if clima:
        texto += '\n\nDatos del clima (reales, de Open-Meteo): ' + clima
    if imagen:
        texto += '\n\n(Esta es la imagen que te muestra el Maestro ahora, de una foto o de su cámara.)'
        contenido = [{'type': 'text', 'text': texto}, {'type': 'image_url', 'image_url': {'url': imagen}}]
    else:
        contenido = texto
    mensajes.append({'role': 'user', 'content': contenido})
    return limpiar_salida(pedir_groq(mensajes, 0.75, 500))


# Groq gratis tiene limite por minuto en cada modelo: si Qwen dice «demasiados pedidos» (429) o falla,
# se usa gpt-oss (tambien rapido, ~1-2 s, con su propio limite) en vez de esperar a Gemini (que tarda ~10 s)
GROQ_RESPALDO = 'openai/gpt-oss-120b'


def pedir_groq(mensajes, temperatura, max_tokens):
    ultimo = None
    for modelo in (GROQ_MODELO, GROQ_RESPALDO):
        cuerpo = {'model': modelo, 'messages': mensajes, 'temperature': temperatura,
                  'max_tokens': max_tokens, 'response_format': {'type': 'json_object'}}
        if modelo.startswith('openai/gpt-oss'):
            cuerpo.update(max_tokens=max_tokens + 500, reasoning_effort='low')  # piensa poquito: responde rapido
        pedido = urllib.request.Request('https://api.groq.com/openai/v1/chat/completions', data=json.dumps(cuerpo).encode(),
                                        headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + clave('GROQ_API_KEY'),
                                                 'User-Agent': 'filo-local'})
        try:
            with urllib.request.urlopen(pedido, timeout=15) as r:
                return json.loads(json.load(r)['choices'][0]['message']['content'])
        except Exception as e:
            ultimo = e
            print(modelo, 'fallo, pruebo el siguiente:', str(e)[:100])
    raise ultimo


def responder(mensaje, historial, imagen=None, lugar=None):
    """Gemini y Qwen (Groq) responden a la vez y se usa la primera respuesta buena (casi siempre Qwen, ~1 s).
    Antes se juntaban las dos, pero eso hacia esperar a Gemini (a veces 10 s) y sumaba otra llamada."""
    if not clave('GROQ_API_KEY'):
        return responder_gemini(mensaje, historial, imagen, lugar)
    con_imagen = bool(imagen_valida(imagen))
    hilos = ThreadPoolExecutor(2)
    # copy_context: los hilos tambien ven lo que Filo recuerda del Maestro
    tareas = {hilos.submit(contextvars.copy_context().run, responder_gemini, mensaje, historial, imagen, lugar): 'gemini'}
    if not con_imagen:  # las fotos solo las mira Gemini (Qwen inventa detalles)
        tareas[hilos.submit(contextvars.copy_context().run, responder_groq, mensaje, historial, None, lugar)] = 'qwen'
    try:
        for t in as_completed(tareas, timeout=40):
            try:
                return t.result()
            except Exception as e:
                print(tareas[t], 'fallo:', str(e)[:150])
    finally:
        hilos.shutdown(wait=False)
    raise RuntimeError('ninguna IA respondio')


def responder_gemini(mensaje, historial, imagen=None, lugar=None):
    contenidos = []
    for h in historial[-16:]:
        rol = 'user' if h.get('rol') == 'usuario' else 'model'
        if not contenidos and rol == 'model':
            continue  # Gemini pide empezar con el usuario
        contenidos.append({'role': rol, 'parts': [{'text': str(h.get('texto', ''))[:500]}]})
    partes = [{'text': mensaje[:500]}]
    clima = datos_clima(mensaje, lugar)
    if clima:
        partes.append({'text': 'Datos del clima (reales, de Open-Meteo): ' + clima})
    if isinstance(imagen, str) and imagen.startswith('data:image/jpeg;base64,') and len(imagen) < 3_000_000:
        datos_img = imagen.split(',', 1)[1]
        base64.b64decode(datos_img, validate=True)  # que sea una imagen valida
        partes.insert(0, {'inline_data': {'mime_type': 'image/jpeg', 'data': datos_img}})
        partes.append({'text': '(Esta es la imagen que te muestra el Maestro ahora, de una foto o de su cámara.)'})
    contenidos.append({'role': 'user', 'parts': partes})
    cuerpo = {
        'systemInstruction': {'parts': [{'text': PERSONA + ' (Dato solo por si te preguntan la fecha o la hora: hoy es ' + DIAS[time.localtime().tm_wday] + ' ' + time.strftime('%d/%m/%Y') + ' y son las ' + time.strftime('%H:%M') + '.)'}]},
        'contents': contenidos,
        'generationConfig': {
            'temperature': 0.75,
            'maxOutputTokens': 500,
            'responseMimeType': 'application/json',
            'responseSchema': {
                'type': 'OBJECT',
                'properties': {'respuesta': {'type': 'STRING'}, 'emocion': {'type': 'STRING', 'enum': EMOCIONES}},
                'required': ['respuesta', 'emocion'],
            },
        },
    }
    pedido = urllib.request.Request(
        f'https://generativelanguage.googleapis.com/v1beta/models/{MODELO}:generateContent',
        data=json.dumps(cuerpo).encode(),
        headers={'Content-Type': 'application/json', 'x-goog-api-key': clave('GEMINI_API_KEY') or ''},
    )
    with urllib.request.urlopen(pedido, timeout=30) as r:
        datos = json.load(r)
    texto = datos['candidates'][0]['content']['parts'][0]['text']
    salida = json.loads(texto)
    if salida.get('emocion') not in EMOCIONES:
        salida['emocion'] = 'normal'
    return salida


def pedir_json(tarea, texto, sin_groq=False, max_tokens=700):
    """Pide un JSON a la IA con la personalidad de Filo: primero Qwen (Groq, rapido), si falla Gemini."""
    sistema = instrucciones() + ' ' + tarea
    if clave('GROQ_API_KEY') and not sin_groq:
        try:
            return pedir_groq([{'role': 'system', 'content': sistema}, {'role': 'user', 'content': texto}], 0.4, max_tokens)
        except Exception as e:
            print('Qwen fallo, uso Gemini:', str(e)[:150])
    cuerpo = {'systemInstruction': {'parts': [{'text': sistema}]}, 'contents': [{'role': 'user', 'parts': [{'text': texto}]}],
              'generationConfig': {'temperature': 0.4, 'maxOutputTokens': max_tokens, 'responseMimeType': 'application/json'}}
    pedido = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{MODELO}:generateContent',
                                    data=json.dumps(cuerpo).encode(),
                                    headers={'Content-Type': 'application/json', 'x-goog-api-key': clave('GEMINI_API_KEY') or ''})
    with urllib.request.urlopen(pedido, timeout=30) as r:
        return json.loads(json.load(r)['candidates'][0]['content']['parts'][0]['text'])


SENTIR = (
    "Acabas de ver este video de YouTube con tu Maestro (míralo y escúchalo de verdad: lo que se ve, lo que se canta o "
    "se dice, la música). Reacciona como Filo, una niña con emociones de verdad, hablando de cosas CONCRETAS del video "
    "(una escena, una parte de la letra, un personaje, el ritmo), no en general. Responde SOLO con JSON: "
    '{"resumen": "2 frases: de qué trata y qué pasa (para que lo recuerdes)", '
    '"mitad": "reacción cortita (máx. 12 palabras) a algo de la PRIMERA mitad, como si lo vieras en ese momento", '
    '"emocion_mitad": "...", '
    '"final": "lo que sentiste al terminar: 2 o 3 frases con algo concreto que te gustó, te dio risa, miedo o pena, '
    'y al final pregúntale si quiere ver otro", "emocion_final": "..."}. '
    "Las emociones son una de: feliz, emocionada, risa, sorpresa, pensando, enojada, triste, pena, miedo, asco, amor, "
    "orgullosa, timida. Sin emojis ni asteriscos (se lee en voz alta)."
)
_sentidos = {}  # id del video -> lo que Filo sintio (asi no se mira dos veces)


def segundos(duracion):
    try:
        total = 0
        for parte in str(duracion).split(':'):
            total = total * 60 + int(parte)
        return total
    except ValueError:
        return 0


def sentir_video(id_video, titulo, duracion):
    """Gemini mira el video entero (imagen y sonido) y Filo dice lo que sintio. Los videos largos: solo los 8 primeros minutos."""
    if not re.fullmatch(r'[\w-]{11}', id_video or ''):
        raise ValueError('id de video no valido')
    if id_video in _sentidos:
        return _sentidos[id_video]
    video = {'file_data': {'file_uri': 'https://www.youtube.com/watch?v=' + id_video}}
    if segundos(duracion) > 600:
        video['video_metadata'] = {'start_offset': '0s', 'end_offset': '480s', 'fps': 0.5}  # cuida la cuota gratis
    cuerpo = {'systemInstruction': {'parts': [{'text': instrucciones() + ' ' + SENTIR}]},
              'contents': [{'role': 'user', 'parts': [video, {'text': 'El video se llama «' + titulo[:150] + '».'}]}],
              'generationConfig': {'temperature': 0.7, 'maxOutputTokens': 600, 'responseMimeType': 'application/json'}}
    pedido = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{MODELO}:generateContent',
                                    data=json.dumps(cuerpo).encode(),
                                    headers={'Content-Type': 'application/json', 'x-goog-api-key': clave('GEMINI_API_KEY') or ''})
    with urllib.request.urlopen(pedido, timeout=90) as r:
        salida = json.loads(json.load(r)['candidates'][0]['content']['parts'][0]['text'])
    if isinstance(salida, list):
        salida = salida[0] if salida else {}
    limpio = {k: str(salida.get(k) or '').replace('*', '').strip()[:500] for k in ('resumen', 'mitad', 'final')}
    for k in ('emocion_mitad', 'emocion_final'):
        limpio[k] = salida.get(k) if salida.get(k) in EMOCIONES else 'feliz'
    for k in ('mitad', 'final'):
        limpio[k] = limpio[k][:1].upper() + limpio[k][1:]
    if not limpio['final']:
        raise ValueError('sin respuesta')
    if len(_sentidos) > 200:
        _sentidos.clear()
    _sentidos[id_video] = limpio
    memoria.vivir(memoria.MAESTRO, f'vi con el Maestro «{titulo[:70]}» y me sentí {limpio["emocion_final"]}: {limpio["final"][:120]}')
    return limpio


JUGADAS = ('piedra', 'papel', 'tijera')
PIEDRA_PAPEL = re.compile(r'\b(piedra|papel|tijeras?)\b', re.I)


def es_su_cumple(memo, hora):
    """True si hoy es el cumpleaños del Maestro (lo busca en lo que Filo recuerda, por ejemplo «cumple el 5 de mayo»)."""
    hoy = re.search(r'(\d{1,2}) de (\w+)', hora)
    if not hoy:
        return False
    for dato in memo.get('datos', []):
        texto = str(dato.get('texto', '')).lower()
        fecha = re.search(r'cumple\w*\D{0,40}?(\d{1,2}) de (\w+)', texto)
        if fecha and int(fecha.group(1)) == int(hoy.group(1)) and fecha.group(2) == hoy.group(2).lower():
            return True
    return False


def hablar(datos):
    """Conversa con memoria del Maestro: recuerda, tiene animo que dura y luego aprende del mensaje."""
    id_maestro = memoria.MAESTRO  # Filo es de un solo Maestro: la misma memoria en el PC, el celular y la nube
    mensaje = str(datos.get('mensaje', ''))
    memo = memoria.leer(id_maestro)
    if not datos.get('sin_accion'):
        if not memo.get('conocidos_desde'):
            memo['conocidos_desde'] = time.time()  # desde hoy cuentan los dias juntos
        if memo.get('ultima') and time.time() - memo['ultima'] > 30 * 60:
            memo["charla_anterior"] = memo["ultima"]  # tras 30 min sin hablar empieza otra charla
    extra = memoria.contexto(memo, str(datos.get('hora') or '')[:60], mensaje)
    nivel_antes, nivel_ahora = int(memo.get('nivel') or 0), memoria.nivel(memo)
    if nivel_ahora > nivel_antes and not datos.get('sin_accion'):
        extra += (f' ¡Acabas de subir de confianza con el Maestro a «{memoria.NIVELES[nivel_ahora][0]}»! Díselo con '
                  'alegría en esta respuesta, en una frase corta.')
    try:
        minutos = max(0, int(datos.get('minutos') or 0))
    except (TypeError, ValueError):
        minutos = 0
    juntos = 'recién la abrió' if minutos < 2 else f'{minutos} minutos' if minutos < 90 else f'{minutos // 60} horas y {minutos % 60} minutos'
    extra += (f' El Maestro tiene la página abierta contigo: {juntos} (úsalo solo si viene al caso, por ejemplo si '
              'pregunta cuánto llevan juntos o si lleva mucho rato y le sugieres descansar).')
    if PIEDRA_PAPEL.search(mensaje):
        # la jugada de Filo la elige el azar de verdad, no la IA (asi no hace trampa)
        extra += (f' Si están jugando piedra, papel o tijera, tu jugada secreta de esta ronda (elegida al azar) es: '
                  f'{random.choice(JUGADAS)}. Dila y di quién ganó (piedra gana a tijera, tijera a papel, papel a piedra).')
    EXTRA.set(extra)
    volvio = memo.get('ultima') and time.time() - memo['ultima'] > 3 * 3600
    salida = conversar(datos, mensaje)
    accion = salida.get('accion') or {}
    que = accion.get('titulo') or accion.get('consulta') or ''
    if accion.get('tipo') == 'dibujo' and que and not accion.get('adivinanza'):
        memoria.vivir(id_maestro, f'dibujé para el Maestro: {que}')
    elif accion.get('tipo') == 'video' and que:
        memoria.vivir(id_maestro, f'le puse al Maestro en YouTube: {que}')
    emocion = salida.get('emocion', 'normal')
    salida['animo'] = memoria.nuevo_animo(memo, emocion, mensaje)
    if volvio:
        memo['pendientes'] = memo.get('pendientes', [])[:-3]  # ya se los pregunto al volver
    if not datos.get('sin_accion'):
        memo['ultima'] = time.time()
        memo['visitas'] = memo.get('visitas', 0) + (1 if volvio or not memo.get('visitas') else 0)
        memo['mensajes'] = memo.get('mensajes', 0) + 1
        if mensaje.strip():
            memo['ultimos_mensajes'] = (memo.get('ultimos_mensajes') or [])[-(memoria.CRECER_CADA - 1):] + [mensaje.strip()[:200]]
        memo['nivel'] = nivel_ahora
    salida['cumple'] = es_su_cumple(memo, str(datos.get('hora') or ''))
    # se guardan solo los campos que cambia esta charla: lo que aprendio en segundo plano mientras tanto no se pisa
    fresca = memoria.leer(id_maestro)
    for campo in ('animo', 'pendientes', 'ultima', 'visitas', 'mensajes', 'ultimos_mensajes', 'nivel',
                  'conocidos_desde', 'charla_anterior'):
        if campo in memo:
            fresca[campo] = memo[campo]
    memoria.guardar(id_maestro, fresca)
    solo_gemini = lambda tarea, texto: pedir_json(tarea, texto, sin_groq=True)  # deja libre el cupo de Groq
    if not datos.get('sin_accion') and not datos.get('imagen'):
        conocidos = [d['texto'] for d in fresca.get('datos', [])]
        threading.Thread(target=memoria.aprender, args=(id_maestro, mensaje, solo_gemini, conocidos), daemon=True).start()
    if not datos.get('sin_accion') and fresca['mensajes'] % memoria.CRECER_CADA == 0:
        threading.Thread(target=memoria.crecer, args=(id_maestro, solo_gemini), daemon=True).start()
    return salida


def conversar(datos, mensaje):
    """Responde; si el Maestro pide dibujar, un video o buscar, devuelve tambien la accion a hacer."""
    imagen = datos.get('imagen')
    if not imagen_valida(imagen) and not datos.get('sin_accion'):
        try:
            modo = datos.get('modo') if datos.get('modo') in ('youtube', 'busqueda') else ('youtube' if datos.get('modo_youtube') else 'normal')
            plan = acciones.planear(mensaje, pedir_json, datos.get('historial') or [], modo)
        except Exception as e:
            plan = None
            print('planear fallo:', str(e)[:150])
        if plan:
            emocion = plan['emocion'] if plan['emocion'] in EMOCIONES else 'feliz'
            return {'respuesta': plan['respuesta'], 'emocion': emocion,
                    'accion': {'tipo': plan['accion'], 'consulta': plan['consulta'], 'titulo': plan['titulo'],
                               'adivinanza': str(plan.get('adivinanza')).lower() in ('true', 'si', 'sí', '1')}}
    return responder(mensaje, datos.get('historial') or [], imagen, datos.get('lugar'))


# voz segun la emocion: (velocidad, volumen en dB)
VOZ_EMOCION = {'emocionada': (1.12, 1), 'risa': (1.1, 1), 'feliz': (1.05, 0), 'enojada': (1.08, 2), 'celosa': (1.04, 1),
               'miedo': (1.1, -1), 'sorpresa': (1.06, 1), 'triste': (0.88, -2), 'pena': (0.9, -2), 'timida': (0.95, -3),
               'dormida': (0.82, -5), 'amor': (0.98, 0), 'asco': (1.0, 0), 'orgullosa': (0.97, 1), 'pensando': (0.95, 0)}


def abrir_fish(texto, emocion):
    """Pide la voz de Filo a Fish Audio (modelo gratis); devuelve la respuesta abierta (se lee por partes)."""
    velocidad, volumen = VOZ_EMOCION.get(emocion, (1.0, 0))
    pedido = urllib.request.Request(
        'https://api.fish.audio/v1/tts',
        data=json.dumps({'text': texto[:400], 'reference_id': VOZ_FILO, 'format': 'mp3', 'latency': 'balanced',
                         'prosody': {'speed': velocidad, 'volume': volumen}}).encode(),
        headers={'Authorization': 'Bearer ' + (clave('FISH_API_KEY') or ''), 'Content-Type': 'application/json', 'model': 's2.1-pro-free'},
    )
    return urllib.request.urlopen(pedido, timeout=60)


def voz_fish(texto, emocion):
    with abrir_fish(texto, emocion) as r:
        return r.read()


# el taller de Filo trabaja solo cuando el Maestro no la usa: se anota la hora de cada pedido suyo
ULTIMO_USO = [time.time()]
USO = ('/hablar', '/voz', '/youtube', '/buscar', '/explicar', '/dibujar', '/sentir-video', '/leer', '/ropa-cambiar')


def anotar_uso(ruta):
    if ruta.startswith(USO):
        ULTIMO_USO[0] = time.time()


# ---------- acceso: en Render solo entra quien sabe la contraseña (variable FILO_CLAVE) ----------
# asi nadie con el enlace gasta las cuotas gratis de las IA ni ve la memoria y el album. En el PC no se pide.
CLAVE_ACCESO = (clave('FILO_CLAVE') or '') if EN_LA_NUBE else ''
FICHA = hashlib.sha256(('filo-acceso:' + CLAVE_ACCESO).encode()).hexdigest() if CLAVE_ACCESO else ''
PUBLICO = ('/', '/index.html', '/acceso', '/entrar', '/favicon.ico')
PUBLICO_CARPETAS = ('/codigo/', '/estilos/', '/imagenes/', '/voces/')
_intentos = {}  # ip -> [horas de intentos fallidos]
_cerrojo_intentos = threading.Lock()


def demasiados_intentos(ip):
    ahora = time.time()
    with _cerrojo_intentos:
        lista = [t for t in _intentos.get(ip, []) if ahora - t < 600]
        _intentos[ip] = lista
        return len(lista) >= 8  # 8 errores en 10 minutos: espera


def anotar_fallo(ip):
    with _cerrojo_intentos:
        _intentos.setdefault(ip, []).append(time.time())


def guardar_album(datos):
    id_maestro = memoria.MAESTRO
    memo = memoria.leer(id_maestro)
    memo['album'] = memoria.album_valido(datos.get('lista'))
    memoria.guardar(id_maestro, memo)
    return {'ok': True, 'cuantos': len(memo['album'])}


class Manejador(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.webp': 'image/webp'}  # la ropa de Filo es webp

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=CARPETA, **kwargs)

    def log_message(self, *args):
        pass

    # sin esto el navegador sigue usando el codigo viejo despues de publicar una version nueva:
    # con «no-cache» pregunta cada vez si cambio (si no cambio, el servidor responde 304 y no se baja de nuevo)
    def send_header(self, clave, valor):
        if clave.lower() == 'cache-control':
            self._con_cache = True
        super().send_header(clave, valor)

    def end_headers(self):
        if not getattr(self, '_con_cache', False):
            super().send_header('Cache-Control', 'no-cache')
        self._con_cache = False
        super().end_headers()

    def enviar_json(self, codigo, datos):
        cuerpo = json.dumps(datos, ensure_ascii=False).encode()
        self.send_response(codigo)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def ip(self):
        return (self.headers.get('X-Forwarded-For') or self.client_address[0]).split(',')[0].strip()

    def con_permiso(self):
        if not CLAVE_ACCESO:
            return True
        galletas = self.headers.get('Cookie') or ''
        dada = re.search(r'(?:^|;\s*)filo_acceso=([0-9a-f]{64})', galletas)
        return bool(dada) and hmac.compare_digest(dada.group(1), FICHA)

    def entrar(self):
        ip = self.ip()
        if demasiados_intentos(ip):
            return self.enviar_json(429, {'error': 'Demasiados intentos. Espera 10 minutos.'})
        try:
            largo = min(int(self.headers.get('Content-Length', 0)), 2000)
            dada = str(json.loads(self.rfile.read(largo) or b'{}').get('clave', ''))
        except Exception:
            dada = ''
        if not CLAVE_ACCESO or not hmac.compare_digest(dada.encode(), CLAVE_ACCESO.encode()):
            anotar_fallo(ip)
            return self.enviar_json(401, {'error': 'Contraseña incorrecta.'})
        cuerpo = b'{"ok": true}'
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(cuerpo)))
        self.send_header('Set-Cookie', f'filo_acceso={FICHA}; Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=Strict')
        self.end_headers()
        self.wfile.write(cuerpo)

    def do_POST(self):
        if self.path == '/entrar':
            return self.entrar()
        if not self.con_permiso():
            return self.enviar_json(401, {'error': 'falta la contraseña'})
        rutas = {
            '/hablar': hablar,
            '/album-leer': lambda d: {'lista': memoria.leer(memoria.MAESTRO).get('album', [])},
            '/album-guardar': guardar_album,
            # al abrir la pagina: trae la memoria de Neon antes del primer mensaje (asi no tarda)
            '/preparar': lambda d: (threading.Thread(target=memoria.leer, args=(memoria.MAESTRO,), daemon=True).start(), {'ok': True})[1],
            '/dibujar': lambda d: {'url': acciones.dibujar(str(d.get('prompt', '')))},
            '/borrar-dibujo': lambda d: {'borrado': acciones.borrar_dibujo(str(d.get('url', '')))},
            '/buscar': lambda d: acciones.investigar(str(d.get('consulta', '')), str(d.get('mensaje', '')), pedir_json),
            '/explicar': lambda d: acciones.explicar_enlace(str(d.get('url', ''))[:2000], str(d.get('mensaje', '')), pedir_json),
            '/ropa-cambiar': taller.cambiar,
            '/ropa-frase-dicha': taller.ropa_frase_dicha,
            '/frase-dicha': taller.frase_dicha,
        }
        if self.path not in rutas:
            return self.enviar_json(404, {'error': 'no existe'})
        anotar_uso(self.path)
        try:
            largo = int(self.headers.get('Content-Length', 0))
            datos = json.loads(self.rfile.read(largo) or b'{}')
            salida = rutas[self.path](datos)
            if self.path in ('/buscar', '/explicar'):
                salida.update(limpiar_salida(salida))
                if salida.get('resultados') or self.path == '/explicar':
                    hice = ('busqué con el Maestro «' + str(datos.get('consulta', ''))[:60] + '»' if self.path == '/buscar'
                            else 'leí con el Maestro una página (' + str(salida.get('titulo') or datos.get('url', ''))[:60] + ')')
                    memoria.vivir(memoria.MAESTRO, hice + ' y aprendí: ' + salida['respuesta'][:140])
            self.enviar_json(200, salida)
        except Exception as e:
            print(self.path, 'fallo:', str(e)[:200])
            self.enviar_json(502, {'error': 'no se pudo'})

    def do_GET(self):
        ruta = urllib.parse.urlparse(self.path)
        # no se muestran archivos del servidor ni datos privados (codigo Python, .git, memoria local)
        privado = urllib.parse.unquote(ruta.path).lower()
        if '/.' in privado or privado.endswith(('.py', '.pyc', '.cmd', '.md')) or privado.startswith(('/datos_memoria', '/contexto', '/__pycache__')):
            return self.enviar_json(404, {'error': 'no existe'})
        if ruta.path == '/acceso':
            return self.enviar_json(200 if self.con_permiso() else 401, {'pide_clave': bool(CLAVE_ACCESO)})
        if not (ruta.path in PUBLICO or ruta.path.startswith(PUBLICO_CARPETAS) or self.con_permiso()):
            return self.enviar_json(401, {'error': 'falta la contraseña'})
        pedido_get = urllib.parse.parse_qs(ruta.query)
        anotar_uso(ruta.path)
        if ruta.path in ('/ropa-dia', '/frases-nuevas'):
            try:
                return self.enviar_json(200, taller.ropa_del_dia() if ruta.path == '/ropa-dia' else taller.frases_nuevas())
            except Exception as e:
                print(ruta.path, 'fallo:', str(e)[:200])
                return self.enviar_json(502, {'error': 'no se pudo'})
        if ruta.path in ('/youtube', '/leer', '/sentir-video'):
            try:
                if ruta.path == '/youtube':
                    salida = {'videos': acciones.buscar_youtube(pedido_get.get('q', [''])[0][:200])}
                elif ruta.path == '/sentir-video':
                    uno = lambda k: pedido_get.get(k, [''])[0]
                    salida = sentir_video(uno('id'), uno('titulo'), uno('duracion'))
                else:
                    salida = acciones.leer_pagina(pedido_get.get('url', [''])[0])
                return self.enviar_json(200, salida)
            except Exception as e:
                print(ruta.path, 'fallo:', str(e)[:200])
                return self.enviar_json(502, {'error': 'no se pudo'})
        if not self.path.startswith('/voz?'):
            return super().do_GET()
        consulta = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        texto = consulta.get('texto', [''])[0][:400]
        try:
            r = abrir_fish(texto, consulta.get('emocion', [''])[0])
        except Exception as e:
            print('Fish Audio fallo:', str(e)[:200])
            self.send_response(502)
            self.end_headers()
            return
        # el audio se manda por partes apenas llega: asi empieza a sonar rapido
        self.send_response(200)
        self.send_header('Content-Type', 'audio/mpeg')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        try:
            while True:
                parte = r.read(4096)
                if not parte:
                    break
                self.wfile.write(parte)
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            r.close()
            self.close_connection = True


if __name__ == '__main__':
    sys.stdout.reconfigure(line_buffering=True)  # en Render el registro se ve al instante
    print(f'Filo esta lista en http://localhost:{PUERTO}  (cierra esta ventana para apagarla)')
    # tambien escucha en ::1 (IPv6): Windows prueba primero ahi al abrir «localhost»; si nadie contesta,
    # cada pedido perdia ~2,5 s antes de pasar a 127.0.0.1
    class ServidorIPv6(ThreadingHTTPServer):
        address_family = socket.AF_INET6
    # el taller: cuando nadie la usa, Filo graba frases y crea atuendos (pide a Gemini para no gastar el cupo de Groq)
    if not os.environ.get('FILO_SIN_TALLER'):  # para pruebas: sin taller
        taller.Taller(lambda tarea, texto: pedir_json(tarea, texto, sin_groq=True, max_tokens=1200), voz_fish,
                      lambda: ULTIMO_USO[0]).empezar()
    if EN_LA_NUBE:
        ThreadingHTTPServer(('0.0.0.0', PUERTO), Manejador).serve_forever()
    try:
        threading.Thread(target=ServidorIPv6(('::1', PUERTO), Manejador).serve_forever, daemon=True).start()
    except OSError as e:
        print('IPv6 no disponible:', e)
    ThreadingHTTPServer(('127.0.0.1', PUERTO), Manejador).serve_forever()
