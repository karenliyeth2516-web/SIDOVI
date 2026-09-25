const entrevistaId =
    new URLSearchParams(window.location.search).get('id');

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


const alertBox =
    document.getElementById('entrevistaAlert');


const reporteAlert =
    document.getElementById('reporteRrhhAlert');


const reporteContenido =
    document.getElementById('reporteRrhhContenido');


function aviso(message, type = 'error') {

  alertBox.textContent = message;

  alertBox.className =
      `form-alert ${type}`;

  alertBox.hidden = false;
}


async function api(url, options = {}) {

  const response =
      await fetch(url, options);

  const data =
      response.status === 204
          ? null
          : await response.json();

  if (!response.ok) {

    throw new Error(
        data?.error ||
        'No fue posible completar la operación.'
    );

  }

  return data;
}


/* ==========================================================
   PREGUNTAS
   ========================================================== */

function pintarPreguntas() {

  const wrap =
      document.getElementById('preguntasWrap');


  const grupos =
      preguntasBase.reduce(
          (acc, [categoria, pregunta], index) => {

            acc[categoria] =
                acc[categoria] || [];

            acc[categoria].push({
              pregunta,
              index
            });

            return acc;

          },
          {}
      );


  wrap.innerHTML =
      Object.entries(grupos)
          .map(([categoria, items]) => `

        <section style="margin-bottom:1.25rem;">

          <h3
            style="
              color:var(--azul-oscuro);
              margin-bottom:.75rem;
            "
          >
            ${esc(categoria)}
          </h3>


          ${items.map(item => `

            <div
              class="field"
              style="margin-bottom:.85rem;"
            >

              <label
                for="respuesta-${item.index}"
              >
                ${esc(item.pregunta)}
              </label>


              <textarea
                id="respuesta-${item.index}"
                data-categoria="${esc(item.categoria || categoria)}"
                data-pregunta="${esc(item.pregunta)}"
                rows="2"
              ></textarea>

            </div>

          `).join('')}

        </section>

      `)
          .join('');
}


/* ==========================================================
   CARGAR REPORTE DE RRHH
   ========================================================== */

async function cargarReporteRrhh(idPostulacion) {

  if (!idPostulacion) {

    reporteAlert.textContent =
        'No fue posible identificar la postulación.';

    reporteAlert.className =
        'form-alert error';

    reporteAlert.hidden = false;

    return;

  }


  try {

    const reporte =
        await api(
            `/api/reportes-rrhh/${encodeURIComponent(idPostulacion)}`
        );


    if (!reporte) {

      reporteAlert.textContent =
          'RRHH todavía no ha registrado un reporte para este candidato.';

      reporteAlert.className =
          'form-alert';

      reporteAlert.hidden = false;

      reporteContenido.hidden = true;

      return;

    }


    document.getElementById('reporteConcepto').textContent =
        reporte.concepto || 'Sin información registrada.';


    document.getElementById('reporteFortalezas').textContent =
        reporte.fortalezas || 'Sin información registrada.';


    document.getElementById('reporteAspectos').textContent =
        reporte.aspectos_considerar ||
        'Sin información registrada.';


    document.getElementById('reporteRecomendacion').textContent =
        reporte.recomendacion ||
        'Sin información registrada.';


    reporteAlert.hidden = true;

    reporteContenido.hidden = false;


  } catch (error) {

    reporteAlert.textContent =
        error.message;

    reporteAlert.className =
        'form-alert error';

    reporteAlert.hidden = false;

    reporteContenido.hidden = true;

  }

}


/* ==========================================================
   CARGAR ENTREVISTA
   ========================================================== */

async function cargarEntrevista() {

  if (!entrevistaId) {

    throw new Error(
        'Abre esta pantalla desde una entrevista del dashboard de Gerencia.'
    );

  }


  const entrevista =
      await api(
          `/api/entrevistas/${encodeURIComponent(entrevistaId)}`
      );


  document.getElementById('datoCandidato').textContent =
      `${entrevista.candidato || 'Candidato'} · ${entrevista.numero_documento || 'Sin documento'}`;


  document.getElementById('datoCargo').textContent =
      entrevista.cargo || '-';


  document.getElementById('datoFecha').textContent =
      `${String(entrevista.fecha_entrevista).slice(0, 10)} ${String(entrevista.hora_entrevista || '').slice(0, 5)}`;


  document.getElementById('datoEntrevistador').textContent =
      entrevista.entrevistador || 'Gerencia';


  /*
   * Aquí obtenemos el ID de la postulación
   * para buscar el reporte creado por RRHH.
   */

  await cargarReporteRrhh(
      entrevista.id_postulacion
  );


  return entrevista;
}


/* ==========================================================
   LEER RESPUESTAS
   ========================================================== */

function leerPreguntas() {

  return [
    ...document.querySelectorAll(
        '[id^="respuesta-"]'
    )
  ].map(input => ({

    categoria:
    input.dataset.categoria,

    pregunta:
    input.dataset.pregunta,

    respuesta:
        input.value.trim()

  }));

}


/* ==========================================================
   GUARDAR ENTREVISTA
   ========================================================== */

document
    .getElementById('entrevistaForm')
    .addEventListener(
        'submit',
        async event => {

          event.preventDefault();


          const resultado =
              document.getElementById('resultado').value;


          const motivoRechazo =
              document
                  .getElementById('motivoRechazo')
                  .value
                  .trim();


          if (
              resultado === 'RECHAZADO' &&
              !motivoRechazo
          ) {

            return aviso(
                'El motivo es obligatorio cuando la entrevista no se aprueba.'
            );

          }


          const preguntas =
              leerPreguntas();


          if (
              !preguntas.some(
                  pregunta => pregunta.respuesta
              )
          ) {

            return aviso(
                'Registra al menos una respuesta de entrevista.'
            );

          }


          try {

            await api(
                '/api/evaluaciones/detallada',
                {

                  method: 'POST',

                  headers: {
                    'Content-Type':
                        'application/json'
                  },

                  body: JSON.stringify({

                    idEntrevista:
                        Number(entrevistaId),

                    resultado,

                    motivoRechazo,

                    preguntas,

                    criterios: [
                      {
                        criterio:
                            'Evaluación gerencial',

                        puntuacion:
                            Number(
                                document
                                    .getElementById('calificacion')
                                    .value || 0
                            )
                      }
                    ],

                    observaciones:
                        document
                            .getElementById('observaciones')
                            .value
                            .trim(),

                    fortalezas:
                        document
                            .getElementById('fortalezas')
                            .value
                            .trim(),

                    aspectosMejora:
                        document
                            .getElementById('aspectosMejora')
                            .value
                            .trim(),

                    recomendacion:
                        document
                            .getElementById('recomendacion')
                            .value
                            .trim()

                  })

                }
            );


            aviso(
                resultado === 'APROBADO'
                    ? 'Entrevista guardada. El candidato pasó a exámenes pendientes.'
                    : 'Entrevista guardada correctamente.',
                'success'
            );


          } catch (error) {

            aviso(
                error.message
            );

          }

        }
    );


/* ==========================================================
   PDF
   ========================================================== */

document
    .getElementById('btnPdf')
    .addEventListener(
        'click',
        () => {

          if (!entrevistaId) {

            return aviso(
                'Primero abre una entrevista válida.'
            );

          }


          window.open(
              `/api/entrevistas/${entrevistaId}/pdf`,
              '_blank'
          );

        }
    );


/* ==========================================================
   INICIO
   ========================================================== */

pintarPreguntas();

cargarEntrevista()
    .catch(error => {

      aviso(
          error.message
      );

    });