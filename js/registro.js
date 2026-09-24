// registro.js — Registro de nuevo usuario
document.getElementById('menuToggle').addEventListener('click', () => {
  document.querySelector('.nav-list').classList.toggle('open');
});

document.getElementById('btnRegistrar').addEventListener('click', () => {
  const fields = [
    'r-nombre', 'r-apellidos', 'r-cedula', 'r-fecha',
    'r-tel', 'r-ciudad', 'r-email', 'r-user', 'r-pass', 'r-pass2'
  ];

  const empty = fields.some(id => !document.getElementById(id).value.trim());
  const alert = document.getElementById('reg-alert');

  if (empty) {
    alert.textContent = '⚠️ Completa todos los campos obligatorios.';
    alert.className   = 'form-alert error';
    alert.hidden      = false;
    return;
  }

  if (document.getElementById('r-pass').value !== document.getElementById('r-pass2').value) {
    alert.textContent = '⚠️ Las contraseñas no coinciden.';
    alert.className   = 'form-alert error';
    alert.hidden      = false;
    return;
  }

  if (!document.getElementById('r-terminos').checked) {
    alert.textContent = '⚠️ Debes aceptar los términos y condiciones.';
    alert.className   = 'form-alert error';
    alert.hidden      = false;
    return;
  }

  alert.hidden = true;
  document.getElementById('regForm').hidden    = true;
  document.getElementById('regSuccess').hidden = false;
});
