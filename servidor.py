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


# ---------- respuestas exactas: voz corta + tarjeta modo nerd en pantalla ----------
NERD = (
    ' FORMATO DE ESTA RESPUESTA: «respuesta» es lo que dices en voz alta (las reglas de voz de arriba: sin listas ni '
    'emojis). Si el Maestro pregunta algo de información, estudio, tarea, ciencia, historia, cuentas, cómo funciona o '
    'cómo se hace algo, o te muestra una imagen: «respuesta» = la respuesta EXACTA en 1 a 3 frases (máximo 45 '
    'palabras) con los datos clave (números con unidades, nombres, fechas), sin rodeos, sin bromas y sin hablar de '
    'ti; y «nerd» = la respuesta completa de experta, como ChatGPT, que se MUESTRA en pantalla (no se lee): de 80 a '
    '300 palabras, sin emojis; la PRIMERA línea empieza con «= » y es la respuesta directa; luego secciones con '
    '«## Título», listas con «- » o «1. », tablas con filas «| a | b |» (la primera es el encabezado) y lo importante '
    'en **negrita**; cuentas con TODOS los pasos y la comprobación; datos precisos; si algo no lo sabes seguro, dilo. '
    'Si hay una imagen, en «nerd» pon «## Lo que veo» con lo que hay exactamente (textos y números copiados tal cual, '
    'objetos, colores) y, si es un ejercicio o problema, «## Paso a paso» resolviéndolo. Tu personalidad de Filo en '
    'la tarjeta solo en una frase corta al final. «titulo» = tema de la tarjeta (máximo 6 palabras). Si solo '
    'conversa contigo (saludo, cariño, juegos, contarte algo de su día), «nerd» y «titulo» van vacíos.'
)
ES_PREGUNTA = re.compile(r'(expl[ií]ca(me)?|resuelve|calcula|define|tarea|ejercicio|ecuaci[oó]n|f[oó]rmula|cu[aá]nto es|'
                         r'diferencia entre|para qu[eé] sirve|ay[uú]dame con|qu[eé] significa|c[oó]mo funciona|'
                         r'c[oó]mo se hace|demuestra|traduce)', re.I)


def es_pregunta(mensaje):
    """Pregunta seria (estudio, datos, cuentas): la responde Gemini, que es mas preciso que Qwen."""
    return bool(ES_PREGUNTA.search(mensaje) or (acciones.PREGUNTA.search(mensaje) and not acciones.CHARLA.search(mensaje)))


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
    limpia = {'respuesta': str(salida['respuesta']).strip(), 'emocion': salida['emocion']}
    nerd = str(salida.get('nerd') or '').strip()
    if len(nerd) > 40:  # tarjeta modo nerd (solo en preguntas serias y fotos)
        limpia['nerd'] = nerd[:6000]
        limpia['titulo'] = str(salida.get('titulo') or '').strip()[:60]
    return limpia


def responder_groq(mensaje, historial, imagen=None, lugar=None, con_clima=True):
    imagen = imagen_valida(imagen)
    sistema = instrucciones() + NERD + (' Responde SOLO con un objeto JSON: {"respuesta": "lo que dices", "nerd": "", '
                                        '"titulo": "", "emocion": "una de: ' + ', '.join(EMOCIONES) + '"}.')
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
    return limpiar_salida(pedir_groq(mensajes, 0.75, 1500))


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
    if con_imagen or es_pregunta(mensaje):
        # preguntas serias y fotos: siempre Gemini (mas preciso); Qwen solo si Gemini falla
        try:
            return responder_gemini(mensaje, historial, imagen, lugar)
        except Exception as e:
            print('gemini fallo, responde qwen:', str(e)[:150])
            if con_imagen:
                raise
            return responder_groq(mensaje, historial, None, lugar)
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
        'systemInstruction': {'parts': [{'text': instrucciones() + NERD}]},
        'contents': contenidos,
        'generationConfig': {
            'temperature': 0.6,
            'maxOutputTokens': 2000,
            'responseMimeType': 'application/json',
            'responseSchema': {
                'type': 'OBJECT',
                'properties': {'respuesta': {'type': 'STRING'}, 'nerd': {'type': 'STRING'}, 'titulo': {'type': 'STRING'},
                               'emocion': {'type': 'STRING', 'enum': EMOCIONES}},
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
    return limpiar_salida(json.loads(texto))


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
    '"momentos": [{"texto": "...", "emocion": "..."}, {...}, {...}] (exactamente 3: lo que dices EN VOZ ALTA mientras '
    'lo ven, una por cada parte del video (inicio, medio, casi al final); cada una de máx. 14 palabras, sobre algo '
    'concreto que pasa o se escucha en ESA parte, como si lo vieras en ese momento, sin repetir ideas. Es TU OPINIÓN '
    'o reacción con emoción y tu forma de hablar (te gusta, te da risa, te sorprende, te emociona, te da penita), NO '
    'una descripción: mal «La chica camina sola», bien «¡Ay, Frieren caminando solita me da penita!»), '
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
    limpio = {k: str(salida.get(k) or '').replace('*', '').strip()[:500] for k in ('resumen', 'final')}
    limpio['emocion_final'] = salida.get('emocion_final') if salida.get('emocion_final') in EMOCIONES else 'feliz'
    limpio['final'] = limpio['final'][:1].upper() + limpio['final'][1:]
    # las 3 opiniones que dice con su voz mientras ven el video (al 25 %, 50 % y 75 %)
    momentos = []
    for m in salida.get('momentos') if isinstance(salida.get('momentos'), list) else []:
        texto = re.sub(r'\s+', ' ', str((m or {}).get('texto') if isinstance(m, dict) else m or '').replace('*', '')).strip()[:160]
        if texto:
            emocion = m.get('emocion') if isinstance(m, dict) and m.get('emocion') in EMOCIONES else 'emocionada'
            momentos.append({'texto': texto[:1].upper() + texto[1:], 'emocion': emocion})
    limpio['momentos'] = momentos[:3]
    if not limpio['final']:
        raise ValueError('sin respuesta')
    if len(_sentidos) > 200:
        _sentidos.clear()
    _sentidos[id_video] = limpio
    dije = ' Mientras lo veíamos dije: ' + ' / '.join(m["texto"][:45] for m in limpio['momentos']) if limpio['momentos'] else ''
    memoria.vivir(memoria.MAESTRO, f'vi con el Maestro «{titulo[:70]}» y me sentí {limpio["emocion_final"]}: {limpio["final"][:80]}.{dije}')
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


# ---------- «olvida…»: Filo borra de verdad lo del tema que el Maestro pide ----------
OLVIDAR = re.compile(r'\b(olv[ií]d(a|ate|alo|ala|alos|alas|ate de|a eso)|borra (eso )?de tu memoria|ya no (lo )?recuerdes|'
                     r'no (lo )?recuerdes m[aá]s)\b', re.I)
PEDIR_OLVIDO = (
    'El Maestro te pide que OLVIDES algo. Te paso su mensaje (y, si hay, lo que pidió olvidar justo antes) y tu '
    'memoria numerada. borrar: los códigos de TODO lo que tenga que ver con lo que pide olvidar (datos, pendientes, '
    'vivencias, gustos, lo que pensaste, mensajes); nada más. Si no queda claro qué tema es, o puede ser más de uno, '
    'NO borres nada: deja borrar vacío y en duda pon una pregunta corta para saber cuál (forma: «¿Olvido lo de X o '
    'lo de Y?»). Si dice «eso» o «lo de antes», míralo en la conversación reciente; si aun así no se sabe, pregunta. '
    'reescribir: si una cosa MEZCLA el tema con otras cosas (o es un texto largo R1, R2, R3), no la borres: pon su '
    'código con el MISMO texto pero sin nada de ese tema. respuesta: lo que dices en voz alta, hablándole de tú, máximo 40 palabras, sin emojis: '
    'qué olvidaste (sin repetir los detalles) o la pregunta de duda; si no tenías nada de eso guardado, dilo. '
    'Si antes preguntaste algo y lo que dice ahora NO responde tu pregunta (cambió de tema), deja borrar, duda y '
    'respuesta vacíos. '
    'tema: el tema que vas a olvidar en pocas palabras, sacado del mensaje o de la conversación reciente; VACÍO si '
    'no sabes de qué habla (entonces pregunta en duda). palabras: 1 a 4 palabras clave propias de ese tema que '
    'aparecen en tu memoria (nombres, cosas; nunca palabras comunes como Maestro, quiere, le, gusta). '
    'Responde SOLO JSON: {"tema": "...", "palabras": ["..."], "borrar": ["D1"], "reescribir": {"R1": "..."}, '
    '"duda": "", "respuesta": "...", "emocion": "normal"}'
)


def _sin_tildes(texto):
    return str(texto).translate(str.maketrans('áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU'))


def _memoria_numerada(memo):
    """Todo lo que Filo recuerda, con un codigo por cosa (para que la IA elija que borrar)."""
    cosas = {}
    for letra, campo in (('D', 'datos'), ('P', 'pendientes'), ('V', 'vivencias')):
        for i, x in enumerate(memo.get(campo) or []):
            cosas[f'{letra}{i + 1}'] = (campo, i, x.get('texto', '') if isinstance(x, dict) else str(x))
    for i, g in enumerate(list(memo.get('gustos') or {})):
        cosas[f'G{i + 1}'] = ('gustos', g, g)
    for i, t in enumerate((memo.get('pensado') or {}).get('puntos') or []):
        cosas[f'T{i + 1}'] = ('pensado', i, t)
    for i, t in enumerate(memo.get('ultimos_mensajes') or []):
        cosas[f'M{i + 1}'] = ('ultimos_mensajes', i, t)
    for codigo, campo in (('R1', 'resumen'), ('R2', 'forma_maestro'), ('R3', 'como_soy')):
        if memo.get(campo):
            cosas[codigo] = (campo, None, memo[campo])
    return cosas


def olvidar(mensaje, historial=()):
    """Borra de la memoria lo del tema que pide olvidar. Si no sabe cual es, pregunta y espera la respuesta."""
    memo = memoria.leer(memoria.MAESTRO)
    antes = memo.get('olvido_pendiente') or {}
    pedido = mensaje
    if antes.get('cuando', 0) > time.time() - 300 and antes.get('mensaje'):
        pedido = 'Antes pidió: «' + antes['mensaje'] + '». Tú preguntaste: «' + antes.get('duda', '') + '». Ahora dice: «' + mensaje + '»'
    resto = re.sub(r'\b(filo|maestro|por favor|porfa|ya|eso|esto|lo|la|las|los|de|del|todo|tu|tú|memoria|y|no|me|olvides|olvida|olvídalo|olvidalo|olvídate|olvidate|borra|recuerdes|más|mas)\b', ' ',
                   mensaje.lower())
    if pedido == mensaje and not historial and len(re.sub(r'[^a-záéíóúñ]', '', resto)) < 3:
        # dijo solo «olvídalo» y no hay de qué hablaba: pregunta en vez de adivinar
        duda = '¿Qué quieres que olvide, Maestro? Dime el tema.'
        fresca = memoria.leer(memoria.MAESTRO)
        fresca['olvido_pendiente'] = {'mensaje': mensaje[:300], 'duda': duda, 'cuando': time.time()}
        memoria.guardar(memoria.MAESTRO, fresca)
        print('olvidar: no dijo el tema, pregunta antes')
        return {'respuesta': duda, 'emocion': 'normal', 'olvido': 0}
    cosas = _memoria_numerada(memo)
    lista = '\n'.join(f'{c}: {t[2][:220]}' for c, t in cosas.items()) or '(tu memoria está vacía)'
    charla = '\n'.join(('Maestro: ' if h.get('rol') == 'usuario' else 'Filo: ') + str(h.get('texto', ''))[:200]
                       for h in list(historial)[-6:] if isinstance(h, dict))
    salida = pedir_json(PEDIR_OLVIDO, ('Conversación reciente:\n' + charla + '\n\n' if charla else '')
                        + 'Mensaje del Maestro: ' + pedido[:600] + '\n\nTu memoria:\n' + lista,
                        sin_groq=True, max_tokens=2500)
    fresca = memoria.leer(memoria.MAESTRO)
    duda = str(salida.get('duda') or '').strip()
    respuesta = str(salida.get('respuesta') or '').strip()
    tema = str(salida.get('tema') or '').strip()
    if not duda and not tema and (salida.get('borrar') or salida.get('reescribir') or respuesta.endswith('?')):
        # no sabe de qué tema habla: no borra nada a ciegas, pregunta
        duda = respuesta if respuesta.endswith('?') else '¿Qué quieres que olvide, Maestro? Dime el tema.'
        respuesta = duda
    if antes and pedido != mensaje and not OLVIDAR.search(mensaje) and not salida.get('borrar') and not salida.get('reescribir')             and not salida.get('palabras') and not str(salida.get('duda') or '').strip():
        fresca.pop('olvido_pendiente', None)  # cambio de tema: se conversa normal
        memoria.guardar(memoria.MAESTRO, fresca)
        return None
    borrar = [c for c in salida.get('borrar') or [] if c in cosas] if not duda else []
    nuevos = salida.get('reescribir') if isinstance(salida.get('reescribir'), dict) and not duda else {}
    nuevos = {c: str(t or '').strip() for c, t in nuevos.items() if c in cosas and c not in borrar and str(t or '').strip()}
    # barrido por palabras clave: lo que la IA se salto y todavia nombra el tema tambien se olvida
    claves = [_sin_tildes(str(x)).lower().strip() for x in salida.get('palabras') or [] if len(str(x).strip()) >= 4][:4]
    claves = [c for c in claves if c not in ('maestro', 'quiere', 'gusta', 'filo', 'cancion', 'video')]
    if claves and not duda:
        tiene = lambda t: any(c in _sin_tildes(t).lower() for c in claves)
        for codigo, (campo, donde, texto) in cosas.items():
            if codigo in borrar or codigo in nuevos or not tiene(texto):
                continue
            if donde is None or campo == 'vivencias':
                # texto mezclado: se quitan solo las partes (frases o «;») que nombran el tema
                partes = re.split(r'(?<=[.;])\s+', texto)
                prefijo = ''
                if campo == 'vivencias' and ':' in texto:
                    prefijo, resto = texto.split(':', 1)
                    partes = re.split(r'(?<=[.;])\s+', resto.strip())
                    prefijo += ': '
                quedan = [x for x in partes if x and not tiene(x)]
                if quedan:
                    nuevos[codigo] = (prefijo + ' '.join(quedan)).strip()
                    continue
            borrar.append(codigo)
    # primero se reescriben las cosas mezcladas (sin el tema) y despues se borra lo demas
    for codigo, texto in nuevos.items():
        campo, donde, _ = cosas[codigo]
        if donde is None:
            fresca[campo] = texto[:1500]
        elif campo == 'gustos':
            continue
        elif campo == 'pensado':
            if fresca.get('pensado') and donde < len(fresca['pensado'].get('puntos') or []):
                fresca['pensado']['puntos'][donde] = texto[:200]
        elif donde < len(fresca.get(campo) or []):
            if isinstance(fresca[campo][donde], dict):
                fresca[campo][donde]['texto'] = texto[:300]
            else:
                fresca[campo][donde] = texto[:300]
    quitar = {}
    for codigo in borrar:
        campo, donde, _ = cosas[codigo]
        quitar.setdefault(campo, set()).add(donde)
    for campo, donde in quitar.items():
        if campo == 'gustos':
            for g in donde:
                (fresca.get('gustos') or {}).pop(g, None)
        elif campo == 'pensado':
            puntos = [t for i, t in enumerate((fresca.get('pensado') or {}).get('puntos') or []) if i not in donde]
            if puntos:
                fresca['pensado']['puntos'] = puntos
            else:
                fresca.pop('pensado', None)
        else:
            fresca[campo] = [x for i, x in enumerate(fresca.get(campo) or []) if i not in donde]
    if duda:
        fresca['olvido_pendiente'] = {'mensaje': mensaje[:300], 'duda': duda[:200], 'cuando': time.time()}
    else:
        fresca.pop('olvido_pendiente', None)
    memoria.guardar(memoria.MAESTRO, fresca)
    print(f'olvidar: {len(borrar)} cosas borradas, {len(nuevos)} textos reescritos' + (', pregunta antes' if duda else ''))
    emocion = salida.get('emocion') if salida.get('emocion') in EMOCIONES else 'normal'
    respuesta = respuesta or duda or 'Listo, Maestro, ya lo olvidé.'
    return {'respuesta': respuesta, 'emocion': emocion, 'olvido': len(borrar) + len(nuevos)}


def quiere_olvidar(mensaje, memo):
    """Pide olvidar algo, o contesta la pregunta que Filo hizo para saber que olvidar."""
    if OLVIDAR.search(mensaje):
        return True
    antes = memo.get('olvido_pendiente') or {}
    return antes.get('cuando', 0) > time.time() - 300


def hablar(datos):
    """Conversa con memoria del Maestro: recuerda, tiene animo que dura y luego aprende del mensaje."""
    id_maestro = memoria.MAESTRO  # Filo es de un solo Maestro: la misma memoria en el PC, el celular y la nube
    mensaje = str(datos.get('mensaje', ''))
    memo = memoria.leer(id_maestro)
    if not datos.get('sin_accion') and not datos.get('imagen') and quiere_olvidar(mensaje, memo):
        try:
            olvido = olvidar(mensaje, datos.get('historial') or [])  # no se aprende nada de este mensaje: es para borrar
            if olvido:
                return olvido
        except Exception as e:
            print('olvidar fallo:', str(e)[:150])
            return {'respuesta': 'Uy, Maestro, no pude borrarlo ahora. ¿Me lo pides otra vez?', 'emocion': 'pena'}
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
            puestos = memoria.leer(memoria.MAESTRO).get('videos_puestos') or []
            plan = acciones.planear(mensaje, pedir_json, datos.get('historial') or [], modo, puestos)
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


# ---------- cuando el Maestro se va o la deja sola: Filo piensa en el y se duerme ----------
# Cada pestaña abierta avisa cada 30 s que sigue ahi. Al cerrar una, se espera 2 minutos: si ya no queda
# ninguna abierta (ni en el PC ni en el celular), Filo piensa con la IA que va a necesitar el Maestro la
# proxima vez y lo guarda en su memoria. Al volver, la pagina pregunta (/al-volver) y la encuentra dormida.
# Si el aviso de cierre no llega (celular, PC apagado), un vigilante revisa cada minuto: sin señal de
# ninguna pestaña en 2,5 min, cuenta como que se fue. Con la pagina abierta y sin tocarla, la pagina pide
# /pensar-sola justo antes de que Filo se duerma.
PESTANAS = {}            # id de la pestaña -> ultima vez que aviso
VIVA = 150               # una pestaña que no avisa hace 2,5 min se da por cerrada (el navegador frena las de fondo)
ESPERA_IDA = int(os.environ.get('FILO_ESPERA_IDA') or 120)  # si la vuelve a abrir antes de 2 min, no pasa nada (pruebas: menos)
_ida = threading.Lock()
ENTRE_PENSAR = 3 * 3600  # sin charla nueva, piensa como mucho una vez cada 3 horas (cuida la cuota gratis)
PENSAR = (
    '{situacion} Antes de dormirte piensas en él: con lo que hablaron y lo que sabes '
    'de él, piensa qué va a necesitar o qué le conviene la próxima vez (algo que él te contó que tiene pendiente, '
    'algo que le gustó para repetir, un plan que él mencionó). REGLA MÁS IMPORTANTE: usa SOLO cosas que están '
    'escritas en el texto que te paso; nunca inventes exámenes, tareas, planes ni problemas que no estén ahí. '
    'puntos: 2 o 3 cosas CONCRETAS, cada una en una frase completa de máximo 100 caracteres, en primera persona y '
    'hablándole de tú (forma: «Preguntarte [algo que él te contó].»), nunca de él en tercera persona. dicho: lo que '
    'le dirás en voz alta cuando vuelva, máximo 200 caracteres, empezando con alegría porque volvió y contándole lo '
    'que pensaste. Si no hay nada concreto, propón algo según sus gustos (una canción, un juego, un dibujo). Sin emojis ni asteriscos en dicho (se lee en '
    'voz alta). Responde SOLO JSON: {"puntos": ["..."], "dicho": "..."}'
)


def pestana_de(datos):
    pestana = str(datos.get('pestana') or '')[:40]
    return pestana if re.fullmatch(r'[a-z0-9-]{6,40}', pestana) else ''


def presente(datos):
    pestana = pestana_de(datos)
    if pestana:
        PESTANAS[pestana] = time.time()
    return {'ok': True}


def me_voy(datos):
    PESTANAS.pop(pestana_de(datos), None)
    hasta = time.time()
    threading.Timer(ESPERA_IDA, revisar_ida, args=(hasta,)).start()
    return {'ok': True}


def vigilar_pestanas():
    """Por si el aviso de cierre no llega: cada minuto mira si todas las pestañas dejaron de dar señal."""
    habia = False
    while True:
        time.sleep(60)
        try:
            ultima = max(PESTANAS.values(), default=0)
            if not PESTANAS:  # se cerraron avisando: de eso se encarga me_voy
                habia = False
            elif time.time() - ultima <= VIVA:
                habia = True
            elif habia:  # quedan pestañas pero ninguna da señal hace 2,5 min: se fue sin avisar
                habia = False
                revisar_ida(ultima)
        except Exception as e:
            print('vigilar pestañas fallo:', str(e)[:150])


def puede_pensar(memo):
    """Piensa si hablaron desde la ultima vez, o si ya pasaron 3 horas aunque no le haya dicho nada."""
    cuando = (memo.get('pensado') or {}).get('cuando', 0)
    return memo.get('ultima', 0) > cuando or time.time() - cuando >= ENTRE_PENSAR


def cortar_completo(texto, maximo):
    """Corta un texto largo sin dejar palabras a medias: hasta la ultima frase completa, o la ultima palabra."""
    texto = re.sub(r'\s+', ' ', str(texto or '')).strip()
    if len(texto) <= maximo:
        return texto
    trozo = texto[:maximo]
    fin = max(trozo.rfind(c) for c in '.!?')
    if fin > maximo * 0.5:
        return trozo[:fin + 1]
    return trozo.rsplit(' ', 1)[0].rstrip(',;:') + '…'


def revisar_ida(se_fue):
    ahora = time.time()
    for pestana, cuando in list(PESTANAS.items()):
        if ahora - cuando > VIVA:
            PESTANAS.pop(pestana, None)
    if PESTANAS:
        return  # sigue abierta en otro lado (o la volvio a abrir)
    with _ida:
        memo = memoria.leer(memoria.MAESTRO)
        if memo.get('se_fue') and memo['se_fue'] >= se_fue - ESPERA_IDA:
            return  # ya se anoto esta ida
        memo['se_fue'] = se_fue
        memoria.guardar(memoria.MAESTRO, memo)
    if puede_pensar(memo):
        threading.Thread(target=pensar_al_irse, daemon=True).start()


_pensando = threading.Lock()  # nunca piensa dos veces a la vez (cierre y pagina sola al mismo tiempo)


def pensar_al_irse(situacion='El Maestro cerró la página y se fue.'):
    if not _pensando.acquire(blocking=False):
        return None
    try:
        return _pensar(situacion)
    finally:
        _pensando.release()


def _pensar(situacion):
    memo = memoria.leer(memoria.MAESTRO)
    if not puede_pensar(memo):
        return None
    if memo.get('ultima', 0) <= (memo.get('pensado') or {}).get('cuando', 0):
        situacion += (' Desde la última vez que pensaste en él no han hablado: piensa en sus gustos, en lo que '
                      'tenía pendiente y en lo que hicieron juntos antes, sin repetir lo que ya pensaste.')
    partes = []
    if memo.get('nombre'):
        partes.append('Se llama ' + memo['nombre'] + '.')
    if memo.get('ultimos_mensajes'):
        partes.append('Lo último que te dijo: ' + ' | '.join(memo['ultimos_mensajes'][-12:]))
    if memo.get('pendientes'):
        partes.append('Cosas para preguntarle: ' + '; '.join(p['texto'] for p in memo['pendientes'][-5:]))
    if memo.get('datos'):
        partes.append('Lo que sabes de él: ' + '; '.join(d['texto'] for d in memo['datos'][-15:]))
    if memo.get('vivencias'):
        partes.append('Lo que hicieron juntos: ' + '; '.join(v['texto'] for v in memo['vivencias'][-8:]))
    if memo.get('gustos'):
        partes.append('Sus gustos: ' + ', '.join(list(memo['gustos'])[:12]))
    try:
        if (memo.get('pensado') or {}).get('puntos'):
            partes.append('Lo que ya pensaste la vez anterior (no lo repitas): ' + '; '.join(memo['pensado']['puntos']))
        salida = pedir_json(PENSAR.replace('{situacion}', situacion), ' / '.join(partes) or 'Todavía no sabes mucho de él.',
                            sin_groq=True, max_tokens=500)
        puntos = [cortar_completo(p, 120) for p in (salida.get('puntos') or []) if str(p).strip()][:3]
        dicho = cortar_completo(salida.get('dicho'), 260)
    except Exception as e:
        print('pensar al irse fallo:', str(e)[:150])
        return None
    if not puntos or not dicho:
        return None
    fresca = memoria.leer(memoria.MAESTRO)
    fresca['pensado'] = {'puntos': puntos, 'dicho': dicho, 'cuando': time.time(), 'contado': False}
    memoria.guardar(memoria.MAESTRO, fresca)
    memoria.vivir(memoria.MAESTRO, 'mientras el Maestro no estaba pensé en él: ' + '; '.join(puntos))
    return fresca['pensado']


def pensar_sola(datos):
    """La pagina sigue abierta pero nadie la toca: Filo piensa justo antes de dormirse."""
    presente(datos)
    pensado = pensar_al_irse('El Maestro dejó la página abierta y no te habla hace rato: se fue a hacer otra cosa.')
    return {'pensado': pensado}


def al_volver(datos):
    """La pagina recien abierta pregunta si Filo se durmio y que penso. Se cuenta una sola vez."""
    presente(datos)
    with _ida:
        memo = memoria.leer(memoria.MAESTRO)
        se_fue = memo.pop('se_fue', 0)
        pensado = memo.get('pensado') or {}
        if se_fue:
            memoria.guardar(memoria.MAESTRO, memo)
    return {'se_fue': se_fue, 'ahora': time.time(), 'espera': ESPERA_IDA,
            'pensado': pensado if pensado.get('puntos') and not pensado.get('contado') else None}


VIDEOS_RECORDADOS = 300


def video_puesto(datos):
    """El video empezo a sonar: Filo lo recuerda para no repetirlo (los ultimos 300)."""
    vid = str(datos.get('id') or '')[:20]
    if not re.fullmatch(r'[A-Za-z0-9_-]{6,20}', vid):
        return {'ok': False}
    memo = memoria.leer(memoria.MAESTRO)
    lista = [v for v in memo.get('videos_puestos') or [] if v.get('id') != vid]
    lista.append({'id': vid, 'titulo': str(datos.get('titulo') or '')[:120], 'canal': str(datos.get('canal') or '')[:60],
                  'cuando': time.time()})
    memo['videos_puestos'] = lista[-VIDEOS_RECORDADOS:]
    memoria.guardar(memoria.MAESTRO, memo)
    return {'ok': True}


def pensado_contado(datos):
    memo = memoria.leer(memoria.MAESTRO)
    if memo.get('pensado'):
        memo['pensado']['contado'] = True
        memoria.guardar(memoria.MAESTRO, memo)
    return {'ok': True}


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
            '/presente': presente,
            '/me-voy': me_voy,
            '/al-volver': al_volver,
            '/pensado-contado': pensado_contado,
            '/pensar-sola': pensar_sola,
            '/video-puesto': video_puesto,
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
                    ya = [v.get('id') for v in memoria.leer(memoria.MAESTRO).get('videos_puestos') or []]
                    videos, agotado = acciones.buscar_sin_repetir(pedido_get.get('q', [''])[0][:200], ya)
                    salida = {'videos': videos, 'agotado': agotado}
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
    threading.Thread(target=vigilar_pestanas, daemon=True).start()
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
