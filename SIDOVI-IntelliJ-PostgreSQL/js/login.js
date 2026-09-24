// login.js — Autenticación de usuarios
fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
document.getElementById('menuToggle')?.addEventListener('click', () => document.querySelector('.nav-list')?.classList.toggle('open'));

document.getElementById('togglePass')?.addEventListener('click', () => {
  const passInput = document.getElementById('login-pass');
  passInput.type = passInput.type === 'password' ? 'text' : 'password';
});

const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('btnLogin');
const alertBox = document.getElementById('login-alert');

loginButton.addEventListener('click', async () => {
  const correo = document.getElementById('login-user').value.trim();
  const contrasena = document.getElementById('login-pass').value;
  const rolSolicitado = document.getElementById('login-rol').value;
  if (!correo || !contrasena || !rolSolicitado) {
    alertBox.textContent = 'Completa todos los campos.';
    alertBox.hidden = false;
    return;
  }
  try {
    loginButton.disabled = true;
    alertBox.hidden = true;
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, contrasena, rolSolicitado })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No fue posible iniciar sesión.');
    sessionStorage.setItem('sidoviRol', data.usuario.rol);
    sessionStorage.setItem('sidoviUsuario', JSON.stringify(data.usuario));
    loginForm.hidden = true;
    document.getElementById('welcomeMsg').textContent = `Bienvenido ${data.usuario.rol === 'Gerente' ? 'gerente' : 'a Recursos Humanos'}, ${data.usuario.nombre_completo}. Redirigiendo...`;
    if (data.usuario.foto_perfil?.startsWith('data:image')) document.getElementById('welcomeProfile').innerHTML = `<img class="profile-photo" src="${data.usuario.foto_perfil}" alt="Foto de ${data.usuario.nombre_completo}">`;
    document.getElementById('loginSuccess').hidden = false;
    setTimeout(() => { window.location.href = data.usuario.rol === 'RRHH' ? 'RRHH.html' : 'gerente.html'; }, 700);
  } catch (error) {
    alertBox.textContent = error.message;
    alertBox.hidden = false;
    loginForm.hidden = true;
    document.getElementById('loginDenied').hidden = false;
  } finally {
    loginButton.disabled = false;
  }
});

document.getElementById('btnRetry')?.addEventListener('click', () => {
  document.getElementById('loginDenied').hidden = true;
  loginForm.hidden = false;
  alertBox.hidden = true;
  document.getElementById('login-pass').value = '';
});
