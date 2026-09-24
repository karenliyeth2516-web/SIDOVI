document.getElementById('menuToggle')?.addEventListener('click', () => document.querySelector('.nav-list')?.classList.toggle('open'));
const body = document.getElementById('rrhhPostulacionesBody');
const sedeFiltro = document.getElementById('rrhhSedeFiltro');
function escapeHtml(value = '') {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}
function labelEstado(status = '') { return status.replaceAll('_', ' '); }
function badgeClass(status = '') {
  const value = status.toLowerCase();
  if (value.includes('aprob') || value.includes('contrato')) return 'badge-aprobado';
  if (value.includes('rechaz')) return 'badge-rechazado';
  if (value.includes('entrevista')) return 'badge-entrevista';
  return 'badge-pendiente';
}
async function apiJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No fue posible consultar la información.');
  return data;
}
async function cargarSedes() {
  const sedes = await apiJson('/api/sedes');
  sedeFiltro.innerHTML = '<option value="">Todas las sedes</option>';
  sedes.forEach((sede) => sedeFiltro.add(new Option(sede.nombre_sede, sede.id_sede)));
}
async function loadDashboard() {
  try {
    const query = sedeFiltro?.value ? `?idSede=${encodeURIComponent(sedeFiltro.value)}` : '';
    const [stats, postulaciones] = await Promise.all([
      apiJson(`/api/dashboard${query}`),
      apiJson(`/api/postulaciones${query}`)
    ]);
    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statRevision').textContent = stats.en_revision;
    document.getElementById('statEntrevistas').textContent = stats.entrevistas;
    document.getElementById('statAprobados').textContent = stats.aprobados;
    body.innerHTML = postulaciones.slice(0, 5).map((p) => `
      <tr>
        <td>${escapeHtml(p.nombre_completo)}</td>
        <td>${escapeHtml(p.cargo)}</td>
        <td>${escapeHtml(p.nombre_sede || 'Sin sede')}</td>
        <td>${new Date(p.fecha_postulacion).toLocaleDateString('es-CO')}</td>
        <td><span class="badge ${badgeClass(p.estado)}">${escapeHtml(labelEstado(p.estado))}</span></td>
        <td><a href="postulantes.html" class="btn-xs btn-xs-blue">Gestionar</a></td>
      </tr>
    `).join('') || '<tr><td colspan="6">No hay postulaciones para la sede seleccionada.</td></tr>';
  } catch (error) {
    body.innerHTML = `<tr><td colspan="6">${escapeHtml(error.message)}</td></tr>`;
  }
}
sedeFiltro?.addEventListener('change', loadDashboard);
Promise.all([cargarSedes(), loadDashboard()]).catch((error) => {
  body.innerHTML = `<tr><td colspan="6">${escapeHtml(error.message)}</td></tr>`;
});
