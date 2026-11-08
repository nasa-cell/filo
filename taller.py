"""Ropa del dia de Filo y su «taller»: lo que crea sola cuando nadie le habla.

- Ropa del dia: cada dia (hora de Peru) se pone un atuendo que no repite hasta usar todos; prefiere los que van con
  la estacion, las fechas y los gustos del Maestro.
- Taller: si el servidor lleva 1 minuto sin uso, hace UNA tarea por vez (asi no se pone lenta si le hablan):
    1. graba con su voz (Fish, modelo gratis) una frase pendiente y la sube a Cloudinary
    2. si le quedan menos de 10 atuendos sin estrenar, inventa uno (con reglas), lo pinta y lo sube
    3. si de algun tipo de frase le quedan menos de 8 nuevas sin decir (o si acaba de crecer), escribe frases nuevas
  Todo queda en Cloudinary (archivos) y Neon (listas): si Render se apaga, al despertar sigue donde quedo.
"""
import json
import os
import random
import re
import threading
import time
import unicodedata

import acciones
import emociones
import memoria
import vestuario

MAESTRO = memoria.MAESTRO
SIN_ESTRENAR_MIN = 10
FRASES_MIN = 8
FRASES_MAX = 200
CREADOS_MAX = 150
LIBRE = 60  # segundos sin uso para ponerse a trabajar
EMOCIONES = ('feliz', 'contenta', 'emocionada', 'risa', 'pensando', 'timida', 'amor', 'orgullosa', 'sorpresa', 'celosa', 'pena', 'guino')

# tipos de frases nuevas: (para que sirven, largo maximo)
TIPOS = {
    'sola': ('cuando el Maestro no te habla hace rato: llamas su atención, le cuentas algo de ti, le propones algo '
             'que les gusta o recuerdas algo que vivieron juntos', 120),
    'saludo': ('saludo cuando el Maestro toca «Saludar» o te pide que te presentes: alegre, con algo tuyo de ahora', 160),
    'pensando': ('frase cortita mientras piensas la respuesta', 40),
    'sigue': ('frase cortita si todavía sigues pensando o trabajando', 40),
    'despertar': ('al despertar cuando el Maestro te despierta', 90),
}
_RECETAS = vestuario.leer_recetas()
BASE = _RECETAS['atuendos']
MODOS = {r['id']: r for r in _RECETAS['modos']}


def _hoy():
    return time.strftime('%Y-%m-%d', time.gmtime(time.time() + memoria.PERU))


def _sin_tildes(t):
    return ''.join(c for c in unicodedata.normalize('NFD', str(t).lower()) if unicodedata.category(c) != 'Mn')


def _ropa(memo):
    r = memo.get('ropa')
    if not isinstance(r, dict):
        r = memo['ropa'] = {}
    r.setdefault('fecha', '')
    r.setdefault('hoy', '')
    r.setdefault('usados', [])
    r.setdefault('creados', [])
    return r


def todas(memo):
    return BASE + [c for c in _ropa(memo)['creados'] if c.get('capas', {}).get('cuerpo')]


def _buscar(memo, id_):
    mezcla = _ropa(memo).get('mezcla')
    if mezcla and mezcla.get('id') == id_:
        return mezcla
    return next((r for r in todas(memo) if r['id'] == id_), None) or MODOS.get(id_)


def publica(receta, voces=None):
    """Lo que la pagina necesita para ponerle la ropa (y decir su frase con voz grabada si ya la tiene)."""
    if not receta:
        return None
    return {'id': receta['id'], 'nombre': receta['nombre'], 'frase': receta['frase'], 'emocion': receta.get('emocion', 'feliz'),
            'capas': receta.get('capas', {}), 'dibujo': vestuario.colores_dibujo(receta), 'voz': receta.get('voz', ''),
            # la Filo 3D arma la misma ropa con piezas 3D: colores, tela, franjas y adorno del pelo
            'tres': {k: receta[k] for k in ('base', 'mono', 'tela', 'extras', 'adorno') if receta.get(k) is not None}}


# ---------- ropa del dia ----------
def _estacion(mes):  # estaciones de Peru
    return 'verano' if mes in (12, 1, 2, 3) else 'otono' if mes in (4, 5) else 'invierno' if mes in (6, 7, 8) else 'primavera'


FECHAS = [((2, 14), 'san valentin', 'San Valentín'), ((7, 28), 'fiestas patrias', 'Fiestas Patrias del Perú'),
          ((10, 31), 'halloween', 'Halloween'), ((12, 25), 'navidad', 'Navidad'), ((2, 10), 'carnaval', 'Carnavales')]


def _fechas_cerca(dias=10):
    ahora = time.gmtime(time.time() + memoria.PERU)
    hoy = time.mktime((ahora.tm_year, ahora.tm_mon, ahora.tm_mday, 12, 0, 0, 0, 0, -1))
    cerca = []
    for (mes, dia), etiqueta, nombre in FECHAS:
        for anio in (ahora.tm_year, ahora.tm_year + 1):
            falta = (time.mktime((anio, mes, dia, 12, 0, 0, 0, 0, -1)) - hoy) / 86400
            if 0 <= falta <= dias:
                cerca.append((etiqueta, nombre, int(falta)))
    return cerca


def _puntaje(receta, memo):
    etiquetas = set(receta.get('etiquetas') or [])
    mes = time.gmtime(time.time() + memoria.PERU).tm_mon
    p = random.random() * 2
    if _estacion(mes) in etiquetas:
        p += 3
    if any(e in etiquetas for e, _, _ in _fechas_cerca()):
        p += 4
    texto = _sin_tildes(' '.join(etiquetas) + ' ' + receta['nombre'])
    for gusto, g in (memo.get('gustos') or {}).items():
        palabras = [w for w in re.findall(r'\w+', _sin_tildes(gusto)) if len(w) > 3]
        if any(w in texto for w in palabras):
            p += 1 + min(3, g.get('nivel', 1))
    if receta['id'].startswith('creado-'):
        p += 1  # los nuevos que hizo ella tienen un poquito de prioridad
    return p


def ropa_del_dia(_datos=None):
    memo = memoria.leer(MAESTRO)
    ropa = _ropa(memo)
    if ropa['fecha'] != _hoy() or not _buscar(memo, ropa['hoy']):
        candidatos = [r for r in todas(memo) if r['id'] not in ropa['usados']]
        if not candidatos:
            ropa['usados'] = []
            candidatos = [r for r in todas(memo) if r['id'] != ropa['hoy']]
        elegido = max(candidatos, key=lambda r: _puntaje(r, memo))
        ropa.update(fecha=_hoy(), hoy=elegido['id'], frase_dicha=False)
        ropa['usados'] = (ropa['usados'] + [elegido['id']])[-500:]
        _guardar_ropa(ropa)
    salida = publica(_buscar(memo, ropa['hoy']))
    salida['estreno'] = not ropa.get('frase_dicha')
    salida['modos'] = {k: publica(v) for k, v in MODOS.items()}
    return salida


def _guardar_ropa(ropa):
    """Guarda solo la ropa sobre la memoria fresca (no pisa lo que se aprendio mientras tanto)."""
    memo = memoria.leer(MAESTRO)
    memo['ropa'] = ropa
    memoria.guardar(MAESTRO, memo)


def ropa_frase_dicha(_datos=None):
    memo = memoria.leer(MAESTRO)
    ropa = _ropa(memo)
    ropa['frase_dicha'] = True
    _guardar_ropa(ropa)
    return {'ok': True}


# ---------- pedidos de ropa del Maestro ----------
# «ponte ropa de primavera», «vístete de conejo», «hazte otro gorro», «crea tu outfit nuevo», «orejas cafés»...
# Primero se entiende el pedido (que parte, que tema, que colores) y luego: si ya tiene algo asi, se lo pone al
# instante; si no, o si pidio crear, la pagina muestra el aviso con barra y llama a /ropa-crear.
COLORES = {
    'cafe': '#8b5a2b', 'marron': '#8b5a2b', 'chocolate': '#5c3a1e', 'rojo': '#d62f3a', 'roja': '#d62f3a',
    'azul': '#2f5fd0', 'celeste': '#7cc4f2', 'rosado': '#f58fb5', 'rosada': '#f58fb5', 'rosa': '#f58fb5',
    'fucsia': '#e0338f', 'morado': '#8a4fc9', 'morada': '#8a4fc9', 'lila': '#b79be6', 'violeta': '#8a4fc9',
    'verde': '#3aa35b', 'amarillo': '#f4cf3a', 'amarilla': '#f4cf3a', 'naranja': '#f08a2e', 'anaranjado': '#f08a2e',
    'negro': '#2b2b30', 'negra': '#2b2b30', 'blanco': '#f7f7f7', 'blanca': '#f7f7f7', 'gris': '#9a9aa5',
    'dorado': '#e8b93a', 'dorada': '#e8b93a', 'plateado': '#c9ced6', 'plateada': '#c9ced6', 'turquesa': '#2ec4b6',
    'beige': '#e8d5b5', 'crema': '#f6ead2', 'vino': '#7d1f35', 'guinda': '#7d1f35',
}
ANIMALES = {'conejo': 'conejo', 'conejito': 'conejo', 'coneja': 'conejo', 'conejita': 'conejo', 'gato': 'gato',
            'gatito': 'gato', 'gata': 'gato', 'gatita': 'gato', 'michi': 'gato', 'neko': 'gato', 'zorro': 'zorro',
            'zorrito': 'zorro', 'zorra': 'zorro', 'zorrita': 'zorro', 'kitsune': 'zorro', 'oso': 'oso', 'osito': 'oso',
            'osa': 'oso', 'osita': 'oso'}
# temas que no son nombre ni etiqueta de ningun atuendo, pero tienen parecidos
SINONIMOS = {'naturaleza': ['bosque', 'campo', 'flores', 'animales'], 'flor': ['flores'], 'florcita': ['flores'],
             'frio': ['invierno'], 'calor': ['verano'], 'estrella': ['estrellas'], 'espacio': ['estrellas', 'noche'],
             'japones': ['japon'], 'japonesa': ['japon'], 'peruana': ['peru'], 'peruano': ['peru'],
             'fruta': ['fruta'], 'mariposas': ['animales', 'primavera'], 'magia': ['fantasia'], 'magica': ['fantasia'],
             'escuela': ['colegio'], 'comoda': ['comodo'], 'deportiva': ['deporte']}
VERBOS = re.compile(r'ponte|pontela|pontelo|ponerte|pongas|pon|vistete|vestirte|vistas|disfrazate|disfrazarte|usa|usar|'
                    r'uses|lleva|llevar|lleves|cambiate|cambiarte|cambies|cambia|cambiar|quiero|verte|puedes|podrias|'
                    r'que|te|crea|create|crear|crees|creas|haz|hazte|hacer|hagas|hacerte|hace|disena|disenate|disenar|'
                    r'disenes|inventa|inventate|inventar|inventes|fabrica|fabricate|cose|cosete|arma|armate|prueba|'
                    r'pruebate|vestida|vestido|vestir|ver|gustaria|me|seria|lindo|disfrazas|disfraces|disfrazada|'
                    r'pones|vistes|encantaria|quisiera|como|si|tal|vez|puedas|hagamos|haces')
CREAR = re.compile(r'\b(crea|create|crear|crees|creas|haz|hazte|hacer|hagas|hacerte|disena|disenate|disenar|disenes|'
                   r'inventa|inventate|inventar|inventes|fabrica|fabricate|cose|cosete|arma|armate|nuev[oa]s?)\b')
ROPA = re.compile(r'\b(ropa|ropita|atuendo|outfit|traje|disfraz|disfraces|disfrazas|disfrazada|vestido|vestida|look|'
                  r'conjunto|uniforme|armadura|capa|gorro|gorrito|gorra|capucha|casco|antifaz|mascara|careta|'
                  r'sombrero|adorno|accesorio|orejas?|orejitas?|diadema|vincha|tiara|corona|lazo|mono|vestirte|vistete|'
                  r'vistes|disfrazate|cambiate|cambiarte)\b')
CABEZA = re.compile(r'\b(gorro|gorrito|gorra|capucha|casco|antifaz|mascara|careta|sombrero|adorno|accesorio|orejas?|orejitas?|diadema|vincha|tiara|corona|lazo|'
                    r'cabeza|pelo|cabello|arriba)\b')
CUERPO = re.compile(r'\b(vestido|tela|falda|abajo|cuerpo)\b')
COMPLETO = re.compile(r'\b(complet[oa]|tod[oa]|enter[oa]|de pies a cabeza)\b')
PRENDA = re.compile(r'\b(ropa|ropita|atuendo|outfit|traje|disfraz|conjunto|look|uniforme|armadura|capa)\b')
RELLENO = set(('ropa ropita atuendo atuendos outfit traje disfraz disfraces vestido look conjunto uniforme gorro gorrito '
               'gorra capucha casco antifaz mascara careta armadura capa '
               'sombrero adorno accesorio oreja orejas orejita orejitas diadema vincha tiara corona lazo mono tela '
               'falda cabeza pelo cabello cuerpo arriba abajo solo solamente unicamente nada mas completo completa '
               'todo toda entero entera filo maestro favor por porfa porfis plis please un una unos unas el la los las '
               'lo de del al a con y o en tu tus mi mis su sus otro otra otros otras nuevo nueva nuevos nuevas distinto '
               'distinta algo uno ya ahora hoy bonito bonita lindo linda tipo estilo me tambien color colores pies '
               'para ti tuyo tuya propio propia se esta este eso esa').split())


# temas con piezas propias: lo que se pinta si o si cuando el Maestro los nombra (la IA pone el resto).
# personaje = version inspirada en sus colores y su simbolo, no el traje exacto.
NEGRO, ROJO, AZUL, AMARILLO, CAFE = '#1e1e26', '#d62f3a', '#2f5fd0', '#f4cf3a', '#b06a30'
TEMAS = [
    ('arana', r'hombre arana|spider ?-?(man|girl|woman)|mujer arana|chica arana|telaranas?|aranas?|aracnid\w*', True,
     {'base': ROJO, 'mono': AZUL, 'tela': {'tipo': 'telarana', 'color': NEGRO},
      'extras': [{'tipo': 'emblema', 'forma': 'arana', 'color': NEGRO}, {'tipo': 'franja', 'color': AZUL, 'y': 960, 'alto': 40}]}),
    ('jirafa', r'jirafas?|jirafit\w*', False,
     {'base': '#f6e3a8', 'mono': CAFE, 'tela': {'tipo': 'manchas', 'color': CAFE},
      'adorno': {'tipo': 'gorro_jirafa', 'color': AMARILLO, 'color2': CAFE}}),
    ('vaca', r'vacas?|vaquit\w*|toro', False,
     {'base': '#f7f7f7', 'mono': '#f58fb5', 'tela': {'tipo': 'vaca', 'color': '#2b2b30'},
      'adorno': {'tipo': 'gorro_vaca', 'color': '#f7f7f7', 'color2': '#2b2b30'}}),
    ('ciervo', r'ciervos?|renos?|venados?|bambi', False,
     {'base': '#b27846', 'mono': '#f6ead2', 'adorno': {'tipo': 'gorro_ciervo', 'color': '#b27846', 'color2': '#784f2d'}}),
    ('unicornio', r'unicornios?', False,
     {'adorno': {'tipo': 'gorro_unicornio', 'color': '#fff8ff', 'color2': '#f0c846'}}),
    ('dinosaurio', r'dinosaurios?|dinos?|t-?rex|dragon(a|es|cito)?', False,
     {'base': '#5ab45a', 'mono': '#f08a2e', 'tela': {'tipo': 'escamas', 'color': '#2f7a3a'},
      'adorno': {'tipo': 'gorro_dinosaurio', 'color': '#5ab45a', 'color2': '#f0a032'}}),
    ('rana', r'ranas?|ranit\w*|sapos?|sapit\w*', False,
     {'base': '#64c35a', 'mono': '#e6505a', 'adorno': {'tipo': 'gorro_rana', 'color': '#64c35a'}}),
    ('pato', r'patos?|patit\w*', False,
     {'base': '#fadc46', 'mono': '#f08c28', 'adorno': {'tipo': 'gorro_pato', 'color': '#fadc46', 'color2': '#f08c28'}}),
    ('pollito', r'pollit\w*|pollos?|gallin\w*', False,
     {'base': '#ffe15a', 'mono': '#f09632', 'adorno': {'tipo': 'gorro_pollito', 'color': '#ffe15a', 'color2': '#f09632'}}),
    ('panda', r'pandas?|pandit\w*', False,
     {'base': '#f7f7f7', 'mono': '#2b2b30', 'adorno': {'tipo': 'gorro_panda', 'color': '#f7f7f7', 'color2': '#2b2b30'}}),
    ('leopardo', r'leopardos?|jaguar(es)?|guepardos?|felin\w*', False,
     {'base': '#f0c070', 'mono': '#3a2a1a', 'tela': {'tipo': 'leopardo', 'color': '#3a2a1a', 'color2': '#a86a30'},
      'adorno': {'tipo': 'orejas_gato', 'color': '#f0c070', 'color2': '#3a2a1a'}}),
    ('tigre', r'tigres?|tigrit\w*|tigresa', False,
     {'base': '#f08a2e', 'mono': '#f7f7f7', 'tela': {'tipo': 'tigre', 'color': '#2b2b30'},
      'adorno': {'tipo': 'orejas_gato', 'color': '#f08a2e', 'color2': '#f7f7f7'}}),
    ('cebra', r'cebras?', False,
     {'base': '#f7f7f7', 'mono': '#e0338f', 'tela': {'tipo': 'cebra', 'color': '#2b2b30'}}),
    ('sirena', r'sirenas?|pez|peces|pescad\w*', False,
     {'base': '#2ec4b6', 'mono': '#b79be6', 'tela': {'tipo': 'escamas', 'color': '#1a7f77', 'color2': '#5fd8cc'}}),
    ('pikachu', r'pikachu|pokemon', True,
     {'base': AMARILLO, 'mono': ROJO, 'extras': [{'tipo': 'emblema', 'forma': 'rayo', 'color': '#2b2b30'}],
      'adorno': {'tipo': 'orejas_zorro', 'color': AMARILLO, 'color2': '#fff1a8'}}),
    ('batman', r'batman|batichica|batgirl|murcielag\w*', True,
     {'base': '#3a3a48', 'mono': AMARILLO, 'extras': [{'tipo': 'emblema', 'forma': 'estrella', 'color': '#1e1e26', 'color2': AMARILLO}],
      'adorno': {'tipo': 'orejas_gato', 'color': '#1e1e26', 'color2': '#3a3a48'}}),
    ('superman', r'super ?man|super ?girl|superchica', True,
     {'base': AZUL, 'mono': ROJO, 'extras': [{'tipo': 'emblema', 'forma': 'estrella', 'color': ROJO, 'color2': AMARILLO},
                                            {'tipo': 'franja', 'color': ROJO, 'y': 960, 'alto': 40}]}),
    ('maravilla', r'mujer maravilla|wonder ?woman', True,
     {'base': ROJO, 'mono': AMARILLO, 'extras': [{'tipo': 'emblema', 'forma': 'estrella', 'color': '#f7f7f7', 'color2': AZUL},
                                                {'tipo': 'franja', 'color': AZUL, 'y': 940, 'alto': 60}],
      'adorno': {'tipo': 'tiara', 'color': '#e8b93a', 'color2': ROJO}}),
    ('ironman', r'iron ?man|hombre de hierro', True,
     {'base': '#b3202c', 'mono': '#e8b93a', 'extras': [{'tipo': 'emblema', 'forma': 'estrella', 'color': '#bfeaff', 'color2': '#e8b93a'},
                                                      {'tipo': 'franja', 'color': '#e8b93a', 'y': 950, 'alto': 50}]}),
    ('hulk', r'hulk', True, {'base': '#4caf50', 'mono': '#8a4fc9', 'extras': [{'tipo': 'franja', 'color': '#8a4fc9', 'y': 940, 'alto': 60}]}),
    ('heroe', r'super ?heroes?|super ?heroina|heroes?|heroina', True,
     {'extras': [{'tipo': 'emblema', 'forma': 'estrella', 'color': AMARILLO}]}),
]
TEMAS = [(clave, re.compile(r'\b(' + regla + r')\b'), personaje, piezas) for clave, regla, personaje, piezas in TEMAS]
ANTIFAZ = re.compile(r'\b(antifaz|mascara|careta|antifaces)\b')


def temas_de(pedido):
    """Temas con piezas propias que nombra el pedido (el primero manda)."""
    t = _sin_tildes(str(pedido))
    return [(clave, personaje, piezas) for clave, regla, personaje, piezas in TEMAS if regla.search(t)]


def _palabras(t):
    return re.findall(r'[a-z0-9]+', t)


def _singular(w):
    if len(w) > 4 and w.endswith('es') and w[:-2] in COLORES:
        return w[:-2]
    return w[:-1] if len(w) > 3 and w.endswith('s') else w


def _color(w):
    return COLORES.get(w) or COLORES.get(_singular(w))


def entender(pedido):
    """Lo que pide el Maestro: crear o no, parte (todo/cabeza/cuerpo), tema, animal y colores por parte."""
    t = re.sub(r'\bmono\b', 'mono', _sin_tildes(pedido))  # «moño» queda «mono» sin tildes
    palabras = _palabras(t)
    colores = {}
    for i, w in enumerate(palabras):
        c = _color(w)
        if not c:
            continue
        cerca = ' '.join(palabras[max(0, i - 4):i])  # «orejas cafés», «vestido rojo», «moño azul»
        ultima = next((p for p in reversed(palabras[max(0, i - 4):i]) if CABEZA.match(p) or CUERPO.match(p)
                       or p == 'mono' or re.match(r'(lunar|flor|estrella|corazon|raya|cuadro|dibujo)', p)), '')
        if ultima == 'mono':
            colores['mono'] = c
        elif CABEZA.match(ultima):
            colores.setdefault('cabeza', c)
        elif re.match(r'(lunar|flor|estrella|corazon|raya|cuadro|dibujo)', ultima):
            colores.setdefault('tela', c)
        elif ultima or not cerca or not CABEZA.search(t):
            colores.setdefault('cuerpo', c)
        else:
            colores.setdefault('cabeza', c)
    solo = re.search(r'\b(solo|solamente|nada mas|unicamente)\b', t)
    if COMPLETO.search(t):
        parte = 'todo'
    elif CABEZA.search(t) and not CUERPO.search(t) and not PRENDA.search(t):
        parte = 'cabeza'
    elif CUERPO.search(t) and not CABEZA.search(t) and (solo or not PRENDA.search(t)):
        parte = 'cuerpo'
    else:
        parte = 'todo'
    tema = [w for w in palabras if w not in RELLENO and not VERBOS.fullmatch(w) and not _color(w) and not w.isdigit()]
    animal = next((ANIMALES[w] for w in palabras if w in ANIMALES), None)
    temas = [clave for clave, _, _ in temas_de(t)]
    vestir = re.search(r'\b(ponte|pontela|ponerte|pongas|pones|vistete|vestirte|vistes|vistas|verte|vestida|'
                       r'disfraz\w*|usa|lleva|cambiate)\b', t)
    original = str(pedido).lower()
    visto = []  # el tema como lo escribio (con ñ y tildes) para el aviso: «hombre araña», no «hombre arana»
    for w in tema[:4]:
        m = re.search(r'(?<![a-z0-9])' + re.escape(w) + r'(?![a-z0-9])', t)
        visto.append(original[m.start():m.end()] if m and len(original) == len(t) else w)
    return {'crear': bool(CREAR.search(t)), 'parte': parte, 'tema': ' '.join(tema[:4]), 'tema_visto': ' '.join(visto),
            'animal': animal,
            'colores': colores, 'temas': temas,
            'es_ropa': bool(ROPA.search(t) or animal or CABEZA.search(t) or CUERPO.search(t) or (temas and vestir)
                            or re.search(r'\b(ponte|pontela|ponerte|pongas|vistete)\s+(algo\s+)?de\b', t))}


def _con_palabra(nombre, texto):
    return re.search(r'(?<![a-z])' + re.escape(nombre) + r'(?![a-z])', texto) is not None


def _parecido(lista, tema):
    """Atuendo que ya tiene con ese nombre o ese tema (etiquetas y parecidos). None si no hay."""
    if not tema:
        return None
    for r in sorted(lista, key=lambda r: -len(r['nombre'])):
        if _con_palabra(_sin_tildes(r['nombre']), tema) or _con_palabra(r['id'].replace('_', ' '), tema):
            return r
    buscadas = set()
    for w in tema.split():
        buscadas |= {w, _singular(w), *SINONIMOS.get(w, []), *SINONIMOS.get(_singular(w), [])}
    mejores = []
    for r in lista:
        texto = set(_sin_tildes(' '.join(r.get('etiquetas') or []) + ' ' + r['nombre']).split())
        n = len(buscadas & texto)
        if n:
            mejores.append((n, random.random(), r))
    return max(mejores, key=lambda m: m[:2])[2] if mejores else None


def _ponerse(memo, receta, mezcla=None):
    ropa = _ropa(memo)
    ropa.update(fecha=_hoy(), hoy=(mezcla or receta)['id'], frase_dicha=True)
    if mezcla:
        ropa['mezcla'] = mezcla
    if receta['id'] not in ropa['usados']:
        ropa['usados'].append(receta['id'])
    _guardar_ropa(ropa)


def _mezclar(cuerpo, cabeza, nombre, frase, emocion='feliz'):
    """Vestido de un atuendo con el adorno de otro (sin pintar nada: se juntan sus capas)."""
    m = {k: v for k, v in cuerpo.items() if k not in ('id', 'voz', 'adorno', 'capas')}
    m.update(id='mezcla-' + str(int(time.time())), nombre=nombre, frase=frase, emocion=emocion,
             adorno=cabeza.get('adorno') or {'tipo': 'ninguno'}, capas=dict(cuerpo.get('capas') or {}))
    m['capas'].pop('cabeza', None)
    if (cabeza.get('capas') or {}).get('cabeza'):
        m['capas']['cabeza'] = cabeza['capas']['cabeza']
    return m


def cambiar(datos):
    """Pedido de ropa. Devuelve la receta puesta, {'crear': {...}} si hay que hacerla (la pagina muestra el aviso y
    llama a /ropa-crear) o {'no_encontre': True} si no era un pedido de ropa."""
    pedido = str(datos.get('pedido') or '')
    q = entender(pedido)
    memo = memoria.leer(MAESTRO)
    ropa = _ropa(memo)
    lista = todas(memo)
    actual = _buscar(memo, ropa['hoy'])
    if not q['es_ropa'] and not _parecido(lista, q['tema']):
        return {'no_encontre': True}  # «ponte feliz», «usa la cámara»: no era ropa
    crear = {'crear': dict(q, pedido=pedido[:200]), 'segundos': 15}
    if q['crear'] or q['colores'] or (q['animal'] and q['parte'] != 'cuerpo') or ANTIFAZ.search(_sin_tildes(pedido)):
        return crear  # lo pidio nuevo, con colores o con orejas: se hace a medida
    elegido = _parecido(lista, q['tema'])
    if q['tema'] and not elegido:
        return crear  # no tiene nada asi: se lo hace
    if not elegido:  # «cámbiate», «otro gorro», «otro vestido»: uno que no use hace poco
        otros = [r for r in lista if r['id'] != ropa['hoy'] and r['id'] not in ropa['usados'][-20:]] or \
                [r for r in lista if r['id'] != ropa['hoy']]
        if q['parte'] == 'cabeza' and actual:
            tipo = (actual.get('adorno') or {}).get('tipo')
            otros = [r for r in otros if (r.get('adorno') or {}).get('tipo') not in (tipo, 'ninguno', None)] or otros
        elegido = max(otros, key=lambda r: _puntaje(r, memo))
    if q['parte'] == 'cabeza' and actual and actual['id'] != elegido['id']:
        m = _mezclar(actual, elegido, actual['nombre'], '¡Me cambié el adorno de la cabeza! ¿Te gusta así, Maestro?')
        _ponerse(memo, elegido, m)
        return publica(m)
    if q['parte'] == 'cuerpo' and actual and actual['id'] != elegido['id']:
        m = _mezclar(elegido, actual, elegido['nombre'], '¡Vestido nuevo con el mismo adorno! ¿Combina, Maestro?')
        _ponerse(memo, elegido, m)
        return publica(m)
    ropa = _ropa(memo)
    ropa.pop('mezcla', None)
    _ponerse(memo, elegido)
    return publica(elegido)


CREAR_PEDIDO = (
    ' AHORA el Maestro te pidió esta ropa: «{pedido}». Hazla de ESE tema{parte}. {colores}Si pide un animal con '
    'orejas (conejo, gato, zorro, oso), usa el adorno orejas_<animal>; si es otro animal con gorro en el catálogo '
    '(jirafa, vaca, ciervo, unicornio, dinosaurio, rana, pato, pollito, panda), usa gorro_<animal>. El nombre dice el '
    'tema que pidió. Si es un personaje (Spider-Man, Pikachu, Batman...), haz una versión INSPIRADA en sus colores y '
    'su símbolo, con nombre tuyo («Filo Araña», no el nombre del personaje). Si el catálogo no tiene la pieza exacta '
    'de lo que pidió (capa, armadura, alas, cola, zapatos...), haz lo más parecido con sus colores y en la frase dilo '
    'con honestidad y cariño («me salió lo más parecido que pude, Maestro...»). En la frase nombra SOLO lo que de '
    'verdad llevas (el color del vestido, su dibujo, el símbolo y el adorno); nunca digas que tienes algo que no está.'
)


def _subir(datos, nombre):
    """Sube la capa a Cloudinary; sin nube (o en pruebas con FILO_ROPA_LOCAL) la deja en imagenes/ropa/creados."""
    if acciones.credenciales_nube() and not os.environ.get('FILO_ROPA_LOCAL'):
        return acciones.subir_archivo(datos, 'filo-ropa', nombre)
    carpeta = os.path.join(vestuario.CARPETA, 'imagenes', 'ropa', 'creados')
    os.makedirs(carpeta, exist_ok=True)
    with open(os.path.join(carpeta, nombre + '.webp'), 'wb') as f:
        f.write(datos)
    return 'imagenes/ropa/creados/' + nombre + '.webp'


def _separar_color(c, base, minimo):
    """Si un color casi no se ve sobre el vestido, lo aclara u oscurece hasta que se note."""
    rb = vestuario.rgb(base)
    if vestuario.distancia(vestuario.rgb(c), rb) >= minimo:
        return c
    otro = vestuario.oscuro(rb, 0.45) if vestuario.luminancia(rb) > 128 else vestuario.claro(rb, 0.6)
    return vestuario.hexa(otro)


def _a_medida(receta, q, actual):
    """Pone si o si lo que pidio el Maestro (colores, orejas, la parte que no cambia) sobre lo que propuso la IA."""
    r = dict(receta) if isinstance(receta, dict) else {}
    col = q.get('colores') or {}
    temas = temas_de(q.get('pedido') or q.get('tema') or '')
    for clave, _, piezas in reversed(temas):  # el primero que nombro manda (se pone al final)
        for k, v in piezas.items():
            if k == 'adorno' and q['parte'] == 'cuerpo' or k != 'adorno' and q['parte'] == 'cabeza':
                continue
            r[k] = json.loads(json.dumps(v))
        r['etiquetas'] = [clave] + [e for e in (r.get('etiquetas') or []) if e != clave][:4]
    if q['parte'] != 'cuerpo' and ANTIFAZ.search(_sin_tildes(q.get('pedido') or '')):
        base = r.get('base') if vestuario.COLOR.match(str(r.get('base'))) else None
        oscura = not base or vestuario.luminancia(vestuario.rgb(base)) < 70
        otro = r.get('mono') if vestuario.COLOR.match(str(r.get('mono'))) else ROJO
        r['adorno'] = {'tipo': 'antifaz', 'color': col.get('cabeza') or (otro if oscura else base), 'color2': '#1e1e26'}
    elif (r.get('adorno') or {}).get('tipo') == 'antifaz':
        r['adorno'] = {'tipo': 'ninguno'}  # el antifaz solo si lo pide
    if q.get('animal') and q['parte'] != 'cuerpo':
        a = dict(r.get('adorno') or {})
        propio = a.get('tipo') == 'orejas_' + q['animal'] and a.get('color')  # la IA ya eligio el color de las orejas
        a['tipo'] = 'orejas_' + q['animal']
        if not propio:
            a.pop('color2', None)
        a['color'] = col.get('cabeza') or propio or {'conejo': '#f7f7f7', 'gato': '#2b2b30',
                                                             'zorro': '#f08a2e', 'oso': '#8b5a2b'}[q['animal']]
        r['adorno'] = a
    if col.get('cabeza'):
        r['adorno'] = dict(r.get('adorno') or {'tipo': 'lazo'}, color=col['cabeza'])
        if r['adorno'].get('tipo') in (None, 'ninguno'):
            r['adorno']['tipo'] = 'lazo'
    if col.get('cuerpo'):
        r['base'] = col['cuerpo']
    if col.get('mono'):
        r['mono'] = col['mono']
    if col.get('tela'):
        r['tela'] = dict(r.get('tela') or {'tipo': 'lunares'}, color=col['tela'])
        if r['tela'].get('tipo') == 'liso':
            r['tela']['tipo'] = 'lunares'
    if actual and q['parte'] == 'cabeza':  # el vestido se queda como esta
        for k in ('base', 'mono', 'tela', 'extras'):
            if actual.get(k) is not None:
                r[k] = actual[k]
    if actual and q['parte'] == 'cuerpo' and actual.get('adorno'):
        r['adorno'] = actual['adorno']
    if vestuario.COLOR.match(str(r.get('base'))):
        if vestuario.COLOR.match(str(r.get('mono'))) and not col.get('mono'):
            r['mono'] = _separar_color(r['mono'], r['base'], 75)
        tela = r.get('tela')
        if isinstance(tela, dict) and vestuario.COLOR.match(str(tela.get('color'))) and tela.get('tipo') != 'brillos':
            r['tela'] = dict(tela, color=_separar_color(tela['color'], r['base'], 50))
    return r


# ---------- la frase dice solo lo que de verdad lleva ----------
NOMBRES_COLOR = {'rojo': '#d62f3a', 'azul': '#2f5fd0', 'celeste': '#7cc4f2', 'rosado': '#f58fb5', 'fucsia': '#e0338f',
                 'morado': '#8a4fc9', 'lila': '#b79be6', 'verde': '#3aa35b', 'amarillo': '#f4cf3a', 'naranja': '#f08a2e',
                 'negro': '#2b2b30', 'blanco': '#f7f7f7', 'gris': '#9a9aa5', 'dorado': '#e8b93a', 'café': '#8b5a2b',
                 'turquesa': '#2ec4b6', 'crema': '#f6ead2', 'guinda': '#7d1f35', 'azul marino': '#1b263b'}
NOMBRE_TELA = {'flores': 'flores', 'estrellas': 'estrellitas', 'lunares': 'lunares', 'corazones': 'corazoncitos',
               'rayas': 'rayas', 'cuadros': 'cuadros', 'rombos': 'rombos', 'tejido': 'tejido', 'brillos': 'brillitos',
               'telarana': 'telarañas', 'manchas': 'manchas de jirafa', 'vaca': 'manchas de vaca',
               'leopardo': 'manchas de leopardo', 'cebra': 'rayas de cebra', 'tigre': 'rayas de tigre',
               'escamas': 'escamas'}
NOMBRE_SIMBOLO = {'arana': 'una araña', 'estrella': 'una estrella', 'rayo': 'un rayo', 'corazon': 'un corazón'}


def nombre_color(hexa):
    c = vestuario.rgb(hexa)
    return min(NOMBRES_COLOR, key=lambda n: vestuario.distancia(vestuario.rgb(NOMBRES_COLOR[n]), c))


def _nombre_adorno(a):
    tipo = (a or {}).get('tipo') or 'ninguno'
    if tipo == 'ninguno':
        return ''
    if tipo.startswith('gorro_'):
        return 'gorro de ' + tipo[6:]
    return vestuario.CATALOGO['adornos'].get(tipo, tipo).split(' (')[0].split(';')[0]


def frase_de(receta):
    """Frase armada con lo que de verdad lleva."""
    partes = ['vestido ' + nombre_color(receta['base'])]
    tela = (receta.get('tela') or {}).get('tipo')
    if tela in NOMBRE_TELA:
        partes[0] += ' con ' + NOMBRE_TELA[tela]
    simbolo = next((e.get('forma') for e in receta.get('extras') or [] if e.get('tipo') == 'emblema'), None)
    if simbolo:
        partes.append(NOMBRE_SIMBOLO.get(simbolo, 'un símbolo') + ' en el pecho')
    adorno = _nombre_adorno(receta.get('adorno'))
    if adorno:
        partes.append(adorno if adorno.startswith(('dos ', 'un ', 'una ')) else 'mi ' + adorno)
    lista = partes[0] if len(partes) == 1 else ', '.join(partes[:-1]) + ' y ' + partes[-1]
    return f'¡Mira, Maestro! Me puse mi {lista}. ¿Te gusta?'


def frase_honesta(receta):
    """Si la frase de la IA nombra algo que no lleva (antifaz, gorro, otro color de vestido...), se arma otra."""
    f = _sin_tildes(receta.get('frase') or '')
    adorno = (receta.get('adorno') or {}).get('tipo') or 'ninguno'
    tela = (receta.get('tela') or {}).get('tipo') or 'liso'
    extras = {e.get('tipo') for e in receta.get('extras') or []}
    mal = bool(re.search(r'\b(antifaz|mascara|careta)', f) and adorno != 'antifaz'
               or re.search(r'\b(gorro|gorrito|capucha)', f) and not adorno.startswith('gorro_')
               or re.search(r'\borej', f) and not adorno.startswith(('orejas_', 'gorro_'))
               or re.search(r'\b(armadura|capa|alas|cola|zapat\w*|botas|guantes|cinturon|casco)\b', f) and 'parecido' not in f
               or 'telaran' in f and tela != 'telarana'
               or 'escamas' in f and tela != 'escamas'
               or re.search(r'\b(simbolo|emblema)', f) and 'emblema' not in extras)
    vestido = re.search(r'vestid\w*\s+(?:de\s+(?:color\s+)?)?([a-z]+)', f)
    if vestido and vestido.group(1) in COLORES:
        mal = mal or vestuario.distancia(vestuario.rgb(COLORES[vestido.group(1)]), vestuario.rgb(receta['base'])) > 120
    return frase_de(receta) if mal else receta['frase']


def _sin_ia(q, actual, lista):
    """Si la IA no responde: lo mas parecido que tiene, con las orejas y colores pedidos."""
    base = _parecido(lista, q.get('tema') or '') or actual or random.choice(lista)
    r = {k: v for k, v in base.items() if k not in ('id', 'voz', 'capas')}
    nombre = (q.get('tema') or q.get('animal') or base['nombre'])[:22]
    r.update(nombre=nombre + ' ' + str(int(time.time()) % 1000), emocion='timida',
             frase='No me salió inventarlo entero, Maestro, pero me hice lo más parecido. ¿Te gusta?')
    if col := q.get('colores'):
        if col.get('mono') is None and col.get('cuerpo'):
            r['mono'] = '#2f5fd0'
    return r


def crear_pedido(datos, pedir_json):
    """Hace el atuendo que pidio el Maestro (IA + reglas + pintar + subir), se lo pone y lo guarda en su ropero."""
    q = dict(datos.get('crear')) if isinstance(datos.get('crear'), dict) else entender(str(datos.get('pedido') or ''))
    q['pedido'] = str(q.get('pedido') or datos.get('pedido') or '')[:200]
    q['colores'] = {k: v for k, v in (q.get('colores') or {}).items() if k in ('cabeza', 'cuerpo', 'mono', 'tela')
                    and isinstance(v, str) and vestuario.COLOR.match(v)}
    if q.get('parte') not in ('todo', 'cabeza', 'cuerpo'):
        q['parte'] = 'todo'
    if q.get('animal') not in (None, *vestuario.OREJAS):
        q['animal'] = None
    memo = memoria.leer(MAESTRO)
    ropa = _ropa(memo)
    lista = todas(memo)
    actual = _buscar(memo, ropa['hoy'])
    usados = [r['nombre'] for r in lista] + [r['nombre'] for r in MODOS.values()]
    pide = {'cabeza': ' (SOLO cambia el adorno de la cabeza; el vestido se queda igual)',
            'cuerpo': ' (SOLO cambia el vestido; el adorno de la cabeza se queda igual)'}.get(q['parte'], '')
    colores = ('Usa EXACTO estos colores que pidió: ' + json.dumps(q['colores']) + '. ') if q['colores'] else ''
    tarea = CREAR_ATUENDO + CREAR_PEDIDO.format(pedido=q['pedido'] or q.get('tema') or 'algo nuevo, a tu gusto',
                                                parte=pide, colores=colores)
    fijas = {k: v for k, v in _a_medida({}, q, actual).items() if k != 'etiquetas'}
    if fijas:  # lo que ya esta decidido (tema, vestido que se queda, antifaz...): la IA lo usa y lo nombra bien
        tarea += (' Esto va SÍ O SÍ, ya está decidido; úsalo tal cual y en la frase nómbralo bien: '
                  + json.dumps(fijas, ensure_ascii=False) + '.')
    texto = ('Atuendos que ya tienes (no repitas el nombre): ' + ', '.join(usados)
             + '\nCatálogo: ' + json.dumps(vestuario.CATALOGO, ensure_ascii=False))
    receta = None
    for _ in range(2):  # si la IA se equivoca en una regla, se le da otra oportunidad
        try:
            receta = vestuario.validar(_a_medida(pedir_json(tarea, texto), q, actual), usados)
            break
        except Exception as e:
            print('ropa a pedido:', str(e)[:150], flush=True)
    sin_ia = receta is None
    if sin_ia:
        receta = vestuario.validar(_a_medida(_sin_ia(q, actual, lista), q, actual), usados)
    receta['frase'] = frase_honesta(receta)
    receta['id'] = 'creado-' + str(int(time.time() * 1000))
    capas_actual = (actual or {}).get('capas') or {}
    if q['parte'] == 'cabeza' and capas_actual.get('cuerpo'):
        partes = ('cabeza',)
    elif q['parte'] == 'cuerpo' and capas_actual.get('cabeza') is not None and (actual or {}).get('adorno'):
        partes = ('cuerpo',)
    else:
        partes = ('cuerpo', 'cabeza')
    hecho = vestuario.pintar(receta, partes)
    receta['capas'] = {}
    for parte in ('cuerpo', 'cabeza'):
        if parte in partes:
            if hecho[parte] and hecho[parte][0]:
                img, caja = hecho[parte]
                receta['capas'][parte] = {'url': _subir(img, f"{receta['id']}-{parte}"), 'caja': caja}
        elif capas_actual.get(parte):
            receta['capas'][parte] = capas_actual[parte]
    memo = memoria.leer(MAESTRO)
    ropa = _ropa(memo)
    ropa['creados'].append(receta)
    if len(ropa['creados']) > CREADOS_MAX:
        viejo = next((r for r in ropa['creados'] if r['id'] in ropa['usados'] and r['id'] != ropa['hoy']), None)
        if viejo:
            ropa['creados'].remove(viejo)
    ropa.update(fecha=_hoy(), hoy=receta['id'], frase_dicha=True)
    ropa.pop('mezcla', None)
    ropa['usados'].append(receta['id'])
    memo.setdefault('frases_pend', []).append({'texto': receta['frase'], 'emocion': receta['emocion'], 'atuendo': receta['id']})
    memoria.guardar(MAESTRO, memo)
    salida = publica(receta)
    salida['sin_ia'] = sin_ia
    return salida


# ---------- frases nuevas ----------
def frases_nuevas(_datos=None):
    memo = memoria.leer(MAESTRO)
    return {'frases': [{k: f.get(k) for k in ('id', 'texto', 'emocion', 'tipo', 'url', 'dicha')}
                       for f in memo.get('frases_nuevas') or [] if f.get('url')]}


def frase_dicha(datos):
    memo = memoria.leer(MAESTRO)
    for f in memo.get('frases_nuevas') or []:
        if f.get('id') == datos.get('id'):
            f['dicha'] = int(f.get('dicha') or 0) + 1
            memoria.guardar(MAESTRO, memo)
            break
    return {'ok': True}


# ---------- taller ----------
CREAR_ATUENDO = (
    'Vas a inventar un ATUENDO NUEVO para ti (Filo). Tu vestido de siempre se pinta de otro color y con un dibujo en la '
    'tela, tu moño cambia de color y llevas un adorno en el pelo. REGLAS: usa SOLO tipos del catálogo; colores en hex '
    '(#rrggbb) que combinen y se vean bien juntos (el moño y el dibujo deben notarse sobre el vestido); nombre corto en '
    'español que NO esté en la lista de los que ya tienes; nada feo, de miedo fuerte ni de adultos; inspíralo en los '
    'gustos del Maestro, en lo que vivieron juntos, en la estación o en una fecha que se acerca. frase: lo que dirás al '
    'estrenarlo, 1 frase corta con tu personalidad (sin emojis). etiquetas: 2-5 palabras sueltas en minúscula (tema, '
    'estación). Responde SOLO JSON: {"nombre": "...", "base": "#...", "tela": {"tipo": "...", "color": "#..."}, '
    '"extras": [{"tipo": "...", "color": "#..."}], "mono": "#...", "adorno": {"tipo": "...", "color": "#..."}, '
    '"frase": "...", "emocion": "feliz", "etiquetas": ["..."]}'
)

ESCRIBIR_FRASES = (
    'Escribe 5 frases NUEVAS tuyas (Filo) para este momento: {para}. Máximo {largo} caracteres cada una. Que suenen a '
    'ti ahora (cómo eres hoy, tus gustos, lo que viviste con el Maestro), variadas, sin repetir las que ya tienes, sin '
    'emojis ni asteriscos (se leen en voz alta). emocion: una de ' + ', '.join(EMOCIONES) + '. '
    'Responde SOLO JSON: {{"frases": [{{"texto": "...", "emocion": "..."}}]}}'
)


class Taller:
    def __init__(self, pedir_json, voz_fish, ultimo_uso):
        self.pedir_json = pedir_json  # (tarea, texto) -> dict, con la personalidad de Filo
        self.voz_fish = voz_fish      # (texto, emocion) -> bytes mp3
        self.ultimo_uso = ultimo_uso  # () -> hora del ultimo pedido del Maestro
        self.pausa = {}               # tarea -> hora hasta la que no se reintenta (si fallo)
        self.solo_emociones = False   # pruebas: solo inventa emociones

    def empezar(self):
        threading.Thread(target=self._bucle, daemon=True).start()

    def _bucle(self):
        time.sleep(20)
        while True:
            time.sleep(15)
            if time.time() - self.ultimo_uso() < LIBRE:
                continue
            try:
                hecho = self.paso_emocion()
                if not hecho and acciones.credenciales_nube() and not self.solo_emociones:
                    self.un_paso()
            except Exception as e:
                print('taller:', str(e)[:200], flush=True)

    def paso_emocion(self):
        """Si Filo ya mostró todas sus emociones, inventa una nueva (máximo 1 por día)."""
        if not self._puede('emocion') or not emociones.hace_falta(memoria.leer(MAESTRO)):
            return None
        try:
            hecho = emociones.crear(self.pedir_json)
            if hecho:
                print('taller:', hecho, flush=True)
            return hecho
        except Exception as e:
            self._fallo('emocion', 30)
            raise RuntimeError('no pude inventar la emoción: ' + str(e)[:120])

    def _puede(self, tarea):
        return self.pausa.get(tarea, 0) < time.time()

    def _fallo(self, tarea, minutos=10):
        self.pausa[tarea] = time.time() + minutos * 60

    def un_paso(self):
        """Hace UNA tarea (la mas necesaria). Devuelve que hizo, o None si no hacia falta nada."""
        memo = memoria.leer(MAESTRO)
        pendientes = memo.get('frases_pend') or []
        if pendientes and self._puede('grabar'):
            return self.grabar(pendientes[0])
        ropa = _ropa(memo)
        sin_estrenar = [r for r in todas(memo) if r['id'] not in ropa['usados']]
        if len(sin_estrenar) < SIN_ESTRENAR_MIN and self._puede('atuendo'):
            return self.crear_atuendo(memo)
        nuevas = memo.get('frases_nuevas') or []
        crecio = memo.get('crecio')
        for tipo in TIPOS:
            sin_decir = [f for f in nuevas if f.get('tipo') == tipo and not f.get('dicha')]
            en_cola = [f for f in pendientes if f.get('tipo') == tipo]
            falta = len(sin_decir) + len(en_cola) < FRASES_MIN or (crecio and tipo in ('sola', 'saludo') and not en_cola)
            if falta and self._puede('frases-' + tipo):
                return self.escribir_frases(memo, tipo)
        if crecio:
            memo = memoria.leer(MAESTRO)
            memo['crecio'] = False
            memoria.guardar(MAESTRO, memo)
        return None

    def grabar(self, item):
        try:
            mp3 = self.voz_fish(item['texto'], item.get('emocion') or 'feliz')
            if len(mp3) < 1000:
                raise ValueError('voz vacia')
            nombre = 'voz-' + str(int(time.time() * 1000))
            url = acciones.subir_archivo(mp3, 'filo-voces', nombre, 'video', 'audio/mpeg', 'voz.mp3')
        except Exception as e:
            self._fallo('grabar', 5)
            raise RuntimeError('no pude grabar: ' + str(e)[:120])
        memo = memoria.leer(MAESTRO)
        memo['frases_pend'] = [f for f in memo.get('frases_pend') or [] if f.get('texto') != item['texto']]
        if item.get('atuendo'):
            for r in _ropa(memo)['creados']:
                if r['id'] == item['atuendo']:
                    r['voz'] = url
        else:
            nuevas = memo.get('frases_nuevas') or []
            nuevas.append({'id': nombre, 'texto': item['texto'], 'emocion': item.get('emocion') or 'feliz',
                           'tipo': item.get('tipo') or 'sola', 'url': url, 'dicha': 0, 'creada': _hoy()})
            while len(nuevas) > FRASES_MAX:  # se va primero la mas vieja que ya dijo; si no, la mas vieja
                viejas = [f for f in nuevas if f.get('dicha')]
                nuevas.remove(viejas[0] if viejas else nuevas[0])
            memo['frases_nuevas'] = nuevas
        memoria.guardar(MAESTRO, memo)
        return 'grabé: ' + item['texto']

    def _contexto(self, memo):
        gustos = sorted((memo.get('gustos') or {}).items(), key=lambda g: -g[1].get('nivel', 0))[:10]
        partes = ['Hoy es ' + _hoy() + ' (estación en Perú: ' + _estacion(time.gmtime(time.time() + memoria.PERU).tm_mon) + ').']
        cerca = _fechas_cerca(15)
        if cerca:
            partes.append('Se acerca: ' + ', '.join(f'{n} (en {d} días)' for _, n, d in cerca) + '.')
        if gustos:
            partes.append('Gustos del Maestro (y tuyos): ' + ', '.join(t for t, _ in gustos) + '.')
        viv = [v['texto'] for v in (memo.get('vivencias') or [])[-8:]]
        if viv:
            partes.append('Lo que viviste con él hace poco: ' + '; '.join(viv) + '.')
        if memo.get('como_soy'):
            partes.append('Cómo eres ahora: ' + memo['como_soy'])
        return ' '.join(partes)

    def crear_atuendo(self, memo):
        usados = [r['nombre'] for r in todas(memo)] + [r['nombre'] for r in MODOS.values()]
        texto = (self._contexto(memo) + '\nAtuendos que ya tienes (no repitas el nombre): ' + ', '.join(usados)
                 + '\nCatálogo: ' + json.dumps(vestuario.CATALOGO, ensure_ascii=False))
        try:
            receta = vestuario.validar(self.pedir_json(CREAR_ATUENDO, texto), usados)
        except Exception as e:
            self._fallo('atuendo', 5)
            raise RuntimeError('atuendo no válido: ' + str(e)[:120])
        receta['id'] = 'creado-' + str(int(time.time()))
        hecho = vestuario.pintar(receta)
        receta['capas'] = {}
        try:
            for parte in ('cuerpo', 'cabeza'):
                if hecho[parte] and hecho[parte][0]:
                    datos, caja = hecho[parte]
                    url = acciones.subir_archivo(datos, 'filo-ropa', f"{receta['id']}-{parte}")
                    receta['capas'][parte] = {'url': url, 'caja': caja}
        except Exception as e:
            self._fallo('atuendo', 10)
            raise RuntimeError('no pude subir el atuendo: ' + str(e)[:120])
        memo = memoria.leer(MAESTRO)
        ropa = _ropa(memo)
        ropa['creados'].append(receta)
        if len(ropa['creados']) > CREADOS_MAX:  # se van los creados mas viejos que ya uso
            viejo = next((r for r in ropa['creados'] if r['id'] in ropa['usados'] and r['id'] != ropa['hoy']), None)
            if viejo:
                ropa['creados'].remove(viejo)
        memo.setdefault('frases_pend', []).append({'texto': receta['frase'], 'emocion': receta['emocion'], 'atuendo': receta['id']})
        memoria.guardar(MAESTRO, memo)
        return 'atuendo nuevo: ' + receta['nombre']

    def escribir_frases(self, memo, tipo):
        para, largo = TIPOS[tipo]
        ya = [f['texto'] for f in (memo.get('frases_nuevas') or []) if f.get('tipo') == tipo][-20:]
        texto = self._contexto(memo) + '\nFrases que ya tienes para esto (no las repitas): ' + (' | '.join(ya) or 'ninguna')
        try:
            res = self.pedir_json(ESCRIBIR_FRASES.format(para=para, largo=largo), texto)
            frases = res.get('frases') if isinstance(res, dict) else None
            if not isinstance(frases, list):
                raise ValueError('sin frases')
        except Exception as e:
            self._fallo('frases-' + tipo, 5)
            raise RuntimeError('no pude escribir frases: ' + str(e)[:120])
        vistas = {_sin_tildes(t) for t in ya}
        buenas = []
        for f in frases[:6]:
            t = re.sub(r'[*_#~]|[\U0001F000-\U0001FFFF]', '', str((f or {}).get('texto') or '')).strip()
            t = re.sub(r'\s+', ' ', t)
            if not (4 <= len(t) <= largo) or vestuario.PROHIBIDO.search(t) or _sin_tildes(t) in vistas:
                continue
            vistas.add(_sin_tildes(t))
            emo = f.get('emocion') if f.get('emocion') in EMOCIONES else 'feliz'
            buenas.append({'texto': t, 'emocion': emo, 'tipo': tipo})
        if not buenas:
            self._fallo('frases-' + tipo, 5)
            return None
        memo = memoria.leer(MAESTRO)
        memo['frases_pend'] = (memo.get('frases_pend') or []) + buenas
        if tipo == 'saludo':
            memo['crecio'] = False
        memoria.guardar(MAESTRO, memo)
        return f'{len(buenas)} frases nuevas de {tipo}'
