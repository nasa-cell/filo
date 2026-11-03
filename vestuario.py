"""Ropa del dia de Filo: su mismo vestido de la ilustracion pintado de otro color y con dibujos (como el pijama),
mas el moño del color que combina y un adorno en el pelo. Brazos, piel, pelo y forma del cuerpo no se tocan.

Cada atuendo es una «receta» (atuendos.json o las que Filo crea). Este modulo:
  - valida una receta (reglas: solo dibujos y adornos del catalogo, colores que combinen, textos limpios)
  - la pinta: capa del vestido y capa del adorno (webp transparentes, recortados)

Para pintar los atuendos de atuendos.json:  python vestuario.py
"""
import colorsys
import io
import json
import math
import os
import re

from PIL import Image, ImageDraw, ImageFilter

CARPETA = os.path.dirname(os.path.abspath(__file__))
ORIGINAL = os.path.join(CARPETA, 'imagenes', 'filo_cuerpo.png')
MASCARA = os.path.join(CARPETA, 'imagenes', 'ropa', 'vestido-mascara.png')
SALIDA = os.path.join(CARPETA, 'imagenes', 'ropa', 'dia')
RECETAS = os.path.join(CARPETA, 'atuendos.json')
K = 4  # los adornos se dibujan al cuadruple y se achican: bordes suaves

_original = None
_mascara = None


# ---------- colores ----------
def rgb(hexa):
    hexa = str(hexa).lstrip('#')
    return tuple(int(hexa[i:i + 2], 16) for i in (0, 2, 4))


def hexa(c):
    return '#%02x%02x%02x' % tuple(int(v) for v in c[:3])


def oscuro(c, f=0.55):
    return tuple(int(v * f) for v in c[:3]) + (255,)


def claro(c, f=0.55):
    return tuple(int(v + (255 - v) * f) for v in c[:3]) + (255,)


def distancia(a, b):
    return math.dist(a[:3], b[:3])


def luminancia(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


# ---------- mascara del vestido (solo la tela, sin brazos ni pelo) ----------
def _es_tela(r, g, b):
    """Tela blanca del vestido o su sombra: clara y sin tono calido (la piel de los brazos es mas calida)."""
    return (r + g + b) / 3 > 150 and max(r, g, b) - min(r, g, b) < 40 and r - b < 20


SEMILLAS = [(512, 960), (400, 850), (600, 950), (700, 830), (330, 980), (720, 1000), (420, 760), (610, 760)]


def _hacer_mascara(original):
    from collections import deque
    o = original.load()
    w, h = original.size
    m = Image.new('L', original.size, 0)
    mp = m.load()
    pendientes = deque(p for p in SEMILLAS if _es_tela(*o[p][:3]))
    for p in pendientes:
        mp[p] = 255
    while pendientes:
        x, y = pendientes.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 690 <= ny < h and not mp[nx, ny]:
                r, g, b, a = o[nx, ny]
                if a > 200 and _es_tela(r, g, b):
                    mp[nx, ny] = 255
                    pendientes.append((nx, ny))
    # se cierran los huecos de las lineas de adentro (para teñirlas tambien), sin agregar piel ni pelo
    cerrada = m.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7))
    cp = cerrada.load()
    for y in range(690, h):
        for x in range(w):
            if cp[x, y] and not mp[x, y]:
                r, g, b, a = o[x, y]
                if not (a > 200 and (r + g + b) / 3 < 170 and r - b < 40):
                    cp[x, y] = 0
    return cerrada


def _cargar():
    global _original, _mascara
    if _original is None:
        _original = Image.open(ORIGINAL).convert('RGBA')
        if os.path.isfile(MASCARA):
            _mascara = Image.open(MASCARA).convert('L')
        else:
            _mascara = _hacer_mascara(_original)
            _mascara.save(MASCARA, optimize=True)
    return _original, _mascara


def _es_mono(r, g, b):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return 0.45 < h < 0.58 and s > 0.25 and v > 0.35  # moño celeste de la ilustracion


# ---------- dibujos de la tela: funcion(x, y, parametros) -> color o None ----------
def _rejilla(x, y, paso, corrida=True):
    fila = y // paso
    corr = paso // 2 if corrida and fila % 2 else 0
    return ((x - corr) // paso) * paso + paso // 2 + corr, fila * paso + paso // 2


def _flor(x, y, cx, cy, r, petalos=5):
    d = math.hypot(x - cx, y - cy)
    if d > r:
        return False
    return d < r * (0.45 + 0.55 * abs(math.cos(petalos / 2 * math.atan2(y - cy, x - cx))))


def _estrella(x, y, cx, cy, r):
    d = math.hypot(x - cx, y - cy)
    if d > r:
        return False
    ang = math.atan2(y - cy, x - cx) + math.pi / 2
    return d < r * (0.42 + 0.58 * abs(math.cos(2.5 * ang)) ** 3)


def _corazon(x, y, cx, cy, r):
    u, v = (x - cx) / r, -(y - cy) / r + 0.25
    return (u * u + v * v - 1) ** 3 - u * u * v ** 3 < 0


def t_flores(x, y, p):
    paso = p.get('paso', 56)
    cx, cy = _rejilla(x, y, paso)
    r = p.get('tam', 15)
    if _flor(x, y, cx, cy, r, p.get('petalos', 5)):
        return p['color2'] if math.hypot(x - cx, y - cy) < r * 0.33 else p['color']
    return None


def t_estrellas(x, y, p):
    cx, cy = _rejilla(x, y, p.get('paso', 64))
    return p['color'] if _estrella(x, y, cx, cy, p.get('tam', 13)) else None


def t_lunares(x, y, p):
    paso = p.get('paso', 46)
    cx, cy = _rejilla(x, y, paso)
    if math.hypot(x - cx, y - cy) < p.get('tam', 8):
        cols = p.get('colores') or [p['color']]
        return cols[(cx // paso + cy // paso) % len(cols)]
    return None


def t_corazones(x, y, p):
    cx, cy = _rejilla(x, y, p.get('paso', 58))
    return p['color'] if _corazon(x, y, cx, cy, p.get('tam', 12)) else None


def t_rayas(x, y, p):
    paso, ancho = p.get('paso', 34), p.get('ancho', 14)
    pos = x if p.get('dir') == 'v' else y
    return p['color'] if pos % paso < ancho else None


def t_cuadros(x, y, p):
    paso = p.get('paso', 30)
    a, b = (x // paso) % 2, (y // paso) % 2
    if a and b:
        return p['color']
    if a or b:
        c, base = p['color'], p.get('_base')
        return tuple((c[i] + base[i]) // 2 for i in range(3)) if base else None
    return None


def t_rombos(x, y, p):
    paso = p.get('paso', 40)
    cx, cy = _rejilla(x, y, paso, False)
    if (y // paso) % 2 == p.get('fila', 1) % 2 and abs(x - cx) + abs(y - cy) < p.get('tam', 14):
        cols = p.get('colores') or [p['color']]
        return cols[(cx // paso) % len(cols)]
    return None


def t_tejido(x, y, p):
    r = t_rombos(x, y, dict(p, paso=40, fila=1, tam=14))
    if r:
        return r
    return p.get('color2') if (y // 6) % 2 == 0 and (x // 6) % 2 == 0 and p.get('color2') else None


def t_brillos(x, y, p):
    return p['color'] if (x * 31 + y * 17) % 211 < 3 else None


def t_liso(x, y, p):
    return None


TELAS = {'liso': t_liso, 'flores': t_flores, 'estrellas': t_estrellas, 'lunares': t_lunares, 'corazones': t_corazones,
         'rayas': t_rayas, 'cuadros': t_cuadros, 'rombos': t_rombos, 'tejido': t_tejido, 'brillos': t_brillos}


# ---------- detalles encima de la tela ----------
def e_franja(x, y, p):
    return p['color'] if p.get('y', 950) <= y < p.get('y', 950) + p.get('alto', 30) else None


def e_franjas(x, y, p):
    i = (y - p.get('y', 950)) // p.get('alto', 18)
    return p['colores'][i] if 0 <= i < len(p['colores']) else None


def e_cuello(x, y, p):
    return p['color'] if y < 760 else None


def e_botones(x, y, p):
    cx = p.get('x', 512)
    return p['color'] if abs(x - cx) < 12 and y > 800 and (y - 800) % 60 < 22 else None


def e_cierre(x, y, p):
    return p['color'] if abs(x - 512) < 4 and y > 765 else None


def e_mandil(x, y, p):
    return p['color'] if y > 800 and abs(x - 512) < 95 + (y - 800) * 0.2 else None


def e_bolsillo(x, y, p):
    return p['color'] if 880 < y < 960 and abs(x - 512) < 105 else None


def e_tirantes(x, y, p):
    if y < 830:
        return p['color'] if abs(x - 440) < 11 or abs(x - 584) < 11 else p.get('color2')
    return None


def e_banda(x, y, p):
    """banda diagonal (como la camiseta de la seleccion)"""
    return p['color'] if abs((y - 700) - (x - 300) * 0.9) < 34 else None


def e_rayas_cuello(x, y, p):
    return p['color'] if 700 < y < 790 and (abs(y - 720) < 5 or abs(y - 735) < 5) else None


def e_play(x, y, p):
    cx, cy = p.get('x', 560), p.get('y', 880)
    if abs(x - cx) < 46 and abs(y - cy) < 32:
        dx, dy = x - (cx - 12), y - cy
        if 0 <= dx < 34 and abs(dy) < 18 - dx * 0.53:
            return (230, 30, 40)
        return (255, 255, 255)
    return None


def e_buscador(x, y, p):
    cx, cy, w, h = 512, p.get('y', 905), 150, 30
    dx, dy = abs(x - cx), abs(y - cy)
    if dx < w / 2 + 4 and dy < h / 2 + 4:
        if dx > w / 2 - 1 or dy > h / 2 - 1:
            return (170, 180, 200)
        lx = cx - w / 2 + 20
        d = math.hypot(x - lx, y - cy)
        if 6 < d < 10 or (0 < x - lx - 7 < 9 and abs((y - cy - 7) - (x - lx - 7)) < 3):
            return (66, 133, 244)
        if cx - 30 < x < cx + 50 and abs(y - cy) < 2 and (x // 6) % 2 == 0:
            return (190, 195, 210)
        return (255, 255, 255)
    return None


EXTRAS = {'franja': e_franja, 'franjas': e_franjas, 'cuello': e_cuello, 'botones': e_botones, 'cierre': e_cierre,
          'mandil': e_mandil, 'bolsillo': e_bolsillo, 'tirantes': e_tirantes, 'banda': e_banda,
          'rayas_cuello': e_rayas_cuello, 'play': e_play, 'buscador': e_buscador}


# ---------- adornos del pelo ----------
def _pflor(cx, cy, r, petalos=5, giro=0.0, hondo=0.45):
    pts = []
    for i in range(petalos * 24):
        a = giro + 2 * math.pi * i / (petalos * 24)
        d = r * (hondo + (1 - hondo) * abs(math.cos(petalos / 2 * (a - giro))))
        pts.append((cx + d * math.cos(a), cy + d * math.sin(a)))
    return pts


def a_flor(d, p, cx=708, cy=265, r=52):
    color, centro = p['color'] + (255,), p.get('color2', (255, 210, 80)) + (255,)
    pet, giro = p.get('petalos', 5), p.get('giro', -0.3)
    cx, cy, r = cx * K, cy * K, p.get('tam', r) * K
    d.polygon(_pflor(cx, cy, r, pet, giro), fill=color, outline=oscuro(color), width=3 * K)
    d.polygon(_pflor(cx - r * 0.1, cy - r * 0.15, r * 0.55, pet, giro), fill=claro(color, 0.4))
    d.ellipse((cx - r * 0.25, cy - r * 0.25, cx + r * 0.25, cy + r * 0.25), fill=centro, outline=oscuro(centro), width=2 * K)


def a_sakura(d, p):
    a_flor(d, p, 712, 262, 52)
    a_flor(d, dict(p, color=claro(p['color'], 0.4)[:3]), 664, 310, 30)
    d.line([(712 * K, 300 * K), (722 * K, 380 * K)], fill=oscuro(p['color'], 0.8), width=5 * K)
    d.ellipse((714 * K, 376 * K, 732 * K, 394 * K), fill=oscuro(p['color'], 0.8))


def a_girasol(d, p):
    a_flor(d, dict(p, petalos=12, giro=0), 708, 265, 60)


def a_margarita(d, p):
    a_flor(d, dict(p, petalos=10, giro=0), 706, 265, 50)
    a_hoja(d, {'color': (90, 170, 80)}, 660, 312, 32)


def a_lazo(d, p, cx=700, cy=258, r=55, giro=0.25):
    color = p['color'] + (255,)
    cx, cy, r = cx * K, cy * K, p.get('tam', r) * K
    c, s = math.cos(giro), math.sin(giro)
    rot = lambda x, y: (cx + x * c - y * s, cy + x * s + y * c)
    for lado in (-1, 1):
        d.polygon([rot(0, 0), rot(lado * r, -r * 0.7), rot(lado * r * 1.15, 0), rot(lado * r, r * 0.7)],
                  fill=color, outline=oscuro(color), width=3 * K)
        d.line([rot(lado * r * 0.2, -r * 0.15), rot(lado * r * 0.75, -r * 0.45)], fill=claro(color, 0.5), width=4 * K)
    d.ellipse((cx - r * 0.28, cy - r * 0.32, cx + r * 0.28, cy + r * 0.32), fill=color, outline=oscuro(color), width=3 * K)


def _pestrella(d, cx, cy, r, color):
    cx, cy, r = cx * K, cy * K, r * K
    g = -math.pi / 2
    pts = [(cx + (r if i % 2 == 0 else r * 0.45) * math.cos(g + i * math.pi / 5),
            cy + (r if i % 2 == 0 else r * 0.45) * math.sin(g + i * math.pi / 5)) for i in range(10)]
    d.polygon(pts, fill=color, outline=oscuro(color), width=3 * K)
    d.ellipse((cx - r * 0.35, cy - r * 0.45, cx - r * 0.05, cy - r * 0.15), fill=(255, 255, 255, 200))


def a_estrella(d, p):
    _pestrella(d, 706, 255, 52, p['color'] + (255,))
    _pestrella(d, 656, 300, 24, p.get('color2', (255, 150, 200)) + (255,))


def a_tiara(d, p, dy=62):
    color, joya = p['color'] + (255,), p.get('color2', (255, 120, 180)) + (255,)
    puntas = [(400, 175), (420, 140), (450, 165), (480, 120), (512, 92), (544, 120), (574, 165), (604, 140), (624, 175),
              (612, 190), (412, 190)]
    d.polygon([(x * K, (y + dy) * K) for x, y in puntas], fill=color, outline=oscuro(color), width=3 * K)
    for x, y, r in ((512, 135, 13), (470, 158, 8), (554, 158, 8)):
        d.ellipse(((x - r) * K, (y + dy - r) * K, (x + r) * K, (y + dy + r) * K), fill=joya, outline=oscuro(joya), width=2 * K)
    d.line([(420 * K, (182 + dy) * K), (600 * K, (182 + dy) * K)], fill=claro(color, 0.6), width=3 * K)


def a_cofia(d, p, dy=58):
    blanco, borde = (255, 255, 255, 255), (190, 190, 205, 255)
    for i in range(9):
        x = 395 + i * 29
        d.ellipse(((x - 22) * K, (128 + dy) * K, (x + 22) * K, (176 + dy) * K), fill=blanco, outline=borde, width=3 * K)
    d.rounded_rectangle((395 * K, (150 + dy) * K, 629 * K, (182 + dy) * K), radius=14 * K, fill=blanco, outline=borde, width=3 * K)
    d.line([(410 * K, (166 + dy) * K), (614 * K, (166 + dy) * K)], fill=p['color'] + (255,), width=6 * K)


def a_vincha(d, p):
    caja = (215 * K, 120 * K, 809 * K, 700 * K)
    cols = p.get('colores')
    if cols:
        for i, c in enumerate(cols):
            paso = 140 / len(cols)
            d.arc(caja, 200 + i * paso, 201 + (i + 1) * paso, fill=oscuro(c + (255,)), width=30 * K)
            d.arc(caja, 201 + i * paso, 200 + (i + 1) * paso, fill=c + (255,), width=24 * K)
        return
    color = p['color'] + (255,)
    d.arc(caja, 200, 340, fill=oscuro(color), width=32 * K)
    d.arc(caja, 201, 339, fill=color, width=26 * K)
    d.arc((caja[0] + 8 * K, caja[1] + 8 * K, caja[2] - 8 * K, caja[3] - 8 * K), 225, 300, fill=claro(color, 0.5), width=5 * K)


def a_orejeras(d, p):
    color = p['color'] + (255,)
    d.arc((225 * K, 110 * K, 799 * K, 840 * K), 195, 345, fill=oscuro(color), width=22 * K)
    d.arc((225 * K, 110 * K, 799 * K, 840 * K), 196, 344, fill=color, width=16 * K)
    pom = p.get('color2', (255, 255, 255)) + (255,)
    for x in (232, 792):
        d.ellipse(((x - 46) * K, 410 * K, (x + 46) * K, 520 * K), fill=pom, outline=oscuro(pom, 0.8), width=4 * K)
        for a in range(0, 360, 40):
            px, py = x + 40 * math.cos(math.radians(a)), 465 + 50 * math.sin(math.radians(a))
            d.ellipse(((px - 10) * K, (py - 10) * K, (px + 10) * K, (py + 10) * K), fill=pom)


def a_hoja(d, p, cx=712, cy=255, r=62):
    color = p['color'] + (255,)
    cx, cy, r = cx * K, cy * K, r * K
    pts = [(cx + r * 0.45 * math.sin(t) ** 2, cy - r + 2 * r * t / math.pi) for t in [i * math.pi / 30 for i in range(31)]]
    pts += [(2 * cx - x, y) for x, y in reversed(pts)]
    d.polygon(pts, fill=color, outline=oscuro(color), width=3 * K)
    d.line([(cx, cy - r), (cx, cy + r)], fill=oscuro(color, 0.7), width=3 * K)


def a_hojas(d, p):
    a_hoja(d, p, 712, 255, 62)
    a_hoja(d, dict(p, color=claro(p['color'], 0.3)[:3]), 676, 290, 42)


def a_pinzas(d, p):
    color = p['color'] + (255,)
    for i in range(2):
        d.rounded_rectangle(((656 + i * 10) * K, (245 + i * 26) * K, (724 + i * 10) * K, (257 + i * 26) * K),
                            radius=6 * K, fill=color, outline=oscuro(color), width=2 * K)


def a_lupa(d, p, cx=735, cy=230, r=38):
    cx, cy, r = cx * K, cy * K, r * K
    d.line([(cx + r * 0.7, cy + r * 0.7), (cx + r * 1.7, cy + r * 1.7)], fill=(110, 75, 40, 255), width=14 * K)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(200, 230, 255, 170), outline=(60, 60, 80, 255), width=8 * K)
    d.arc((cx - r * 0.6, cy - r * 0.6, cx + r * 0.6, cy + r * 0.6), 200, 260, fill=(255, 255, 255, 255), width=5 * K)


def a_broches(d, p):
    for i, c in enumerate(p.get('colores') or [p['color']] * 4):
        x = 640 + i * 30
        d.ellipse(((x - 13) * K, (300 - i * 12) * K, (x + 13) * K, (326 - i * 12) * K), fill=c + (255,), outline=oscuro(c + (255,)), width=2 * K)


def a_corazon(d, p, cx=706, cy=262, r=46):
    color = p['color'] + (255,)
    pts = []
    for i in range(120):
        t = 2 * math.pi * i / 120
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append(((cx + x * r / 17) * K, (cy - y * r / 17) * K))
    d.polygon(pts, fill=color, outline=oscuro(color), width=3 * K)
    d.ellipse(((cx - r * 0.55) * K, (cy - r * 0.5) * K, (cx - r * 0.25) * K, (cy - r * 0.2) * K), fill=(255, 255, 255, 190))


def a_luna(d, p, cx=708, cy=262, r=48):
    color = p['color'] + (255,)
    grande = Image.new('L', (int(r * 2.4 * K), int(r * 2.4 * K)), 0)
    g = ImageDraw.Draw(grande)
    o = r * 0.2 * K
    g.ellipse((o, o, o + 2 * r * K, o + 2 * r * K), fill=255)
    g.ellipse((o + r * 0.7 * K, o - r * 0.25 * K, o + r * 2.5 * K, o + r * 1.6 * K), fill=0)
    capa = Image.new('RGBA', grande.size, color)
    capa.putalpha(grande)
    d._image.alpha_composite(capa, (int((cx - r * 1.2) * K), int((cy - r * 1.2) * K)))
    _pestrella(d, cx + r * 0.75, cy - r * 0.55, r * 0.32, p.get('color2', (255, 230, 120)) + (255,))


def a_mariposa(d, p, cx=706, cy=262, r=46):
    color, otro = p['color'] + (255,), p.get('color2', (255, 255, 255)) + (255,)
    for lado in (-1, 1):
        d.ellipse(((cx + lado * r * 0.55 - r * 0.55) * K, (cy - r * 0.95) * K, (cx + lado * r * 0.55 + r * 0.55) * K, (cy + r * 0.05) * K),
                  fill=color, outline=oscuro(color), width=3 * K)
        d.ellipse(((cx + lado * r * 0.45 - r * 0.38) * K, (cy - r * 0.05) * K, (cx + lado * r * 0.45 + r * 0.38) * K, (cy + r * 0.7) * K),
                  fill=otro, outline=oscuro(color), width=3 * K)
    d.ellipse(((cx - r * 0.12) * K, (cy - r * 0.8) * K, (cx + r * 0.12) * K, (cy + r * 0.7) * K), fill=oscuro(color, 0.4))


# ---------- orejas de animal: diadema fina sobre el pelo y dos orejas que salen de ella ----------
# Cada forma se dibuja con la base en (0, 0) apuntando hacia arriba; luego se gira y se pone sobre la diadema.
# La punta queda dentro de la imagen (y >= 4): arriba de la cabeza no hay mas lienzo.
def _girar(pts, x0, y0, grados):
    a = math.radians(grados)
    c, s = math.cos(a), math.sin(a)
    return [((x0 + x * c - y * s) * K, (y0 + x * s + y * c) * K) for x, y in pts]


def _elipse(cx, cy, rx, ry, n=40):
    return [(cx + rx * math.cos(2 * math.pi * i / n), cy + ry * math.sin(2 * math.pi * i / n)) for i in range(n)]


OREJAS = {  # animal: (x de cada oreja, giro, forma de afuera, forma de adentro)
    'conejo': ((428, 596), 16, _elipse(0, -60, 36, 66), _elipse(0, -56, 18, 46)),
    'gato': ((410, 614), 24, [(-54, 18), (-10, -100), (54, 18)], [(-32, 6), (-10, -66), (32, 6)]),
    'zorro': ((406, 618), 22, [(-58, 20), (-6, -118), (58, 20)], [(-34, 6), (-7, -80), (34, 6)]),
    'oso': ((398, 626), 26, _elipse(0, -28, 46, 46), _elipse(0, -26, 25, 25)),
}


def _diadema_y(x):
    """Altura de la diadema (la misma curva de la vincha) en esa x."""
    dx = (x - 512) / 297
    return 410 - 290 * math.sqrt(max(0.0, 1 - dx * dx))


def _orejas(d, p, animal):
    color = p['color'] + (255,)
    adentro = p.get('color2', (255, 248, 240) if animal == 'zorro' else (255, 182, 200)) + (255,)
    xs, giro, afuera, dentro = OREJAS[animal]
    caja = (215 * K, 120 * K, 809 * K, 700 * K)
    d.arc(caja, 205, 335, fill=oscuro(color), width=16 * K)
    d.arc(caja, 206, 334, fill=color, width=11 * K)
    for x, signo in zip(xs, (-1, 1)):
        y = _diadema_y(x) + 4
        d.polygon(_girar(afuera, x, y, giro * signo), fill=color, outline=oscuro(color), width=3 * K)
        d.polygon(_girar(dentro, x, y, giro * signo), fill=adentro)


def a_orejas_conejo(d, p):
    _orejas(d, p, 'conejo')


def a_orejas_gato(d, p):
    _orejas(d, p, 'gato')


def a_orejas_zorro(d, p):
    _orejas(d, p, 'zorro')


def a_orejas_oso(d, p):
    _orejas(d, p, 'oso')


ADORNOS = {'ninguno': None, 'flor': a_flor, 'sakura': a_sakura, 'girasol': a_girasol, 'margarita': a_margarita,
           'lazo': a_lazo, 'estrella': a_estrella, 'tiara': a_tiara, 'cofia': a_cofia, 'vincha': a_vincha,
           'orejeras': a_orejeras, 'hojas': a_hojas, 'pinzas': a_pinzas, 'lupa': a_lupa, 'broches': a_broches,
           'corazon': a_corazon, 'luna': a_luna, 'mariposa': a_mariposa,
           'orejas_conejo': a_orejas_conejo, 'orejas_gato': a_orejas_gato, 'orejas_zorro': a_orejas_zorro,
           'orejas_oso': a_orejas_oso}

# lo que se le explica a la IA cuando Filo inventa un atuendo
CATALOGO = {
    'telas': {'liso': 'sin dibujo', 'flores': 'flores (color pétalos, color2 centro; petalos 5-12; tam 8-18)',
              'estrellas': 'estrellitas (color)', 'lunares': 'lunares (color, o colores: lista de 2-4)',
              'corazones': 'corazoncitos (color)', 'rayas': 'rayas (color; dir h o v; ancho 6-20)',
              'cuadros': 'cuadros (color)', 'rombos': 'rombos (color o colores)', 'tejido': 'chompa tejida (color, color2)',
              'brillos': 'brillitos (color)'},
    'extras': {'franja': 'franja abajo (color, y 900-1000, alto 15-40)', 'franjas': 'varias franjas (colores, y, alto)',
               'cuello': 'cuello de otro color (color)', 'botones': 'botones (color)', 'cierre': 'cierre al medio (color)',
               'mandil': 'mandil (color)', 'bolsillo': 'bolsillo (color)', 'tirantes': 'tirantes (color, color2 polo)',
               'banda': 'banda diagonal (color)', 'rayas_cuello': 'rayas en el cuello (color)'},
    'adornos': {'flor': 'flor (color, color2 centro, petalos)', 'sakura': 'flor de cerezo con colgante (color)',
                'girasol': 'girasol (color, color2)', 'margarita': 'margarita con hoja (color, color2)',
                'lazo': 'lazo (color)', 'estrella': 'dos estrellas (color, color2)', 'tiara': 'tiara (color, color2 joya)',
                'cofia': 'cofia de maid (color cinta)', 'vincha': 'vincha (color, o colores)',
                'orejeras': 'orejeras (color, color2 pompones)', 'hojas': 'hojas (color)', 'pinzas': 'pinzas (color)',
                'broches': 'broches (colores)', 'corazon': 'corazón (color)', 'luna': 'luna con estrella (color, color2)',
                'mariposa': 'mariposa (color, color2)',
                'orejas_conejo': 'diadema con orejas de conejo (color, color2 adentro de la oreja)',
                'orejas_gato': 'diadema con orejas de gato (color, color2 adentro)',
                'orejas_zorro': 'diadema con orejas de zorro (color, color2 adentro)',
                'orejas_oso': 'diadema con orejas de oso (color, color2 adentro)', 'ninguno': 'sin adorno'},
}


# ---------- reglas ----------
PROHIBIDO = re.compile(r'sex|desnud|lencer|bikini|tanga|sangre|muert|arma|droga|nazi|calavera|diablo|porn', re.I)
COLOR = re.compile(r'^#[0-9a-fA-F]{6}$')


def _color_ok(c):
    return isinstance(c, str) and bool(COLOR.match(c))


def validar(receta, nombres_usados=()):
    """Devuelve la receta limpia o lanza ValueError con el motivo. Reglas de los atuendos que crea Filo."""
    if not isinstance(receta, dict):
        raise ValueError('no es una receta')
    nombre = re.sub(r'\s+', ' ', str(receta.get('nombre') or '')).strip()[:30]
    frase = re.sub(r'\s+', ' ', str(receta.get('frase') or '')).strip()[:140]
    if len(nombre) < 3 or len(frase) < 8:
        raise ValueError('falta nombre o frase')
    if PROHIBIDO.search(nombre + ' ' + frase):
        raise ValueError('texto no permitido')
    if nombre.lower() in {n.lower() for n in nombres_usados}:
        raise ValueError('nombre repetido')
    limpio = {'nombre': nombre, 'frase': frase, 'emocion': str(receta.get('emocion') or 'feliz')[:20],
              'etiquetas': [str(e).lower()[:20] for e in (receta.get('etiquetas') or [])][:8]}
    for k in ('base', 'mono'):
        if not _color_ok(receta.get(k)):
            raise ValueError('color no valido: ' + k)
        limpio[k] = receta[k].lower()

    def parte(dato, catalogo, que):
        if not isinstance(dato, dict) or dato.get('tipo') not in catalogo:
            raise ValueError(que + ' no está en el catálogo')
        p = {'tipo': dato['tipo']}
        for k in ('color', 'color2'):
            if dato.get(k) is not None:
                if not _color_ok(dato[k]):
                    raise ValueError('color no valido en ' + que)
                p[k] = dato[k].lower()
        if dato.get('colores') is not None:
            cols = dato['colores']
            if not (isinstance(cols, list) and 2 <= len(cols) <= 6 and all(_color_ok(c) for c in cols)):
                raise ValueError('colores no validos en ' + que)
            p['colores'] = [c.lower() for c in cols]
        for k, (mn, mx) in {'petalos': (4, 12), 'tam': (6, 60), 'paso': (24, 80), 'ancho': (4, 24), 'y': (860, 1010),
                            'alto': (10, 60), 'x': (400, 620)}.items():
            if dato.get(k) is not None:
                p[k] = int(min(mx, max(mn, int(dato[k]))))
        if dato.get('dir') in ('h', 'v'):
            p['dir'] = dato['dir']
        if p['tipo'] not in ('liso', 'ninguno', 'cofia', 'play', 'buscador') and 'color' not in p and 'colores' not in p:
            raise ValueError('falta el color en ' + que)
        return p

    limpio['tela'] = parte(receta.get('tela') or {'tipo': 'liso'}, TELAS, 'tela')
    limpio['extras'] = [parte(e, EXTRAS, 'extra') for e in (receta.get('extras') or [])[:3]]
    limpio['adorno'] = parte(receta.get('adorno') or {'tipo': 'ninguno'}, ADORNOS, 'adorno')
    # colores que combinen: el moño y los dibujos tienen que verse sobre el vestido (distintos en tono o en luz)
    base = rgb(limpio['base'])
    if distancia(rgb(limpio['mono']), base) < 70:
        raise ValueError('el moño no se ve sobre el vestido')
    tc = limpio['tela'].get('color')
    if tc and limpio['tela']['tipo'] != 'brillos' and distancia(rgb(tc), base) < 45:
        raise ValueError('el dibujo no se ve sobre el vestido')
    return limpio


# ---------- pintar ----------
def _a_rgb(p):
    """Pasa los colores de una parte de la receta a tuplas (las funciones de dibujo usan tuplas)."""
    q = dict(p)
    for k in ('color', 'color2'):
        if k in q:
            q[k] = rgb(q[k])
    if 'colores' in q:
        q['colores'] = [rgb(c) for c in q['colores']]
    return q


def _recortar(capa):
    caja = capa.split()[-1].getbbox()
    if not caja:
        return None, None
    trozo = capa.crop(caja)
    salida = io.BytesIO()
    trozo.save(salida, 'WEBP', quality=88, method=6)
    x0, y0, x1, y1 = caja
    return salida.getvalue(), [x0, y0, x1 - x0, y1 - y0]


def pintar(receta, partes=('cuerpo', 'cabeza')):
    """Devuelve {'cuerpo': (bytes webp, [x, y, ancho, alto]), 'cabeza': (...) o None, 'vista': imagen PIL}.
    partes: lo que hay que pintar (si solo cambia el adorno, el vestido no se vuelve a pintar)."""
    original, mascara = _cargar()
    base, mono = rgb(receta['base']), rgb(receta['mono'])
    tela = _a_rgb(receta.get('tela') or {'tipo': 'liso'})
    tela['_base'] = base
    f_tela = TELAS[tela['tipo']]
    extras = [(EXTRAS[e['tipo']], _a_rgb(e)) for e in receta.get('extras') or []]
    o, mk = original.load(), mascara.load()
    capa = Image.new('RGBA', original.size, (0, 0, 0, 0))
    cp = capa.load()
    for y in range(660 if 'cuerpo' in partes else 0, 1024 if 'cuerpo' in partes else 0):
        for x in range(240, 790):
            r, g, b, a = o[x, y]
            if a < 200:
                continue
            if mk[x, y]:
                luz = (r + g + b) / 3 / 255
                c = None
                if luz > 0.55:
                    for f, p in extras:
                        c = f(x, y, p)
                        if c:
                            break
                    c = c or f_tela(x, y, tela)
                c = c or base
                cp[x, y] = (int(c[0] * luz), int(c[1] * luz), int(c[2] * luz), 255)
            elif _es_mono(r, g, b):
                k = max(r, g, b) / 255
                cp[x, y] = (int(mono[0] * k), int(mono[1] * k), int(mono[2] * k), 255)
    resultado = {'cuerpo': _recortar(capa) if 'cuerpo' in partes else None, 'cabeza': None}
    adorno = receta.get('adorno') or {'tipo': 'ninguno'}
    dibujo = ADORNOS.get(adorno['tipo']) if 'cabeza' in partes else None
    cabeza = None
    if dibujo:
        grande = Image.new('RGBA', (1024 * K, 1024 * K), (0, 0, 0, 0))
        d = ImageDraw.Draw(grande)
        dibujo(d, _a_rgb(adorno))
        cabeza = grande.resize((1024, 1024), Image.LANCZOS)
        sombra = Image.new('RGBA', cabeza.size, (90, 50, 40, 0))
        sombra.putalpha(cabeza.split()[-1].point(lambda v: int(v * 0.35)).filter(ImageFilter.GaussianBlur(5)))
        junta = Image.new('RGBA', cabeza.size, (0, 0, 0, 0))
        junta.alpha_composite(sombra, (3, 6))
        junta.alpha_composite(cabeza)
        cabeza = junta
        resultado['cabeza'] = _recortar(cabeza)
    vista = Image.new('RGBA', original.size, (233, 240, 255, 255))
    vista.alpha_composite(original)
    vista.alpha_composite(capa)
    if cabeza:
        vista.alpha_composite(cabeza)
    resultado['vista'] = vista
    return resultado


def colores_dibujo(receta):
    """Colores para la vista «Dibujo» (Filo hecha con codigo): vestido, su sombra y el moño."""
    base = rgb(receta['base'])
    return {'vestido': receta['base'], 'vestido_osc': hexa(tuple(v * 0.86 for v in base)), 'cinta': receta['mono']}


def leer_recetas():
    with open(RECETAS, encoding='utf-8') as f:
        return json.load(f)


def main():
    """Pinta los atuendos de atuendos.json en imagenes/ropa/dia y anota sus medidas."""
    import sys
    os.makedirs(SALIDA, exist_ok=True)
    datos = leer_recetas()
    solo = sys.argv[1].split(',') if len(sys.argv) > 1 and sys.argv[1] else None
    vistas = []
    for r in datos['atuendos'] + datos['modos']:
        if solo and r['id'] not in solo:
            continue
        validar(r)  # los de fabrica tambien cumplen las reglas
        hecho = pintar(r)
        r['capas'] = {}
        for parte in ('cuerpo', 'cabeza'):
            if hecho[parte] and hecho[parte][0]:
                datos_img, caja = hecho[parte]
                nombre = f"{r['id']}-{parte}.webp"
                with open(os.path.join(SALIDA, nombre), 'wb') as f:
                    f.write(datos_img)
                r['capas'][parte] = {'url': 'imagenes/ropa/dia/' + nombre, 'caja': caja}
        vistas.append((r['id'], hecho['vista']))
        print(r['id'], 'listo', flush=True)
    with open(RECETAS, 'w', encoding='utf-8') as f:
        json.dump(datos, f, ensure_ascii=False, indent=1)
    if len(sys.argv) > 2:  # hoja de revision
        lado = 220
        hoja = Image.new('RGB', (lado * 10, lado * ((len(vistas) + 9) // 10)), (255, 255, 255))
        for i, (_, v) in enumerate(vistas):
            hoja.paste(v.convert('RGB').resize((lado, lado), Image.LANCZOS), ((i % 10) * lado, (i // 10) * lado))
        hoja.save(sys.argv[2], quality=85)


if __name__ == '__main__':
    main()
