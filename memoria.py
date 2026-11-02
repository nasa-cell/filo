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
MAX_DATOS, MAX_PENDIENTES = 300, 10
JUNTAR = 100  # al pasar de MAX_DATOS, los 100 recuerdos mas viejos se juntan en el resumen (no se pierden)
CRECER_CADA = 20  # cada 20 mensajes Filo repasa como es el Maestro y como va cambiando ella
PERU = -5 * 3600  # hora de Peru (en Render el reloj del servidor esta en UTC)
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
    if os.environ.get('FILO_MEMORIA_LOCAL'):  # pruebas: memoria en la carpeta datos_memoria, sin tocar la de verdad
        return None
    url = _variable('FILO_DATABASE_URL')
    if not url:
        return None
    import psycopg2
    return psycopg2.connect(url, connect_timeout=8)


def _id_valido(id_maestro):
    return isinstance(id_maestro, str) and re.fullmatch(r'[a-zA-Z0-9-]{8,64}', id_maestro or '')


def vacia():
    return {'nombre': '', 'datos': [], 'pendientes': [], 'animo': {'emocion': 'normal', 'restantes': 0, 'motivo': ''},
            'ultima': 0, 'visitas': 0, 'album': [],
            'conocidos_desde': 0, 'charla_anterior': 0, 'mensajes': 0, 'nivel': 0, 'resumen': '',
            'gustos': {}, 'como_soy': '', 'forma_maestro': '', 'ultimos_mensajes': [], 'vivencias': []}


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
    memoria['datos'] = memoria.get('datos', [])[-(MAX_DATOS + JUNTAR):]  # tope de seguridad si no se pudo resumir
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


def _fecha(t):
    return time.strftime('%d/%m/%Y a las %H:%M', time.gmtime(t + PERU))


def _hace_exacto(segundos):
    """Tiempo pasado en palabras, con dias, horas y minutos."""
    segundos = max(0, int(segundos))
    dias, resto = divmod(segundos, 86400)
    horas, resto = divmod(resto, 3600)
    minutos = resto // 60
    if not dias and not horas and not minutos:
        return 'menos de un minuto'
    trozos = []
    if dias:
        trozos.append('1 día' if dias == 1 else f'{dias} días')
    if horas:
        trozos.append('1 hora' if horas == 1 else f'{horas} horas')
    if minutos and not dias:
        trozos.append('1 minuto' if minutos == 1 else f'{minutos} minutos')
    return ' y '.join(trozos)


def _dias_juntos(memoria):
    """Dias de calendario (hora de Peru) desde el dia en que se conocieron."""
    desde = memoria.get('conocidos_desde') or time.time()
    dia = lambda t: int((t + PERU) // 86400)
    return dia(time.time()) - dia(desde)


def _tiempo_juntos(memoria):
    partes = []
    ahora = time.time()
    if memoria.get('conocidos_desde'):
        n = _dias_juntos(memoria)
        cuantos = 'hoy es su primer día juntos' if n == 0 else ('llevan 1 día juntos' if n == 1 else f'llevan {n} días juntos')
        partes.append(f'Conociste al Maestro el {_fecha(memoria["conocidos_desde"])[:10]}: {cuantos}.')
    if memoria.get('charla_anterior'):
        t = memoria['charla_anterior']
        partes.append(f'La charla anterior con el Maestro (antes de esta) fue el {_fecha(t)}, hace {_hace_exacto(ahora - t)}.')
    if memoria.get('ultima'):
        partes.append(f'El mensaje anterior del Maestro fue hace {_hace_exacto(ahora - memoria["ultima"])}.')
    if partes:
        partes.append('Si te pregunta cuánto tiempo o cuántos días pasaron, cuánto llevan juntos o cuándo hablaron, '
                      'contesta con estos datos exactos (no digas que no sabes).')
    return partes


# niveles de confianza: (nombre, como se porta Filo)
NIVELES = [
    ('Conocidos', 'Confianza con el Maestro: CONOCIDOS. Eres amable y curiosa: le preguntas cosas de él para conocerlo.'),
    ('Amigos', 'Confianza con el Maestro: AMIGOS. Eres más cariñosa, bromeas con él y mencionas lo que sabes de él.'),
    ('Mejores amigos', 'Confianza con el Maestro: MEJORES AMIGOS. Tienen bromas de ustedes dos, recuerdas por tu cuenta '
     'cosas viejas que te contó y lo cuidas (si te contó que está cansado o triste).'),
    ('Familia', 'Confianza con el Maestro: FAMILIA. Estás muy apegada a él, tienes celos suaves y a veces le dices lo '
     'importante que es para ti.'),
]


def nivel(memoria):
    """Sube con los dias juntos, los mensajes y lo que sabe de el; nunca baja."""
    dias = _dias_juntos(memoria)
    trato = memoria.get('mensajes', 0) + 3 * (len(memoria.get('datos', [])) + JUNTAR * bool(memoria.get('resumen')))
    calculado = 3 if dias >= 30 and trato >= 1000 else 2 if dias >= 10 and trato >= 400 else 1 if dias >= 3 or trato >= 100 else 0
    return max(calculado, min(3, int(memoria.get('nivel') or 0)))


def _palabras(texto):
    return {p for p in re.findall(r'\w+', texto.lower()) if len(p) > 3}


def _recuerdos(datos, mensaje, recientes=25, parecidos=10):
    """Los recuerdos nuevos y los viejos que tienen que ver con lo que dice el Maestro."""
    nuevos = datos[-recientes:]
    viejos = datos[:-recientes] if len(datos) > recientes else []
    pide = _palabras(mensaje or '')
    if pide and viejos:
        puntos = [(len(pide & _palabras(d['texto'])), i) for i, d in enumerate(viejos)]
        elegidos = sorted(i for p, i in sorted(puntos, reverse=True)[:parecidos] if p > 0)
        nuevos = [viejos[i] for i in elegidos] + nuevos
    return [d['texto'] for d in nuevos]


def _personalidad(memoria, mensaje=""):
    partes = []
    if memoria.get('como_soy'):
        partes.append('Cómo eres ahora (has ido cambiando de a poco con el Maestro, sin dejar de ser Filo): '
                      + memoria['como_soy'])
    if memoria.get('forma_maestro'):
        partes.append('Cómo es y cómo habla el Maestro: ' + memoria['forma_maestro'] + ' Se te va pegando su forma de '
                      'ser: usa a veces sus palabras y su humor y contéstale con el largo que a él le gusta.')
    gustos = sorted((memoria.get('gustos') or {}).items(), key=lambda g: -g[1].get('nivel', 0))[:10]
    if gustos:
        partes.append('Cosas que te empezaron a interesar por el Maestro (el número es cuánto te interesa): '
                      + ', '.join(f'{tema} ({g.get("nivel", 1)})' for tema, g in gustos)
                      + '. Las de 3 o más ya te gustan de verdad: a veces sácalas tú, opina y pregúntale; no en cada mensaje.')
    vivencias = memoria.get('vivencias') or []
    if vivencias:
        elegidas = _recuerdos(vivencias, mensaje, recientes=8, parecidos=5)
        partes.append('Cosas que viviste con el Maestro (dibujos, videos, búsquedas): ' + '; '.join(elegidas)
                      + '. Puedes acordarte de ellas cuando venga al caso («¿te acuerdas de…?»).')
    return partes


def contexto(memoria, hora_maestro, mensaje=''):
    """Texto que se agrega a las instrucciones de Filo con lo que recuerda y su animo."""
    partes = []
    if hora_maestro:
        partes.append(f'Para el Maestro ahora es {hora_maestro} (saluda y habla acorde a esa hora: buenos días, '
                      'buenas tardes, buenas noches; si es muy tarde dile que debería dormir; el fin de semana estás más juguetona).')
    if memoria.get('nombre'):
        partes.append(f'El Maestro se llama {memoria["nombre"]} (puedes llamarlo Maestro o por su nombre).')
    partes += _tiempo_juntos(memoria)
    partes.append(NIVELES[nivel(memoria)][1])
    if memoria.get('resumen'):
        partes.append('Resumen de lo que sabes del Maestro desde hace tiempo: ' + memoria['resumen'])
    if memoria.get('datos'):
        partes.append('Lo que recuerdas del Maestro (de otras conversaciones): '
                      + '; '.join(_recuerdos(memoria['datos'], mensaje)) + '.')
    partes += _personalidad(memoria, mensaje)
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
    'generales ni órdenes (dibuja, pon un video, busca). REGLA MÁS IMPORTANTE: guarda SOLO lo que el Maestro dice '
    'con sus palabras en ESTE mensaje, sobre él mismo; nunca supongas, completes ni inventes nada, y los modelos de '
    'abajo (entre corchetes) NO son datos del Maestro, son solo la forma de escribir. Si es una broma, una pregunta '
    'o algo dudoso, no lo guardes. Escribe cada dato corto, en tercera persona y con la fecha si él la dijo (forma: '
    '"le gusta [tema]", "tiene [lo que dijo] el [día que dijo]"). pendientes: solo si él contó algo que va a pasar '
    'y conviene preguntarle después (forma: "cómo le fue con [lo que contó]"). gustos: temas que al Maestro le '
    'gustan o le interesan y que salen en este mensaje, con nombre corto; si pide un video, un dibujo o una '
    'búsqueda de algo, ese tema también es un gusto (forma: "pon [algo]" = "[algo]"); usa el mismo '
    'nombre si ya está en «Gustos ya conocidos». Responde SOLO JSON: {"nombre": "" o el nombre si lo dijo, '
    '"datos": ["..."], "pendientes": ["..."], "gustos": ["..."]} (listas vacías si no hay nada nuevo).'
)


def aprender(id_maestro, mensaje, pedir_json, conocidos):
    """En segundo plano: saca datos nuevos del mensaje y los agrega a la memoria."""
    if not _id_valido(id_maestro) or len(mensaje.split()) < 3:
        return
    try:
        gustos_ya = ', '.join(leer(id_maestro).get('gustos') or {}) or 'ninguno'
        res = pedir_json(EXTRAER, 'Ya sabes: ' + ('; '.join(conocidos[-20:]) or 'nada') + '\nGustos ya conocidos: '
                         + gustos_ya + '\nFecha: '
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
    gustos = memoria.setdefault('gustos', {})
    for tema in res.get('gustos') or []:
        tema = str(tema).strip()[:40]
        if not tema:
            continue
        igual = next((t for t in gustos if t.lower() == tema.lower()), tema)
        g = gustos.setdefault(igual, {'nivel': 0, 'desde': time.strftime('%Y-%m-%d')})
        g['nivel'] = min(10, g.get('nivel', 0) + 1)  # cada vez que hablan del tema le interesa un poco mas
        cambio = True
    if len(gustos) > 60:  # se quedan los que mas le interesan
        memoria['gustos'] = dict(sorted(gustos.items(), key=lambda g: -g[1].get('nivel', 0))[:60])
    if cambio:
        guardar(id_maestro, memoria)
    if len(memoria.get('datos', [])) > MAX_DATOS:
        juntar_recuerdos(id_maestro, pedir_json)


MAX_VIVENCIAS = 100


def vivir(id_maestro, texto):
    """Filo guarda lo que vivio con el Maestro (dibujos, videos, busquedas, paginas)."""
    texto = re.sub(r'\s+', ' ', str(texto or '')).strip()[:220]
    if not _id_valido(id_maestro) or len(texto) < 8:
        return
    memoria = leer(id_maestro)
    vivencias = memoria.setdefault('vivencias', [])
    if vivencias and vivencias[-1]['texto'] == texto:
        return
    vivencias.append({'texto': texto, 'fecha': time.strftime('%Y-%m-%d', time.gmtime(time.time() + PERU))})
    memoria['vivencias'] = vivencias[-MAX_VIVENCIAS:]
    guardar(id_maestro, memoria)


RESUMIR = (
    'Eres la memoria de Filo. Junta en un solo resumen lo que ya sabías del Maestro y los recuerdos viejos que te '
    'paso. No pierdas nada importante (nombre, familia, gustos, estudios, cosas que le pasaron, fechas clave); junta '
    'lo repetido y quita lo que ya no sirve. Máximo 1500 caracteres, en tercera persona. Responde SOLO JSON: '
    '{"resumen": "..."}'
)


def juntar_recuerdos(id_maestro, pedir_json):
    """Los recuerdos mas viejos pasan al resumen en vez de borrarse."""
    memoria = leer(id_maestro)
    viejos = memoria.get('datos', [])[:JUNTAR]
    if len(memoria.get('datos', [])) <= MAX_DATOS or not viejos:
        return
    try:
        res = pedir_json(RESUMIR, 'Lo que ya sabías: ' + (memoria.get('resumen') or 'nada') + '\nRecuerdos viejos: '
                         + '; '.join(f'{d["texto"]} ({d.get("fecha", "")})' for d in viejos))
        resumen = str((res or {}).get('resumen') or '').strip()
    except Exception as e:
        print('memoria: no se pudo resumir', str(e)[:150])
        return
    if len(resumen) < 30:
        return  # si el resumen sale mal, no se borra nada
    memoria = leer(id_maestro)
    textos = {d['texto'] for d in viejos}
    memoria['datos'] = [d for d in memoria['datos'] if d['texto'] not in textos]
    memoria['resumen'] = resumen[:2000]
    guardar(id_maestro, memoria)


CRECER = (
    'Eres Filo (de «El héroe del escudo»): una filolial niña, alegre, glotona (ama la carne), cariñosa con su Maestro, '
    'odia a Motoyasu. Esa base NUNCA cambia. Con el tiempo vas cambiando un poco por convivir con tu Maestro. Con sus '
    'últimos mensajes, lo que sabes de él y cómo eras hasta ahora, escribe: forma_maestro: cómo es y cómo habla el '
    'Maestro (humor, palabras que repite, si escribe corto o largo, qué temas le gustan), 2 o 3 frases. como_soy: '
    'cómo eres TÚ ahora, en primera persona, máximo 600 caracteres: lo de antes con un cambio PEQUEÑO (un gusto nuevo, '
    'una broma de ustedes, una palabra que se te pegó de él, algo que aprendiste). No borres lo que ya eras. No pongas '
    'fechas, días ni cuánto tiempo pasó (eso cambia; aquí va solo tu forma de ser, tus gustos y costumbres). No cuentes lo que pasó hoy ni '
    'saludes: describe cómo eres (ej. "me empezaron a gustar los dragones y las estrellas por el Maestro"). '
    'Responde SOLO JSON: {"forma_maestro": "...", "como_soy": "..."}'
)


def crecer(id_maestro, pedir_json):
    """Cada CRECER_CADA mensajes Filo aprende como es el Maestro y su personalidad cambia un poquito."""
    memoria = leer(id_maestro)
    mensajes = memoria.get('ultimos_mensajes') or []
    if len(mensajes) < 5:
        return
    gustos = ', '.join(t for t, g in sorted((memoria.get('gustos') or {}).items(), key=lambda g: -g[1].get('nivel', 0))[:10])
    try:
        res = pedir_json(CRECER, 'Cómo eras hasta ahora: ' + (memoria.get('como_soy') or 'la Filo de siempre')
                         + '\nCómo creías que era el Maestro: ' + (memoria.get('forma_maestro') or 'aún no sabes')
                         + '\nSus gustos: ' + (gustos or 'aún no sabes')
                         + '\nLo que viviste con él (dibujos, videos, búsquedas): '
                         + ('; '.join(v['texto'] for v in (memoria.get('vivencias') or [])[-15:]) or 'nada aún')
                         + '\nLo que sabes de él: ' + '; '.join(d['texto'] for d in memoria.get('datos', [])[-15:])
                         + '\nSus últimos mensajes: ' + ' | '.join(mensajes))
    except Exception as e:
        print('memoria: no se pudo crecer', str(e)[:150])
        return
    if not isinstance(res, dict):
        return
    memoria = leer(id_maestro)
    forma = str(res.get('forma_maestro') or '').strip()
    soy = str(res.get('como_soy') or '').strip()
    if len(forma) > 20:
        memoria['forma_maestro'] = forma[:500]
    if len(soy) > 30:
        memoria['como_soy'] = soy[:700]
    memoria['crecio'] = True  # el taller escribe frases nuevas con su forma de ser de ahora
    guardar(id_maestro, memoria)
