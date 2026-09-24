const form = document.getElementById('cargoForm');
const body = document.getElementById('cargosBody');
const alertBox = document.getElementById('cargoAlert');
const cargoId = document.getElementById('cargoId');
const nombre = document.getElementById('nombreCargo');
const sede = document.getElementById('sedeCargo');
const turnos = document.getElementById('turnosCargo');
const descripcion = document.getElementById('descripcionCargo');
const guardar = document.getElementById('guardarCargo');
const cancelar = document.getElementById('cancelarEdicion');
let cargos = [];

const esc = (value = '') => {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
};

function showAlert(message, type = 'error') {
  alertBox.textContent = message;
  alertBox.className = `form-alert ${type}`;
  alertBox.hidden = false;
}

function resetForm() {
  form.reset();
  cargoId.value = '';
  guardar.textContent = 'Crear cargo';
  cancelar.hidden = true;
}

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error || 'No fue posible completar la operación.');
  return data;
}

async function cargarSedes() {
  const sedes = await api('/api/sedes');
  sede.innerHTML = '<option value="">Selecciona una sede</option>';
  sedes.forEach((item) => sede.add(new Option(item.nombre_sede, item.id_sede)));
}

function pintarCargos() {
  body.innerHTML = cargos.length ? cargos.map((item) => `
    <tr>
      <td>${esc(item.nombre_cargo)}</td>
      <td>${esc(item.nombre_sede)}</td>
      <td>${esc(item.turnos || 'No definido')}</td>
      <td>${esc(item.descripcion_cargo || 'Sin descripción')}</td>
      <td>
        <button class="btn-xs btn-xs-blue" data-action="edit" data-id="${item.id_cargo}">Editar</button>
        <button class="btn-xs btn-xs-red" data-action="delete" data-id="${item.id_cargo}">Eliminar</button>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="5">No hay cargos registrados.</td></tr>';
}

async function cargarCargos() {
  try {
    cargos = await api('/api/cargos');
    pintarCargos();
  } catch (error) {
    body.innerHTML = `<tr><td colspan="5">${esc(error.message)}</td></tr>`;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = cargoId.value;
  const payload = {
    nombreCargo: nombre.value.trim(),
    idSede: Number(sede.value),
    turnos: turnos.value.trim(),
    descripcionCargo: descripcion.value.trim()
  };
  if (!payload.nombreCargo || !payload.idSede) {
    showAlert('El nombre del cargo y la sede son obligatorios.');
    return;
  }
  try {
    guardar.disabled = true;
    await api(id ? `/api/cargos/${id}` : '/api/cargos', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    showAlert(id ? 'Cargo actualizado correctamente.' : 'Cargo creado correctamente.', 'success');
    resetForm();
    await cargarCargos();
  } catch (error) {
    showAlert(error.message);
  } finally {
    guardar.disabled = false;
  }
});

body.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const item = cargos.find((cargo) => String(cargo.id_cargo) === button.dataset.id);
  if (!item) return;
  if (button.dataset.action === 'edit') {
    cargoId.value = item.id_cargo;
    nombre.value = item.nombre_cargo || '';
    sede.value = item.id_sede || '';
    turnos.value = item.turnos || '';
    descripcion.value = item.descripcion_cargo || '';
    guardar.textContent = 'Guardar cambios';
    cancelar.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (button.dataset.action === 'delete' && confirm(`¿Eliminar el cargo “${item.nombre_cargo}” de ${item.nombre_sede}?`)) {
    try {
      await api(`/api/cargos/${item.id_cargo}`, { method: 'DELETE' });
      showAlert('Cargo eliminado correctamente.', 'success');
      await cargarCargos();
    } catch (error) { showAlert(error.message); }
  }
});

cancelar.addEventListener('click', resetForm);

Promise.all([cargarSedes(), cargarCargos()]).catch((error) => showAlert(error.message));
