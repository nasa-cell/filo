// Fondo animado detras de Filo: noche estrellada con luna y luciernagas.
(function () {
  const caja = document.getElementById('fondo');
  document.body.dataset.fondo = 'c';
  // celulares (4 GB o pantalla táctil): menos estrellas y luciérnagas, cada una gasta al titilar
  const liviano = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
    || matchMedia('(pointer: coarse)').matches;
  const azar = (min, max) => min + Math.random() * (max - min);
  function poner(clase, estilos) {
    const e = document.createElement('i');
    e.className = clase;
    for (const k in estilos) e.style.setProperty(k, estilos[k]);
    caja.appendChild(e);
  }
  for (let i = 0; i < (liviano ? 30 : 70); i++) poner('estrella', { '--x': azar(0, 100) + '%', '--y': azar(0, 70) + '%', '--t': azar(2, 5) + 's', '--d': -azar(0, 5) + 's', '--s': azar(1, 3) + 'px' });
  poner('luna', {});
  for (let i = 0; i < (liviano ? 7 : 14); i++) poner('luciernaga', { '--x': azar(3, 97) + '%', '--y': azar(40, 95) + '%', '--t': azar(6, 12) + 's', '--d': -azar(0, 12) + 's', '--mx': azar(-60, 60) + 'px', '--my': azar(-50, 30) + 'px' });
})();
