// trabajadores.js — Lista y filtro de trabajadores
document.getElementById('menuToggle').addEventListener('click', () => {
  document.querySelector('.nav-list').classList.toggle('open');
});

document.getElementById('buscarTrab').addEventListener('input', filtrarT);
document.getElementById('filtroArea').addEventListener('change', filtrarT);

function filtrarT() {
  const q = document.getElementById('buscarTrab').value.toLowerCase();
  const a = document.getElementById('filtroArea').value.toLowerCase();
  document.querySelectorAll('#tablaTrabajadores tbody tr').forEach(tr => {
    const t = tr.textContent.toLowerCase();
    tr.style.display = (t.includes(q) && (a === '' || t.includes(a))) ? '' : 'none';
  });
}
