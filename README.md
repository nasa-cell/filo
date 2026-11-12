# Filo

Filo, la filolial de *El héroe del escudo*, en ilustración 2D y en 3D: conversa contigo con su voz, cambia de cara según lo que siente, dibuja, pone videos de YouTube, busca en internet y te recuerda de un día para otro.

## Qué hace

- **Conversa con voz.** Le escribes o le hablas por el micrófono y responde con la voz de Filo (Fish Audio). El micrófono queda encendido hasta que lo apagues y puedes hacer pausas para pensar.
- **Tiene emociones.** Feliz, risa, emocionada, amor, tímida, triste, pena, miedo, asco, enojada, celosa, orgullosa, dormida y más, en dos estilos: ilustración y 3D. Ninguna emoción le dura más de 10 segundos.
- **Filo en 3D.** Elige «3D» o «Las dos» arriba. Es un modelo VRM que pone las caras que elige la IA (37 reacciones, cada una con su fondo) y mueve manos y cuerpo al hablar.
  - **✨ 3D automática:** si nadie le habla, se mueve y reacciona sola.
  - **Botones:** acercar, alejar, volver al tamaño normal y 🔄 girar el cuerpo entero. También se puede girar arrastrándola.
  - **Alas realistas:** tienen cuerpo y plumas, aletean según lo que siente y se pliegan cuando duerme.
  - **Ropa:** se pone la ropa del día, la de los modos YouTube y búsqueda, la de ocasión y la que crea cuando le pides «ponte…».
  - **Celulares de 4 GB:** dibuja con menos nitidez para no trabarse.
- **Reacciona al tocarla.** En la cabeza se pone roja y le salen corazones; si le tocas las alas tres veces, se enoja; en el cuerpo le dan cosquillas.
- **Dibuja, pone videos y busca.** «Dibújame un gato», «pon la canción RISE», «busca el clima de Lima». Los dibujos van a un álbum con hasta 500 imágenes.
- **Te recuerda.** Guarda tu nombre, tus gustos y lo que le cuentas, y al volver te pregunta por eso. Es una sola memoria y un solo álbum para el PC, el celular y la página publicada.
- **Habla sola y se duerme** si la dejas sin hablar un rato.
- **Juega:** piedra, papel o tijera, adivinanzas, trivia y «adivina qué dibujé».
- **Funciona en celular, tablet y PC.**

## Cómo abrirla

1. Instala [Python 3](https://www.python.org/) y la librería de la base de datos:
   ```
   pip install psycopg2-binary
   ```
2. Pon tus claves como variables de entorno de Windows (nunca dentro de los archivos):

   | Variable | Para qué | Obligatoria |
   |---|---|---|
   | `GROQ_API_KEY` | IA principal (Qwen y gpt-oss, gratis en [Groq](https://console.groq.com/)) | sí |
   | `GEMINI_API_KEY` | IA de respaldo y para mirar fotos ([Google AI Studio](https://aistudio.google.com/)) | sí |
   | `FISH_API_KEY` | voz de Filo ([Fish Audio](https://fish.audio/), modelo gratis) | sí |
   | `FILO_DATABASE_URL` | memoria en una base Postgres (por ejemplo [Neon](https://neon.tech/)); sin ella se guarda en la carpeta `servidor/cerebro/datos_memoria` | no |
   | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | guardar los dibujos en la nube | no |

3. Haz doble clic en **`servidor/iniciar.cmd`**. Se abre en Chrome en `http://localhost:5077`.
4. Las frases propias de Filo ya vienen grabadas en `pagina/voces`. Si cambias o agregas frases en `pagina/codigo/frases-filo.js`, con el servidor encendido ejecuta:
   ```
   python servidor/herramientas/grabar_voces.py
   ```

## Publicarla en Render

Servicio web de Python: comando de instalación `pip install -r servidor/requirements.txt` y de inicio `python servidor/servidor.py`. Las claves van en las variables de entorno del servicio. Con `FILO_CLAVE` la página pide esa contraseña para entrar (así nadie más gasta las cuotas ni ve la memoria).

## Carpetas

```
servidor/            lo que corre en el servidor (Python)
  servidor.py        conversa con las IA, pide la voz y guarda la memoria
  iniciar.cmd        abre a Filo en el PC
  requirements.txt   librerías de Python
  cerebro/           acciones, memoria, emociones, ropa (taller, vestuario) y atuendos.json
  herramientas/      grabar_voces.py: graba las frases de Filo con su voz
pagina/              lo que ve el navegador
  index.html
  codigo/            conversación, ilustración, acciones, frases y Filo 3D (tres.js)
  tres/              modelo VRM, alas, manos y librerías 3D
  estilos/           colores y fondos
  imagenes/  voces/  dibujos/
```

## Créditos

Filo y *El héroe del escudo* (Tate no Yuusha no Nariagari) pertenecen a sus autores. Proyecto de fans, sin fines de lucro.
