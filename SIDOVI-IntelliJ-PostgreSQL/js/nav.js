// nav.js — Menú hamburguesa compartido por todas las páginas
document.getElementById('menuToggle').addEventListener('click', () => {
  document.querySelector('.nav-list').classList.toggle('open');
});
