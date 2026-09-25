// ============================================================
// SIDOVI - REPORTES
// ============================================================

const esc = (value) =>
    String(value ?? '')
        .replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));


// ============================================================
// ELEMENTOS
// ============================================================

const aspiranteReporte =
    document.getElementById('aspiranteReporte');

const btnConsultarHistorial =
    document.getElementById('btnConsultarHistorial');

const btnPdfHistorial =
    document.getElementById('btnPdfHistorial');

const datosAspirante =
    document.getElementById('datosAspirante');

const resumenAspirante =
    document.getElementById('resumenAspirante');

const historialAspirante =
    document.getElementById('historialAspirante');

const detalleHistorial =
    document.getElementById('detalleHistorial');

const desde =
    document.getElementById('desde');

const hasta =
    document.getElementById('hasta');

const btnConsultar =
    document.getElementById('btnConsultar');

const btnPdf =
    document.getElementById('btnPdf');

const summary =
    document.getElementById('summary');

const genero =
    document.getElementById('genero');

const monthly =
    document.getElementById('monthly');

const weekly =
    document.getElementById('weekly');

const sedes =
    document.getElementById('sedes');

const cargos =
    document.getElementById('cargos');

const states =
    document.getElementById('states');

const sedeGenero =
    document.getElementById('sedeGenero');

const history =
    document.getElementById('history');

const reportAlert =
    document.getElementById('reportAlert');


// ============================================================
// API
// ============================================================

const api = async (url, options = {}) => {

    const response = await fetch(url, {
        credentials: 'same-origin',
        ...options
    });

    const data =
        await response
            .json()
            .catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.error ||
            'No fue posible consultar la información.'
        );
    }

    return data;
};


// ============================================================
// UTILIDADES
// ============================================================

function showAlert(message) {

    if (!reportAlert) return;

    reportAlert.textContent = message;
    reportAlert.hidden = false;
}


function hideAlert() {

    if (!reportAlert) return;

    reportAlert.textContent = '';
    reportAlert.hidden = true;
}


function formatDate(value) {

    if (!value) {
        return 'No especificado';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}


function formatDateTime(value) {

    if (!value) {
        return 'No especificado';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString('es-CO', {
        dateStyle: 'short',
        timeStyle: 'short'
    });
}


function formatTime(value) {

    if (!value) {
        return 'No especificado';
    }

    return String(value).slice(0, 5);
}


function normalizeText(value) {

    if (
        value === null ||
        value === undefined ||
        String(value).trim() === ''
    ) {
        return 'No especificado';
    }

    return String(value);
}


function emptyRow(columns, text = 'Sin datos') {

    return `
        <tr>
            <td colspan="${columns}">
                ${esc(text)}
            </td>
        </tr>
    `;
}


function percentage(value, total) {

    const number = Number(value || 0);
    const totalNumber = Number(total || 0);

    if (!totalNumber) {
        return '0%';
    }

    return `${((number / totalNumber) * 100).toFixed(1)}%`;
}


// ============================================================
// REPORTE 1
// CARGAR ASPIRANTES
// ============================================================

async function cargarAspirantes() {

    try {

        const postulaciones =
            await api('/api/postulaciones');

        const mapa =
            new Map();

        postulaciones.forEach((p) => {

            const id =
                p.id_aspirante;

            if (!id) return;

            if (!mapa.has(id)) {

                mapa.set(id, {
                    id,
                    nombre: p.nombre_completo,
                    documento: p.numero_documento,
                    correo: p.correo
                });

            }

        });

        aspiranteReporte.innerHTML = `
            <option value="">
                Seleccione un aspirante
            </option>
        `;

        [...mapa.values()]
            .sort((a, b) =>
                String(a.nombre || '')
                    .localeCompare(
                        String(b.nombre || ''),
                        'es'
                    )
            )
            .forEach((aspirante) => {

                const option =
                    document.createElement('option');

                option.value =
                    aspirante.id;

                option.textContent =
                    `${aspirante.nombre || 'Sin nombre'} · ${aspirante.documento || 'Sin documento'}`;

                aspiranteReporte.appendChild(option);

            });

    } catch (error) {

        showAlert(
            'No fue posible cargar los aspirantes: ' +
            error.message
        );

    }
}


// ============================================================
// REPORTE 1
// CONSULTAR HISTORIAL
// ============================================================

async function consultarHistorial() {

    hideAlert();

    const id =
        aspiranteReporte.value;

    if (!id) {

        showAlert(
            'Seleccione un aspirante para consultar su historial.'
        );

        return;
    }

    btnConsultarHistorial.disabled = true;

    try {

        const data =
            await api(
                `/api/reportes/historial/${encodeURIComponent(id)}`
            );

        renderAspirante(data);

        btnPdfHistorial.disabled = false;

        btnPdfHistorial.dataset.idAspirante =
            id;

    } catch (error) {

        datosAspirante.hidden = true;
        historialAspirante.hidden = true;

        btnPdfHistorial.disabled = true;

        showAlert(error.message);

    } finally {

        btnConsultarHistorial.disabled = false;

    }
}


// ============================================================
// REPORTE 1
// DATOS GENERALES
// ============================================================

function renderAspirante(data) {

    const aspirante =
        data.aspirante || {};

    const resumen =
        data.resumen || {};

    const historial =
        data.historial || [];

    datosAspirante.hidden = false;

    historialAspirante.hidden = false;

    resumenAspirante.innerHTML = `
    <table class="tabla-resumen-aspirante">
        <thead>
            <tr>
                <th>Campo</th>
                <th>Información</th>
            </tr>
        </thead>

        <tbody>
            <tr>
                <td>Nombre completo</td>
                <td>${esc(normalizeText(aspirante.nombre_completo))}</td>
            </tr>

            <tr>
                <td>Documento</td>
                <td>${esc(normalizeText(aspirante.numero_documento))}</td>
            </tr>

            <tr>
                <td>Sexo</td>
                <td>${esc(normalizeText(aspirante.sexo))}</td>
            </tr>

            <tr>
                <td>Correo</td>
                <td>${esc(normalizeText(aspirante.correo))}</td>
            </tr>

            <tr>
                <td>Teléfono</td>
                <td>${esc(normalizeText(aspirante.telefono))}</td>
            </tr>

            <tr>
                <td>Total postulaciones</td>
                <td>${esc(resumen.total_postulaciones)}</td>
            </tr>

            <tr>
                <td>Postulaciones rechazadas</td>
                <td>${esc(resumen.rechazadas)}</td>
            </tr>

            <tr>
                <td>Postulaciones aprobadas</td>
                <td>${esc(resumen.aprobadas)}</td>
            </tr>
        </tbody>
    </table>
`;


    renderHistorial(historial);
}


// ============================================================
// REPORTE 1
// HISTORIAL COMPLETO
// ============================================================

function renderHistorial(historial) {

    if (!historial.length) {

        detalleHistorial.innerHTML = `
            <div class="form-alert">
                No existen postulaciones registradas.
            </div>
        `;

        return;
    }


    detalleHistorial.innerHTML =
        historial
            .map((postulacion, index) =>
                renderPostulacion(
                    postulacion,
                    index
                )
            )
            .join('');
}


// ============================================================
// REPORTE 1
// TARJETA DE POSTULACIÓN
// ============================================================

function renderPostulacion(postulacion, index) {

    const estado =
        normalizeText(
            postulacion.estado
        );

    const motivo =
        postulacion.motivo_rechazo_completo ||
        postulacion.motivo_rechazo ||
        'No especificado';


    const etapa =
        postulacion.etapa_rechazo ||
        'No aplica';


    const historialProceso =
        postulacion.historial_proceso || [];


    const documentos =
        postulacion.documentos || [];


    const entrevista =
        postulacion.entrevista;


    const examen =
        postulacion.examen;


    const contrato =
        postulacion.contrato;


    return `

        <article
            class="data-table-wrap"
            style="margin-top:20px;"
        >

            <h3>
                Postulación #${index + 1}
            </h3>


            <!-- ============================================
                 INFORMACIÓN PRINCIPAL
                 ============================================ -->

            <table>

                <tbody>

                    <tr>
                        <th>
                            Fecha de postulación
                        </th>

                        <td>
                            <strong>
                                ${esc(
        formatDate(
            postulacion.fecha_postulacion
        )
    )}
                            </strong>
                        </td>
                    </tr>


                    <tr>

                        <th>
                            Cargo
                        </th>

                        <td>
                            ${esc(
        normalizeText(
            postulacion.nombre_cargo ||
            postulacion.cargo ||
            postulacion.titulo
        )
    )}
                        </td>

                    </tr>


                    <tr>

                        <th>
                            Sede
                        </th>

                        <td>
                            ${esc(
        normalizeText(
            postulacion.nombre_sede
        )
    )}
                        </td>

                    </tr>


                    <tr>

                        <th>
                            Estado actual
                        </th>

                        <td>
                            <strong>
                                ${esc(estado)}
                            </strong>
                        </td>

                    </tr>


                    <tr>

                        <th>
                            Resultado
                        </th>

                        <td>
                            ${esc(
        normalizeText(
            postulacion.resultado
        )
    )}
                        </td>

                    </tr>


                    <tr>

                        <th>
                            Fecha de rechazo
                        </th>

                        <td>
                            ${esc(
        formatDate(
            postulacion.fecha_rechazo
        )
    )}
                        </td>

                    </tr>


                    <tr>

                        <th>
                            Etapa del rechazo
                        </th>

                        <td>
                            ${esc(etapa)}
                        </td>

                    </tr>


                    <tr>

                        <th>
                            Motivo de rechazo
                        </th>

                        <td>
                            ${esc(motivo)}
                        </td>

                    </tr>


                    <tr>

                        <th>
                            Experiencia registrada
                        </th>

                        <td>
                            ${esc(
        normalizeText(
            postulacion.experiencia
        )
    )}
                        </td>

                    </tr>


                    <tr>

                        <th>
                            Descripción
                        </th>

                        <td>
                            ${esc(
        normalizeText(
            postulacion.descripcion
        )
    )}
                        </td>

                    </tr>

                </tbody>

            </table>


            <!-- ============================================
                 HISTORIAL DEL PROCESO
                 ============================================ -->

            <h4 style="margin-top:25px;">
                Historial del proceso
            </h4>


            ${
        historialProceso.length
            ? `
                        <table>

                            <thead>

                                <tr>
                                    <th>
                                        Fecha
                                    </th>

                                    <th>
                                        Estado anterior
                                    </th>

                                    <th>
                                        Estado nuevo
                                    </th>

                                    <th>
                                        Detalle
                                    </th>

                                    <th>
                                        Responsable
                                    </th>
                                </tr>

                            </thead>

                            <tbody>

                                ${
                historialProceso
                    .map(h => `
                                            <tr>

                                                <td>
                                                    ${esc(
                        formatDateTime(
                            h.creado_en
                        )
                    )}
                                                </td>

                                                <td>
                                                    ${esc(
                        normalizeText(
                            h.estado_anterior
                        )
                    )}
                                                </td>

                                                <td>
                                                    ${esc(
                        normalizeText(
                            h.estado_nuevo
                        )
                    )}
                                                </td>

                                                <td>
                                                    ${esc(
                        normalizeText(
                            h.detalle
                        )
                    )}
                                                </td>

                                                <td>
                                                    ${esc(
                        normalizeText(
                            h.usuario
                        )
                    )}
                                                </td>

                                            </tr>
                                        `)
                    .join('')
            }

                            </tbody>

                        </table>
                    `
            : `
                        <p>
                            No existe historial de cambios
                            registrado para esta postulación.
                        </p>
                    `
    }


            <!-- ============================================
                 REPORTE DE RRHH
                 ============================================ -->

            <h4 style="margin-top:25px;">
                Verificación de Recursos Humanos
            </h4>


            ${
        postulacion.reporte_rrhh
            ? `

                        <table>

                            <tbody>

                                <tr>

                                    <th>
                                        Responsable
                                    </th>

                                    <td>
                                        ${esc(
                normalizeText(
                    postulacion
                        .reporte_rrhh
                        .nombre_rrhh
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Concepto
                                    </th>

                                    <td>
                                        ${esc(
                normalizeText(
                    postulacion
                        .reporte_rrhh
                        .concepto
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Fortalezas
                                    </th>

                                    <td>
                                        ${esc(
                normalizeText(
                    postulacion
                        .reporte_rrhh
                        .fortalezas
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Aspectos a considerar
                                    </th>

                                    <td>
                                        ${esc(
                normalizeText(
                    postulacion
                        .reporte_rrhh
                        .aspectos_considerar
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Recomendación
                                    </th>

                                    <td>
                                        ${esc(
                normalizeText(
                    postulacion
                        .reporte_rrhh
                        .recomendacion
                )
            )}
                                    </td>

                                </tr>

                            </tbody>

                        </table>

                    `
            : `
                        <p>
                            No existe reporte de Recursos Humanos
                            registrado.
                        </p>
                    `
    }


            <!-- ============================================
                 DOCUMENTOS
                 ============================================ -->

            <h4 style="margin-top:25px;">
                Documentos registrados
            </h4>


            ${
        documentos.length
            ? `

                        <table>

                            <thead>

                                <tr>

                                    <th>
                                        Documento
                                    </th>

                                    <th>
                                        Tipo
                                    </th>

                                    <th>
                                        Estado
                                    </th>

                                    <th>
                                        Observación
                                    </th>

                                    <th>
                                        Fecha de revisión
                                    </th>

                                </tr>

                            </thead>

                            <tbody>

                                ${
                documentos
                    .map(d => `
                                            <tr>

                                                <td>
                                                    ${esc(
                        normalizeText(
                            d.nombre_documento
                        )
                    )}
                                                </td>

                                                <td>
                                                    ${esc(
                        normalizeText(
                            d.tipo_documento
                        )
                    )}
                                                </td>

                                                <td>
                                                    ${esc(
                        normalizeText(
                            d.estado
                        )
                    )}
                                                </td>

                                                <td>
                                                    ${esc(
                        normalizeText(
                            d.observacion
                        )
                    )}
                                                </td>

                                                <td>
                                                    ${esc(
                        formatDateTime(
                            d.fecha_revision
                        )
                    )}
                                                </td>

                                            </tr>
                                        `)
                    .join('')
            }

                            </tbody>

                        </table>

                    `
            : `
                        <p>
                            No hay documentos registrados.
                        </p>
                    `
    }


            <!-- ============================================
                 ENTREVISTA
                 ============================================ -->

            <h4 style="margin-top:25px;">
                Entrevista
            </h4>


            ${
        entrevista
            ? `

                        <table>

                            <tbody>

                                <tr>

                                    <th>
                                        Fecha
                                    </th>

                                    <td>
                                        ${esc(
                formatDateTime(
                    entrevista
                        .fecha_entrevista
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Modalidad
                                    </th>

                                    <td>
                                        ${esc(
                normalizeText(
                    entrevista.modalidad
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Estado
                                    </th>

                                    <td>
                                        ${esc(
                normalizeText(
                    entrevista.estado
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Entrevistador
                                    </th>

                                    <td>
                                        ${esc(
                normalizeText(
                    entrevista.entrevistador
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Calificación
                                    </th>

                                    <td>
                                        ${esc(
                normalizeText(
                    entrevista.calificacion
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Resultado
                                    </th>

                                    <td>
                                        ${esc(
                normalizeText(
                    entrevista
                        .evaluacion
                        ?.resultado
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Motivo de rechazo
                                    </th>

                                    <td>
                                        ${esc(
                normalizeText(
                    entrevista
                        .evaluacion
                        ?.motivoRechazo
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Observaciones
                                    </th>

                                    <td>
                                        ${esc(
                normalizeText(
                    entrevista
                        .evaluacion
                        ?.observaciones ||
                    entrevista.observacion
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Fortalezas
                                    </th>

                                    <td>
                                        ${esc(
                normalizeText(
                    entrevista
                        .evaluacion
                        ?.fortalezas
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Aspectos por mejorar
                                    </th>

                                    <td>
                                        ${esc(
                normalizeText(
                    entrevista
                        .evaluacion
                        ?.aspectosMejora
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Recomendación
                                    </th>

                                    <td>
                                        ${esc(
                normalizeText(
                    entrevista
                        .evaluacion
                        ?.recomendacion
                )
            )}
                                    </td>

                                </tr>

                            </tbody>

                        </table>

                    `
            : `
                        <p>
                            No existe entrevista registrada
                            para esta postulación.
                        </p>
                    `
    }


            <!-- ============================================
                 EXÁMENES
                 ============================================ -->

            <h4 style="margin-top:25px;">
                Exámenes médicos
            </h4>


            ${
        examen
            ? `

                        <table>

                            <tbody>

                                <tr>

                                    <th>
                                        Fecha
                                    </th>

                                    <td>
                                        ${esc(
                formatDate(
                    examen.fecha
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Hora
                                    </th>

                                    <td>
                                        ${esc(
                formatTime(
                    examen.hora
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Lugar
                                    </th>

                                    <td>
                                        ${esc(
                normalizeText(
                    examen.lugar
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Estado
                                    </th>

                                    <td>
                                        ${esc(
                normalizeText(
                    examen.estado
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Resultado
                                    </th>

                                    <td>
                                        ${esc(
                normalizeText(
                    examen.resultado
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Motivo de rechazo
                                    </th>

                                    <td>
                                        ${esc(
                normalizeText(
                    examen.motivo_rechazo
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Observaciones de RRHH
                                    </th>

                                    <td>
                                        ${esc(
                normalizeText(
                    examen.observaciones_rrhh
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Fecha de verificación
                                    </th>

                                    <td>
                                        ${esc(
                formatDateTime(
                    examen.fecha_verificacion
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Verificado por
                                    </th>

                                    <td>
                                        ${esc(
                normalizeText(
                    examen
                        .verificado_por_nombre
                )
            )}
                                    </td>

                                </tr>

                            </tbody>

                        </table>

                    `
            : `
                        <p>
                            No existen exámenes registrados
                            para esta postulación.
                        </p>
                    `
    }


            <!-- ============================================
                 CONTRATO
                 ============================================ -->

            <h4 style="margin-top:25px;">
                Información de contrato
            </h4>


            ${
        contrato
            ? `

                        <table>

                            <tbody>

                                <tr>

                                    <th>
                                        Fecha de contratación
                                    </th>

                                    <td>
                                        ${esc(
                formatDate(
                    postulacion
                        .fecha_contratacion
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Fecha de firma
                                    </th>

                                    <td>
                                        ${esc(
                formatDate(
                    postulacion
                        .fecha_firma_programada ||
                    contrato.fecha_firma_programada
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Hora de firma
                                    </th>

                                    <td>
                                        ${esc(
                formatTime(
                    postulacion.hora_firma ||
                    contrato.hora_firma
                )
            )}
                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Lugar
                                    </th>

                                    <td>
                                        ${esc(
                normalizeText(
                    postulacion.lugar_firma ||
                    contrato.lugar_firma
                )
            )}
                                    </td>

                                </tr>

                            </tbody>

                        </table>

                    `
            : `
                        <p>
                            No existe contrato registrado
                            para esta postulación.
                        </p>
                    `
    }

        </article>

    `;
}


// ============================================================
// REPORTE 2
// CONSULTAR ESTADÍSTICAS
// ============================================================

async function cargarEstadisticas() {

    hideAlert();

    btnConsultar.disabled = true;

    try {

        const params =
            new URLSearchParams();

        if (desde.value) {
            params.set(
                'desde',
                desde.value
            );
        }

        if (hasta.value) {
            params.set(
                'hasta',
                hasta.value
            );
        }


        const data =
            await api(
                `/api/reportes/detallado?${params.toString()}`
            );


        renderResumen(data.resumen);

        renderGenero(data.genero);

        renderMensual(data.mensual);

        renderSemanal(data.semanal);

        renderSedes(data.sedeGenero);

        renderCargos(data.porCargo);

        renderEstados(data.estados);

        renderSedeGenero(data.sedeGenero);

        renderHistory(data.historial);

    } catch (error) {

        showAlert(error.message);

    } finally {

        btnConsultar.disabled = false;

    }
}


// ============================================================
// REPORTE 2
// RESUMEN
// ============================================================

function renderResumen(data = {}) {

    summary.innerHTML = `

        <div class="stat-box">

            <div class="stat-num">
                ${esc(data.total || 0)}
            </div>

            <div class="stat-label">
                Total postulaciones
            </div>

        </div>


        <div class="stat-box">

            <div class="stat-num">
                ${esc(data.en_proceso || 0)}
            </div>

            <div class="stat-label">
                En proceso
            </div>

        </div>


        <div class="stat-box">

            <div class="stat-num">
                ${esc(data.rechazados || 0)}
            </div>

            <div class="stat-label">
                Rechazados
            </div>

        </div>


        <div class="stat-box">

            <div class="stat-num">
                ${esc(data.contratados || 0)}
            </div>

            <div class="stat-label">
                Contratados
            </div>

        </div>


        <div class="stat-box">

            <div class="stat-num">
                ${esc(data.hombres || 0)}
            </div>

            <div class="stat-label">
                Hombres
            </div>

        </div>


        <div class="stat-box">

            <div class="stat-num">
                ${esc(data.mujeres || 0)}
            </div>

            <div class="stat-label">
                Mujeres
            </div>

        </div>

    `;
}


// ============================================================
// REPORTE 2
// GÉNERO
// ============================================================

function renderGenero(data = []) {

    const total =
        data.reduce(
            (sum, item) =>
                sum + Number(item.cantidad || 0),
            0
        );


    genero.innerHTML =
        data.length
            ? data.map(item => `

                <tr>

                    <td>
                        ${esc(
                normalizeText(
                    item.sexo
                )
            )}
                    </td>

                    <td>
                        ${esc(
                item.cantidad || 0
            )}
                    </td>

                    <td>
                        ${percentage(
                item.cantidad,
                total
            )}
                    </td>

                </tr>

            `).join('')
            : emptyRow(3);

}


// ============================================================
// REPORTE 2
// MES
// ============================================================

function renderMensual(data = []) {

    monthly.innerHTML =
        data.length
            ? data.map(item => `

                <tr>

                    <td>
                        ${esc(
                item.periodo
            )}
                    </td>

                    <td>
                        ${esc(
                item.cantidad
            )}
                    </td>

                </tr>

            `).join('')
            : emptyRow(2);

}


// ============================================================
// REPORTE 2
// SEMANA
// ============================================================

function renderSemanal(data = []) {

    weekly.innerHTML =
        data.length
            ? data.map(item => `

                <tr>

                    <td>
                        Semana
                    </td>

                    <td>
                        ${esc(
                formatDate(
                    item.semana_inicio
                )
            )}
                    </td>

                    <td>
                        ${esc(
                formatDate(
                    item.semana_fin
                )
            )}
                    </td>

                    <td>
                        ${esc(
                item.cantidad
            )}
                    </td>

                </tr>

            `).join('')
            : emptyRow(4);

}


// ============================================================
// REPORTE 2
// SEDES
// ============================================================

function renderSedes(data = []) {

    sedes.innerHTML =
        data.length
            ? data.map(item => `

                <tr>

                    <td>
                        ${esc(
                normalizeText(
                    item.sede
                )
            )}
                    </td>

                    <td>
                        ${esc(
                item.hombres || 0
            )}
                    </td>

                    <td>
                        ${esc(
                item.mujeres || 0
            )}
                    </td>

                    <td>
                        ${esc(
                item.total || 0
            )}
                    </td>

                </tr>

            `).join('')
            : emptyRow(4);

}


// ============================================================
// REPORTE 2
// CARGOS
// ============================================================

function renderCargos(data = []) {

    cargos.innerHTML =
        data.length
            ? data.map(item => `

                <tr>

                    <td>
                        ${esc(
                normalizeText(
                    item.cargo
                )
            )}
                    </td>

                    <td>
                        ${esc(
                item.cantidad
            )}
                    </td>

                </tr>

            `).join('')
            : emptyRow(2);

}


// ============================================================
// REPORTE 2
// ESTADOS
// ============================================================

function renderEstados(data = []) {

    states.innerHTML =
        data.length
            ? data.map(item => `

                <tr>

                    <td>
                        ${esc(
                normalizeText(
                    item.estado
                )
            )}
                    </td>

                    <td>
                        ${esc(
                item.cantidad
            )}
                    </td>

                </tr>

            `).join('')
            : emptyRow(2);

}


// ============================================================
// REPORTE 2
// SEDE + GÉNERO
// ============================================================

function renderSedeGenero(data = []) {

    sedeGenero.innerHTML =
        data.length
            ? data.map(item => `

                <tr>

                    <td>
                        ${esc(
                normalizeText(
                    item.sede
                )
            )}
                    </td>

                    <td>
                        ${esc(
                item.hombres || 0
            )}
                    </td>

                    <td>
                        ${esc(
                item.mujeres || 0
            )}
                    </td>

                    <td>
                        ${esc(
                item.total || 0
            )}
                    </td>

                </tr>

            `).join('')
            : emptyRow(4);

}


// ============================================================
// REPORTE 2
// HISTORIAL GENERAL
// ============================================================

function renderHistory(data = []) {

    history.innerHTML =
        data.length
            ? data.map(item => `

                <tr>

                    <td>
                        ${esc(
                normalizeText(
                    item.nombre_completo
                )
            )}
                    </td>

                    <td>
                        ${esc(
                `${item.tipo_documento || ''} ${item.numero_documento || ''}`.trim()
            )}
                    </td>

                    <td>
                        ${esc(
                normalizeText(
                    item.sexo
                )
            )}
                    </td>

                    <td>
                        ${esc(
                formatDate(
                    item.fecha_postulacion
                )
            )}
                    </td>

                    <td>
                        ${esc(
                normalizeText(
                    item.cargo
                )
            )}
                    </td>

                    <td>
                        ${esc(
                normalizeText(
                    item.sede
                )
            )}
                    </td>

                    <td>
                        ${esc(
                normalizeText(
                    item.estado
                )
            )}
                    </td>

                </tr>

            `).join('')
            : emptyRow(7);

}


// ============================================================
// PDF REPORTE INDIVIDUAL
// ============================================================

function generarPdfHistorial() {

    const id =
        btnPdfHistorial.dataset.idAspirante;

    if (!id) {

        showAlert(
            'Primero consulte el historial de un aspirante.'
        );

        return;
    }


    const url =
        `/api/reportes/historial/${encodeURIComponent(id)}/pdf`;

    window.location.href = url;

}


// ============================================================
// PDF ESTADÍSTICAS
// ============================================================

function generarPdfEstadisticas() {

    const params =
        new URLSearchParams();

    if (desde.value) {

        params.set(
            'desde',
            desde.value
        );

    }

    if (hasta.value) {

        params.set(
            'hasta',
            hasta.value
        );

    }


    params.set(
        'tipo',
        'Estadísticas del proceso de selección'
    );


    window.location.href =
        `/api/reportes/estadisticas/pdf?${params.toString()}`;

}


// ============================================================
// EVENTOS
// ============================================================

btnConsultarHistorial
    ?.addEventListener(
        'click',
        consultarHistorial
    );


btnPdfHistorial
    ?.addEventListener(
        'click',
        generarPdfHistorial
    );


btnConsultar
    ?.addEventListener(
        'click',
        cargarEstadisticas
    );


btnPdf
    ?.addEventListener(
        'click',
        generarPdfEstadisticas
    );


// ============================================================
// MENÚ HAMBURGUESA
// ============================================================

document
    .getElementById('menuToggle')
    ?.addEventListener(
        'click',
        () => {

            document
                .querySelector('.nav-list')
                ?.classList.toggle('open');

        }
    );


// ============================================================
// INICIALIZACIÓN
// ============================================================

(async function init() {
    try {

        // Página de historial individual
        if (aspiranteReporte) {
            await cargarAspirantes();
        }

        // Página de estadísticas
        if (btnConsultar) {
            await cargarEstadisticas();
        }

    } catch (error) {
        showAlert(error.message);
    }
})();