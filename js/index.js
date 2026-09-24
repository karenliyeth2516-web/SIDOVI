const chatPanel = document.getElementById('chatPanel');
const chatTrigger = document.getElementById('chatTrigger');
const chatClose = document.getElementById('chatClose');
const chatMessages = document.getElementById('chatMessages');
const answers = {
  'Quiero ver ofertas de empleo': 'Puedes consultar las vacantes disponibles en “Ver ofertas” y elegir la que mejor se ajuste a tu perfil.',
  'Necesito ayuda para postularme': 'Para postularte, selecciona una oferta y completa tus datos y documentos. Te avisaremos cuando haya novedades.',
  'Quiero acceder a mi cuenta': 'Ingresa por “Acceso personal” con tus datos registrados. Si no tienes cuenta, puedes crearla durante tu postulación.'
};
function toggleChat(show) {
  chatPanel.hidden = !show;
  chatTrigger.classList.toggle('is-open', show);
  if (show) chatPanel.querySelector('.chat-options button')?.focus();
}
chatTrigger?.addEventListener('click', () => toggleChat(chatPanel.hidden));
chatClose?.addEventListener('click', () => toggleChat(false));
document.querySelectorAll('.chat-options button').forEach((button) => {
  button.addEventListener('click', () => {
    const question = button.dataset.answer;
    chatMessages.insertAdjacentHTML('beforeend', `<p class="user-message">${question}</p><p class="bot-message">${answers[question]}</p>`);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
});
