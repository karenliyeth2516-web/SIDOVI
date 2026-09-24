const title = document.getElementById('tituloLista');
const search = document.getElementById('buscar');
const statusFilter = document.getElementById('filtroEstado');
const modal = document.getElementById('candidateModal');
const form = document.getElementById('candidateForm');
const body = document.getElementById('postulantesBody');
const estados = [
  { label: 'En revisión', value: 'EN_REVISION' },
  { label: 'Hoja de vida aprobada', value: 'HOJA_VIDA_APROBADA' },
  { label: 'Entrevista pendiente', value: 'ENTREVISTA_PENDIENTE' },
  { label: 'Entrevista agendada', value: 'ENTREVISTA_AGENDADA' },
  { label: 'Exámenes pendientes', value: 'EXAMENES_PENDIENTES' },
  { label: 'Exámenes agendados', value: 'EXAMENES_AGENDADOS' },
  { label: 'Exámenes en revisión', value: 'EXAMENES_EN_REVISION' },
  { label: 'Pendiente de contrato', value: 'PENDIENTE_CONTRATO' },
  { label: 'Firma contrato agendada', value: 'FIRMA_CONTRATO_AGENDADA' },
  { label: 'Contratado', value: 'CONTRATADO' },
  { label: 'Rechazado', value: 'RECHAZADO' }
];
let postulaciones = [];

document.getElementById('menuToggle')?.addEventListener('click', () => document.querySelector('.nav-list')?.classList.toggle('open'));
search.addEventListener('input', render);
statusFilter.addEventListener('change', render);
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalCancel').addEventListener('click', closeModal);

function escapeHtml(value = '') { const div = document.createElement('div'); div.textContent = value; return div.innerHTML; }
function badgeClass(status = '') { const value = status.toLowerCase(); return value.includes('aprob') || value.includes('contrato') ? 'badge-aprobado' : value.includes('rechaz') || value.includes('cancel') ? 'badge-rechazado' : value.includes('entrevista') ? 'badge-entrevista' : 'badge-pendiente'; }
function nombreEstado(estado) { const match = estados.find((e) => e.value === estado); return match ? match.label : String(estado || '').replace(/_/g, ' '); }
function accionesProceso(p) {
  const acciones = [
    `<select class="estado-editor" data-id="${p.id_postulacion}">${estados.map((e) => `<option value="${e.value}" ${p.estado === e.value ? 'selected' : ''}>${e.label}</option>`).join('')}</select>`,
    `<button class="btn-xs btn-xs-green guardar-estado" data-id="${p.id_postulacion}">Estado</button>`,
    `<button class="btn-xs btn-xs-blue editar" data-id="${p.id_postulacion}">Editar</button>`
  ];
  if (p.estado === 'HOJA_VIDA_APROBADA' || p.estado === 'ENTREVISTA_PENDIENTE') acciones.push(`<a class="btn-xs btn-xs-blue" href="agenda.html?idPostulacion=${p.id_postulacion}">Agendar entrevista</a>`);
  if (p.estado === 'EXAMENES_PENDIENTES') acciones.push('<a class="btn-xs btn-xs-blue" href="examenes.html">Programar exámenes</a>');
  acciones.push(`<button class="btn-xs btn-xs-red eliminar" data-id="${p.id_postulacion}">Eliminar</button>`);
  return acciones.join('');
}
function render() {
  const query = search.value.trim().toLowerCase();
  const state = statusFilter.value.toLowerCase();
  const rows = postulaciones.filter((p) => `${p.nombre_completo} ${p.numero_documento} ${p.cargo} ${p.estado}`.toLowerCase().includes(query) && (!state || p.estado.toLowerCase().includes(state)));
  title.textContent = `Lista de Postulantes (${rows.length})`;
  body.innerHTML = rows.length ? rows.map((p) => `<tr class="postulante-row"><td>${escapeHtml(p.nombre_completo)}</td><td>${escapeHtml(p.numero_documento)}</td><td>${escapeHtml(p.cargo)}</td><td>${new Date(p.fecha_postulacion).toLocaleDateString('es-CO')}</td><td><span class="badge ${badgeClass(p.estado)}">${escapeHtml(nombreEstado(p.estado))}</span></td><td style="display:flex;gap:.4rem;flex-wrap:wrap">${accionesProceso(p)}</td></tr>`).join('') : '<tr><td colspan="6">No hay postulaciones para mostrar.</td></tr>';
}
async function loadPostulaciones() { try { const response = await fetch('/api/postulaciones'); if (!response.ok) throw new Error(); postulaciones = await response.json(); render(); } catch { body.innerHTML = '<tr><td colspan="6">No fue posible cargar los datos de PostgreSQL.</td></tr>'; } }
async function request(url, options) { const response = await fetch(url, options); const data = response.status === 204 ? {} : await response.json(); if (!response.ok) throw new Error(data.error || 'No fue posible guardar el cambio.'); return data; }
function closeModal() { modal.hidden = true; }
function openModal(candidate) { document.getElementById('editPostulacionId').value = candidate.id_postulacion; document.getElementById('editNombre').value = candidate.nombre_completo; document.getElementById('editDocumento').value = candidate.numero_documento; document.getElementById('editCorreo').value = candidate.correo; document.getElementById('editTelefono').value = candidate.telefono; document.getElementById('editDireccion').value = candidate.direccion || ''; document.getElementById('editCargo').value = candidate.cargo; modal.hidden = false; document.getElementById('editNombre').focus(); }

body.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const id = button.dataset.id;
  const candidate = postulaciones.find((p) => String(p.id_postulacion) === id);
  if (!candidate) return;
  try {
    if (button.classList.contains('editar')) return openModal(candidate);
    if (button.classList.contains('eliminar')) { if (!confirm(`¿Eliminar a ${candidate.nombre_completo} y sus registros relacionados?`)) return; await request(`/api/postulaciones/${id}`, { method: 'DELETE' }); return loadPostulaciones(); }
    if (button.classList.contains('guardar-estado')) { const estado = body.querySelector(`.estado-editor[data-id="${id}"]`).value; await request(`/api/postulaciones/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ estado }) }); candidate.estado = estado; render(); }
  } catch (error) { alert(error.message); }
});

form.addEventListener('submit', async (event) => { event.preventDefault(); const id = document.getElementById('editPostulacionId').value; const payload = { nombre:document.getElementById('editNombre').value.trim(), documento:document.getElementById('editDocumento').value.trim(), correo:document.getElementById('editCorreo').value.trim(), telefono:document.getElementById('editTelefono').value.trim(), direccion:document.getElementById('editDireccion').value.trim(), cargo:document.getElementById('editCargo').value.trim() }; try { await request(`/api/postulaciones/${id}/datos`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) }); closeModal(); loadPostulaciones(); } catch (error) { alert(error.message); } });
modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
loadPostulaciones();
