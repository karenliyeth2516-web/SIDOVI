(() => {
  const referrerPage = document.referrer
    ? new URL(document.referrer).pathname.split('/').pop()
    : '';
  const managerPages = ['gerente.html', 'evaluar.html', 'evaluacion.html', 'trabajadores.html', 'contrato.html'];
  const isManager = sessionStorage.getItem('sidoviRol') === 'Gerente'
    || sessionStorage.getItem('sidoviPanel') === 'Gerente'
    || managerPages.includes(referrerPage);
  if (!isManager) return;

  sessionStorage.setItem('sidoviPanel', 'Gerente');

  const nav = document.querySelector('.site-header .nav-list');
  if (nav) nav.innerHTML = '<li><a href="index.html" class="nav-link">Inicio Público</a></li><li><a href="login.html" class="nav-link nav-cta">Cerrar Sesión</a></li>';

  const sidebar = document.querySelector('aside.sidebar');
  if (!sidebar) return;

  sidebar.setAttribute('aria-label', 'Menú de gerencia');
  sidebar.innerHTML = '<span class="sidebar-title">Gerencia</span><a href="gerente.html" class="sidebar-link">Dashboard</a><a href="evaluar.html" class="sidebar-link">Evaluar Candidatos</a><a href="trabajadores.html" class="sidebar-link">Trabajadores</a><a href="mi-perfil.html" class="sidebar-link profile-sidebar-link">Mi perfil</a><a href="contrato.html" class="sidebar-link">Contratos</a><span class="sidebar-title">Información</span><a href="reporte.html" class="sidebar-link active" aria-current="page">Reportes</a>';
})();
