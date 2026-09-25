const menuToggle = document.getElementById('menuToggle');
const navList = document.querySelector('.nav-list');
const candidatosBody = document.getElementById('candidatosEvaluarBody');

let candidatos = [];
let entrevistas = [];


// ================================
// MENÚ
// ================================

menuToggle?.addEventListener('click', () => {
  navList?.classList.toggle('open');
});


// ================================
// SEGURIDAD HTML
// ================================

function escapeHtml(value = '') {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}


// ================================
// ESTADOS
// ================================

function estadoVisible(estado = '') {

  const nombres = {

    EN_REVISION: 'En revisión',

    APROBADO_RRHH: 'Aprobado por RRHH',

    RECHAZADO_RRHH: 'Rechazado por RRHH',

    HOJA_VIDA_APROBADA: 'Hoja de vida aprobada',

    ENTREVISTA: 'Entrevista',

    ENTREVISTA_PENDIENTE: 'Entrevista pendiente',

    ENTREVISTA_AGENDADA: 'Entrevista agendada',

    EXAMENES_PENDIENTES: 'Exámenes pendientes',

    PENDIENTE_CONTRATO: 'Pendiente de contrato',

    RECHAZADO: 'Rechazado',

    CONTRATADO: 'Contratado'

  };

  return nombres[estado] || estado;
}


// ================================
// OBTENER ENTREVISTA DEL CANDIDATO
// ================================

function obtenerEntrevista(idPostulacion) {

  return entrevistas.find(
      (entrevista) =>
          String(entrevista.id_postulacion) ===
          String(idPostulacion)
  );

}


// ================================
// FORMATO DE FECHA
// ================================

function formatoFecha(fecha, hora) {

  if (!fecha) {
    return 'Sin fecha';
  }

  const fechaTexto = String(fecha).slice(0, 10);

  const horaTexto = String(hora || '').slice(0, 5);

  if (!horaTexto) {
    return fechaTexto;
  }

  return `${fechaTexto} ${horaTexto}`;
}


// ================================
// MOSTRAR CANDIDATOS
// ================================

function pintarCandidatos() {

  if (!candidatos.length) {

    candidatosBody.innerHTML = `
      <tr>
        <td colspan="5">
          No hay candidatos pendientes de entrevista.
        </td>
      </tr>
    `;

    return;
  }


  candidatosBody.innerHTML = candidatos.map((candidato) => {

    const entrevista =
        obtenerEntrevista(candidato.id_postulacion);


    const fechaEntrevista = entrevista
        ? formatoFecha(
            entrevista.fecha_entrevista,
            entrevista.hora_entrevista
        )
        : 'Sin entrevista programada';


    let boton = '';


    if (entrevista) {

      boton = `
        <a
          href="evaluacion.html?id=${encodeURIComponent(entrevista.id_entrevista)}"
          class="btn-xs btn-xs-blue"
        >
          Entrevistar
        </a>
      `;

    } else {

      boton = `
        <span
          class="btn-xs"
          style="opacity:.6;cursor:not-allowed;"
        >
          Sin entrevista
        </span>
      `;

    }


    return `
      <tr>

        <td>
          <strong>
            ${escapeHtml(
        candidato.nombre_completo || 'Sin nombre'
    )}
          </strong>
        </td>


        <td>
          ${escapeHtml(
        candidato.cargo || 'Sin cargo'
    )}
        </td>


        <td>
          ${escapeHtml(fechaEntrevista)}
        </td>


        <td>

          <span class="badge badge-entrevista">
            ${escapeHtml(
        estadoVisible(candidato.estado)
    )}
          </span>

        </td>


        <td>
          ${boton}
        </td>

      </tr>
    `;

  }).join('');

}


// ================================
// CARGAR INFORMACIÓN
// ================================

async function cargarCandidatos() {

  try {

    const [
      respuestaPostulaciones,
      respuestaEntrevistas
    ] = await Promise.all([

      fetch('/api/postulaciones'),

      fetch('/api/entrevistas')

    ]);


    const dataPostulaciones =
        await respuestaPostulaciones.json();


    const dataEntrevistas =
        await respuestaEntrevistas.json();


    if (!respuestaPostulaciones.ok) {

      throw new Error(
          dataPostulaciones.error ||
          'No fue posible cargar los candidatos.'
      );

    }


    if (!respuestaEntrevistas.ok) {

      throw new Error(
          dataEntrevistas.error ||
          'No fue posible cargar las entrevistas.'
      );

    }


    entrevistas = Array.isArray(dataEntrevistas)
        ? dataEntrevistas
        : [];


    /*
      Solo mostramos candidatos que
      ya están en el proceso de entrevista.
    */

    candidatos = dataPostulaciones.filter(
        (candidato) => [

          'APROBADO_RRHH',

          'HOJA_VIDA_APROBADA',

          'ENTREVISTA',

          'ENTREVISTA_PENDIENTE',

          'ENTREVISTA_AGENDADA'

        ].includes(candidato.estado)
    );


    pintarCandidatos();


  } catch (error) {

    candidatosBody.innerHTML = `
      <tr>

        <td colspan="5">

          ${escapeHtml(error.message)}

        </td>

      </tr>
    `;

  }

}


// ================================
// INICIAR
// ================================

cargarCandidatos();