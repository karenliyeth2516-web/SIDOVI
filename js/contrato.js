// ============================================================
// SIDOVI - GESTIÓN DE CONTRATOS
// ============================================================

const form = document.getElementById('contratoForm');

const proximosBody = document.getElementById('proximosContratoBody');
const contratadosBody = document.getElementById('contratadosBody');

const alertBox = document.getElementById('contratoAlert');

const modal = document.getElementById('contratoModal');
const cerrarModal = document.getElementById('cerrarContratoModal');

const datosCandidato = document.getElementById('datosCandidatoContrato');

const contratoId = document.getElementById('contratoId');
const postulacion = document.getElementById('postulacionContrato');

const tipoContrato = document.getElementById('tipoContrato');
const salario = document.getElementById('salario');
const fechaInicio = document.getElementById('fechaInicio');
const fechaFin = document.getElementById('fechaFin');

const fechaFirma = document.getElementById('fechaFirma');
const horaFirma = document.getElementById('horaFirma');
const lugarFirma = document.getElementById('lugarFirma');
const direccionFirma = document.getElementById('direccionFirma');

const observaciones = document.getElementById('observaciones');
const mensajeFirma = document.getElementById('mensajeFirma');

const guardarContrato = document.getElementById('guardarContrato');
const cancelarContrato = document.getElementById('cancelarContrato');
const programarFirma = document.getElementById('programarFirma');

const contratoDocumento = document.getElementById('contratoDocumento');
const cerrarDocumento = document.getElementById('cerrarDocumento');
const exportarPDF = document.getElementById('exportarPDF');
const imprimirContrato = document.getElementById('imprimirContrato');


// ============================================================
// DATOS DEL CANDIDATO
// ============================================================

const datoNombre = document.getElementById('datoNombreCandidato');
const datoDocumento = document.getElementById('datoDocumentoCandidato');
const datoCorreo = document.getElementById('datoCorreoCandidato');
const datoTelefono = document.getElementById('datoTelefonoCandidato');
const datoCargo = document.getElementById('datoCargoCandidato');
const datoSede = document.getElementById('datoSedeCandidato');
const datoEstado = document.getElementById('datoEstadoCandidato');


// ============================================================
// DATOS INTERNOS
// ============================================================

let postulaciones = [];
let contratos = [];
let trabajadores = [];


// ============================================================
// UTILIDADES
// ============================================================

function esc(value = '') {

    const div = document.createElement('div');

    div.textContent = value;

    return div.innerHTML;
}


function mostrarAlerta(message, type = 'error') {

    if (!alertBox) return;

    alertBox.textContent = message;

    alertBox.className = `form-alert ${type}`;

    alertBox.hidden = false;

    setTimeout(() => {

        alertBox.hidden = true;

    }, 5000);
}


function ocultarAlerta() {

    if (!alertBox) return;

    alertBox.hidden = true;

    alertBox.textContent = '';

}


async function api(url, options = {}) {

    const response = await fetch(url, options);

    let data = null;

    const contentType =
        response.headers.get('content-type') || '';

    if (response.status !== 204) {

        if (contentType.includes('application/json')) {

            data = await response.json();

        } else {

            const texto = await response.text();

            data = {
                error:
                    texto ||
                    'Respuesta inesperada del servidor.'
            };

        }

    }

    if (!response.ok) {

        throw new Error(
            data?.error ||
            'No fue posible completar la operación.'
        );

    }

    return data;

}


// ============================================================
// FORMATEADORES
// ============================================================

function formatearSalario(valor) {

    return `$${Number(valor || 0).toLocaleString('es-CO')} COP`;

}


function formatearFecha(fecha) {

    if (!fecha) return '—';

    const fechaTexto =
        String(fecha).slice(0, 10);

    const partes =
        fechaTexto.split('-');

    if (partes.length !== 3) {

        return fechaTexto;

    }

    return `${partes[2]}/${partes[1]}/${partes[0]}`;

}


function hoy() {

    return new Date()
        .toISOString()
        .slice(0, 10);

}


// ============================================================
// NORMALIZAR TELÉFONO PARA WHATSAPP
// ============================================================

function normalizarTelefonoWhatsApp(telefono) {

    if (!telefono) return '';

    let numero =
        String(telefono)
            .replace(/\D/g, '');

    // Si ya viene como 57 + número colombiano
    if (
        numero.length === 12 &&
        numero.startsWith('57')
    ) {

        return numero;

    }

    // Número colombiano de 10 dígitos
    if (
        numero.length === 10 &&
        numero.startsWith('3')
    ) {

        return `57${numero}`;

    }

    // Si viene con 57 pero sin formato exacto
    if (
        numero.startsWith('57') &&
        numero.length >= 11
    ) {

        return numero;

    }

    return numero;

}


// ============================================================
// ABRIR WHATSAPP
// ============================================================

function abrirWhatsApp(telefono, mensaje) {

    const numero =
        normalizarTelefonoWhatsApp(telefono);

    if (!numero) {

        mostrarAlerta(
            'El candidato no tiene un número de teléfono válido para WhatsApp.'
        );

        return false;

    }

    const url =
        `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;

    const ventana =
        window.open(url, '_blank');

    if (!ventana) {

        mostrarAlerta(
            'El navegador bloqueó la ventana de WhatsApp. Permite ventanas emergentes para este sitio.'
        );

        return false;

    }

    return true;

}


// ============================================================
// MODAL
// ============================================================

function abrirModal() {

    if (!modal) return;

    modal.hidden = false;

    document.body.style.overflow = 'hidden';

}


function cerrarModalContrato() {

    if (!modal) return;

    modal.hidden = true;

    document.body.style.overflow = '';

}


cerrarModal?.addEventListener(
    'click',
    cerrarModalContrato
);


cancelarContrato?.addEventListener(
    'click',
    cerrarModalContrato
);


// Cerrar haciendo clic en el fondo
modal?.addEventListener(
    'click',
    (event) => {

        if (event.target === modal) {

            cerrarModalContrato();

        }

    }
);


// ESC para cerrar
document.addEventListener(
    'keydown',
    (event) => {

        if (
            event.key === 'Escape' &&
            modal &&
            !modal.hidden
        ) {

            cerrarModalContrato();

        }

    }
);


// ============================================================
// REINICIAR FORMULARIO
// ============================================================

function resetForm() {

    form?.reset();

    contratoId.value = '';

    postulacion.disabled = false;

    tipoContrato.value =
        'Término Fijo';

    salario.value =
        '1423500';

    fechaInicio.value =
        hoy();

    fechaFin.value =
        '';

    fechaFirma.value =
        '';

    horaFirma.value =
        '';

    lugarFirma.value =
        '';

    direccionFirma.value =
        '';

    observaciones.value =
        '';

    guardarContrato.textContent =
        'Generar contrato';

    cancelarContrato.hidden =
        false;

    datosCandidato.hidden =
        true;

    contratoDocumento.hidden =
        true;

    if (programarFirma) {

        programarFirma.hidden =
            false;

        programarFirma.disabled =
            false;

        programarFirma.textContent =
            'Enviar mensaje';

    }

    ocultarAlerta();

}


// ============================================================
// CARGAR POSTULACIONES PRÓXIMAS A CONTRATO
// ============================================================

async function cargarPostulaciones() {

    try {

        const resultados =
            await Promise.all([

                api(
                    '/api/postulaciones?estado=PENDIENTE_CONTRATO'
                ),

                api(
                    '/api/postulaciones?estado=FIRMA_CONTRATO_AGENDADA'
                )

            ]);


        const pendientes =
            Array.isArray(resultados[0])
                ? resultados[0]
                : (resultados[0]?.postulaciones || []);


        const firmas =
            Array.isArray(resultados[1])
                ? resultados[1]
                : (resultados[1]?.postulaciones || []);


        postulaciones = [
            ...pendientes,
            ...firmas
        ];


        console.log(
            'POSTULACIONES PARA CONTRATO:',
            postulaciones
        );


        pintarPostulaciones();


    } catch (error) {

        console.error(
            'Error cargando postulaciones:',
            error
        );


        proximosBody.innerHTML = `
      <tr>
        <td colspan="6" class="sin-registros">
          ${esc(error.message)}
        </td>
      </tr>
    `;

    }

}


// ============================================================
// TABLA PERSONAS PRÓXIMAS A CONTRATO
// ============================================================

function pintarPostulaciones() {

    if (!postulaciones.length) {

        proximosBody.innerHTML = `
      <tr>
        <td colspan="6" class="sin-registros">
          No hay personas pendientes de contratación.
        </td>
      </tr>
    `;

        return;

    }


    proximosBody.innerHTML =
        postulaciones.map(item => {

            const estado =
                String(
                    item.estado || ''
                ).toUpperCase();


            const esFirma =
                estado ===
                'FIRMA_CONTRATO_AGENDADA';


            const textoEstado =
                esFirma
                    ? 'Firma programada'
                    : 'Pendiente de contrato';


            const claseEstado =
                esFirma
                    ? 'estado-activo'
                    : 'estado-pendiente';


            let informacionFirma =
                '';


            if (esFirma) {

                informacionFirma = `
            <div class="info-firma-contrato">

              <strong>
                ${esc(
                    formatearFecha(
                        item.fecha_firma_programada
                    )
                )}
              </strong>

              <span>
                ${esc(
                    item.hora_firma ||
                    'Sin hora'
                )}
              </span>

              <small>
                ${esc(
                    item.lugar_firma ||
                    'Sin lugar'
                )}
              </small>

              ${
                    item.direccion_firma
                        ? `
                      <small>
                        ${esc(
                            item.direccion_firma
                        )}
                      </small>
                    `
                        : ''
                }

            </div>
          `;

            }


            const boton =
                esFirma

                    ? `
                  <button
                    type="button"
                    class="btn-contrato btn-generar"
                    data-generar="${item.id_postulacion}"
                  >
                    Generar contrato
                  </button>
                `

                    : `
                  <button
                    type="button"
                    class="btn-contrato btn-programar"
                    data-programar="${item.id_postulacion}"
                  >
                    Programar firma
                  </button>
                `;


            return `
          <tr>

            <td>
              <strong>
                ${esc(
                item.nombre_completo ||
                'Sin nombre'
            )}
              </strong>
            </td>

            <td>
              ${esc(
                item.numero_documento ||
                '—'
            )}
            </td>

            <td>
              ${esc(
                item.cargo ||
                item.nombre_cargo ||
                '—'
            )}
            </td>

            <td>
              ${esc(
                item.nombre_sede ||
                'Sin sede'
            )}
            </td>

            <td>

              <span
                class="estado-contrato ${claseEstado}"
              >
                ${esc(textoEstado)}
              </span>

              ${informacionFirma}

            </td>

            <td>

              <div class="acciones-contrato">

                ${boton}

              </div>

            </td>

          </tr>
        `;

        }).join('');

}


// ============================================================
// SELECCIONAR PERSONA DESDE TABLA
// ============================================================

proximosBody?.addEventListener(
    'click',
    async (event) => {

        const botonGenerar =
            event.target.closest(
                '[data-generar]'
            );


        const botonProgramar =
            event.target.closest(
                '[data-programar]'
            );


        if (botonProgramar) {

            const id =
                botonProgramar.dataset.programar;

            await abrirContratoParaPostulacion(
                id,
                'programar'
            );

            return;

        }


        if (botonGenerar) {

            const id =
                botonGenerar.dataset.generar;

            await abrirContratoParaPostulacion(
                id,
                'generar'
            );

        }

    }
);


// ============================================================
// ABRIR GENERACIÓN / PROGRAMACIÓN
// ============================================================

async function abrirContratoParaPostulacion(
    idPostulacion,
    modo = 'generar'
) {

    resetForm();

    abrirModal();

    postulacion.value =
        String(idPostulacion);

    await cargarPostulacionSeleccionada(
        idPostulacion,
        modo
    );

}


// ============================================================
// CARGAR DATOS DEL CANDIDATO
// ============================================================

async function cargarPostulacionSeleccionada(
    idForzado = null,
    modo = 'generar'
) {

    const id =
        idForzado ||
        postulacion.value;


    if (!id) {

        datosCandidato.hidden =
            true;

        return;

    }


    try {

        const candidato =
            await api(
                `/api/postulaciones/${id}`
            );


        // --------------------------------------------------------
        // DATOS PERSONALES
        // --------------------------------------------------------

        datoNombre.textContent =
            candidato.nombre_completo ||
            '—';


        datoDocumento.textContent =
            candidato.numero_documento ||
            '—';


        datoCorreo.textContent =
            candidato.correo ||
            '—';


        datoTelefono.textContent =
            candidato.telefono ||
            '—';


        datoCargo.textContent =
            candidato.cargo ||
            candidato.nombre_cargo ||
            '—';


        datoSede.textContent =
            candidato.nombre_sede ||
            '—';


        datoEstado.textContent =
            candidato.estado ||
            '—';


        datosCandidato.hidden =
            false;


        // --------------------------------------------------------
        // CARGAR DATOS DE FIRMA GUARDADOS
        // --------------------------------------------------------

        if (candidato.fecha_firma_programada) {

            fechaFirma.value =
                String(
                    candidato.fecha_firma_programada
                ).slice(0, 10);

        }


        if (candidato.hora_firma) {

            horaFirma.value =
                String(
                    candidato.hora_firma
                ).slice(0, 5);

        }


        lugarFirma.value =
            candidato.lugar_firma ||
            '';


        direccionFirma.value =
            candidato.direccion_firma ||
            '';


        if (
            candidato.observaciones_firma
        ) {

            observaciones.value =
                candidato.observaciones_firma;

        }


        // --------------------------------------------------------
        // SI YA HAY FIRMA PROGRAMADA
        // --------------------------------------------------------

        const estado =
            String(
                candidato.estado || ''
            ).toUpperCase();


        const firmaProgramada =
            estado ===
            'FIRMA_CONTRATO_AGENDADA';


        if (firmaProgramada) {

            guardarContrato.textContent =
                'Generar contrato';


            if (programarFirma) {

                programarFirma.hidden =
                    true;

            }

        } else {

            if (programarFirma) {

                programarFirma.hidden =
                    false;

                programarFirma.disabled =
                    false;

                programarFirma.textContent =
                    'Enviar mensaje';

            }

        }


        // Actualizar mensaje
        actualizarMensajeFirma();


        // Datos para el documento
        actualizarDocumentoCandidato(
            candidato
        );


    } catch (error) {

        datosCandidato.hidden =
            true;

        mostrarAlerta(
            error.message
        );

    }

}


// Cambio manual del select
postulacion?.addEventListener(
    'change',
    () => cargarPostulacionSeleccionada()
);


// ============================================================
// DOCUMENTO DEL CONTRATO
// ============================================================

function actualizarDocumentoCandidato(
    candidato
) {

    document.getElementById(
        'docNombreTrabajador'
    ).textContent =
        candidato.nombre_completo ||
        '—';


    document.getElementById(
        'docDocumentoTrabajador'
    ).textContent =
        candidato.numero_documento ||
        '—';


    document.getElementById(
        'docCargoTrabajador'
    ).textContent =
        candidato.cargo ||
        candidato.nombre_cargo ||
        '—';


    document.getElementById(
        'docSedeTrabajador'
    ).textContent =
        candidato.nombre_sede ||
        '—';


    document.getElementById(
        'docFirmaTrabajador'
    ).textContent =
        candidato.nombre_completo ||
        'El Trabajador';


    document.getElementById(
        'docFirmaDocumento'
    ).textContent =
        candidato.numero_documento ||
        '—';

}


// ============================================================
// MOSTRAR DOCUMENTO DEL CONTRATO
// ============================================================

function mostrarDocumento(
    contrato,
    candidato
) {

    contratoDocumento.hidden =
        false;


    actualizarDocumentoCandidato(
        candidato
    );


    document.getElementById(
        'docSalario'
    ).textContent =
        formatearSalario(
            contrato.salario
        );


    document.getElementById(
        'docFechaInicio'
    ).textContent =
        formatearFecha(
            contrato.fecha_inicio
        );


    document.getElementById(
        'docFechaFin'
    ).textContent =
        contrato.fecha_fin
            ? formatearFecha(
                contrato.fecha_fin
            )
            : 'No definida';


    document.getElementById(
        'docFechaContrato'
    ).textContent =
        new Date().toLocaleDateString(
            'es-CO'
        );


    const numeroContrato =
        `COL-${new Date().getFullYear()}-` +
        `${String(
            contrato.id_contrato
        ).padStart(4, '0')}`;


    document.getElementById(
        'docNumeroContrato'
    ).textContent =
        numeroContrato;


    contratoDocumento.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });

}


// ============================================================
// GENERAR / GUARDAR CONTRATO
// ============================================================

form?.addEventListener(
    'submit',
    async (event) => {

        event.preventDefault();

        ocultarAlerta();


        const id =
            contratoId.value;


        const idPostulacion =
            Number(
                postulacion.value
            );


        const payload = {

            idPostulacion,

            fechaInicio:
            fechaInicio.value,

            fechaFin:
                fechaFin.value ||
                null,

            tipoContrato:
                tipoContrato.value.trim() ||
                'Término Fijo',

            salario:
                Number(
                    salario.value || 0
                ),

            estado:
                'Borrador',

            observaciones:
                observaciones.value.trim()

        };


        if (!idPostulacion) {

            mostrarAlerta(
                'Selecciona una persona antes de generar el contrato.'
            );

            return;

        }


        if (!payload.fechaInicio) {

            mostrarAlerta(
                'La fecha de inicio es obligatoria.'
            );

            return;

        }


        if (
            payload.fechaFin &&
            payload.fechaFin <
            payload.fechaInicio
        ) {

            mostrarAlerta(
                'La fecha de finalización no puede ser anterior a la fecha de inicio.'
            );

            return;

        }


        try {

            guardarContrato.disabled =
                true;


            guardarContrato.textContent =
                id
                    ? 'Guardando...'
                    : 'Generando...';


            let resultado;


            if (id) {

                resultado =
                    await api(
                        `/api/contratos/${id}`,
                        {
                            method: 'PATCH',

                            headers: {
                                'Content-Type':
                                    'application/json'
                            },

                            body:
                                JSON.stringify(
                                    payload
                                )
                        }
                    );

            } else {

                resultado =
                    await api(
                        '/api/contratos',
                        {
                            method: 'POST',

                            headers: {
                                'Content-Type':
                                    'application/json'
                            },

                            body:
                                JSON.stringify(
                                    payload
                                )
                        }
                    );

            }


            contratoId.value =
                resultado.id_contrato;


            const candidato =
                await api(
                    `/api/postulaciones/${idPostulacion}`
                );


            mostrarDocumento(
                resultado,
                candidato
            );


            mostrarAlerta(
                id
                    ? 'Contrato actualizado correctamente.'
                    : 'Contrato generado correctamente.',
                'success'
            );


            await cargarPostulaciones();

            await cargarTrabajadores();


        } catch (error) {

            console.error(error);

            mostrarAlerta(
                error.message
            );


        } finally {

            guardarContrato.disabled =
                false;


            guardarContrato.textContent =
                id
                    ? 'Guardar cambios'
                    : 'Generar contrato';

        }

    }
);


// ============================================================
// ACTUALIZAR MENSAJE DE FIRMA
// ============================================================

function actualizarMensajeFirma() {

    if (!mensajeFirma) return;


    const nombre =
        datoNombre?.textContent?.trim() ||
        'el candidato';


    const fecha =
        fechaFirma?.value
            ? formatearFecha(
                fechaFirma.value
            )
            : 'la fecha seleccionada';


    const hora =
        horaFirma?.value ||
        'la hora seleccionada';


    const lugar =
        lugarFirma?.value?.trim() ||
        'el lugar indicado';


    const direccion =
        direccionFirma?.value?.trim();


    const mensaje =
        `Hola ${nombre}.\n\n` +

        `Nos complace informarle que su proceso de selección ` +
        `ha avanzado satisfactoriamente.\n\n` +

        `La firma de su contrato ha sido programada para ` +
        `el día ${fecha}, a las ${hora}, ` +
        `en ${lugar}` +

        `${
            direccion
                ? `, dirección ${direccion}`
                : ''
        }.\n\n` +

        `Por favor, esté atento(a) y presente los documentos ` +
        `necesarios para realizar el proceso de firma.\n\n` +

        `Cordialmente,\n` +
        `Colviseg Ltda.`;


    mensajeFirma.value =
        mensaje;

}


// ============================================================
// ACTUALIZAR MENSAJE AL CAMBIAR DATOS
// ============================================================

fechaFirma?.addEventListener(
    'change',
    actualizarMensajeFirma
);


horaFirma?.addEventListener(
    'change',
    actualizarMensajeFirma
);


lugarFirma?.addEventListener(
    'input',
    actualizarMensajeFirma
);


direccionFirma?.addEventListener(
    'input',
    actualizarMensajeFirma
);


// ============================================================
// PROGRAMAR FIRMA + WHATSAPP
// ============================================================

programarFirma?.addEventListener(
    'click',
    async () => {

        ocultarAlerta();


        const idPostulacion =
            Number(
                postulacion.value
            );


        const fecha =
            fechaFirma.value;


        const hora =
            horaFirma.value;


        const lugar =
            lugarFirma.value.trim();


        const direccion =
            direccionFirma.value.trim();


        const observacionesTexto =
            observaciones.value.trim();


        // --------------------------------------------------------
        // VALIDACIONES
        // --------------------------------------------------------

        if (!idPostulacion) {

            mostrarAlerta(
                'No se encontró la persona seleccionada.'
            );

            return;

        }


        if (!fecha) {

            mostrarAlerta(
                'Selecciona la fecha de firma.'
            );

            return;

        }


        if (!hora) {

            mostrarAlerta(
                'Selecciona la hora de firma.'
            );

            return;

        }


        if (!lugar) {

            mostrarAlerta(
                'Indica el lugar o modalidad de firma.'
            );

            return;

        }


        // --------------------------------------------------------
        // GENERAR MENSAJE
        // --------------------------------------------------------

        actualizarMensajeFirma();


        const mensaje =
            mensajeFirma.value;


        // --------------------------------------------------------
        // OBTENER TELÉFONO
        // --------------------------------------------------------

        let telefono =
            datoTelefono?.textContent?.trim() ||
            '';


        // Si el dato mostrado no sirve, consultar nuevamente
        if (
            !telefono ||
            telefono === '—'
        ) {

            try {

                const candidato =
                    await api(
                        `/api/postulaciones/${idPostulacion}`
                    );

                telefono =
                    candidato.telefono ||
                    '';

            } catch (error) {

                mostrarAlerta(
                    'No fue posible obtener el teléfono del candidato.'
                );

                return;

            }

        }


        if (!telefono) {

            mostrarAlerta(
                'El candidato no tiene un número de teléfono registrado.'
            );

            return;

        }


        // --------------------------------------------------------
        // CONFIRMAR
        // --------------------------------------------------------

        const confirmar =
            confirm(
                '¿Deseas programar la firma y abrir WhatsApp con el mensaje preparado?'
            );


        if (!confirmar) {

            return;

        }


        // --------------------------------------------------------
        // PREPARAR VENTANA DE WHATSAPP
        // --------------------------------------------------------
        //
        // La abrimos inmediatamente después del clic del usuario
        // para evitar que el navegador la bloquee.
        // --------------------------------------------------------

        const numero =
            normalizarTelefonoWhatsApp(
                telefono
            );


        if (!numero) {

            mostrarAlerta(
                'El número de teléfono no tiene un formato válido.'
            );

            return;

        }


        const urlWhatsApp =
            `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;


        const ventanaWhatsApp =
            window.open(
                'about:blank',
                '_blank'
            );


        // --------------------------------------------------------
        // ENVIAR AL SERVIDOR
        // --------------------------------------------------------

        try {

            programarFirma.disabled =
                true;


            programarFirma.textContent =
                'Programando...';


            const resultado =
                await api(
                    '/api/contratos/agenda-firma',
                    {
                        method: 'POST',

                        headers: {
                            'Content-Type':
                                'application/json'
                        },

                        body:
                            JSON.stringify({

                                idPostulacion,

                                fecha,

                                hora,

                                lugar,

                                direccion,

                                observaciones:
                                observacionesTexto

                            })

                    }
                );


            // ------------------------------------------------------
            // ABRIR WHATSAPP
            // ------------------------------------------------------

            if (ventanaWhatsApp) {

                ventanaWhatsApp.location.href =
                    urlWhatsApp;

            } else {

                // Fallback si el navegador bloqueó la ventana
                window.open(
                    urlWhatsApp,
                    '_blank'
                );

            }


            // ------------------------------------------------------
            // MOSTRAR ÉXITO
            // ------------------------------------------------------

            mostrarAlerta(
                'Firma programada correctamente. WhatsApp se abrió con el mensaje preparado.',
                'success'
            );


            // ------------------------------------------------------
            // ACTUALIZAR DATOS DEL MODAL
            // ------------------------------------------------------

            datoEstado.textContent =
                'FIRMA_CONTRATO_AGENDADA';


            fechaFirma.value =
                fecha;


            horaFirma.value =
                hora;


            lugarFirma.value =
                lugar;


            direccionFirma.value =
                direccion;


            actualizarMensajeFirma();


            // ------------------------------------------------------
            // ACTUALIZAR TABLAS
            // ------------------------------------------------------

            await cargarPostulaciones();

            await cargarTrabajadores();


            // ------------------------------------------------------
            // CAMBIAR BOTÓN
            // ------------------------------------------------------

            programarFirma.textContent =
                'WhatsApp abierto';


            programarFirma.disabled =
                true;


            // Cerramos después de un momento
            setTimeout(
                () => {

                    cerrarModalContrato();

                },
                1800
            );


        } catch (error) {

            console.error(
                'Error programando firma:',
                error
            );


            // Si falló el servidor, cerramos la pestaña
            // que habíamos abierto en blanco.
            if (
                ventanaWhatsApp &&
                !ventanaWhatsApp.closed
            ) {

                ventanaWhatsApp.close();

            }


            mostrarAlerta(
                error.message ||
                'No fue posible programar la firma.'
            );


            programarFirma.disabled =
                false;


            programarFirma.textContent =
                'Enviar mensaje';

        }

    }
);


// ============================================================
// CARGAR CONTRATOS
// ============================================================

async function cargarContratos() {

    try {

        contratos =
            await api(
                '/api/contratos'
            );

    } catch (error) {

        console.error(
            'Error cargando contratos:',
            error
        );

    }

}


// ============================================================
// CARGAR TRABAJADORES CONTRATADOS
// ============================================================

async function cargarTrabajadores() {

    try {

        trabajadores =
            await api(
                '/api/trabajadores'
            );


        pintarTrabajadores();


    } catch (error) {

        console.error(error);


        contratadosBody.innerHTML = `
      <tr>
        <td colspan="6" class="sin-registros">
          ${esc(error.message)}
        </td>
      </tr>
    `;

    }

}


// ============================================================
// TABLA PERSONAS CONTRATADAS
// ============================================================

function pintarTrabajadores() {

    if (!trabajadores.length) {

        contratadosBody.innerHTML = `
      <tr>
        <td colspan="6" class="sin-registros">
          No hay personas contratadas registradas.
        </td>
      </tr>
    `;

        return;

    }


    contratadosBody.innerHTML =
        trabajadores.map(item => {

            const estado =
                String(
                    item.estado || ''
                ).toUpperCase();


            let claseEstado =
                'estado-borrador';


            if (
                estado === 'ACTIVO' ||
                estado === 'CONTRATADO'
            ) {

                claseEstado =
                    'estado-contratado';

            }


            return `
          <tr>

            <td>
              <strong>
                ${esc(
                item.trabajador ||
                item.nombre_completo ||
                'Sin nombre'
            )}
              </strong>
            </td>

            <td>
              ${esc(
                item.numero_documento ||
                '—'
            )}
            </td>

            <td>
              ${esc(
                item.cargo ||
                '—'
            )}
            </td>

            <td>
              ${esc(
                formatearFecha(
                    item.fecha_inicio
                )
            )}
            </td>

            <td>

              <span
                class="estado-contrato ${claseEstado}"
              >
                ${esc(
                item.estado ||
                'Borrador'
            )}
              </span>

            </td>

            <td>

              <div class="acciones-contrato">

                <button
                  type="button"
                  class="btn-contrato btn-pdf"
                  data-ver-contrato="${item.id_contrato}"
                >
                  Ver contrato
                </button>

                <button
                  type="button"
                  class="btn-contrato btn-editar"
                  data-editar-contrato="${item.id_contrato}"
                >
                  Editar
                </button>

              </div>

            </td>

          </tr>
        `;

        }).join('');

}


// ============================================================
// BOTONES DE PERSONAS CONTRATADAS
// ============================================================

contratadosBody?.addEventListener(
    'click',
    async (event) => {

        const ver =
            event.target.closest(
                '[data-ver-contrato]'
            );


        const editar =
            event.target.closest(
                '[data-editar-contrato]'
            );


        if (ver) {

            await verContrato(
                ver.dataset.verContrato
            );

            return;

        }


        if (editar) {

            await editarContrato(
                editar.dataset.editarContrato
            );

        }

    }
);


// ============================================================
// VER CONTRATO
// ============================================================

async function verContrato(id) {

    try {

        resetForm();

        abrirModal();


        const contrato =
            await api(
                `/api/contratos/${id}`
            );


        contratoId.value =
            contrato.id_contrato;


        postulacion.value =
            contrato.id_postulacion;


        postulacion.disabled =
            true;


        fechaInicio.value =
            contrato.fecha_inicio
                ?.slice(0, 10) ||
            '';


        fechaFin.value =
            contrato.fecha_fin
                ?.slice(0, 10) ||
            '';


        tipoContrato.value =
            contrato.tipo_contrato ||
            'Término Fijo';


        salario.value =
            contrato.salario ||
            0;


        fechaFirma.value =
            contrato.fecha_firma_programada
                ?.slice(0, 10) ||
            '';


        horaFirma.value =
            contrato.hora_firma
                ? String(
                    contrato.hora_firma
                ).slice(0, 5)
                : '';


        lugarFirma.value =
            contrato.lugar_firma ||
            '';


        direccionFirma.value =
            contrato.direccion_firma ||
            '';


        observaciones.value =
            contrato.observaciones ||
            '';


        actualizarMensajeFirma();


        guardarContrato.textContent =
            'Guardar cambios';


        cancelarContrato.hidden =
            false;


        if (programarFirma) {

            programarFirma.hidden =
                true;

        }


        const candidato =
            await api(
                `/api/postulaciones/${contrato.id_postulacion}`
            );


        datoNombre.textContent =
            candidato.nombre_completo ||
            '—';


        datoDocumento.textContent =
            candidato.numero_documento ||
            '—';


        datoCorreo.textContent =
            candidato.correo ||
            '—';


        datoTelefono.textContent =
            candidato.telefono ||
            '—';


        datoCargo.textContent =
            candidato.cargo ||
            candidato.nombre_cargo ||
            '—';


        datoSede.textContent =
            candidato.nombre_sede ||
            '—';


        datoEstado.textContent =
            candidato.estado ||
            '—';


        datosCandidato.hidden =
            false;


        actualizarDocumentoCandidato(
            candidato
        );


        mostrarDocumento(
            contrato,
            candidato
        );


    } catch (error) {

        mostrarAlerta(
            error.message
        );

    }

}


// ============================================================
// EDITAR CONTRATO
// ============================================================

async function editarContrato(id) {

    await verContrato(id);

}


// ============================================================
// CERRAR DOCUMENTO
// ============================================================

cerrarDocumento?.addEventListener(
    'click',
    () => {

        contratoDocumento.hidden =
            true;

    }
);


// ============================================================
// IMPRIMIR CONTRATO
// ============================================================

imprimirContrato?.addEventListener(
    'click',
    () => {

        window.print();

    }
);


// ============================================================
// EXPORTAR PDF
// ============================================================

exportarPDF?.addEventListener(
    'click',
    () => {

        window.print();

    }
);


// ============================================================
// INICIALIZACIÓN
// ============================================================

async function iniciarContratos() {

    try {

        resetForm();


        await Promise.all([

            cargarPostulaciones(),

            cargarContratos(),

            cargarTrabajadores()

        ]);


        const idURL =
            new URLSearchParams(
                window.location.search
            ).get(
                'idPostulacion'
            );


        if (idURL) {

            await abrirContratoParaPostulacion(
                idURL,
                'generar'
            );

        }


    } catch (error) {

        console.error(
            'Error inicializando contratos:',
            error
        );

    }

}


iniciarContratos();