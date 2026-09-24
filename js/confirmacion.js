// confirmacion.js — Confirmación de postulación
document.getElementById('menuToggle').addEventListener('click', () => {
  document.querySelector('.nav-list').classList.toggle('open');
});

// Genera radicado aleatorio para demo
document.getElementById('radicado').textContent =
  'SID-2025-' + String(Math.floor(Math.random() * 90000) + 10000);
