(() => {
  const grid = document.getElementById('ofertasGrid');
  const sedeFiltro = document.getElementById('sedeFiltro');
  const esc = (value = '') => {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
  };
  const normalizar = (value = '') => String(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let vacantes = [];

  function mostrarOfertas() {
    const sedeSeleccionada = sedeFiltro.value;
    const disponibles = vacantes.filter((v) => {
      const activa = ['abierta', 'activo', 'activa'].includes(normalizar(v.estado));
      return activa && (!sedeSeleccionada || String(v.id_sede) === sedeSeleccionada);
    });
    grid.innerHTML = disponibles.length
      ? disponibles.map((v) => `<article class="oferta-card">
          <div class="oferta-header"><span class="oferta-badge">Vacante</span><span class="oferta-status activo">● Activo</span></div>
          <h3>${esc(v.nombre_cargo || v.titulo)}</h3>
          <ul class="oferta-details">
            <li><strong>Sede:</strong> ${esc(v.nombre_sede || 'Sin sede')}</li>
            <li><strong>Jornada:</strong> ${esc(v.requisitos || v.turnos || 'Según operación')}</li>
            <li><strong>Descripción:</strong> ${esc(v.descripcion || v.descripcion_cargo)}</li>
            <li><strong>Responsable:</strong> ${esc(v.responsable || 'Colviseg Ltda.')}</li>
          </ul>
          <a href="postulacion.html?id_vacante=${encodeURIComponent(v.id_vacante)}" class="btn btn-primary btn-sm">Postularme</a>
        </article>`).join('')
      : '<p class="form-alert">No hay vacantes activas para la sede seleccionada.</p>';
  }

  async function cargarSedes() {
    const response = await fetch('/api/sedes');
    if (!response.ok) throw new Error('No fue posible consultar las sedes. Ejecuta la migración de sedes y cargos.');
    const sedes = await response.json();
    sedeFiltro.innerHTML = '<option value="">Todas las sedes</option>';
    sedes.forEach((sede) => sedeFiltro.add(new Option(sede.nombre_sede, sede.id_sede)));
  }

  async function cargarVacantes() {
    const response = await fetch('/api/vacantes');
    if (!response.ok) throw new Error('No fue posible consultar las vacantes.');
    vacantes = await response.json();
    mostrarOfertas();
  }

  function completarSedesDesdeVacantes() {
    if (sedeFiltro.options.length > 1) return;
    const sedes = [...new Map(vacantes.filter((v) => v.id_sede && v.nombre_sede)
      .map((v) => [String(v.id_sede), v.nombre_sede])).entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'es'));
    sedes.forEach(([id, nombre]) => sedeFiltro.add(new Option(nombre, id)));
  }

  sedeFiltro.addEventListener('change', mostrarOfertas);
  Promise.all([cargarSedes(), cargarVacantes()]).then(completarSedesDesdeVacantes).catch((error) => {
    grid.innerHTML = `<p class="form-alert error">${esc(error.message)}</p>`;
  });
})();
