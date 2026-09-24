const menuToggle = document.getElementById('menuToggle');
const navList = document.querySelector('.nav-list');
const candidatosBody = document.getElementById('candidatosEvaluarBody');
const candidatoSelect = document.getElementById('ev-candidato');
const btnGenerarContrato = document.getElementById('btnGenerarContrato');
const btnRechazarCandidato = document.getElementById('btnRechazarCandidato');
const candidatoIdSeleccionado = new URLSearchParams(window.location.search).get('id');

let candidatos = [];
let candidatoActual = null;

menuToggle?.addEventListener('click', () => {
  navList?.classList.toggle('open');
});

function escapeHtml(value = '') {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function estadoVisible(estado = '') {
  const nombres = {
    EN_REVISION: 'En revisión',
    APROBADO_RRHH: 'Aprobado por RRHH',
    RECHAZADO_RRHH: 'Rechazado por RRHH',
    HOJA_VIDA_APROBADA: 'Hoja de vida aprobada',
    ENTREVISTA_PENDIENTE: 'Entrevista pendiente',
    ENTREVISTA_AGENDADA: 'Entrevista agendada',
    EXAMENES_PENDIENTES: 'Exámenes pendientes',
    PENDIENTE_CONTRATO: 'Pendiente de contrato',
    RECHAZADO: 'Rechazado',
    CONTRATADO: 'Contratado'
  };
  return nombres[estado] || estado;
}

function seleccionarCandidato(id) {
  const candidato = candidatos.find((item) => String(item.id_postulacion) === String(id));
  if (!candidato) return;

  candidatoActual = candidato;
  candidatoSelect.value = String(candidato.id_postulacion);
  btnGenerarContrato.href = `contrato.html?idPostulacion=${candidato.id_postulacion}`;
  document.getElementById('ev-candidato')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function pintarCandidatos() {
  if (!candidatos.length) {
    candidatosBody.innerHTML = '<tr><td colspan="6">No hay candidatos pendientes de evaluación.</td></tr>';
    candidatoSelect.innerHTML = '<option value="">No hay candidatos disponibles</option>';
    return;
  }

  candidatosBody.innerHTML = candidatos.map((candidato) => `
    <tr>
      <td><strong>${escapeHtml(candidato.nombre_completo || 'Sin nombre')}</strong></td>
      <td>${escapeHtml(candidato.cargo || 'Sin cargo')}</td>
      <td>—</td>
      <td>—</td>
      <td><span class="badge badge-entrevista">${escapeHtml(estadoVisible(candidato.estado))}</span></td>
      <td style="display:flex;gap:0.4rem;flex-wrap:wrap;">
        <button type="button" class="btn-xs btn-xs-blue btn-evaluar" data-id="${candidato.id_postulacion}">Evaluar</button>
        <button type="button" class="btn-xs btn-xs-green btn-aprobar" data-id="${candidato.id_postulacion}">Aprobar</button>
        <button type="button" class="btn-xs btn-xs-red btn-rechazar" data-id="${candidato.id_postulacion}">Rechazar</button>
      </td>
    </tr>
  `).join('');

  candidatoSelect.innerHTML = candidatos.map((candidato) => `
    <option value="${candidato.id_postulacion}">
      ${escapeHtml(candidato.nombre_completo || 'Sin nombre')} – ${escapeHtml(candidato.cargo || 'Sin cargo')}
    </option>
  `).join('');

  const idInicial = candidatoIdSeleccionado || candidatos[0].id_postulacion;
  seleccionarCandidato(idInicial);
}

async function cargarCandidatos() {
  try {
    const respuesta = await fetch('/api/postulaciones');
    const data = await respuesta.json();
    if (!respuesta.ok) throw new Error(data.error || 'No fue posible cargar los candidatos.');

    candidatos = data.filter((candidato) => [
      'EN_REVISION',
      'ENTREVISTA_AGENDADA',
      'APROBADO_RRHH',
      'HOJA_VIDA_APROBADA',
      'EXAMENES_PENDIENTES',
      'PENDIENTE_CONTRATO'
    ].includes(candidato.estado));

    pintarCandidatos();
  } catch (error) {
    candidatosBody.innerHTML = `<tr><td colspan="6">${escapeHtml(error.message)}</td></tr>`;
  }
}

async function cambiarEstado(id, estado) {
  const respuesta = await fetch(`/api/postulaciones/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado })
  });
  const data = await respuesta.json();
  if (!respuesta.ok) throw new Error(data.error || 'No fue posible actualizar el estado.');
  return data;
}

candidatosBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-id]');
  if (!button) return;

  const id = button.dataset.id;
  seleccionarCandidato(id);

  try {
    if (button.classList.contains('btn-evaluar')) return;

    const estado = button.classList.contains('btn-aprobar') ? 'EXAMENES_PENDIENTES' : 'RECHAZADO';
    await cambiarEstado(id, estado);
    await cargarCandidatos();
  } catch (error) {
    window.alert(error.message);
  }
});

candidatoSelect.addEventListener('change', () => {
  seleccionarCandidato(candidatoSelect.value);
});

btnRechazarCandidato?.addEventListener('click', async () => {
  if (!candidatoActual) return window.alert('Selecciona primero un candidato.');

  try {
    await cambiarEstado(candidatoActual.id_postulacion, 'RECHAZADO');
    await cargarCandidatos();
  } catch (error) {
    window.alert(error.message);
  }
});

cargarCandidatos();
