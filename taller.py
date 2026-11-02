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
import random
import re
import threading
import time
import unicodedata

import acciones
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
    return next((r for r in todas(memo) if r['id'] == id_), None) or MODOS.get(id_)


def publica(receta, voces=None):
    """Lo que la pagina necesita para ponerle la ropa (y decir su frase con voz grabada si ya la tiene)."""
    if not receta:
        return None
    return {'id': receta['id'], 'nombre': receta['nombre'], 'frase': receta['frase'], 'emocion': receta.get('emocion', 'feliz'),
            'capas': receta.get('capas', {}), 'dibujo': vestuario.colores_dibujo(receta), 'voz': receta.get('voz', '')}


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


def cambiar(datos):
    """«cámbiate» = otro atuendo; «ponte el kimono» = ese. Devuelve la receta o {'no_encontre': True}."""
    pedido = _sin_tildes(str(datos.get('pedido') or ''))
    memo = memoria.leer(MAESTRO)
    ropa = _ropa(memo)
    lista = todas(memo)
    elegido = None
    for r in sorted(lista, key=lambda r: -len(r['nombre'])):
        nombre = _sin_tildes(r['nombre'])
        if nombre in pedido or r['id'].replace('_', ' ') in pedido:
            elegido = r
            break
    if not elegido:
        if re.search(r'\b(ponte|vistete|usa|lleva)\b', pedido) and not re.search(r'\b(otr[ao]|cambia|nuev[ao]|distint[ao])\b', pedido):
            return {'no_encontre': True}
        otros = [r for r in lista if r['id'] != ropa['hoy'] and r['id'] not in ropa['usados'][-20:]] or [r for r in lista if r['id'] != ropa['hoy']]
        elegido = max(otros, key=lambda r: _puntaje(r, memo))
    ropa.update(fecha=_hoy(), hoy=elegido['id'], frase_dicha=True)
    if elegido['id'] not in ropa['usados']:
        ropa['usados'].append(elegido['id'])
    _guardar_ropa(ropa)
    return publica(elegido)


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

    def empezar(self):
        threading.Thread(target=self._bucle, daemon=True).start()

    def _bucle(self):
        time.sleep(20)
        while True:
            time.sleep(15)
            if time.time() - self.ultimo_uso() < LIBRE or not acciones.credenciales_nube():
                continue
            try:
                self.un_paso()
            except Exception as e:
                print('taller:', str(e)[:200], flush=True)

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
