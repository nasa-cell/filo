"""Graba con la voz de Filo (Fish, modelo gratis) todas las frases de codigo/frases-filo.js y las deja en «voces».

Uso: con el servidor encendido (iniciar.cmd), ejecutar:  python servidor/herramientas/grabar_voces.py
Solo graba las frases nuevas o cambiadas; las que ya estan grabadas no se vuelven a pedir.
"""
import hashlib
import json
import os
import subprocess
import time
import urllib.parse
import urllib.request

CARPETA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGINA = os.path.join(os.path.dirname(CARPETA), 'pagina')
VOCES = os.path.join(PAGINA, 'voces')
SERVIDOR = 'http://127.0.0.1:5077'


def leer_frases():
    """Lee frases-filo.js con node y devuelve la lista de [texto, emocion] sin repetir."""
    codigo = ("global.window={};require(process.argv[1]);"
              "const out=[];const ver=(x)=>{if(Array.isArray(x)&&typeof x[0]==='string')out.push(x);"
              "else if(Array.isArray(x))x.forEach(ver);else if(x&&typeof x==='object')Object.values(x).forEach(ver)};"
              "ver(window.FrasesFilo);process.stdout.write(JSON.stringify(out))")
    salida = subprocess.run(['node', '-e', codigo, os.path.join(PAGINA, 'codigo', 'frases-filo.js')],
                            capture_output=True, check=True)
    vistas, frases = set(), []
    lista = json.loads(salida.stdout.decode('utf-8'))
    # tambien la frase de estreno de cada atuendo de atuendos.json (ropa del dia y de los modos)
    with open(os.path.join(CARPETA, 'cerebro', 'atuendos.json'), encoding='utf-8') as f:
        recetas = json.load(f)
    lista += [[r['frase'], r.get('emocion', 'feliz')] for r in recetas['atuendos'] + recetas['modos']]
    for texto, emocion in lista:
        if (texto, emocion) not in vistas:
            vistas.add((texto, emocion))
            frases.append((texto, emocion))
    return frases


def main():
    os.makedirs(VOCES, exist_ok=True)
    ruta_indice = os.path.join(VOCES, 'indice.json')
    viejo = json.load(open(ruta_indice, encoding='utf-8')) if os.path.isfile(ruta_indice) else {}
    indice, nuevas, fallas = {}, 0, []
    for texto, emocion in leer_frases():
        clave = texto + '|' + emocion
        archivo = 'filo-' + hashlib.sha1(clave.encode('utf-8')).hexdigest()[:12] + '.mp3'
        ruta = os.path.join(VOCES, archivo)
        if not (os.path.isfile(ruta) and os.path.getsize(ruta) > 1000):
            url = SERVIDOR + '/voz?texto=' + urllib.parse.quote(texto) + '&emocion=' + urllib.parse.quote(emocion)
            try:
                with urllib.request.urlopen(url, timeout=90) as r:
                    datos = r.read()
                if len(datos) < 1000:
                    raise ValueError('voz vacia')
                with open(ruta, 'wb') as f:
                    f.write(datos)
                nuevas += 1
                print('grabada:', texto)
                time.sleep(0.5)
            except Exception as e:
                fallas.append(texto)
                print('NO se pudo grabar:', texto, '-', str(e)[:80])
                continue
        indice[clave] = archivo
    # borra las grabaciones de frases que ya no existen
    for archivo in set(viejo.values()) - set(indice.values()):
        try:
            os.remove(os.path.join(VOCES, archivo))
        except OSError:
            pass
    with open(ruta_indice, 'w', encoding='utf-8') as f:
        json.dump(indice, f, ensure_ascii=False, indent=0)
    print(f'Listo: {len(indice)} frases con voz ({nuevas} nuevas). Fallaron: {len(fallas)}')


if __name__ == '__main__':
    main()
