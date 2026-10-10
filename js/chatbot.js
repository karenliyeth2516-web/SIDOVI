const chatbotButton = document.getElementById("chatbotButton");
const chatbotContainer = document.getElementById("chatbotContainer");
const closeChat = document.getElementById("closeChat");
const sendButton = document.getElementById("sendButton");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");
const emojiButton = document.getElementById("emojiButton");

chatbotButton?.addEventListener("click", () => {
    chatbotContainer.classList.add("active");
    chatbotButton.style.display = "none";
    chatInput.focus();
});

closeChat?.addEventListener("click", () => {
    chatbotContainer.classList.remove("active");
    chatbotButton.style.display = "block";
});

function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    addMessage(message, "user-message");
    chatInput.value = "";

    window.setTimeout(() => {
        const response = generateResponse(message);
        addMessage(response.text, "bot-message");
        if (response.contact) addContactLink();
    }, 400);
}

function addMessage(text, className) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", className);

    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    messageDiv.appendChild(paragraph);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function generateResponse(message) {
    const text = message.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    if (/\b(error|falla|fallo|problema|no funciona|no me deja|no puedo|no carga|no guarda|no se guarda)\b/.test(text)) {
        return {
            text: "Siento que estés teniendo este inconveniente. No puedo resolverlo desde el asistente; el equipo de Colviseg puede ayudarte directamente en el (601) 756 2093.",
            contact: true
        };
    }
    if (/\b(hola|buenas|buenos dias|buenas tardes|buenas noches)\b/.test(text)) {
        return { text: "¡Hola! 👋 Soy el asistente de SIDOVI. Puedo orientarte sobre vacantes, postulaciones, acceso y el proceso de selección." };
    }
    if (/\b(oferta|ofertas|vacante|vacantes|empleo|trabajo)\b/.test(text)) {
        return { text: "En Ofertas puedes consultar las vacantes activas, revisar cargo, sede, jornada y requisitos, y elegir «Postularme» para iniciar tu solicitud. Si no aparece una vacante adecuada, revisa más adelante porque la lista se actualiza." };
    }
    if (/\b(postular|postulacion|inscribirme|inscripcion|aplicar)\b/.test(text)) {
        return { text: "Para postularte, abre «Postularse», completa tus datos y la información solicitada, adjunta los documentos requeridos y envía el formulario. El equipo de selección revisará tu postulación y podrá contactarte para las siguientes etapas." };
    }
    if (/\b(hoja de vida|hv|documentos|documentacion)\b/.test(text)) {
        return { text: "Ten lista tu hoja de vida y la documentación de soporte para completar la postulación. Si ya tienes una cuenta interna, tu equipo autorizado puede revisar documentos desde los módulos de Hojas de Vida y Gestión de aspirantes." };
    }
    if (/\b(entrevista|entrevistas|cita|agenda)\b/.test(text)) {
        return { text: "Si tu perfil avanza en el proceso, el equipo de selección te informará la fecha, hora y modalidad de la entrevista. Para cambiar una cita o confirmar detalles, comunícate con Colviseg al (601) 756 2093.", contact: true };
    }
    if (/\b(examen|examenes|medico|medicos|contrato|contratacion|seleccion|proceso)\b/.test(text)) {
        return { text: "El proceso puede incluir revisión de la postulación, entrevista, exámenes y, si se cumplen las etapas, gestión del contrato. Las instrucciones y el estado de tu caso los confirma el equipo de selección." };
    }
    if (/\b(login|iniciar sesion|ingresar|contrasena|cuenta|acceso)\b/.test(text)) {
        return { text: "El acceso a SIDOVI está destinado al personal autorizado de RRHH y Gerencia. Si eres aspirante, puedes consultar vacantes y postularte sin iniciar sesión. Si no puedes ingresar a tu cuenta interna, llama al (601) 756 2093.", contact: true };
    }
    if (/\b(perfil|actualizar datos|datos personales)\b/.test(text)) {
        return { text: "El perfil y los datos de las personas aspirantes son gestionados por el equipo de selección. Para solicitar una actualización o corregir información de tu postulación, comunícate con Colviseg al (601) 756 2093.", contact: true };
    }
    if (/\b(rrhh|recursos humanos|gerencia|dashboard|sistema|sidovi|colviseg|empresa)\b/.test(text)) {
        return { text: "SIDOVI es el sistema de información de Colviseg Ltda. para gestionar selección y vinculación de personal. Incluye consultas de vacantes y postulaciones, y módulos internos para RRHH y Gerencia. La oficina está en Cra. 20 #66-15, Bogotá." };
    }
    if (/\b(gracias|listo|entendi|entendido)\b/.test(text)) {
        return { text: "¡Con gusto! Si necesitas más ayuda con las vacantes o tu postulación, escríbeme." };
    }

    return {
        text: "No tengo información suficiente para resolver esa consulta desde aquí. El equipo de Colviseg puede ayudarte directamente en el (601) 756 2093.",
        contact: true
    };
}

function addContactLink() {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", "bot-message");

    const link = document.createElement("a");
    link.href = "tel:+576017562093";
    link.textContent = "Llamar a Colviseg";
    link.className = "chatbot-contact-link";
    messageDiv.appendChild(link);

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendButton?.addEventListener("click", sendMessage);

chatInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
    }
});

emojiButton?.addEventListener("click", () => {
    chatInput.value += " 😊";
    chatInput.focus();
});
