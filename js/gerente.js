(() => {
  const esc = (value = '') => {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
  };
  const normalizar = (value = '') => String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const statNodes = [...document.querySelectorAll('.stat-num')];
  const columns = [...document.querySelectorAll('.kanban-col')];

  async function api(url) {
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No fue posible cargar el dashboard.');
    return data;
  }

  function categoria(postulacion) {
    const estado = normalizar(postulacion.estado);
    if (estado.includes('rechaz')) return 2;
    if (estado.includes('contrato') || estado.includes('examenes aprobados') || estado.includes('pendiente contrato')) return 1;
    if (estado.includes('entrevista')) return 0;
    return 0;
  }

  function accion(item, index) {
    if (index === 0) return `<a href="evaluacion.html?id=${item.id_entrevista || item.id_postulacion}" class="btn-xs btn-xs-blue">Abrir entrevista</a>`;
    if (index === 1) return `<a href="contrato.html?idPostulacion=${item.id_postulacion}" class="btn-xs btn-xs-green">Gestionar contrato</a>`;
    return `<a href="perfil.html?id=${item.id_postulacion}" class="btn-xs btn-xs-blue">Perfil</a>`;
  }

  function pintarColumna(index, titulo, items) {
    const header = columns[index]?.querySelector('.kanban-col-header');
    const body = columns[index]?.querySelector('.kanban-col-body');
    if (!header || !body) return;
    header.textContent = `${titulo} (${items.length})`;
    body.innerHTML = items.length ? items.slice(0, 12).map((item) => {
      const nombre = item.candidato || item.nombre_completo || 'Postulante';
      const fecha = item.fecha_entrevista ? `${String(item.fecha_entrevista).slice(0, 10)} ${String(item.hora_entrevista || '').slice(0, 5)}` : (item.estado || '');
      return `<div class="kanban-card"><h4>${esc(nombre)}</h4><p>${esc(item.cargo || 'Cargo no especificado')} · ${esc(fecha || item.nombre_sede || 'Sin sede')}</p><div class="card-actions">${accion(item, index)}</div></div>`;
    }).join('') : '<p class="form-alert">No hay candidatos en este estado.</p>';
  }

  async function cargarDashboard() {
    try {
      const [stats, postulaciones, entrevistas, contratos] = await Promise.all([
        api('/api/dashboard'), api('/api/postulaciones'), api('/api/entrevistas'), api('/api/contratos')
      ]);
      const activos = contratos.filter((contrato) => ['activo', 'vigente'].includes(normalizar(contrato.estado))).length;
      [stats.total, stats.en_revision, stats.aprobados, activos].forEach((value, index) => {
        if (statNodes[index]) statNodes[index].textContent = Number(value || 0);
      });
      const grupos = [[], [], []];
      entrevistas.filter((e) => !['APROBADO', 'RECHAZADO'].includes(String(e.resultado))).forEach((item) => grupos[0].push(item));
      postulaciones.forEach((item) => grupos[categoria(item)].push(item));
      pintarColumna(0, 'Entrevistas por realizar', grupos[0]);
      pintarColumna(1, 'Pendientes de contrato', grupos[1]);
      pintarColumna(2, 'Rechazados', grupos[2]);
    } catch (error) {
      columns.forEach((column) => {
        const body = column.querySelector('.kanban-col-body');
        if (body) body.innerHTML = `<p class="form-alert error">${esc(error.message)}</p>`;
      });
    }
  }

  cargarDashboard();
})();
