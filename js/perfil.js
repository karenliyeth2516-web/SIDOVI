const esc = v => {
    const d = document.createElement('div');
    d.textContent = v ?? '';
    return d.innerHTML;
};

const params = new URLSearchParams(location.search);
const id = params.get('id');

const estado = document.getElementById('perfilEstado');
const card = document.getElementById('perfilCard');

const reporteSection = document.getElementById('reporteRrhhSection');
const reporteForm = document.getElementById('reporteRrhhForm');
const reporteAlert = document.getElementById('reporteAlert');

const docUrl = d =>
    `/api/documentos/${encodeURIComponent(d.id_documento)}/archivo`;

document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.querySelector('.nav-list')?.classList.toggle('open');
});


function mostrarReporteAlert(message, type = 'error') {
    reporteAlert.textContent = message;
    reporteAlert.className = `form-alert ${type}`;
    reporteAlert.hidden = false;
}


async function cargarReporte() {
    const response = await fetch(
        `/api/reportes-rrhh/${encodeURIComponent(id)}`
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.error || 'No fue posible cargar el reporte de RRHH.'
        );
    }

    if (data) {
        document.getElementById('concepto').value =
            data.concepto || '';

        document.getElementById('fortalezas').value =
            data.fortalezas || '';

        document.getElementById('aspectosConsiderar').value =
            data.aspectos_considerar || '';

        document.getElementById('recomendacion').value =
            data.recomendacion || '';
    }
}


reporteForm?.addEventListener('submit', async event => {

    event.preventDefault();

    const concepto =
        document.getElementById('concepto').value.trim();

    const fortalezas =
        document.getElementById('fortalezas').value.trim();

    const aspectosConsiderar =
        document.getElementById('aspectosConsiderar').value.trim();

    const recomendacion =
        document.getElementById('recomendacion').value.trim();


    if (!concepto) {
        mostrarReporteAlert(
            'El concepto sobre la hoja de vida es obligatorio.'
        );
        return;
    }


    const boton =
        document.getElementById('btnGuardarReporte');

    const textoOriginal = boton.textContent;

    boton.disabled = true;
    boton.textContent = 'Guardando...';

    reporteAlert.hidden = true;


    try {

        const response = await fetch(
            `/api/reportes-rrhh/${encodeURIComponent(id)}`,
            {
                method: 'PUT',

                headers: {
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify({
                    concepto,
                    fortalezas,
                    aspectosConsiderar,
                    recomendacion
                })
            }
        );


        const data = await response.json();


        if (!response.ok) {
            throw new Error(
                data.error ||
                'No fue posible guardar el reporte.'
            );
        }


        mostrarReporteAlert(
            'Reporte de RRHH guardado correctamente.',
            'success'
        );


    } catch (error) {

        mostrarReporteAlert(
            error.message
        );

    } finally {

        boton.disabled = false;
        boton.textContent = textoOriginal;

    }

});


(async () => {

    try {

        if (!id) {
            throw new Error(
                'No se indicó el candidato.'
            );
        }


        const response = await fetch(
            `/api/postulaciones/${encodeURIComponent(id)}`
        );

        const p = await response.json();


        if (!response.ok) {
            throw new Error(
                p.error ||
                'No fue posible cargar el perfil.'
            );
        }


        const foto = p.documentos?.find(
            d =>
                String(d.tipo_documento).toUpperCase() === 'FOTO'
        );


        const imagen = foto
            ? `
        <img
          class="profile-photo"
          src="${docUrl(foto)}"
          alt="Foto de ${esc(p.nombre_completo)}"
          onerror="this.outerHTML='<div class=\\'profile-photo profile-placeholder\\'>Sin foto</div>'"
        >
      `
            : `
        <div class="profile-photo profile-placeholder">
          Sin foto
        </div>
      `;


        card.innerHTML = `

      <div class="profile-head">

        ${imagen}

        <div>

          <h2>
            ${esc(p.nombre_completo)}
          </h2>

          <p>
            ${esc(p.cargo || 'Cargo no especificado')}
            ·
            ${esc(p.estado || 'En revisión')}
          </p>

        </div>

      </div>


      <div class="profile-grid">

        <div>
          <strong>Tipo de documento</strong>
          <span>${esc(p.tipo_documento || 'CC')}</span>
        </div>

        <div>
          <strong>Número de documento</strong>
          <span>${esc(p.numero_documento)}</span>
        </div>

        <div>
          <strong>Teléfono</strong>
          <span>${esc(p.telefono)}</span>
        </div>

        <div>
          <strong>Dirección</strong>
          <span>${esc(p.direccion)}</span>
        </div>

        <div>
          <strong>Correo</strong>
          <span>${esc(p.correo)}</span>
        </div>

        <div>
          <strong>Cargo</strong>
          <span>${esc(p.cargo)}</span>
        </div>

      </div>


      <h3>
        Documentos entregados
      </h3>


      <div class="document-list">

        ${
            (p.documentos || [])
                .map(d => `
              <a
                class="document-chip"
                href="${docUrl(d)}"
                target="_blank"
                rel="noopener"
              >
                📎
                ${esc(d.nombre_documento)}
                (${esc(d.tipo_documento)})
              </a>
            `)
                .join('')
            ||
            '<span>No hay documentos.</span>'
        }

      </div>

    `;


        estado.hidden = true;
        card.hidden = false;


        /*
         * Mostramos el formulario de reporte
         * solamente después de cargar correctamente
         * el perfil.
         */
        reporteSection.hidden = false;


        /*
         * Intentamos cargar un reporte existente.
         * Si todavía no existe, simplemente dejamos
         * los campos vacíos.
         */
        try {

            await cargarReporte();

        } catch (error) {

            console.warn(
                'No hay reporte previo o todavía no está disponible:',
                error.message
            );

        }


    } catch (error) {

        estado.className = 'form-alert error';
        estado.textContent = error.message;
        estado.hidden = false;

    }

})();