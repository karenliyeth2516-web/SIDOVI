(() => {
  const nav = document.querySelector('.site-header .nav-list');
  if (!nav) return;

  nav.innerHTML = '<li><a href="index.html" class="nav-link">Inicio Público</a></li><li><a href="login.html" class="nav-link nav-cta">Cerrar Sesión</a></li>';
})();
