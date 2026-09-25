
const api = (url, options = {}) =>
    fetch(url, {
        credentials: 'same-origin',
        ...options
    }).then(async response => {
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || 'Operación no válida.');
        }

        return data;
    });


const esc = value =>
    String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[character]));


let examenes = [];
let postulaciones = [];
let examenSeleccionado = null;
let examenVerificacion = null;
let postulacionFirma = null;


/* =========================================================
   INICIAR CUANDO EL HTML YA ESTÉ CARGADO
   ========================================================= */

document.addEventListener('DOMContentLoaded', iniciar);


function iniciar() {

    /* =========================================================
       ELEMENTOS
       ========================================================= */

    const agendaForm = document.getElementById('agendaForm');
    const cargaForm = document.getElementById('cargaForm');
    const verificacionForm = document.getElementById('verificacionForm');
    const firmaForm = document.getElementById('firmaForm');

    const postulacion = document.getElementById('postulacion');
    const tipos = document.getElementById('tipos');
    const fecha = document.getElementById('fecha');
    const hora = document.getElementById('hora');
    const lugar = document.getElementById('lugar');
    const direccion = document.getElementById('direccion');
    const observaciones = document.getElementById('observaciones');

    const examenCarga = document.getElementById('examenCarga');
    const nombreDocumento = document.getElementById('nombreDocumento');
    const archivo = document.getElementById('archivo');
    const obsCarga = document.getElementById('obsCarga');

    const resultadoExamen = document.getElementById('resultadoExamen');
    const motivoRechazo = document.getElementById('motivoRechazo');
    const motivoRechazoWrap = document.getElementById('motivoRechazoWrap');
    const observacionesVerificacion =
        document.getElementById('observacionesVerificacion');

    const firmaFecha = document.getElementById('firmaFecha');
    const firmaHora = document.getElementById('firmaHora');
    const firmaLugar = document.getElementById('firmaLugar');
    const firmaDireccion = document.getElementById('firmaDireccion');
    const firmaObservaciones = document.getElementById('firmaObservaciones');

    const lista = document.getElementById('lista');
    const listaFirmas = document.getElementById('listaFirmas');
    const alerta = document.getElementById('alerta');

    const resultadoModal = document.getElementById('resultadoModal');
    const verificacionModal = document.getElementById('verificacionModal');
    const firmaModal = document.getElementById('firmaModal');

    const resultadoCandidato = document.getElementById('resultadoCandidato');
    const verificacionCandidato =
        document.getElementById('verificacionCandidato');

    const firmaCandidato = document.getElementById('firmaCandidato');


    /* =========================================================
       VERIFICAR ELEMENTOS PRINCIPALES
       ========================================================= */

    const elementosFaltantes = [];

    const elementos = {
        agendaForm,
        cargaForm,
        verificacionForm,
        firmaForm,
        postulacion,
        tipos,
        fecha,
        hora,
        lugar,
        direccion,
        observaciones,
        examenCarga,
        nombreDocumento,
        archivo,
        obsCarga,
        resultadoExamen,
        motivoRechazo,
        motivoRechazoWrap,
        observacionesVerificacion,
        firmaFecha,
        firmaHora,
        firmaLugar,
        firmaDireccion,
        firmaObservaciones,
        lista,
        listaFirmas,
        alerta,
        resultadoModal,
        verificacionModal,
        firmaModal,
        resultadoCandidato,
        verificacionCandidato,
        firmaCandidato
    };

    Object.entries(elementos).forEach(([nombre, elemento]) => {
        if (!elemento) {
            elementosFaltantes.push(nombre);
        }
    });

    if (elementosFaltantes.length) {

        console.error(
            'SIDOVI: faltan elementos HTML:',
            elementosFaltantes
        );

        return;
    }


    /* =========================================================
       ALERTAS
       ========================================================= */

    function aviso(mensaje, tipo = 'success') {

        if (!alerta) return;

        alerta.textContent = mensaje;
        alerta.hidden = false;

        alerta.style.background =
            tipo === 'error'
                ? '#fdecec'
                : '#e8f6ee';

        alerta.style.color =
            tipo === 'error'
                ? '#a51d1d'
                : '#14703f';

        alerta.style.border =
            tipo === 'error'
                ? '1px solid #f5c2c0'
                : '1px solid #b7e4c7';

        setTimeout(() => {
            if (alerta) {
                alerta.hidden = true;
            }
        }, 5000);
    }


    /* =========================================================
       MODALES
       ========================================================= */

    function abrirModal(modal) {

        if (!modal) return;

        modal.hidden = false;
        document.body.style.overflow = 'hidden';
    }


    function cerrarModal(modal) {

        if (!modal) return;

        modal.hidden = true;

        if (
            resultadoModal.hidden &&
            verificacionModal.hidden &&
            firmaModal.hidden
        ) {
            document.body.style.overflow = '';
        }
    }


    document.querySelectorAll('[data-close]').forEach(button => {

        button.addEventListener('click', () => {

            const modal =
                document.getElementById(button.dataset.close);

            if (modal) {
                cerrarModal(modal);
            }

        });

    });


    document.querySelectorAll('.sidovi-modal').forEach(modal => {

        modal.addEventListener('click', event => {

            if (event.target === modal) {
                cerrarModal(modal);
            }

        });

    });


    document.addEventListener('keydown', event => {

        if (event.key !== 'Escape') return;

        [
            resultadoModal,
            verificacionModal,
            firmaModal
        ].forEach(modal => {

            if (modal && !modal.hidden) {
                cerrarModal(modal);
            }

        });

    });


    /* =========================================================
       FECHA MÍNIMA
       ========================================================= */

    function establecerFechaMinima() {

        const hoy = new Date();

        const yyyy = hoy.getFullYear();

        const mm =
            String(hoy.getMonth() + 1).padStart(2, '0');

        const dd =
            String(hoy.getDate()).padStart(2, '0');

     const fechaActual =
    yyyy + '-' + mm + '-' + dd;

        fecha.min = fechaActual;
        firmaFecha.min = fechaActual;
    }


    establecerFechaMinima();


    /* =========================================================
       CARGAR INFORMACIÓN
       ========================================================= */

    async function load() {

        try {

            const [posts, ex] = await Promise.all([

                api('/api/postulaciones'),

                api('/api/examenes')

            ]);


            postulaciones =
                Array.isArray(posts)
                    ? posts
                    : [];


            examenes =
                Array.isArray(ex)
                    ? ex
                    : [];


            console.log(
                'SIDOVI postulaciones:',
                postulaciones
            );

            console.log(
                'SIDOVI exámenes:',
                examenes
            );


            cargarCandidatosParaExamen();

            cargarExamenesParaResultados();

            pintarExamenes();

            cargarFirmas();

        } catch (error) {

            console.error(
                'Error cargando exámenes:',
                error
            );

            aviso(
                error.message,
                'error'
            );


            lista.innerHTML = `
<tr>
<td colspan="6" class="sidovi-empty">
    No fue posible cargar los exámenes.
</td>
</tr>
`;


            listaFirmas.innerHTML = `
<tr>
<td colspan="7" class="sidovi-empty">
    No fue posible cargar la información.
</td>
</tr>
`;

        }

    }


    /* =========================================================
       CANDIDATOS PARA AGENDAR EXÁMENES
       ========================================================= */

    function cargarCandidatosParaExamen() {

        const candidatos =
            postulaciones.filter(persona => {

                const estado =
                    String(persona.estado || '')
                        .trim()
                        .toUpperCase();

                return [
                    'EXAMENES_PENDIENTES',
                    'APROBADO'
                ].includes(estado);

            });


        postulacion.innerHTML = `
<option value="">
    Selecciona un candidato
</option>
    `;


        candidatos.forEach(persona => {

            const option =
                document.createElement('option');

            option.value =
                persona.id_postulacion;

            option.textContent =
                `${persona.nombre_completo || 'Sin nombre'} · ` +
                `${persona.cargo || 'Sin cargo'} ` +
                `#${persona.id_postulacion}`;

            postulacion.appendChild(option);

        });


        if (!candidatos.length) {

            postulacion.innerHTML = `
<option value="">
    No hay candidatos pendientes de exámenes
</option>
    `;

        }

    }


    /* =========================================================
       EXÁMENES PARA CARGAR RESULTADOS
       ========================================================= */

    function cargarExamenesParaResultados() {

        const disponibles =
            examenes.filter(examen => {

                const estado =
                    String(examen.estado || '')
                        .trim()
                        .toUpperCase();

                return [
                    'PROGRAMADO',
                    'EN_REVISION'
                ].includes(estado);

            });


        examenCarga.innerHTML = `
<option value="">
    Selecciona un examen
</option>
    `;


        disponibles.forEach(examen => {

            const option =
                document.createElement('option');

            option.value =
                examen.id_examen;

            option.textContent =
                `${examen.nombre_completo || 'Sin nombre'} · ` +
                `${formatearFecha(examen.fecha)} ` +
                `${formatearHora(examen.hora)}`;

            examenCarga.appendChild(option);

        });


        if (!disponibles.length) {

            examenCarga.innerHTML = `
<option value="">
    No hay resultados pendientes
</option>
    `;

        }

    }


    /* =========================================================
       TABLA DE EXÁMENES
       ========================================================= */

    function pintarExamenes() {

        if (!examenes.length) {

            lista.innerHTML = `
<tr>
<td colspan="6" class="sidovi-empty">
    No hay exámenes programados.
</td>
</tr>
`;

            return;
        }


        lista.innerHTML =
            examenes.map(examen => {

                const estado =
                    String(examen.estado || '')
                        .trim()
                        .toUpperCase();


                let claseEstado =
                    'programado';


                if (estado === 'EN_REVISION') {
                    claseEstado = 'revision';
                }


                if (estado === 'APROBADO') {
                    claseEstado = 'aprobado';
                }


                if (estado === 'RECHAZADO') {
                    claseEstado = 'rechazado';
                }


                let acciones = '—';


                if (estado === 'PROGRAMADO') {

                    acciones = `
<div class="sidovi-action-group">

    <button
type="button"
class="sidovi-btn-whatsapp"
data-whatsapp-examen="${examen.id_examen}"
    >
                                📲 WhatsApp
</button>

<button
    type="button"
    class="sidovi-btn-upload"
    data-subir="${examen.id_examen}"
>
    📄 Subir resultado
</button>

</div>
`;

                }


                if (estado === 'EN_REVISION') {

                    acciones = `
<div class="sidovi-action-group">

    <button
type="button"
class="sidovi-btn-whatsapp"
data-whatsapp-examen="${examen.id_examen}"
    >
                                📲 WhatsApp
</button>

<button
    type="button"
    class="sidovi-btn-approve"
    data-verificar="${examen.id_examen}"
>
    🔎 Verificar
</button>

</div>
`;

                }


                if (estado === 'APROBADO') {

                    acciones = `
<span style="color:#14703f;font-weight:700;">
                            ✓ Examen aprobado
</span>
    `;

                }


                if (estado === 'RECHAZADO') {

                    acciones = `
<span style="color:#a51d1d;font-weight:700;">
                            ✕ No aprobado
</span>
    `;

                }


                const tiposTexto =
                    Array.isArray(examen.tipos)
                        ? examen.tipos.join(', ')
                        : String(examen.tipos || '—');


                return `
<tr>

<td>
<strong>
${esc(examen.nombre_completo || 'Sin nombre')}
</strong>
</td>

<td>
    ${esc(formatearFecha(examen.fecha))}
    <br>
        <small>
            ${esc(formatearHora(examen.hora))}
        </small>
</td>

<td>
    ${esc(examen.lugar || '—')}
    ${
    examen.direccion
        ? `<br><small>${esc(examen.direccion)}</small>`
        : ''
}
</td>

<td>
    ${esc(tiposTexto)}
</td>

<td>
                            <span class="sidovi-status ${claseEstado}">
                                ${textoEstadoExamen(estado)}
                            </span>
</td>

<td>
    ${acciones}
</td>

</tr>
`;

            }).join('');


        document
            .querySelectorAll('[data-subir]')
            .forEach(button => {

                button.addEventListener('click', () => {

                    abrirCargaResultado(
                        button.dataset.subir
                    );

                });

            });


        document
            .querySelectorAll('[data-verificar]')
            .forEach(button => {

                button.addEventListener('click', () => {

                    abrirVerificacion(
                        button.dataset.verificar
                    );

                });

            });


        document
            .querySelectorAll('[data-whatsapp-examen]')
            .forEach(button => {

                button.addEventListener('click', () => {

                    enviarWhatsAppExamen(
                        button.dataset.whatsappExamen
                    );

                });

            });

    }


    function textoEstadoExamen(estado) {

        const estados = {

            PROGRAMADO: '📅 Programado',

            EN_REVISION: '🔎 En revisión',

            APROBADO: '✓ Aprobado',

            RECHAZADO: '✕ Rechazado'

        };

        return estados[estado] || estado;

    }


    /* =========================================================
       AGENDAR EXÁMENES
       ========================================================= */

    agendaForm.addEventListener('submit', async event => {

        event.preventDefault();


        const tiposSeleccionados =
            [...tipos.selectedOptions]
                .map(option => option.value);


        if (!postulacion.value) {

            aviso(
                'Debes seleccionar un candidato.',
                'error'
            );

            return;
        }


        if (!tiposSeleccionados.length) {

            aviso(
                'Debes seleccionar al menos un tipo de examen.',
                'error'
            );

            return;
        }


        try {

            await api('/api/examenes', {

                method: 'POST',

                headers: {
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify({

                    idPostulacion:
                        Number(postulacion.value),

                    tipos:
                        tiposSeleccionados,

                    fecha:
                        fecha.value,

                    hora:
                        hora.value,

                    lugar:
                        lugar.value,

                    direccion:
                        direccion.value,

                    observaciones:
                        observaciones.value

                })

            });


            agendaForm.reset();


            aviso(
                'Los exámenes fueron agendados correctamente.'
            );


            await load();

        } catch (error) {

            aviso(
                error.message,
                'error'
            );

        }

    });


    /* =========================================================
       WHATSAPP EXÁMENES
       ========================================================= */

    function enviarWhatsAppExamen(idExamen) {

        const examen =
            examenes.find(
                item =>
                    String(item.id_examen) ===
                    String(idExamen)
            );


        if (!examen) {

            aviso(
                'No se encontró el examen.',
                'error'
            );

            return;
        }


        const telefono =
            examen.telefono ||
            examen.celular ||
            examen.telefono_celular ||
            examen.numero_telefono ||
            '';


        if (!telefono) {

            aviso(
                'El candidato no tiene un número de teléfono registrado.',
                'error'
            );

            return;
        }


        const nombre =
            examen.nombre_completo ||
            'candidato';


        const mensaje =
            `Hola ${nombre}, te informamos que tus exámenes médicos ` +
            `han sido programados para el día ` +
            `${formatearFecha(examen.fecha)} ` +
            `a las ${formatearHora(examen.hora)}. ` +
            `Lugar: ${examen.lugar || 'por confirmar'}. ` +
            `${
    examen.direccion
        ? `Dirección: ${examen.direccion}. `
        : ''
}` +
            `Por favor asistir puntualmente. ` +
            `Gracias, Colviseg.`;


        abrirWhatsApp(
            telefono,
            mensaje
        );

    }


    /* =========================================================
       ABRIR SUBIR RESULTADO
       ========================================================= */

    function abrirCargaResultado(idExamen) {

        examenSeleccionado =
            examenes.find(
                examen =>
                    String(examen.id_examen) ===
                    String(idExamen)
            );


        if (!examenSeleccionado) {

            aviso(
                'No se encontró el examen seleccionado.',
                'error'
            );

            return;
        }


        resultadoCandidato.innerHTML = `
<strong>
${esc(examenSeleccionado.nombre_completo)}
</strong>

<span>
                ${esc(formatearFecha(examenSeleccionado.fecha))}
    ·
                ${esc(formatearHora(examenSeleccionado.hora))}
    ·
                ${esc(examenSeleccionado.lugar)}
            </span>
    `;


        cargaForm.reset();


        examenCarga.value =
            examenSeleccionado.id_examen;


        abrirModal(resultadoModal);

    }


    /* =========================================================
       SUBIR RESULTADO
       ========================================================= */

    cargaForm.addEventListener('submit', event => {

        event.preventDefault();


        const file =
            archivo.files[0];


        if (!file) {

            aviso(
                'Selecciona el archivo del resultado.',
                'error'
            );

            return;
        }


        if (file.size > 8 * 1024 * 1024) {

            aviso(
                'El archivo supera 8 MB.',
                'error'
            );

            return;
        }


        const reader =
            new FileReader();


        reader.onload = async () => {

            try {

                await api(
                    `/api/examenes/${examenCarga.value}/documentos`,
{

    method: 'POST',

        headers: {
    'Content-Type':
    'application/json'
},

    body: JSON.stringify({

        nombreDocumento:
        nombreDocumento.value,

        tipoDocumento:
        file.type,

        archivo:
        reader.result,

        observaciones:
        obsCarga.value

    })

}
);


cerrarModal(
    resultadoModal
);


aviso(
    'Resultado cargado correctamente. Ahora puedes verificarlo.'
);


await load();

} catch (error) {

    aviso(
        error.message,
        'error'
    );

}

};


reader.readAsDataURL(file);

});


/* =========================================================
   ABRIR VERIFICACIÓN
   ========================================================= */

function abrirVerificacion(idExamen) {

    examenVerificacion =
        examenes.find(
            examen =>
                String(examen.id_examen) ===
                String(idExamen)
        );


    if (!examenVerificacion) {

        aviso(
            'No se encontró el examen seleccionado.',
            'error'
        );

        return;
    }


    verificacionCandidato.innerHTML = `
            <strong>
                ${esc(examenVerificacion.nombre_completo)}
            </strong>

            <span>
                Exámenes realizados ·
                ${esc(formatearFecha(examenVerificacion.fecha))}
            </span>
        `;


    verificacionForm.reset();


    motivoRechazoWrap.hidden = true;

    motivoRechazo.required = false;


    abrirModal(
        verificacionModal
    );

}


/* =========================================================
   MOTIVO DE RECHAZO
   ========================================================= */

resultadoExamen.addEventListener(
    'change',
    () => {

        const rechazado =
            resultadoExamen.value ===
            'RECHAZADO';


        motivoRechazoWrap.hidden =
            !rechazado;


        motivoRechazo.required =
            rechazado;


        if (!rechazado) {
            motivoRechazo.value = '';
        }

    }
);


/* =========================================================
   VERIFICAR EXAMEN
   ========================================================= */

verificacionForm.addEventListener(
    'submit',
    async event => {

        event.preventDefault();


        if (!examenVerificacion) {

            aviso(
                'No hay ningún examen seleccionado.',
                'error'
            );

            return;
        }


        const resultado =
            resultadoExamen.value;


        if (!resultado) {

            aviso(
                'Selecciona el resultado del examen.',
                'error'
            );

            return;
        }


        if (
            resultado === 'RECHAZADO' &&
            !motivoRechazo.value.trim()
        ) {

            aviso(
                'Debes indicar el motivo del rechazo.',
                'error'
            );

            motivoRechazo.focus();

            return;
        }


        try {

            await api(
                `/api/examenes/${examenVerificacion.id_examen}/verificar`,
                {

                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body: JSON.stringify({

                        resultado,

                        motivoRechazo:
                            motivoRechazo.value.trim(),

                        observaciones:
                            observacionesVerificacion.value.trim()

                    })

                }
            );


            cerrarModal(
                verificacionModal
            );


            if (resultado === 'APROBADO') {

                aviso(
                    'Examen aprobado. El candidato pasó a la etapa de contratación y aparecerá en Próximas firmas.'
                );

            } else if (
                resultado === 'RECHAZADO'
            ) {

                aviso(
                    'Resultado rechazado y motivo registrado.'
                );

            } else {

                aviso(
                    'El examen quedó pendiente de revisión.'
                );

            }


            await load();

        } catch (error) {

            aviso(
                error.message,
                'error'
            );

        }

    }
);


/* =========================================================
   CANDIDATOS PARA FIRMA
   ========================================================= */

function cargarFirmas() {

    const candidatos =
        postulaciones.filter(persona => {

            const estado =
                String(persona.estado || '')
                    .trim()
                    .toUpperCase();

            return [
                'PENDIENTE_CONTRATO',
                'FIRMA_CONTRATO_AGENDADA'
            ].includes(estado);

        });


    if (!candidatos.length) {

        listaFirmas.innerHTML = `
                <tr>
                    <td colspan="7" class="sidovi-empty">
                        No hay candidatos pendientes para programar firma.
                    </td>
                </tr>
            `;

        return;
    }


    listaFirmas.innerHTML =
        candidatos.map(persona => {

            const estado =
                String(persona.estado || '')
                    .trim()
                    .toUpperCase();


            const firmaAgendada =
                estado ===
                'FIRMA_CONTRATO_AGENDADA';


            const fechaFirma =
                persona.fecha_firma_programada ||
                persona.fecha_firma ||
                '—';


            const horaFirma =
                persona.hora_firma ||
                '—';


            const lugarFirma =
                persona.lugar_firma ||
                '—';


            let acciones;


            if (firmaAgendada) {

                acciones = `
                        <div class="sidovi-action-group">

                            <button
                                type="button"
                                class="sidovi-btn-whatsapp"
                                data-whatsapp-firma="${persona.id_postulacion}"
                            >
                                📲 WhatsApp
                            </button>

                            <button
                                type="button"
                                class="sidovi-btn-signature"
                                data-firma="${persona.id_postulacion}"
                            >
                                ✏️ Reprogramar
                            </button>

                        </div>
                    `;

            } else {

                acciones = `
                        <button
                            type="button"
                            class="sidovi-btn-signature"
                            data-firma="${persona.id_postulacion}"
                        >
                            📅 Programar firma
                        </button>
                    `;

            }


            return `
                    <tr>

                        <td>
                            <strong>
                                ${esc(persona.nombre_completo || 'Sin nombre')}
                            </strong>
                        </td>

                        <td>
                            ${esc(persona.cargo || '—')}
                        </td>

                        <td>
                            ${esc(formatearFecha(fechaFirma))}
                        </td>

                        <td>
                            ${esc(formatearHora(horaFirma))}
                        </td>

                        <td>
                            ${esc(lugarFirma)}
                        </td>

                        <td>

                            <span class="sidovi-status ${
                firmaAgendada
                    ? 'firma'
                    : 'aprobado'
            }">

                                ${
                firmaAgendada
                    ? '📅 Firma agendada'
                    : '✓ Exámenes aprobados'
            }

                            </span>

                        </td>

                        <td>
                            ${acciones}
                        </td>

                    </tr>
                `;

        }).join('');


    document
        .querySelectorAll('[data-firma]')
        .forEach(button => {

            button.addEventListener(
                'click',
                () => {

                    abrirFirma(
                        button.dataset.firma
                    );

                }
            );

        });


    document
        .querySelectorAll('[data-whatsapp-firma]')
        .forEach(button => {

            button.addEventListener(
                'click',
                () => {

                    enviarWhatsAppFirma(
                        button.dataset.whatsappFirma
                    );

                }
            );

        });

}


/* =========================================================
   ABRIR PROGRAMAR FIRMA
   ========================================================= */

function abrirFirma(idPostulacion) {

    postulacionFirma =
        postulaciones.find(
            persona =>
                String(persona.id_postulacion) ===
                String(idPostulacion)
        );


    if (!postulacionFirma) {

        aviso(
            'No se encontró la postulación.',
            'error'
        );

        return;
    }


    firmaCandidato.innerHTML = `
            <strong>
                ${esc(postulacionFirma.nombre_completo)}
            </strong>

            <span>
                ${esc(
        postulacionFirma.cargo ||
        'Cargo no especificado'
    )}
                · Exámenes aprobados
            </span>
        `;


    firmaFecha.value =
        postulacionFirma.fecha_firma_programada ||
        '';


    firmaHora.value =
        postulacionFirma.hora_firma ||
        '';


    firmaLugar.value =
        postulacionFirma.lugar_firma ||
        '';


    firmaDireccion.value =
        postulacionFirma.direccion_firma ||
        '';


    firmaObservaciones.value =
        postulacionFirma.observaciones_firma ||
        '';


    abrirModal(
        firmaModal
    );

}


/* =========================================================
   PROGRAMAR FIRMA
   ========================================================= */

firmaForm.addEventListener(
    'submit',
    async event => {

        event.preventDefault();


        if (!postulacionFirma) {

            aviso(
                'No hay ningún candidato seleccionado.',
                'error'
            );

            return;
        }


        try {

            await api(
                '/api/contratos/agenda-firma',
                {

                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body: JSON.stringify({

                        idPostulacion:
                            Number(
                                postulacionFirma.id_postulacion
                            ),

                        fecha:
                        firmaFecha.value,

                        hora:
                        firmaHora.value,

                        lugar:
                        firmaLugar.value,

                        direccion:
                        firmaDireccion.value,

                        observaciones:
                        firmaObservaciones.value

                    })

                }
            );


            cerrarModal(
                firmaModal
            );


            aviso(
                'La firma fue programada correctamente.'
            );


            await load();

        } catch (error) {

            aviso(
                error.message,
                'error'
            );

        }

    }
);


/* =========================================================
   WHATSAPP FIRMA
   ========================================================= */

function enviarWhatsAppFirma(idPostulacion) {

    const persona =
        postulaciones.find(
            item =>
                String(item.id_postulacion) ===
                String(idPostulacion)
        );


    if (!persona) {

        aviso(
            'No se encontró la postulación.',
            'error'
        );

        return;
    }


    const telefono =
        persona.telefono ||
        persona.celular ||
        persona.telefono_celular ||
        persona.numero_telefono ||
        '';


    if (!telefono) {

        aviso(
            'El candidato no tiene un número de teléfono registrado.',
            'error'
        );

        return;
    }


    if (!persona.fecha_firma_programada) {

        aviso(
            'Primero debes programar la firma.',
            'error'
        );

        return;
    }


    const mensaje =
        `Hola ${persona.nombre_completo || 'candidato'}, ` +
        `te informamos que la firma de tu contrato ha sido programada ` +
        `para el día ${formatearFecha(persona.fecha_firma_programada)} ` +
        `a las ${formatearHora(persona.hora_firma)}. ` +
        `Lugar: ${persona.lugar_firma || 'por confirmar'}. ` +
        `${
            persona.direccion_firma
                ? `Dirección: ${persona.direccion_firma}. `
                : ''
        }` +
        `Por favor asistir puntualmente. ` +
        `Gracias, Colviseg.`;


    abrirWhatsApp(
        telefono,
        mensaje
    );

}


/* =========================================================
   ABRIR WHATSAPP
   ========================================================= */

function abrirWhatsApp(telefono, mensaje) {

    let numero =
        String(telefono)
            .replace(/\D/g, '');


    if (
        numero.length === 10 &&
        numero.startsWith('3')
    ) {

        numero =
            `57${numero}`;

    }


    if (!numero) {

        aviso(
            'El número de teléfono no es válido.',
            'error'
        );

        return;
    }


    const url =
        `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;


    window.open(
        url,
        '_blank',
        'noopener,noreferrer'
    );

}


/* =========================================================
   FORMATEAR FECHA
   ========================================================= */

function formatearFecha(valor) {

    if (
        !valor ||
        valor === '—'
    ) {
        return '—';
    }


    const texto =
        String(valor);


    const partes =
        texto
            .substring(0, 10)
            .split('-');


    if (partes.length !== 3) {
        return texto;
    }


    const [
        year,
        month,
        day
    ] = partes;


    return `${day}/${month}/${year}`;

}


/* =========================================================
   FORMATEAR HORA
   ========================================================= */

function formatearHora(valor) {

    if (
        !valor ||
        valor === '—'
    ) {
        return '—';
    }


    const texto =
        String(valor);


    const partes =
        texto
            .substring(0, 5)
            .split(':');


    if (partes.length !== 2) {
        return texto;
    }


    let horas =
        Number(partes[0]);


    const minutos =
        partes[1];


    if (Number.isNaN(horas)) {
        return texto;
    }


    const periodo =
        horas >= 12
            ? 'p. m.'
            : 'a. m.';


    horas =
        horas % 12;


    if (horas === 0) {
        horas = 12;
    }


    return `${horas}:${minutos} ${periodo}`;

}


/* =========================================================
   ARRANCAR
   ========================================================= */

load();

}
