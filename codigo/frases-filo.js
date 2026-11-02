// Frases propias de Filo (no las piensa la IA). Cada una tiene su voz ya grabada en la carpeta «voces»
// (se graban con grabar_voces.py): asi suenan al instante, aunque Fish tarde o no haya internet.
// Formato: [texto, emocion]. Si cambias o agregas una frase, vuelve a correr grabar_voces.py.
window.FrasesFilo = {
  // habla sola cuando el Maestro no le dice nada (no repite hasta decirlas todas)
  sola: [
    ['Maestro… ¿sigues ahí?', 'pensando'],
    ['¡Filo tiene hambre! ¿Hay carne por ahí?', 'emocionada'],
    ['Filo se aburre… ¿Jugamos a algo? ¡Adivinanzas o piedra, papel o tijera!', 'emocionada'],
    ['¿Quieres que te dibuje algo bonito, Maestro?', 'feliz'],
    ['¡La la la! Filo canta mientras te espera.', 'contenta'],
    ['Mmm… ¿y si vemos un video juntos?', 'pensando'],
    ['Maestro, no te olvides de tomar agua, ¿sí?', 'pena'],
    ['¡Filo jalaría el carruaje hasta el fin del mundo por ti!', 'orgullosa'],
    ['¿Me estás ignorando? Hmph… Filo se pone celosa.', 'celosa'],
    ['¿Hola? Filo te extraña un poquito…', 'timida'],
  ],
  // boton «Saludar»: se presenta al instante (voz ya grabada)
  saludo: [
    ['¡Hola, Maestro! Soy Filo, una filolial reina. Me encanta correr, jalar el carruaje y comer mucha carne. ¿Qué hacemos hoy?', 'feliz'],
    ['¡Maestro, hola! Soy Filo. Puedo conversar contigo, dibujarte cosas, ponerte videos y buscar en internet. ¿Qué quieres hacer?', 'emocionada'],
    ['¡Hola, hola! Filo está aquí. Si me tocas la cabeza me pongo roja, ¡pero las alas no se tocan! ¿Jugamos o conversamos?', 'risa'],
  ],
  dormir: [['Fuaaah… Filo tiene sueño… Me voy a dormir un ratito…', 'dormida']],
  despertar: [['¡Ah! ¡Me quedé dormida! ¿Qué pasó, Maestro?', 'sorpresa']],
  // mientras piensa o trabaja (asi no se queda callada esperando a la IA)
  esperando: {
    pensando: [['Mmm… déjame pensar.', 'pensando'], ['A ver, a ver…', 'pensando'], ['Mmm… Filo está pensando.', 'pensando'], ['Buena pregunta, Maestro…', 'pensando'], ['¡Uy! Espera un momentito.', 'pensando']],
    mirando: [['A ver, déjame mirar…', 'pensando'], ['¡Uy! A ver qué es esto…', 'sorpresa']],
    dibujando: [['¡Voy a dibujarlo! Espérame un poquito.', 'emocionada'], ['¡Filo saca sus lápices!', 'feliz'], ['Dibujando, dibujando…', 'contenta']],
    video: [['¡Lo busco en YouTube!', 'feliz'], ['Ya te lo pongo, Maestro.', 'contenta'], ['A ver qué video encuentro…', 'pensando']],
    // si tarda, sigue hablando mientras espera
    sigue: [['Ya casi, Maestro…', 'pensando'], ['Un poquito más…', 'pensando'], ['Mmm… esto es difícil, pero Filo puede.', 'orgullosa'], ['Filo está en eso, ¡no te vayas!', 'emocionada'], ['Hmm, hmm, hmm…', 'pensando'], ['¡Ya mero, ya mero!', 'feliz']],
    sigueDibujo: [['Le estoy poniendo colores…', 'contenta'], ['¡Va a quedar bonito!', 'emocionada'], ['Unos trazos más…', 'pensando'], ['Filo dibuja con mucho cariño.', 'amor']],
    buscando: [['Déjame buscarlo en internet.', 'pensando'], ['Voy a leer unas páginas, espérame.', 'pensando'], ['Mmm, lo averiguo ahora mismo.', 'orgullosa']],
  },
  // modos: al encenderlos con el boton o la voz, y cuando se encienden solos (pide un video o una busqueda)
  modos: {
    youtube: [['¡Modo YouTuber activado, Maestro! Dime qué canción o video quieres.', 'emocionada'], ['¡Me puse mi ropa de YouTuber! ¿Qué ponemos?', 'feliz'], ['¡Modo YouTube! Pídeme la música que quieras.', 'emocionada']],
    busqueda: [['¡Modo investigadora activado! Pregúntame lo que quieras y lo busco.', 'orgullosa'], ['¡Ya tengo mi ropa de investigadora! ¿Qué averiguamos?', 'emocionada'], ['¡Modo búsqueda! Todo lo que preguntes lo busco en internet.', 'feliz']],
    normal: [['¡Listo! Volví a mi ropa de hoy. Conversamos normal, Maestro.', 'feliz'], ['¡Modo normal! Ahora solo conversamos.', 'contenta']],
    autoYoutube: [['¡Me pongo en modo YouTuber!', 'emocionada'], ['¡Espera, me pongo mi ropa de YouTuber!', 'feliz'], ['¡Modo YouTuber, ya!', 'emocionada']],
    autoBusqueda: [['¡Modo investigadora!', 'orgullosa'], ['¡Me pongo mi ropa de investigadora!', 'emocionada'], ['¡A investigar!', 'feliz']],
  },
  // caricias: tocar la cabeza, las alas o el cuerpo
  caricias: {
    cabeza: [['¡Jeje, cosquillas!', 'timida'], ['Mmm… Filo se porta bien, ¿verdad?', 'contenta'], ['¡Más, más! Me gusta que me acaricies, Maestro.', 'amor']],
    alas: [['¡Ay! Mis alas…', 'sorpresa'], ['Cuidado con mis plumas, Maestro.', 'timida']],
    alasMucho: [['¡Ya, no toques mis alas! ¡Filo se enoja!', 'enojada'], ['¡Mis alas no se tocan! ¡Hmph!', 'enojada'], ['¡Te dije que no! Filo está enojada contigo.', 'enojada']],
    cuerpo: [['¡Jijiji, cosquillas!', 'risa'], ['¡Oye! Eso hace cosquillas, Maestro.', 'risa']],
  },
  // avisos de la pagina
  avisos: {
    sinMasVideos: [['Ya no me quedan más videos de eso, Maestro. ¿Busco otra cosa?', 'pensando'], ['¡Uy, se me acabaron los videos! ¿Qué más quieres ver?', 'sorpresa'], ['Esos eran todos, Maestro. ¿Te pongo otra cosa?', 'timida']],
    borrado: [['Listo, Maestro, eliminé el dibujo.', 'normal'], ['¡Adiós, dibujo! Ya lo borré.', 'guino'], ['Ya no está. Si quieres, te dibujo otro mejor.', 'orgullosa']],
    otraCosa: [['¡Claro, Maestro! ¿Qué quieres que busque?', 'feliz'], ['¡Sí! ¿Qué buscamos ahora?', 'emocionada'], ['Mmm, ¿qué te pongo ahora, Maestro?', 'pensando']],
    guardado: [['¡Listo, ya lo guardé en tus descargas!', 'feliz'], ['¡Guardado! Ahora lo tienes en tu computadora, Maestro.', 'orgullosa'], ['¡Ya está en tus descargas! Cuídalo mucho.', 'amor']],
    sinVideos: [['No encontré videos de eso, Maestro. ¿Lo busco con otras palabras?', 'triste'], ['Mmm, YouTube no me mostró nada. ¿Me lo dices de otra forma?', 'pensando'], ['¡No hay nada! Qué raro… ¿probamos con otras palabras?', 'sorpresa']],
    videoBloqueado: [['Esos videos no se dejan ver aquí, Maestro. ¿Busco otro?', 'triste'], ['¡Qué mal, esos videos no me dejan ponerlos aquí! ¿Busco otros?', 'enojada']],
    otraVersion: [['¡Ya está, mira! Aquí tienes otra versión.', 'feliz'], ['¡Otra más! ¿Te gusta más esta?', 'emocionada'], ['Esta me salió todavía mejor, ¿verdad, Maestro?', 'orgullosa']],
    noDibujo: [['Uy, no pude dibujar ahora. ¿Lo intentas otra vez?', 'triste'], ['¡Mis lápices no funcionan! Pídemelo otra vez en un ratito.', 'sorpresa']],
    sinEsaRopa: [['Mmm, esa ropa no la tengo, Maestro. ¿Me pongo otra?', 'pensando'], ['¡Uy! No tengo esa ropa todavía. Dime «cámbiate» y me pongo otra.', 'timida']],
    alAlbum: [['Maestro, voy a guardar el dibujo en el álbum. Ahí lo vas a encontrar.', 'feliz'], ['Guardo el dibujo en el álbum, ¿sí? Ahí lo encuentras cuando quieras.', 'guino'], ['¡Al álbum va! Así no se pierde, Maestro.', 'orgullosa']],
  },
};
