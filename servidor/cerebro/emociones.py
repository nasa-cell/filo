"""Emociones nuevas de Filo 3D: cuando ya mostró todas las que tiene, inventa una más (como la ropa del taller).

- La página avisa con /emociones-agotadas cuando Filo ya mostró todas sus emociones sin repetir.
- El taller, cuando nadie la usa, pide a la IA UNA receta nueva (máximo 1 por día y hasta 200 guardadas).
- La receta solo usa piezas probadas: lugares fijos para las manos (el motor las hace chocar con el cuerpo en vez
  de atravesarlo), posturas de dedos que ya existen, ángulos con límites, y símbolos y fondos del motor.
- Queda en la memoria (Neon) y la página la baja con /emociones-nuevas.
"""
import re
import time

import memoria

MAESTRO = memoria.MAESTRO
MAXIMO = 200
ANIMOS = ('feliz', 'risa', 'emocionada', 'sorpresa', 'pensando', 'enojada', 'triste', 'pena', 'miedo', 'asco', 'timida',
          'guino', 'amor', 'orgullosa', 'celosa')
LUGARES = ('abajo', 'cadera', 'pecho', 'corazon', 'frente', 'mejilla', 'cara', 'menton', 'boca', 'oreja', 'arriba',
           'saludo', 'senalar', 'lado')
DEDOS = ('relajada', 'abierta', 'palma', 'puno', 'punoSuave', 'senalar', 'paz', 'pulgar', 'garra', 'corazon', 'menton')
RITMOS = ('quieto', 'rebote', 'ola', 'lado', 'latido', 'temblor')
SIMBOLOS = ('gota', 'vena', 'corazones', 'estrellas', 'notas', 'pregunta', 'idea', 'zetas', 'rubor', 'lagrimas',
            'espiral', 'suspiro', 'susto')
FONDOS = ('cielo', 'rosa', 'azul', 'rojo', 'gris', 'amarillo')
CARA = ('happy', 'sad', 'angry', 'surprised', 'relaxed', 'aa', 'blink')
# las que ya tiene (para que no repita nombre ni idea)
BASE = ['Saludar', 'Hablar', 'Pensar', 'Reaccionar', 'Reírse', 'Saltitos de alegría', '¿Quién sabe?', 'Mira a un lado',
        'Enojada', 'Triste', 'Enamorada', 'Asustada', '¡Puaj!', 'Orgullosa', 'Guiño', 'Se duerme', 'Tímida', 'Confundida',
        '¡Sí, sí!', 'No, no', 'Bostezar', 'Llora a mares', 'Traviesa', 'Aburrida', 'Mareada', 'Puchero', 'Aplaudir',
        '¡Qué bonito!', 'Bota fuego', 'Vomita arcoíris', 'Vomita verde', 'Humo por las orejas', 'Sopla burbujas',
        'Se le sale el alma', '¡Achís!', 'Se le hace agua la boca', '¡Tengo una idea!', 'Mano al pecho', '¡Lo logré!',
        '¡Kyaa!', '¡Qué vergüenza!', '¡Vamos!', '¡Tú!', '¡Holi, chat!', 'Corazón con las manos', 'Nya~',
        'V de victoria', '¡Buenísimo!', 'Mmm…', 'Abrazo al chat', '¡Me muero de risa!']
# ángulos del cuerpo (grados) y sus límites
CUERPO = {'inclina': 12, 'gira': 18, 'ladea': 14, 'cabeza': 14, 'mira_lado': 25}

CREAR = (
    'Vas a inventar una EMOCIÓN NUEVA para tu cuerpo 3D (una reacción corta de 4 a 6 segundos, estilo anime/VTuber). '
    'Tiene que ser distinta de las que ya tienes. Usa SOLO las piezas permitidas. Responde SOLO este JSON: '
    '{"nombre": "nombre corto en español (2 a 4 palabras, con signos si quieres)", '
    '"animo": "uno de: ' + ', '.join(ANIMOS) + '", '
    '"mano_izquierda": {"lugar": "uno de: ' + ', '.join(LUGARES) + '", "dedos": "uno de: ' + ', '.join(DEDOS) + '"}, '
    '"mano_derecha": {"lugar": "...", "dedos": "..."}, '
    '"cuerpo": {"inclina": -12..12 (adelante +), "gira": -18..18, "ladea": -14..14, "cabeza": -14..14 (agachar +), '
    '"mira_lado": -25..25}, '
    '"salta": 0..1, "ritmo": "uno de: ' + ', '.join(RITMOS) + '", '
    '"cara": {"happy": 0..1, "sad": 0..1, "angry": 0..1, "surprised": 0..1, "relaxed": 0..1, "aa": 0..1 (boca abierta), '
    '"blink": 0..1 (ojos cerrados)}, "guino": true o false, '
    '"simbolos": [hasta 2 de: ' + ', '.join(SIMBOLOS) + '], "fondo": "uno de: ' + ', '.join(FONDOS) + '" o null}. '
    'Las dos manos pueden ir al mismo lugar (se ponen una a cada lado). Que la cara vaya con el ánimo.'
)


def _num(v, lim, base=0.0):
    try:
        return max(-lim, min(lim, float(v)))
    except (TypeError, ValueError):
        return base


def _uno(v, lista, defecto):
    v = str(v or '').strip()
    return v if v in lista else defecto


def limpiar(res, ya):
    """Revisa la receta de la IA. Devuelve la receta segura o None si no sirve."""
    if not isinstance(res, dict):
        return None
    nombre = re.sub(r'[*_#~<>]|[\U0001F000-\U0001FFFF]', '', str(res.get('nombre') or '')).strip()[:32]
    if len(nombre) < 3 or nombre.lower() in {n.lower() for n in ya}:
        return None
    manos = {}
    for lado, clave in (('I', 'mano_izquierda'), ('D', 'mano_derecha')):
        m = res.get(clave) if isinstance(res.get(clave), dict) else {}
        manos[lado] = {'lugar': _uno(m.get('lugar'), LUGARES, 'abajo'), 'dedos': _uno(m.get('dedos'), DEDOS, 'relajada')}
    if manos['I']['lugar'] == 'abajo' and manos['D']['lugar'] == 'abajo':
        return None  # sin manos no se nota la emoción
    c = res.get('cuerpo') if isinstance(res.get('cuerpo'), dict) else {}
    cara = res.get('cara') if isinstance(res.get('cara'), dict) else {}
    simbolos = [s for s in (res.get('simbolos') or []) if s in SIMBOLOS][:2] if isinstance(res.get('simbolos'), list) else []
    return {
        'nombre': nombre,
        'animo': _uno(res.get('animo'), ANIMOS, 'feliz'),
        'manos': manos,
        'cuerpo': {k: round(_num(c.get(k), lim), 1) for k, lim in CUERPO.items()},
        'salta': round(max(0.0, _num(res.get('salta'), 1)), 2),
        'ritmo': _uno(res.get('ritmo'), RITMOS, 'quieto'),
        'cara': {k: round(max(0.0, _num(cara.get(k), 1)), 2) for k in CARA if cara.get(k) is not None},
        'guino': bool(res.get('guino')),
        'simbolos': simbolos,
        'fondo': res.get('fondo') if res.get('fondo') in FONDOS else None,
    }


def _hoy():
    return time.strftime('%Y-%m-%d', time.gmtime(time.time() + memoria.PERU))


def lista(_datos=None):
    memo = memoria.leer(MAESTRO)
    return {'emociones': memo.get('emociones_nuevas') or []}


def agotadas(_datos=None):
    """La página avisa que Filo ya mostró todas sus emociones: el taller inventará una cuando pueda."""
    memo = memoria.leer(MAESTRO)
    if not memo.get('emociones_pedida'):
        memo['emociones_pedida'] = True
        memoria.guardar(MAESTRO, memo)
    return {'ok': True}


def hace_falta(memo):
    nuevas = memo.get('emociones_nuevas') or []
    hoy_ya = any(e.get('dia') == _hoy() for e in nuevas)
    return bool(memo.get('emociones_pedida')) and not hoy_ya and len(nuevas) < MAXIMO


def crear(pedir_json):
    """Inventa UNA emoción nueva y la guarda."""
    memo = memoria.leer(MAESTRO)
    if not hace_falta(memo):
        return None
    nuevas = memo.get('emociones_nuevas') or []
    ya = BASE + [e['nombre'] for e in nuevas]
    receta = None
    for _ in range(2):
        res = pedir_json(CREAR, 'Emociones que ya tienes (no repitas nombre ni idea): ' + ', '.join(ya[-80:]))
        receta = limpiar(res, ya)
        if receta:
            break
    if not receta:
        raise RuntimeError('la receta de la emoción no sirvió')
    receta['id'] = 'n' + str(int(time.time()))
    receta['dia'] = _hoy()
    memo = memoria.leer(MAESTRO)
    memo['emociones_nuevas'] = (memo.get('emociones_nuevas') or []) + [receta]
    memo['emociones_pedida'] = False
    memoria.guardar(MAESTRO, memo)
    return 'emoción nueva: ' + receta['nombre']
