(async () => {
    const el = document.getElementById('panelIdentity');
    if (!el) return;
    try {
        const r = await fetch('/api/auth/me');
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        const u = d.usuario || {};
        const foto = u.foto_perfil?.startsWith('data:image')
            ? `<img src="${u.foto_perfil}" alt="Foto de ${u.nombre_completo}">`
            : '';
        // Nota: aquí solo se actualiza el bloque de bienvenida (#panelIdentity).
        // El título de la página (#panelTitle) NO se toca: debe conservar
        // el nombre del panel ("Dashboard · Recursos Humanos"), no el
        // nombre del usuario logueado.
        el.innerHTML = `${foto}<span><strong>Bienvenido, ${u.rol === 'Gerente' ? 'gerente' : 'equipo de RRHH'} ${u.nombre_completo || ''}</strong><small>${u.correo || ''}</small></span>`;
    } catch (e) {
        el.textContent = 'Sesión no disponible';
    }
})();
