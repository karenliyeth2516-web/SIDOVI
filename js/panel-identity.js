(async () => {
    const el = document.getElementById('panelIdentity');
    const loader = document.getElementById('panelLoader');
    document.body.classList.add('panel-loading');

    if (!el) {
        if (loader) {
            document.body.classList.add('panel-ready');
            setTimeout(() => loader.remove(), 250);
        }
        return;
    }

    try {
        const r = await fetch('/api/auth/me');
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Sesión no disponible');

        const u = d.usuario || {};
        const nombre = u.nombre_completo || 'usuario';
        const foto = u.foto_perfil?.startsWith('data:image')
            ? `<img src="${u.foto_perfil}" alt="Foto de ${nombre}" class="panel-user-photo" />`
            : '';
        el.innerHTML = `${foto}<span><strong>Bienvenido, ${nombre}</strong></span>`;
    } catch (e) {
        el.innerHTML = '<span><strong>Bienvenido</strong></span>';
    } finally {
        document.body.classList.remove('panel-loading');
        document.body.classList.add('panel-ready');
        if (loader) {
            setTimeout(() => loader.remove(), 250);
        }
    }
})();
