const entrevistaId = new URLSearchParams(window.location.search).get('id');
const preguntasBase = [
  ['Información general', '¿Por qué está interesado en trabajar en la empresa?'],
  ['Información general', '¿Qué conoce de la empresa?'],
  ['Información general', '¿Cuál considera que es su principal fortaleza?'],
  ['Experiencia y conocimientos', '¿Qué experiencia tiene relacionada con el cargo?'],
  ['Experiencia y conocimientos', '¿Qué conocimientos considera más importantes para desempeñar este cargo?'],
  ['Experiencia y conocimientos', 'Describa una situación en la que tuvo que solucionar un problema.'],
  ['Trabajo y comportamiento', '¿Cómo trabaja bajo presión?'],
  ['Trabajo y comportamiento', '¿Cómo maneja los conflictos?'],
  ['Trabajo y comportamiento', '¿Cómo trabaja en equipo?'],
  ['Trabajo y comportamiento', '¿Cómo maneja una situación en la que comete un error?'],
  ['Disponibilidad', 'Disponibilidad de horario.'],
  ['Disponibilidad', 'Disponibilidad para desplazarse.'],
  ['Disponibilidad', 'Observaciones adicionales.']
];

document.getElementById('menuToggle')?.addEventListener('click', () => {
  document.querySelector('.nav-list')?.classList.toggle('open');
});

const esc = (value = '') => {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
};
const alertBox = document.getElementById('entrevistaAlert');

function aviso(message, type = 'error') {
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

function pintarPreguntas() {
  const wrap = document.getElementById('preguntasWrap');
  const grupos = preguntasBase.reduce((acc, [categoria, pregunta], index) => {
    acc[categoria] = acc[categoria] || [];
    acc[categoria].push({ pregunta, index });
    return acc;
  }, {});
  wrap.innerHTML = Object.entries(grupos).map(([categoria, items]) => `
    <section style="margin-bottom:1.25rem;">
      <h3 style="color:var(--azul-oscuro);margin-bottom:.75rem;">${esc(categoria)}</h3>
      ${items.map((item) => `
        <div class="field" style="margin-bottom:.85rem;">
          <label for="respuesta-${item.index}">${esc(item.pregunta)}</label>
          <textarea id="respuesta-${item.index}" data-categoria="${esc(categoria)}" data-pregunta="${esc(item.pregunta)}" rows="2"></textarea>
        </div>
      `).join('')}
    </section>
  `).join('');
}

async function cargarEntrevista() {
  if (!entrevistaId) throw new Error('Abre esta pantalla desde una entrevista del dashboard de Gerencia.');
  const entrevista = await api(`/api/entrevistas/${entrevistaId}`);
  document.getElementById('datoCandidato').textContent = `${entrevista.candidato || 'Candidato'} · ${entrevista.numero_documento || 'Sin documento'}`;
  document.getElementById('datoCargo').textContent = entrevista.cargo || '-';
  document.getElementById('datoFecha').textContent = `${String(entrevista.fecha_entrevista).slice(0, 10)} ${String(entrevista.hora_entrevista || '').slice(0, 5)}`;
  document.getElementById('datoEntrevistador').textContent = entrevista.entrevistador || 'Gerencia';
  return entrevista;
}

function leerPreguntas() {
  return [...document.querySelectorAll('[id^="respuesta-"]')].map((input) => ({
    categoria: input.dataset.categoria,
    pregunta: input.dataset.pregunta,
    respuesta: input.value.trim()
  }));
}

document.getElementById('entrevistaForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const resultadoInput = document.querySelector('input[name="resultado"]:checked');
  if (!resultadoInput) return aviso('Selecciona el resultado de la entrevista (Aprobado o No aprobado).');
  const resultado = resultadoInput.value;
  const motivoRechazo = document.getElementById('motivoRechazo').value.trim();
  if (resultado === 'RECHAZADO' && !motivoRechazo) return aviso('El motivo es obligatorio cuando la entrevista no se aprueba.');
  const preguntas = leerPreguntas();
  if (!preguntas.some((p) => p.respuesta)) return aviso('Registra al menos una respuesta de entrevista.');
  try {
    await api('/api/evaluaciones/detallada', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idEntrevista: Number(entrevistaId),
        resultado,
        motivoRechazo,
        preguntas,
        criterios: [{ criterio: 'Evaluación gerencial', puntuacion: Number(document.getElementById('calificacion').value || 0) }],
        observaciones: document.getElementById('observaciones').value.trim(),
        fortalezas: document.getElementById('fortalezas').value.trim(),
        aspectosMejora: document.getElementById('aspectosMejora').value.trim(),
        recomendacion: document.getElementById('recomendacion').value.trim()
      })
    });
    aviso(resultado === 'APROBADO' ? 'Entrevista guardada. El candidato pasó a exámenes pendientes.' : 'Entrevista guardada correctamente.', 'success');
  } catch (error) {
    aviso(error.message);
  }
});

document.getElementById('btnPdf').addEventListener('click', () => {
  if (!entrevistaId) return aviso('Primero abre una entrevista válida.');
  window.open(`/api/entrevistas/${entrevistaId}/pdf`, '_blank');
});

pintarPreguntas();
cargarEntrevista().catch((error) => aviso(error.message));
