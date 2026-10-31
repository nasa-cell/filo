"""Memoria de Filo: lo que sabe de cada Maestro y su animo, para que lo recuerde aunque se cierre la pagina
o Render se reinicie.

- Se guarda en la base de Neon «filo-memoria» (variable FILO_DATABASE_URL), separada de los otros proyectos.
- Sin esa variable se guarda en la carpeta «datos_memoria» del PC (sirve igual para probar en local).
- Filo es de un solo Maestro: una sola memoria (id «maestro-filo») para el PC, el celular y la pagina publicada.
"""
import json
import os
import re
import threading
import time

CARPETA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'datos_memoria')
MAX_DATOS, MAX_PENDIENTES = 40, 10
MAESTRO = 'maestro-filo'
_cerrojo = threading.Lock()
_tabla_lista = False
_en_ram = {}  # memoria de cada Maestro mientras el servidor esta encendido (Neon tarda ~1 s por consulta)


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


def _conexion():
    url = _variable('FILO_DATABASE_URL')
    if not url:
        return None
    import psycopg2
    return psycopg2.connect(url, connect_timeout=8)


def _id_valido(id_maestro):
    return isinstance(id_maestro, str) and re.fullmatch(r'[a-zA-Z0-9-]{8,64}', id_maestro or '')


def vacia():
    return {'nombre': '', 'datos': [], 'pendientes': [], 'animo': {'emocion': 'normal', 'restantes': 0, 'motivo': ''},
            'ultima': 0, 'visitas': 0, 'album': []}


def leer(id_maestro):
    if not _id_valido(id_maestro):
        return vacia()
    if id_maestro in _en_ram:
        return json.loads(json.dumps(_en_ram[id_maestro]))  # copia: el que la use no cambia la guardada
    memo = _leer_guardada(id_maestro)
    _en_ram[id_maestro] = json.loads(json.dumps(memo))
    return memo


def _leer_guardada(id_maestro):
    global _tabla_lista
    try:
        con = _conexion()
        if con:
            with con, con.cursor() as c:
                if not _tabla_lista:
                    c.execute('CREATE TABLE IF NOT EXISTS filo_maestros (id text PRIMARY KEY, datos jsonb NOT NULL, '
                              'actualizado timestamptz NOT NULL DEFAULT now())')
                    _tabla_lista = True
                c.execute('SELECT datos FROM filo_maestros WHERE id = %s', (id_maestro,))
                fila = c.fetchone()
            con.close()
            return dict(vacia(), **(fila[0] if fila else {}))
        ruta = os.path.join(CARPETA, id_maestro + '.json')
        if os.path.isfile(ruta):
            with open(ruta, encoding='utf-8') as f:
                return dict(vacia(), **json.load(f))
    except Exception as e:
        print('memoria: no se pudo leer', str(e)[:150])
    return vacia()


def guardar(id_maestro, memoria):
    if not _id_valido(id_maestro):
        return
    memoria['datos'] = memoria.get('datos', [])[-MAX_DATOS:]
    memoria['pendientes'] = memoria.get('pendientes', [])[-MAX_PENDIENTES:]
    _en_ram[id_maestro] = json.loads(json.dumps(memoria))
    # se escribe en Neon en segundo plano: la respuesta no espera
    threading.Thread(target=_escribir, args=(id_maestro, json.loads(json.dumps(memoria))), daemon=True).start()


def _escribir(id_maestro, memoria):
    with _cerrojo:
        try:
            con = _conexion()
            if con:
                with con, con.cursor() as c:
                    c.execute('INSERT INTO filo_maestros (id, datos) VALUES (%s, %s) ON CONFLICT (id) DO UPDATE '
                              'SET datos = EXCLUDED.datos, actualizado = now()', (id_maestro, json.dumps(memoria, ensure_ascii=False)))
                con.close()
                return
            os.makedirs(CARPETA, exist_ok=True)
            with open(os.path.join(CARPETA, id_maestro + '.json'), 'w', encoding='utf-8') as f:
                json.dump(memoria, f, ensure_ascii=False)
        except Exception as e:
            print('memoria: no se pudo guardar', str(e)[:150])


def album_valido(lista):
    """Solo entradas de dibujo con direccion de imagen (Cloudinary o /dibujos/), maximo 500."""
    limpio = []
    for d in (lista if isinstance(lista, list) else [])[:500]:
        if not isinstance(d, dict):
            continue
        url = str(d.get('url') or '')
        if not (url.startswith('https://res.cloudinary.com/') or re.fullmatch(r'/dibujos/[\w.-]+\.(jpg|png)(\?\w*)?', url)):
            continue
        limpio.append({'url': url[:500], 'titulo': str(d.get('titulo') or '')[:120], 'prompt': str(d.get('prompt') or '')[:600]})
    return limpio


def _hace(segundos):
    if segundos < 3600:
        return f'{int(segundos // 60)} minutos'
    if segundos < 86400:
        return f'{int(segundos // 3600)} horas'
    dias = int(segundos // 86400)
    return 'un día' if dias == 1 else f'{dias} días'


def contexto(memoria, hora_maestro):
    """Texto que se agrega a las instrucciones de Filo con lo que recuerda y su animo."""
    partes = []
    if hora_maestro:
        partes.append(f'Para el Maestro ahora es {hora_maestro} (saluda y habla acorde a esa hora: buenos días, '
                      'buenas tardes, buenas noches; si es muy tarde dile que debería dormir; el fin de semana estás más juguetona).')
    if memoria.get('nombre'):
        partes.append(f'El Maestro se llama {memoria["nombre"]} (puedes llamarlo Maestro o por su nombre).')
    if memoria.get('datos'):
        partes.append('Lo que recuerdas del Maestro (de otras conversaciones): '
                      + '; '.join(d['texto'] for d in memoria['datos'][-25:]) + '.')
    if memoria.get('ultima'):
        pasado = time.time() - memoria['ultima']
        if pasado > 3 * 3600:
            pend = '; '.join(p['texto'] for p in memoria.get('pendientes', [])[-3:])
            partes.append(f'El Maestro vuelve después de {_hace(pasado)} sin hablarte: salúdalo con cariño, dile que lo '
                          'extrañaste' + (f' y pregúntale por algo de esto: {pend}' if pend else '') + '.')
    animo = memoria.get('animo') or {}
    if _vencido(animo):  # el enojo dura 10 s; la pena o la alegria, 10 min
        animo = memoria['animo'] = {'emocion': 'normal', 'restantes': 0, 'motivo': ''}
    if animo.get('restantes', 0) > 0 and animo.get('emocion') not in (None, 'normal', 'enojada', 'celosa'):
        partes.append(f'Tu ánimo de ahora: sigues {animo["emocion"]} por lo de antes ({animo.get("motivo", "")}). Se te va '
                      'pasando poco a poco: que se note un poquito en tu forma de hablar, sin exagerar, salvo que el '
                      'Maestro te haga cambiar de ánimo (si te pide perdón o te da carne, se te pasa).')
    return (' ' + ' '.join(partes)) if partes else ''


# como cambia el animo despues de cada respuesta: emocion -> (animo que queda, cuantos mensajes dura)
ANIMOS = {'enojada': ('enojada', 3), 'celosa': ('celosa', 3), 'triste': ('triste', 2), 'pena': ('triste', 1),
          'amor': ('feliz', 3), 'emocionada': ('feliz', 3), 'orgullosa': ('feliz', 2), 'risa': ('feliz', 2)}


ANIMO_MAX = 10  # toda emocion se le pasa en 10 s
ENOJO_MAX = 10  # el enojo y los celos se le pasan en 10 s


def _vencido(animo):
    tope = ENOJO_MAX if animo.get('emocion') in ('enojada', 'celosa') else ANIMO_MAX
    return time.time() - animo.get('desde', 0) > tope


def nuevo_animo(memoria, emocion, mensaje):
    animo = dict(memoria.get('animo') or {})
    if _vencido(animo):
        animo = {'emocion': 'normal', 'restantes': 0, 'motivo': ''}
    if emocion in ANIMOS:
        nombre, dura = ANIMOS[emocion]
        sigue_igual = nombre in ('enojada', 'celosa') and animo.get('emocion') == nombre
        animo = {'emocion': nombre, 'restantes': dura, 'motivo': mensaje[:80],
                 'desde': animo['desde'] if sigue_igual else time.time()}
    elif animo.get('restantes', 0) > 0:
        animo['restantes'] -= 1
        if animo['restantes'] <= 0:
            animo = {'emocion': 'normal', 'restantes': 0, 'motivo': ''}
    memoria['animo'] = animo
    return animo['emocion'] if animo.get('restantes', 0) > 0 else 'normal'


EXTRAER = (
    'Eres la memoria de Filo. Del mensaje del Maestro, saca SOLO datos que valga la pena recordar otros días: su '
    'nombre, gustos, familia, mascotas, estudios, trabajo, planes y cosas que le pasaron. No guardes preguntas '
    'generales ni órdenes (dibuja, pon un video, busca). Escribe cada dato corto, en tercera persona y con la fecha '
    'si importa (ej. "le gusta el anime Frieren", "tiene examen de matemáticas el lunes 3/11"). pendientes: cosas '
    'para preguntarle después (ej. "cómo le fue en el examen"). Responde SOLO JSON: {"nombre": "" o el nombre si lo '
    'dijo, "datos": ["..."], "pendientes": ["..."]} (listas vacías si no hay nada nuevo).'
)


def aprender(id_maestro, mensaje, pedir_json, conocidos):
    """En segundo plano: saca datos nuevos del mensaje y los agrega a la memoria."""
    if not _id_valido(id_maestro) or len(mensaje.split()) < 3:
        return
    try:
        res = pedir_json(EXTRAER, 'Ya sabes: ' + ('; '.join(conocidos[-20:]) or 'nada') + '\nFecha: '
                         + time.strftime('%d/%m/%Y') + '\nMensaje del Maestro: «' + mensaje[:500] + '»')
    except Exception as e:
        print('memoria: no se pudo aprender', str(e)[:150])
        return
    if not isinstance(res, dict):
        return
    memoria = leer(id_maestro)
    cambio = False
    nombre = str(res.get('nombre') or '').strip()
    if nombre and len(nombre) < 40:
        memoria['nombre'], cambio = nombre, True
    ya = {d['texto'].lower() for d in memoria['datos']}
    for texto in res.get('datos') or []:
        texto = str(texto).strip()[:160]
        if texto and texto.lower() not in ya:
            memoria['datos'].append({'texto': texto, 'fecha': time.strftime('%Y-%m-%d')})
            cambio = True
    for texto in res.get('pendientes') or []:
        texto = str(texto).strip()[:160]
        if texto:
            memoria['pendientes'].append({'texto': texto, 'fecha': time.strftime('%Y-%m-%d')})
            cambio = True
    if cambio:
        guardar(id_maestro, memoria)
