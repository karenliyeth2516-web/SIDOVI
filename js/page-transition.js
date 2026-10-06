(() => {
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );
  const footer = document.querySelector('.site-footer');
  const chatbotElements = [
    document.querySelector('.chatbot-button'),
    document.querySelector('.chatbot-container')
  ].filter(Boolean);

  const repositionChatbot = () => {
    if (!footer || chatbotElements.length === 0) {
      return;
    }

    const footerTop = footer.getBoundingClientRect().top;
    const footerIsVisible = footerTop >= 0 && footerTop < window.innerHeight;
    const bottomOffset = footerIsVisible
      ? window.innerHeight - footerTop + 20
      : 25;

    chatbotElements.forEach((element) => {
      element.style.bottom = `${bottomOffset}px`;
      if (element.classList.contains('chatbot-container')) {
        element.style.maxHeight = `calc(100vh - ${bottomOffset + 20}px)`;
      }
    });
  };

  if (footer && chatbotElements.length > 0) {
    window.addEventListener('scroll', repositionChatbot, { passive: true });
    window.addEventListener('resize', repositionChatbot);
    repositionChatbot();
  }

  document.addEventListener('click', (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      prefersReducedMotion.matches
    ) {
      return;
    }

    if (!(event.target instanceof Element)) {
      return;
    }

    const link = event.target.closest('a[href]');
    if (
      !link ||
      link.hasAttribute('download') ||
      (link.target && link.target !== '_self')
    ) {
      return;
    }

    const destination = new URL(link.href, window.location.href);
    if (
      destination.origin !== window.location.origin ||
      destination.pathname === window.location.pathname &&
        destination.search === window.location.search
    ) {
      return;
    }

    event.preventDefault();
    document.body.classList.add('page-leaving');
    window.setTimeout(() => {
      window.location.assign(destination.href);
    }, 180);
  });
})();
