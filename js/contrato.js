const form = document.getElementById('contratoForm');
const body = document.getElementById('contratosBody');
const alertBox = document.getElementById('contratoAlert');
const contratoId = document.getElementById('contratoId');
const postulacion = document.getElementById('postulacionContrato');
const tipo = document.getElementById('tipoContrato');
const inicio = document.getElementById('fechaInicio');
const fin = document.getElementById('fechaFin');
const salario = document.getElementById('salario');
const estado = document.getElementById('estadoContrato');
const observaciones = document.getElementById('observaciones');
const guardar = document.getElementById('guardarContrato');
const cancelar = document.getElementById('cancelarContrato');
const programarFirma = document.getElementById('programarFirma');

const idPostulacionUrl = new URLSearchParams(window.location.search).get('idPostulacion');
const datosCandidatoContrato = document.getElementById('datosCandidatoContrato');
const datoNombreCandidato = document.getElementById('datoNombreCandidato');
const datoDocumentoCandidato = document.getElementById('datoDocumentoCandidato');
const datoCorreoCandidato = document.getElementById('datoCorreoCandidato');
const datoTelefonoCandidato = document.getElementById('datoTelefonoCandidato');
const datoCargoCandidato = document.getElementById('datoCargoCandidato');
const datoSedeCandidato = document.getElementById('datoSedeCandidato');
const datoEstadoCandidato = document.getElementById('datoEstadoCandidato');

let contratos = [];
let postulaciones = [];
let contratoSeleccionado = null;

const detalle = document.getElementById('contratoDetalle');
const editarDetalle = document.getElementById('editarDetalle');
const cerrarDetalle = document.getElementById('cerrarDetalle');
const detalleCampos = {
  trabajador: document.getElementById('detalleTrabajador'),
  documento: document.getElementById('detalleDocumento'),
  correo: document.getElementById('detalleCorreo'),
  telefono: document.getElementById('detalleTelefono'),
  cargo: document.getElementById('detalleCargo'),
  tipo: document.getElementById('detalleTipo'),
  inicio: document.getElementById('detalleInicio'),
  fin: document.getElementById('detalleFin'),
  salario: document.getElementById('detalleSalario'),
  estado: document.getElementById('detalleEstado'),
  observaciones: document.getElementById('detalleObservaciones')
};

const esc = (value = '') => {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
};

function alert(message, type = 'error') {
  alertBox.textContent = message;
  alertBox.className = `form-alert ${type}`;
  alertBox.hidden = false;
}

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error || 'No fue posible completar la operación.');
  return data;
}

function resetForm() {
  form.reset();
  contratoId.value = '';
  inicio.value = new Date().toISOString().slice(0, 10);
  tipo.value = 'Término Fijo';
  salario.value = '1423500';
  estado.value = 'Borrador';
  guardar.textContent = 'Crear contrato';
  cancelar.hidden = true;
  postulacion.disabled = false;
}

async function cargarPostulaciones() {
  postulaciones = await api('/api/postulaciones');
  postulacion.innerHTML = '<option value="">Selecciona una postulación</option>';

  postulaciones.filter((item) => ['PENDIENTE_CONTRATO', 'EXAMENES_APROBADOS', 'FIRMA_CONTRATO_AGENDADA'].includes(item.estado)).forEach((item) => {
    const option = new Option(
        `${item.nombre_completo} — ${item.cargo} — ${item.nombre_sede || 'Sin sede'} — ${item.estado}`,
        item.id_postulacion
    );
    postulacion.add(option);
  });
}

async function cargarPostulacionSeleccionada() {
  if (!idPostulacionUrl) return;

  const candidato = await api(`/api/postulaciones/${idPostulacionUrl}`);
  postulacion.value = String(candidato.id_postulacion);
  postulacion.disabled = true;

  datoNombreCandidato.textContent = candidato.nombre_completo || '—';
  datoDocumentoCandidato.textContent = candidato.numero_documento || '—';
  datoCorreoCandidato.textContent = candidato.correo || '—';
  datoTelefonoCandidato.textContent = candidato.telefono || '—';
  datoCargoCandidato.textContent = candidato.cargo || '—';
  datoSedeCandidato.textContent = candidato.nombre_sede || '—';
  datoEstadoCandidato.textContent = candidato.estado || '—';
  datosCandidatoContrato.hidden = false;
}

function pintarContratos() {
  body.innerHTML = contratos.length
      ? contratos.map((item) => `
      <tr>
        <td>${esc(item.trabajador)}</td>
        <td>${esc(item.cargo)}</td>
        <td>${esc(item.fecha_inicio)}</td>
        <td>${esc(item.tipo_contrato)}</td>
        <td>$${Number(item.salario || 0).toLocaleString('es-CO')}</td>
        <td><span class="badge ${String(item.estado).toLowerCase() === 'activo' ? 'badge-activo' : 'badge-pendiente'}">${esc(item.estado)}</span></td>
        <td>
          <button type="button" class="btn-xs btn-xs-blue" data-view="${item.id_contrato}">Ver</button>
          <button type="button" class="btn-xs btn-xs-blue" data-edit="${item.id_contrato}">Editar</button>
        </td>
      </tr>
    `).join('')
      : '<tr><td colspan="7">No hay contratos registrados.</td></tr>';
}

async function cargarContratos() {
  contratos = await api('/api/contratos');
  pintarContratos();
}

function cargarContratoEnFormulario(item) {
  contratoId.value = item.id_contrato;
  postulacion.value = item.id_postulacion;
  postulacion.disabled = true;
  inicio.value = item.fecha_inicio?.slice(0, 10) || '';
  fin.value = item.fecha_fin?.slice(0, 10) || '';
  tipo.value = item.tipo_contrato || '';
  salario.value = item.salario || 0;
  estado.value = item.estado || 'Borrador';
  observaciones.value = item.observaciones || '';
  guardar.textContent = 'Guardar cambios';
  cancelar.hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function mostrarDetalle(item) {
  contratoSeleccionado = item;
  detalleCampos.trabajador.textContent = item.trabajador || '—';
  detalleCampos.documento.textContent = item.numero_documento || '—';
  detalleCampos.correo.textContent = item.correo || '—';
  detalleCampos.telefono.textContent = item.telefono || '—';
  detalleCampos.cargo.textContent = item.cargo || '—';
  detalleCampos.tipo.textContent = item.tipo_contrato || '—';
  detalleCampos.inicio.textContent = item.fecha_inicio?.slice(0, 10) || '—';
  detalleCampos.fin.textContent = item.fecha_fin?.slice(0, 10) || 'No definida';
  detalleCampos.salario.textContent = `$${Number(item.salario || 0).toLocaleString('es-CO')} COP`;
  detalleCampos.estado.textContent = item.estado || '—';
  detalleCampos.observaciones.textContent = item.observaciones || 'Sin observaciones';
  detalle.hidden = false;
  detalle.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = contratoId.value;
  const payload = {
    idPostulacion: Number(postulacion.value),
    fechaInicio: inicio.value,
    fechaFin: fin.value || null,
    tipoContrato: tipo.value.trim(),
    salario: Number(salario.value || 0),
    estado: estado.value,
    observaciones: observaciones.value.trim()
  };

  if (!id && !payload.idPostulacion) return alert('Selecciona una postulación.');

  try {
    guardar.disabled = true;
    await api(id ? `/api/contratos/${id}` : '/api/contratos', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    alert(id ? 'Contrato actualizado correctamente.' : 'Contrato creado correctamente.', 'success');
    resetForm();
    await cargarContratos();
  } catch (error) {
    alert(error.message);
  } finally {
    guardar.disabled = false;
  }
});

body.addEventListener('click', (event) => {
  const button = event.target.closest('[data-edit], [data-view]');
  if (!button) return;

  const id = button.dataset.edit || button.dataset.view;
  const item = contratos.find((contract) => String(contract.id_contrato) === String(id));
  if (!item) return;

  if (button.dataset.view) {
    mostrarDetalle(item);
    return;
  }

  cargarContratoEnFormulario(item);
});

cancelar.addEventListener('click', resetForm);

cerrarDetalle.addEventListener('click', () => {
  detalle.hidden = true;
  contratoSeleccionado = null;
});

editarDetalle.addEventListener('click', () => {
  if (!contratoSeleccionado) return;
  detalle.hidden = true;
  cargarContratoEnFormulario(contratoSeleccionado);
});

programarFirma?.addEventListener('click', async () => {
  const idPostulacion = Number(postulacion.value);
  const payload = {
    idPostulacion,
    fecha: document.getElementById('fechaFirma').value,
    hora: document.getElementById('horaFirma').value,
    lugar: document.getElementById('lugarFirma').value.trim(),
    direccion: document.getElementById('direccionFirma').value.trim(),
    observaciones: observaciones.value.trim()
  };
  if (!idPostulacion) return alert('Selecciona una postulación.');
  if (!payload.fecha || !payload.hora || !payload.lugar) return alert('Fecha, hora y lugar de firma son obligatorios.');
  try {
    const result = await api('/api/contratos/agenda-firma', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    alert(result.notificacion || 'Firma programada y notificación registrada.', 'success');
    await Promise.all([cargarPostulaciones(), cargarContratos()]);
  } catch (error) {
    alert(error.message);
  }
});

resetForm();
Promise.all([cargarPostulaciones(), cargarContratos()])
    .then(() => cargarPostulacionSeleccionada())
    .catch((error) => {
      body.innerHTML = `<tr><td colspan="7">${esc(error.message)}</td></tr>`;
    });
