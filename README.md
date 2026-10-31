# Filo

Filo, la filolial de *El héroe del escudo*, en 2D: conversa contigo con su voz, cambia de cara según lo que siente, dibuja, pone videos de YouTube, busca en internet y te recuerda de un día para otro.

## Qué hace

- **Conversa con voz.** Le escribes o le hablas por el micrófono y responde con la voz de Filo (Fish Audio). El micrófono queda encendido hasta que lo apagues y puedes hacer pausas para pensar.
- **Tiene emociones.** Feliz, risa, emocionada, amor, tímida, triste, pena, miedo, asco, enojada, celosa, orgullosa, dormida y más, en dos estilos: ilustración y dibujo. Ninguna emoción le dura más de 10 segundos.
- **Reacciona al tocarla.** En la cabeza se pone roja y le salen corazones; si le tocas las alas tres veces, se enoja; en el cuerpo le dan cosquillas.
- **Dibuja, pone videos y busca.** «Dibújame un gato», «pon la canción RISE», «busca el clima de Lima». Los dibujos van a un álbum con hasta 500 imágenes.
- **Te recuerda.** Guarda tu nombre, tus gustos y lo que le cuentas, y al volver te pregunta por eso.
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
   | `FILO_DATABASE_URL` | memoria en una base Postgres (por ejemplo [Neon](https://neon.tech/)); sin ella se guarda en la carpeta `datos_memoria` | no |
   | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | guardar los dibujos en la nube | no |

3. Haz doble clic en **`iniciar.cmd`**. Se abre en Chrome en `http://localhost:5077`.
4. (Opcional) Para que sus frases propias suenen al instante, con el servidor encendido ejecuta:
   ```
   python grabar_voces.py
   ```

## Archivos

| Archivo | Qué es |
|---|---|
| `servidor.py` | servidor local: conversa con las IA, pide la voz y guarda la memoria |
| `acciones.py` | dibujar, buscar videos y buscar en internet |
| `memoria.py` | lo que Filo recuerda de cada persona y su ánimo |
| `grabar_voces.py` | graba con la voz de Filo las frases de `codigo/frases-filo.js` |
| `codigo/ilustracion.js`, `codigo/filo.js` | las dos Filo animadas (ilustración y dibujo) |
| `codigo/conversacion.js` | conversación, micrófono, caricias, emociones |
| `codigo/acciones.js` | panel del dibujo, videos, resultados y álbum |
| `codigo/frases-filo.js` | frases propias de Filo (hablar sola, caricias, avisos) |

## Créditos

Filo y *El héroe del escudo* (Tate no Yuusha no Nariagari) pertenecen a sus autores. Proyecto de fans, sin fines de lucro.
