// Pantalla de acceso: login normal o, si todavía no existe ningún usuario, creación del primer administrador.
(() => {
  const form = document.getElementById('login-form');
  const $ = id => document.getElementById(id);
  const error = $('login-error');
  const submit = $('login-submit');
  let setupMode = false;

  $('toggle-pass').addEventListener('click', event => {
    const show = $('login-pass').type === 'password';
    $('login-pass').type = show ? 'text' : 'password';
    $('login-confirm').type = show ? 'text' : 'password';
    event.currentTarget.textContent = show ? 'Ocultar' : 'Mostrar';
  });

  function showError(message) {
    error.textContent = message;
    error.hidden = !message;
  }

  // Solo se vuelve a rutas de esta misma aplicación.
  function nextUrl() {
    const next = new URLSearchParams(location.search).get('next');
    try {
      const url = new URL(next, location.origin);
      if (next && url.origin === location.origin && !url.pathname.endsWith('/login.html')) {
        return `${url.pathname}${url.search}`;
      }
    } catch { /* se usa el inicio */ }
    return '../index.html';
  }

  function enableSetup() {
    setupMode = true;
    $('login-title').textContent = 'Crea el administrador';
    $('login-sub').textContent = 'Aún no hay usuarios. Esta cuenta tendrá acceso total y podrás crear más usuarios y roles después.';
    $('name-field').hidden = false;
    $('confirm-field').hidden = false;
    $('login-pass').autocomplete = 'new-password';
    submit.textContent = 'Crear administrador y entrar';
  }

  window.inventarioApi.get('session').then(result => {
    if (result.authenticated) {
      window.inventarioApi.saveSession(result.account);
      location.replace(nextUrl());
      return;
    }
    if (result.setupRequired) enableSetup();
  }).catch(err => showError(err.message));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    showError('');
    const username = $('login-user').value.trim();
    const password = $('login-pass').value;
    if (!username || !password) { showError('Escribe tu usuario y contraseña.'); return; }
    if (setupMode) {
      if (!$('login-name').value.trim()) { showError('Escribe tu nombre completo.'); return; }
      if (password !== $('login-confirm').value) { showError('Las contraseñas no coinciden.'); return; }
    }
    submit.disabled = true;
    try {
      const result = setupMode
        ? await window.inventarioApi.post('auth.setup', { username, password, name: $('login-name').value.trim() })
        : await window.inventarioApi.post('auth.login', { username, password });
      window.inventarioApi.saveSession(result.account);
      location.replace(nextUrl());
    } catch (err) {
      showError(err.message);
      $('login-pass').value = '';
      $('login-pass').focus();
      submit.disabled = false;
    }
  });
})();