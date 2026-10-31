// En la pagina publicada (Render) se pide la contraseña una vez; queda guardada en este navegador un año.
// En el PC no se pide. El servidor no atiende a nadie sin ella, esto solo muestra el cuadro.
(function () {
  if (location.protocol === 'file:') return;
  fetch('/acceso', { cache: 'no-store' }).then((r) => {
    if (r.status !== 401) return;
    const capa = document.createElement('div');
    capa.className = 'acceso';
    capa.innerHTML = '<form class="acceso-caja"><img src="imagenes/filo_cuerpo.png" alt="">'
      + '<h2>Filo es solo de su Maestro</h2><p>Escribe la contraseña para entrar.</p>'
      + '<input type="password" autocomplete="current-password" required aria-label="Contraseña" placeholder="Contraseña">'
      + '<button type="submit">Entrar</button><p class="acceso-error" role="alert"></p></form>';
    document.documentElement.append(capa);  // fuera del body: su diseño no lo mueve
    const campo = capa.querySelector('input');
    const error = capa.querySelector('.acceso-error');
    campo.focus();
    capa.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      error.textContent = '';
      fetch('/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clave: campo.value }) })
        .then((x) => (x.ok ? location.reload() : x.json().then((d) => { error.textContent = d.error || 'No se pudo entrar.'; campo.select(); })))
        .catch(() => { error.textContent = 'Sin conexión. Prueba otra vez.'; });
    });
  }).catch(() => {});
})();
