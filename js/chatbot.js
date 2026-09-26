/* =========================================
   ELEMENTOS
========================================= */

const chatbotButton = document.getElementById("chatbotButton");

const chatbotContainer =
    document.getElementById("chatbotContainer");

const closeChat =
    document.getElementById("closeChat");

const sendButton =
    document.getElementById("sendButton");
const chatInput =
    document.getElementById("chatInput");
const chatMessages =
    document.getElementById("chatMessages");
const emojiButton =
    document.getElementById("emojiButton");
const fileInput =
    document.getElementById("fileInput");
const likeButton =
    document.getElementById("likeButton");
const dislikeButton =
    document.getElementById("dislikeButton");

/* =========================================
   ABRIR CHAT
========================================= */

chatbotButton.addEventListener("click", function () {
    chatbotContainer.classList.add("active");
    chatbotButton.style.display = "none";
    chatInput.focus();

});
/* =========================================
   CERRAR CHAT
========================================= */
closeChat.addEventListener("click", function () {
    chatbotContainer.classList.remove("active");
    chatbotButton.style.display = "block";

});

/* =========================================
   ENVIAR MENSAJE
========================================= */

function sendMessage() {
    const message = chatInput.value.trim();


    // No enviar mensaje vacío
    if (message === "") {
        return;
    }

    // Mostrar mensaje del usuario
    addMessage(message, "user-message");

    // Limpiar input
    chatInput.value = "";

    // Simular respuesta del bot

    setTimeout(function () {
        const response = generateResponse(message);
        addMessage(response, "bot-message");
    }, 700);

}
/* =========================================
   CREAR MENSAJE
========================================= */

function addMessage(text, className) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add(
        "message",
        className
    );
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    messageDiv.appendChild(paragraph);
    chatMessages.appendChild(messageDiv);

    // Bajar automáticamente
    chatMessages.scrollTop =
        chatMessages.scrollHeight;
}
/* =========================================
   RESPUESTAS DEL CHATBOT
========================================= */
function generateResponse(message) {
    const text = message.toLowerCase();
    if (
        text.includes("hola") ||
        text.includes("buenas")
    ) {
        return "¡Hola! 👋 ¿Cómo puedo ayudarte con SIDOVI?";
    }


    if (
        text.includes("oferta") ||
        text.includes("empleo") ||
        text.includes("trabajo")
    ) {
        return "Puedes consultar las ofertas laborales disponibles desde la sección 'Ofertas' de SIDOVI.";

    }

    if (
        text.includes("postular") ||
        text.includes("postulación")
    ) {
        return "Para postularte a una oferta, selecciona una vacante y utiliza la opción 'Postularme'.";
    }
    if (
        text.includes("perfil") ||
        text.includes("hoja de vida")
    ) {

        return "Puedes consultar y actualizar tu información personal desde tu perfil o desde la sección de hojas de vida.";
    }

    if (
        text.includes("rrhh") ||
        text.includes("recursos humanos")
    ) {

        return "La sección de RRHH permite gestionar información relacionada con trabajadores, contratos y procesos de selección.";
    }

    if (
        text.includes("ayuda") ||
        text.includes("ayúdame")
    ) {

        return "Claro 😊 Puedo ayudarte con ofertas, postulaciones, perfiles, hojas de vida y navegación por SIDOVI.";

    }


    return "Gracias por tu mensaje 😊. Puedo ayudarte con ofertas laborales, postulaciones, perfiles, hojas de vida y otras funciones de SIDOVI.";

}
/* =========================================
   BOTÓN ENVIAR
========================================= */

sendButton.addEventListener(
    "click",
    sendMessage
);
/* =========================================
   ENTER PARA ENVIAR
========================================= */

chatInput.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "Enter") {

            event.preventDefault();

            sendMessage();

        }

    }
);
/* =========================================
   EMOJI
========================================= */

emojiButton.addEventListener(
    "click",
    function () {

        chatInput.value += " 😊";

        chatInput.focus();

    }
);


/* =========================================
   ARCHIVO ADJUNTO
========================================= */

fileInput.addEventListener(
    "change",
    function () {

        if (fileInput.files.length > 0) {

            const file =
                fileInput.files[0];

            addMessage(
                "📎 Archivo seleccionado: " + file.name,
                "user-message"
            );

        }

    }
);
/* =========================================
   LIKE
========================================= */

likeButton.addEventListener(
    "click",
    function () {

        likeButton.style.background = "#b8f5c2";

    }
);
/* =========================================
   DISLIKE
========================================= */
dislikeButton.addEventListener(
    "click",
    function () {

        dislikeButton.style.background = "#ffb8b8";

    }
);