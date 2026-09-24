require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const sessions = new Map();
const sslSetting = process.env.PGSSL ?? process.env.DB_SSL;
const postgresConfig = process.env.DATABASE_URL
    ? {
      connectionString: process.env.DATABASE_URL,
      ssl: String(sslSetting).toLowerCase() === 'true' ? { rejectUnauthorized: false } : false
    }
    : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'SIDOVI',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: String(sslSetting).toLowerCase() === 'true' ? { rejectUnauthorized: false } : false
    };
const db = new Pool(postgresConfig);

app.use(cors());
app.use(express.json({ limit: '18mb' }));
app.use(express.urlencoded({ extended: true }));
function getSession(req) {
  const authorization = req.get('authorization') || '';
  const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const cookies = Object.fromEntries((req.get('cookie') || '').split(';').filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }));
  const session = sessions.get(bearerToken || cookies.sid) || null;
  if (session && Date.now() - session.creado > 8 * 60 * 60 * 1000) {
    sessions.delete(bearerToken || cookies.sid);
    return null;
  }
  return session;
}
function getSessionToken(req) {
  const authorization = req.get('authorization') || '';
  if (authorization.startsWith('Bearer ')) return authorization.slice(7);
  const cookie = (req.get('cookie') || '').split(';').find((part) => part.trim().startsWith('sid='));
  return cookie ? decodeURIComponent(cookie.trim().slice(4)) : '';
}
function requireRoles(...roles) {
  return (req, res, next) => {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Sesión requerida.' });
    if (roles.length && !roles.includes(session.rol)) return res.status(403).json({ error: 'No tienes permisos para este módulo.' });
    req.session = session;
    next();
  };
}
const publicApi = (req) => req.path === '/auth/login' || req.path === '/health' || (req.path === '/vacantes' && req.method === 'GET') || (req.path === '/sedes' && req.method === 'GET') || (req.path === '/postulaciones' && req.method === 'POST');
const protectedPages = {
  '/RRHH.html': ['RRHH'],
  '/cargos.html': ['RRHH'],
  '/gerente.html': ['Gerente'],
  '/evaluar.html': ['Gerente'],
  '/evaluacion.html': ['Gerente'],
  '/contrato.html': ['Gerente'],
  '/trabajadores.html': ['RRHH', 'Gerente'],
  '/reporte.html': ['RRHH', 'Gerente'],
  '/aspirantes.html': ['RRHH', 'Gerente'],
  '/agenda.html': ['RRHH', 'Gerente'],
  '/hojasdevida.html': ['RRHH', 'Gerente'],
  '/perfil.html': ['RRHH', 'Gerente'],
  '/mi-perfil.html': ['RRHH', 'Gerente']
};
app.use((req, res, next) => {
  const roles = protectedPages[req.path];
  if (!roles) return next();
  const session = getSession(req);
  if (!session) return res.redirect('/login.html?acceso=sesion');
  if (!roles.includes(session.rol)) return res.status(403).send('Acceso denegado para este rol.');
  next();
});

app.use('/api', (req, res, next) => {
  if (publicApi(req)) return next();
  if (req.path === '/dashboard' || req.path === '/cargos') return requireRoles('RRHH', 'Gerente')(req, res, next);
  if (req.path.startsWith('/contratos') || req.path.startsWith('/evaluaciones')) return requireRoles('Gerente')(req, res, next);
  if (req.path.startsWith('/postulaciones') || req.path.startsWith('/aspirantes') || req.path.startsWith('/documentos') || req.path.startsWith('/entrevistas')) return requireRoles('RRHH', 'Gerente')(req, res, next);
  if (req.path.startsWith('/trabajadores') || req.path.startsWith('/reportes') || req.path.startsWith('/examenes')) return requireRoles('RRHH', 'Gerente')(req, res, next);
  return next();
});

app.use(express.static(__dirname));

const normalState = (value) => String(value || '').trim();
const fullName = (nombre, apellido) => [nombre, apellido].filter(Boolean).join(' ');
const splitName = (value = '') => { const parts = String(value).trim().split(/\s+/); return { nombre: parts.shift() || 'Aspirante', apellido: parts.join(' ') || 'SIDOVI' }; };
const errorResponse = (res, error, fallback) => { console.error(error); const status = error.status || (error.code === '23503' ? 400 : error.code === '23505' ? 409 : 500); res.status(status).json({ error: error.code === '23505' ? 'El registro ya existe.' : error.message || fallback }); };

app.get('/api/health', async (_req, res) => {
  try { await db.query('SELECT 1'); res.json({ ok: true, servicio: 'SIDOVI API', baseDatos: 'SIDOVI' }); }
  catch (error) { errorResponse(res, error, 'No fue posible conectar con PostgreSQL.'); }
});

app.get('/api/sedes', async (_req, res) => {
  try {
    const result = await db.query('SELECT id_sede, nombre_sede, COALESCE(activa, true) AS activa FROM sede ORDER BY nombre_sede');
    res.json(result.rows);
  } catch (error) { errorResponse(res, error, 'No fue posible consultar las sedes.'); }
});

app.get('/api/cargos', async (req, res) => {
  try {
    const values = [];
    let clause = 'WHERE c.activo = true';
    if (req.query.idSede) { values.push(req.query.idSede); clause += ` AND c.id_sede = $${values.length}`; }
    const result = await db.query(`SELECT c.*, s.nombre_sede FROM cargo c JOIN sede s ON s.id_sede = c.id_sede ${clause} ORDER BY c.nombre_cargo, s.nombre_sede`, values);
    res.json(result.rows);
  } catch (error) { errorResponse(res, error, 'No fue posible consultar los cargos.'); }
});

app.post('/api/cargos', async (req, res) => {
  const { nombreCargo, nombre_cargo, descripcionCargo = '', descripcion_cargo = '', turnos = '', idSede, id_sede } = req.body;
  const sedeId = idSede || id_sede;
  const nombre = nombreCargo || nombre_cargo;
  if (!nombre || !sedeId) return res.status(400).json({ error: 'El nombre del cargo y la sede son obligatorios.' });
  try {
    const result = await db.query('INSERT INTO cargo (nombre_cargo, descripcion_cargo, turnos, id_sede) VALUES ($1,$2,$3,$4) RETURNING *', [nombre.trim(), descripcionCargo || descripcion_cargo, turnos, sedeId]);
    res.status(201).json(result.rows[0]);
  } catch (error) { errorResponse(res, error, 'No fue posible crear el cargo.'); }
});

app.patch('/api/cargos/:id', async (req, res) => {
  const { nombreCargo, nombre_cargo, descripcionCargo, descripcion_cargo, turnos, idSede, id_sede, activo } = req.body;
  try {
    const result = await db.query(`UPDATE cargo SET nombre_cargo = COALESCE($1,nombre_cargo), descripcion_cargo = COALESCE($2,descripcion_cargo), turnos = COALESCE($3,turnos), id_sede = COALESCE($4,id_sede), activo = COALESCE($5,activo) WHERE id_cargo = $6 RETURNING *`, [nombreCargo || nombre_cargo, descripcionCargo ?? descripcion_cargo, turnos, idSede || id_sede, activo, req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Cargo no encontrado.' });
    res.json(result.rows[0]);
  } catch (error) { errorResponse(res, error, 'No fue posible actualizar el cargo.'); }
});

app.delete('/api/cargos/:id', async (req, res) => {
  try {
    const result = await db.query('UPDATE cargo SET activo = false WHERE id_cargo = $1 RETURNING id_cargo', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Cargo no encontrado.' });
    res.status(204).end();
  } catch (error) { errorResponse(res, error, 'No fue posible desactivar el cargo.'); }
});

app.get('/api/vacantes', async (req, res) => {
  try {
    const values = [];
    let clause = '';
    if (req.query.idSede) { values.push(req.query.idSede); clause = `WHERE v.id_sede = $${values.length}`; }
    const result = await db.query(`SELECT v.*, v.nombre_cargo AS titulo, s.nombre_sede, c.id_cargo, c.nombre_cargo, u.nombre_completo AS responsable, COUNT(p.id_postulacion)::int AS total_postulaciones FROM vacante v LEFT JOIN sede s ON s.id_sede = v.id_sede LEFT JOIN cargo c ON c.id_cargo = v.id_cargo LEFT JOIN usuario u ON u.id_usuario = v.id_usuario LEFT JOIN postulacion p ON p.id_vacante = v.id_vacante ${clause} GROUP BY v.id_vacante, s.nombre_sede, c.id_cargo, c.nombre_cargo, u.nombre_completo ORDER BY v.id_vacante DESC`, values);
    res.json(result.rows);
  } catch (error) { errorResponse(res, error, 'No fue posible consultar las vacantes. Ejecuta primero la migración de sedes y cargos.'); }
});

app.get('/api/vacantes/:id', async (req, res) => {
  try { const result = await db.query('SELECT * FROM vacante WHERE id_vacante = $1', [req.params.id]); if (!result.rowCount) return res.status(404).json({ error: 'Vacante no encontrada.' }); res.json(result.rows[0]); }
  catch (error) { errorResponse(res, error, 'No fue posible consultar la vacante.'); }
});

app.post('/api/vacantes', async (req, res) => {
  const { titulo, descripcion, requisitos = '', fechaPublicacion = new Date(), estado = 'ABIERTA', idUsuario = 2, idSede, id_sede, idCargo, id_cargo } = req.body;
  if (!titulo || !descripcion) return res.status(400).json({ error: 'Título y descripción son obligatorios.' });
  try { const result = await db.query(`INSERT INTO vacante (titulo, descripcion, requisitos, fecha_publicacion, estado, id_usuario, id_sede, id_cargo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [titulo, descripcion, requisitos, fechaPublicacion, estado, idUsuario, idSede || id_sede || null, idCargo || id_cargo || null]); res.status(201).json(result.rows[0]); }
  catch (error) { errorResponse(res, error, 'No fue posible crear la vacante.'); }
});

app.patch('/api/vacantes/:id', async (req, res) => {
  const { titulo, descripcion, requisitos = '', fechaPublicacion, estado, idUsuario, idSede, id_sede, idCargo, id_cargo } = req.body;
  try { const result = await db.query(`UPDATE vacante SET titulo = COALESCE($1,titulo), descripcion = COALESCE($2,descripcion), requisitos = COALESCE($3,requisitos), fecha_publicacion = COALESCE($4,fecha_publicacion), estado = COALESCE($5,estado), id_usuario = COALESCE($6,id_usuario), id_sede = COALESCE($7,id_sede), id_cargo = COALESCE($8,id_cargo) WHERE id_vacante = $9 RETURNING *`, [titulo, descripcion, requisitos, fechaPublicacion, estado, idUsuario, idSede || id_sede, idCargo || id_cargo, req.params.id]); if (!result.rowCount) return res.status(404).json({ error: 'Vacante no encontrada.' }); res.json(result.rows[0]); }
  catch (error) { errorResponse(res, error, 'No fue posible actualizar la vacante.'); }
});

app.delete('/api/vacantes/:id', async (req, res) => {
  try { const result = await db.query('DELETE FROM vacante WHERE id_vacante = $1 RETURNING id_vacante', [req.params.id]); if (!result.rowCount) return res.status(404).json({ error: 'Vacante no encontrada.' }); res.status(204).end(); }
  catch (error) { errorResponse(res, error, 'No fue posible eliminar la vacante.'); }
});

app.get('/api/aspirantes', async (_req, res) => {
  try { const result = await db.query('SELECT * FROM aspirante ORDER BY id_aspirante DESC'); res.json(result.rows); }
  catch (error) { errorResponse(res, error, 'No fue posible consultar aspirantes.'); }
});

app.get('/api/aspirantes/:id', async (req, res) => {
  try { const result = await db.query('SELECT * FROM aspirante WHERE id_aspirante=$1', [req.params.id]); if (!result.rowCount) return res.status(404).json({ error: 'Postulante no encontrado.' }); res.json(result.rows[0]); }
  catch (error) { errorResponse(res, error, 'No fue posible consultar el aspirante.'); }
});

app.post('/api/aspirantes', async (req, res) => {
  const { nombre, apellido, documento, correo, telefono, direccion, fechaRegistro = new Date() } = req.body;
  if (!nombre || !apellido || !documento || !correo || !telefono || !direccion) return res.status(400).json({ error: 'Nombre, apellido, documento, correo, teléfono y dirección son obligatorios.' });
  try { const result = await db.query('INSERT INTO aspirante (tipo_documento, numero_documento, nombre_completo, correo, telefono, direccion, fecha_registro, activo) VALUES ($1,$2,$3,$4,$5,$6,$7,true) RETURNING *', ['CC', documento, `${nombre} ${apellido}`.trim(), correo, telefono, direccion, fechaRegistro]); res.status(201).json(result.rows[0]); }
  catch (error) { errorResponse(res, error, 'No fue posible crear el aspirante.'); }
});

app.patch('/api/aspirantes/:id', async (req, res) => {
  const { nombre, apellido, documento, correo, telefono, direccion } = req.body;
  try { const result = await db.query('UPDATE aspirante SET nombre_completo=COALESCE($1,nombre_completo), numero_documento=COALESCE($2,numero_documento), correo=COALESCE($3,correo), telefono=COALESCE($4,telefono), direccion=COALESCE($5,direccion) WHERE id_aspirante=$6 RETURNING *', [nombre || apellido ? `${nombre || ''} ${apellido || ''}`.trim() : null, documento, correo, telefono, direccion, req.params.id]); if (!result.rowCount) return res.status(404).json({ error: 'Aspirante no encontrado.' }); res.json(result.rows[0]); }
  catch (error) { errorResponse(res, error, 'No fue posible actualizar el aspirante.'); }
});

app.delete('/api/aspirantes/:id', async (req, res) => {
  const client = await db.connect();
  try { await client.query('BEGIN'); await client.query('DELETE FROM documento WHERE id_aspirante=$1', [req.params.id]); const result = await client.query('DELETE FROM aspirante WHERE id_aspirante=$1 RETURNING id_aspirante', [req.params.id]); if (!result.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Postulante no encontrado.' }); } await client.query('COMMIT'); res.status(204).end(); }
  catch (error) { await client.query('ROLLBACK'); errorResponse(res, error, 'No fue posible eliminar el aspirante.'); } finally { client.release(); }
});

const postulacionQuery = `SELECT p.id_postulacion, p.id_aspirante, p.id_vacante, p.fecha_postulacion, p.estado AS estado, a.nombre_completo, a.numero_documento, a.correo, a.telefono, a.direccion, v.nombre_cargo AS cargo, v.descripcion AS descripcion_vacante, v.estado AS estado_vacante, v.id_sede, s.nombre_sede FROM postulacion p JOIN aspirante a ON a.id_aspirante = p.id_aspirante JOIN vacante v ON v.id_vacante = p.id_vacante LEFT JOIN sede s ON s.id_sede = v.id_sede`;

app.get('/api/dashboard', async (req, res) => {
  try {
    const values = [];
    const clause = req.query.idSede ? (values.push(req.query.idSede), 'WHERE v.id_sede = $1') : '';
    const result = await db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE LOWER(TRIM(p.estado)) LIKE '%revis%' OR LOWER(TRIM(p.estado)) LIKE '%proceso%' OR LOWER(TRIM(p.estado)) LIKE '%pendiente%')::int AS en_revision,
        COUNT(*) FILTER (WHERE LOWER(TRIM(p.estado)) LIKE '%entrevista%')::int AS entrevistas,
        COUNT(*) FILTER (WHERE LOWER(TRIM(p.estado)) LIKE '%aprob%' OR LOWER(TRIM(p.estado)) LIKE '%contrato%')::int AS aprobados
      FROM (
        SELECT p.*, v.id_sede
        FROM postulacion p
        JOIN vacante v ON v.id_vacante = p.id_vacante
        ${clause}
      ) p
    `, values);
    res.json(result.rows[0] || { total: 0, en_revision: 0, entrevistas: 0, aprobados: 0 });
  } catch (error) {
    errorResponse(res, error, 'No fue posible consultar los indicadores de Recursos Humanos.');
  }
});

app.get('/api/postulaciones', async (req, res) => {
  try { const values = []; const where = []; if (req.query.estado) { values.push(req.query.estado); where.push(`LOWER(p.estado) = LOWER($${values.length})`); } if (req.query.buscar) { values.push(`%${req.query.buscar}%`); where.push(`(a.nombre_completo || ' ' || a.numero_documento || ' ' || v.nombre_cargo) ILIKE $${values.length}`); } if (req.query.idAspirante || req.query.idPostulante) { values.push(req.query.idAspirante || req.query.idPostulante); where.push(`p.id_aspirante = $${values.length}`); } if (req.query.idSede) { values.push(req.query.idSede); where.push(`v.id_sede = $${values.length}`); } const result = await db.query(`${postulacionQuery} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.fecha_postulacion DESC, p.id_postulacion DESC`, values); res.json(result.rows); }
  catch (error) { errorResponse(res, error, 'No fue posible consultar postulaciones.'); }
});

app.get('/api/postulaciones/:id', async (req, res) => {
  try { const result = await db.query(`${postulacionQuery} WHERE p.id_postulacion = $1`, [req.params.id]); if (!result.rowCount) return res.status(404).json({ error: 'Postulación no encontrada.' }); const row = result.rows[0]; const docs = await db.query('SELECT * FROM documento WHERE id_aspirante = $1 ORDER BY id_documento', [row.id_aspirante]); const entrevistas = await db.query('SELECT * FROM entrevista WHERE id_postulacion = $1 ORDER BY id_entrevista DESC', [req.params.id]); res.json({ ...row, documentos: docs.rows, entrevista: entrevistas.rows[0] || null }); }
  catch (error) { errorResponse(res, error, 'No fue posible consultar la postulación.'); }
});

app.get('/api/hojas-de-vida', requireRoles('RRHH', 'Gerente'), async (_req, res) => {
  try {
    const result = await db.query(`SELECT p.id_postulacion, p.fecha_postulacion, p.estado, a.id_aspirante, a.nombre_completo, a.tipo_documento, a.numero_documento, a.correo, a.telefono, a.direccion, v.nombre_cargo AS cargo, COALESCE(json_agg(json_build_object('id_documento', d.id_documento, 'nombre_documento', d.nombre_documento, 'tipo_documento', d.tipo_documento, 'archivo', d.archivo) ORDER BY d.id_documento) FILTER (WHERE d.id_documento IS NOT NULL), '[]') AS documentos FROM postulacion p JOIN aspirante a ON a.id_aspirante = p.id_aspirante JOIN vacante v ON v.id_vacante = p.id_vacante LEFT JOIN documento d ON d.id_aspirante = a.id_aspirante GROUP BY p.id_postulacion, a.id_aspirante, v.nombre_cargo ORDER BY p.fecha_postulacion DESC, p.id_postulacion DESC`);
    res.json(result.rows);
  } catch (error) { errorResponse(res, error, 'No fue posible consultar las hojas de vida.'); }
});

app.post('/api/postulaciones', async (req, res) => {
  const { idPostulante, idAspirante, nombre, nombreCompleto, apellido, cedula, numeroDocumento, email, correo, telefono, ciudad, direccion, cargo, idVacante, documentos = [] } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    let id = Number(idPostulante || idAspirante);
    if (!id) { const names = splitName(nombreCompleto || nombre); const user = await client.query('SELECT id_aspirante FROM aspirante WHERE correo = $1 OR numero_documento = $2 LIMIT 1', [email || correo, cedula || numeroDocumento]); if (user.rowCount) id = user.rows[0].id_aspirante; else { const created = await client.query('INSERT INTO aspirante (tipo_documento, numero_documento, nombre_completo, correo, telefono, direccion, fecha_registro, activo) VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE,true) RETURNING id_aspirante', ['CC', cedula || numeroDocumento, `${names.nombre} ${apellido || names.apellido}`.trim(), email || correo, telefono, ciudad || direccion]); id = created.rows[0].id_aspirante; } }
    let vacancyId = idVacante;
    if (!vacancyId && cargo) { const found = await client.query(`SELECT id_vacante FROM vacante WHERE LOWER(nombre_cargo) = LOWER($1) AND LOWER(estado) IN ('abierta','activo','activa') ORDER BY id_vacante DESC LIMIT 1`, [cargo]); if (!found.rowCount) throw Object.assign(new Error('No hay una vacante abierta para ese cargo.'), { status: 400 }); vacancyId = found.rows[0].id_vacante; }
    if (!id || !vacancyId) throw Object.assign(new Error('El aspirante y la vacante son obligatorios.'), { status: 400 });
    const post = await client.query(`INSERT INTO postulacion (id_aspirante, id_vacante, fecha_postulacion, estado) VALUES ($1,$2,CURRENT_DATE,'EN_REVISION') RETURNING *`, [id, vacancyId]);
    for (const doc of documentos) {
      const archivo = String(doc.archivo || doc.rutaArchivo || 'pendiente');
      if (archivo.length > 8 * 1024 * 1024) throw Object.assign(new Error('Uno de los documentos supera el límite permitido.'), { status: 413 });
      await client.query('INSERT INTO documento (nombre_documento, tipo_documento, archivo, id_aspirante) VALUES ($1,$2,$3,$4)', [doc.nombreArchivo || doc.nombreDocumento || 'Documento', doc.tipoDocumento || doc.tipoArchivo || 'PDF', archivo, id]);
    }
    await client.query('COMMIT'); res.status(201).json({ idPostulacion: post.rows[0].id_postulacion, ...post.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); errorResponse(res, error, 'No fue posible registrar la postulación.'); } finally { client.release(); }
});

const ESTADOS_POSTULACION_DB = {
  'EN PROCESO': 'EN_REVISION',
  'EN REVISION': 'EN_REVISION',
  'EN_REVISION': 'EN_REVISION',
  'HOJA VIDA APROBADA': 'HOJA_VIDA_APROBADA',
  'HOJA_VIDA_APROBADA': 'HOJA_VIDA_APROBADA',
  'APROBADO RRHH': 'APROBADO_RRHH',
  'APROBADO_RRHH': 'APROBADO_RRHH',
  'RECHAZADO RRHH': 'RECHAZADO_RRHH',
  'RECHAZADO_RRHH': 'RECHAZADO_RRHH',
  'ENTREVISTA': 'ENTREVISTA_PENDIENTE',
  'ENTREVISTA PENDIENTE': 'ENTREVISTA_PENDIENTE',
  'ENTREVISTA_PENDIENTE': 'ENTREVISTA_PENDIENTE',
  'ENTREVISTA AGENDADA': 'ENTREVISTA_AGENDADA',
  'ENTREVISTA_AGENDADA': 'ENTREVISTA_AGENDADA',
  'ENTREVISTA APROBADA': 'ENTREVISTA_APROBADA',
  'ENTREVISTA_APROBADA': 'ENTREVISTA_APROBADA',
  'ENTREVISTA RECHAZADA': 'RECHAZADO',
  'ENTREVISTA_RECHAZADA': 'RECHAZADO',
  'EXAMENES PENDIENTES': 'EXAMENES_PENDIENTES',
  'EXAMENES_PENDIENTES': 'EXAMENES_PENDIENTES',
  'EXAMENES AGENDADOS': 'EXAMENES_AGENDADOS',
  'EXAMENES_AGENDADOS': 'EXAMENES_AGENDADOS',
  'EXAMENES PROGRAMADOS': 'EXAMENES_AGENDADOS',
  'EXAMENES_PROGRAMADOS': 'EXAMENES_AGENDADOS',
  'EXAMENES EN REVISION': 'EXAMENES_EN_REVISION',
  'EXAMENES_EN_REVISION': 'EXAMENES_EN_REVISION',
  'EXAMENES APROBADOS': 'EXAMENES_APROBADOS',
  'EXAMENES_APROBADOS': 'EXAMENES_APROBADOS',
  'PENDIENTE CONTRATO': 'PENDIENTE_CONTRATO',
  'PENDIENTE_CONTRATO': 'PENDIENTE_CONTRATO',
  'FIRMA CONTRATO AGENDADA': 'FIRMA_CONTRATO_AGENDADA',
  'FIRMA_CONTRATO_AGENDADA': 'FIRMA_CONTRATO_AGENDADA',
  'APROBADO': 'HOJA_VIDA_APROBADA',
  'RECHAZADO': 'RECHAZADO',
  'CANCELADO': 'CANCELADO',
  'CONTRATO': 'CONTRATADO',
  'CONTRATADO': 'CONTRATADO'
};

function normalizarEstadoPostulacion(value) {
  const normalized = String(value || '').trim().toUpperCase().replace(/_/g, ' ');
  return ESTADOS_POSTULACION_DB[normalized] || null;
}

app.patch('/api/postulaciones/:id', async (req, res) => {
  const estadoRecibido = req.body.estado || req.body.estadoPostulacion;
  const estadoNormalizado = normalizarEstadoPostulacion(estadoRecibido);
  if (!estadoNormalizado) return res.status(400).json({ error: 'Estado de postulación no válido.' });
  try {
    const result = await db.query('UPDATE postulacion SET estado = $1, fecha_rechazo = CASE WHEN $1 = \'RECHAZADO\' THEN CURRENT_DATE ELSE fecha_rechazo END, motivo_rechazo = CASE WHEN $1 = \'RECHAZADO\' THEN COALESCE($3, motivo_rechazo, \'\') ELSE motivo_rechazo END WHERE id_postulacion = $2 RETURNING *', [estadoNormalizado, req.params.id, req.body.motivoRechazo || req.body.motivo || null]);
    if (!result.rowCount) return res.status(404).json({ error: 'Postulación no encontrada.' });
    res.json(result.rows[0]);
  } catch (error) {
    errorResponse(res, error, 'No fue posible actualizar el estado.');
  }
});

app.patch('/api/postulaciones/:id/datos', async (req, res) => {
  const { nombre, nombreCompleto, apellido, correo, email, telefono, direccion, ciudad, documento, cedula } = req.body;
  try { const post = await db.query('SELECT id_aspirante FROM postulacion WHERE id_postulacion = $1', [req.params.id]); if (!post.rowCount) return res.status(404).json({ error: 'Postulación no encontrada.' }); const id = post.rows[0].id_aspirante; const names = splitName(nombreCompleto || nombre); await db.query('UPDATE aspirante SET nombre_completo=$1, correo=$2, telefono=$3, direccion=$4, numero_documento=$5 WHERE id_aspirante=$6', [`${names.nombre} ${apellido || names.apellido}`.trim(), correo || email, telefono, direccion || ciudad, documento || cedula, id]); const result = await db.query(`${postulacionQuery} WHERE p.id_postulacion = $1`, [req.params.id]); res.json(result.rows[0]); }
  catch (error) { errorResponse(res, error, 'No fue posible actualizar el candidato.'); }
});

app.delete('/api/postulaciones/:id', async (req, res) => {
  const client = await db.connect(); try { await client.query('BEGIN'); const p = await client.query('SELECT id_aspirante FROM postulacion WHERE id_postulacion = $1', [req.params.id]); if (!p.rowCount) return res.status(404).json({ error: 'Postulación no encontrada.' }); const id = p.rows[0].id_aspirante; await client.query('DELETE FROM evaluacion WHERE id_entrevista IN (SELECT id_entrevista FROM entrevista WHERE id_postulacion = $1)', [req.params.id]); await client.query('DELETE FROM entrevista WHERE id_postulacion = $1', [req.params.id]); await client.query('DELETE FROM evidencia WHERE id_postulacion = $1', [req.params.id]); await client.query('DELETE FROM postulacion WHERE id_postulacion = $1', [req.params.id]); await client.query('DELETE FROM documento WHERE id_aspirante = $1', [id]); await client.query('DELETE FROM aspirante WHERE id_aspirante = $1', [id]); await client.query('COMMIT'); res.status(204).end(); } catch (error) { await client.query('ROLLBACK'); errorResponse(res, error, 'No fue posible eliminar la postulación.'); } finally { client.release(); }
});

app.get('/api/entrevistas', async (_req, res) => {
  try {
    const result = await db.query(`
      SELECT
        e.id_entrevista,
        e.fecha_entrevista,
        e.hora_entrevista,
        e.modalidad,
        e.estado AS resultado,
        e.observacion AS observaciones,
        s.id_seleccionado,
        s.id_postulacion,
        p.id_aspirante,
        po.nombre_completo AS candidato,
        v.nombre_cargo AS cargo
      FROM entrevista e
      JOIN aspirantes_seleccionados s ON s.id_seleccionado = e.id_seleccionado
      JOIN postulacion p ON p.id_postulacion = s.id_postulacion
      JOIN aspirante po ON po.id_aspirante = p.id_aspirante
      JOIN vacante v ON v.id_vacante = p.id_vacante
      ORDER BY e.fecha_entrevista DESC, e.hora_entrevista DESC
    `);
    res.json(result.rows);
  } catch (error) {
    errorResponse(res, error, 'No fue posible consultar entrevistas.');
  }
});

app.get('/api/entrevistas/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT e.*, e.estado AS resultado, e.observacion AS observaciones,
             p.id_aspirante, p.estado AS estado_postulacion,
             a.nombre_completo AS candidato, a.numero_documento, a.correo, a.telefono,
             v.nombre_cargo AS cargo, COALESCE(s.nombre_sede, 'Sin sede') AS nombre_sede,
             u.nombre_completo AS entrevistador
      FROM entrevista e
      JOIN postulacion p ON p.id_postulacion = e.id_postulacion
      JOIN aspirante a ON a.id_aspirante = p.id_aspirante
      JOIN vacante v ON v.id_vacante = p.id_vacante
      LEFT JOIN sede s ON s.id_sede = v.id_sede
      LEFT JOIN usuario u ON u.id_usuario = e.id_gerente
      WHERE e.id_entrevista = $1 OR e.id_postulacion = $1
      ORDER BY e.id_entrevista DESC
      LIMIT 1
    `, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Entrevista no encontrada.' });
    const entrevista = result.rows[0];
    const evaluacion = await db.query('SELECT * FROM evaluacion WHERE id_entrevista = $1 ORDER BY id_evaluacion DESC LIMIT 1', [entrevista.id_entrevista]);
    res.json({ ...entrevista, evaluacion: evaluacion.rows[0] || null });
  } catch (error) {
    errorResponse(res, error, 'No fue posible consultar la entrevista.');
  }
});

app.post('/api/entrevistas', async (req, res) => {
  const {
    idPostulacion,
    fecha,
    fechaEntrevista,
    hora = '09:00',
    modalidad = 'Presencial',
    indicaciones = '',
    observaciones = '',
    idGerente
  } = req.body;

  try {
    const approved = await db.query(
        `SELECT id_postulacion
       FROM postulacion
       WHERE id_postulacion = $1
          AND estado IN ('APROBADO', 'APROBADO_RRHH', 'HOJA_VIDA_APROBADA', 'ENTREVISTA_PENDIENTE')`,
        [idPostulacion]
    );

    if (!approved.rowCount) {
      return res.status(400).json({
        error: 'La postulación debe estar aprobada antes de agendar la entrevista.'
      });
    }

    const rrhhOwner = await db.query('SELECT id_rrhh FROM recursos_humanos WHERE activo = true ORDER BY id_rrhh LIMIT 1');
    const idRrhh = rrhhOwner.rows[0]?.id_rrhh || null;
    const selected = await db.query(
        `INSERT INTO aspirantes_seleccionados
         (id_postulacion, fecha_seleccion, estado, id_rrhh)
       VALUES ($1, CURRENT_DATE, 'SELECCIONADO_EN_PROCESO', $2)
       ON CONFLICT (id_postulacion) DO UPDATE
         SET estado = EXCLUDED.estado,
             id_rrhh = EXCLUDED.id_rrhh
       RETURNING id_seleccionado`,
        [idPostulacion, idRrhh]
    );

    const modalidadDB = String(modalidad).toLowerCase().includes('virtual')
        ? 'Virtual'
        : 'Presencial';

    const gerenteResult = await db.query(`
      SELECT id_usuario
      FROM usuario
      WHERE activo = true
        AND LOWER(TRIM(rol)) IN ('gerente', 'gerencia')
      ORDER BY id_usuario
      LIMIT 1
    `);
    const gerenteId = gerenteResult.rows[0]?.id_usuario || null;
    if (!gerenteId) {
      return res.status(400).json({ error: 'No existe un usuario activo con rol Gerente. Registra o activa el gerente antes de agendar.' });
    }

    const result = await db.query(`
  INSERT INTO entrevista
    (fecha_entrevista, hora_entrevista, modalidad, estado, observacion,
     id_seleccionado, id_gerente, id_postulacion)
  VALUES ($1, $2, $3, 'PROGRAMADA', $4, $5, $6, $7)
  RETURNING *
`, [
      fecha || fechaEntrevista,
      hora,
      modalidadDB,
      indicaciones || observaciones,
      selected.rows[0].id_seleccionado,
      gerenteId,
      idPostulacion
    ]);

    await db.query(
        `UPDATE postulacion
       SET estado = 'ENTREVISTA_AGENDADA'
       WHERE id_postulacion = $1`,
        [idPostulacion]
    );

    res.status(201).json({
      ...result.rows[0],
      id_entrevista: result.rows[0].id_entrevista,
      hora_entrevista: hora,
      observaciones: result.rows[0].observacion,
      resultado: result.rows[0].estado
    });
  } catch (error) {
    console.error('Error al guardar entrevista:', error);
    errorResponse(res, error, 'No fue posible guardar la entrevista.');
  }
});

app.patch('/api/entrevistas/:id', async (req, res) => {
  const {
    fecha,
    fechaEntrevista,
    modalidad,
    observaciones = '',
    hora,
    horaEntrevista,
    resultado,
    estado
  } = req.body;

  const estadoRecibido = String(estado || resultado || 'PROGRAMADA')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');

  const estadoDB = {
    PENDIENTE: 'PROGRAMADA',
    PROGRAMADA: 'PROGRAMADA',
    REALIZADA: 'REALIZADA',
    CANCELADA: 'CANCELADA'
  }[estadoRecibido] || 'PROGRAMADA';

  const modalidadDB = modalidad
      ? (String(modalidad).toLowerCase().includes('virtual') ? 'Virtual' : 'Presencial')
      : null;

  try {
    const result = await db.query(`
      UPDATE entrevista
      SET fecha_entrevista = COALESCE($1, fecha_entrevista),
          hora_entrevista = COALESCE($2, hora_entrevista),
          modalidad = COALESCE($3, modalidad),
          observacion = $4,
          estado = $5
      WHERE id_seleccionado = $6
      RETURNING *
    `, [
      fecha || fechaEntrevista || null,
      hora || horaEntrevista || null,
      modalidadDB,
      observaciones,
      estadoDB,
      req.params.id
    ]);

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Entrevista no encontrada.' });
    }

    res.json({
      ...result.rows[0],
      id_entrevista: result.rows[0].id_seleccionado,
      observaciones: result.rows[0].observacion,
      resultado: result.rows[0].estado
    });
  } catch (error) {
    errorResponse(res, error, 'No fue posible actualizar la entrevista.');
  }
});

app.delete('/api/entrevistas/:id', async (req, res) => {
  try {
    const result = await db.query(
        `DELETE FROM entrevista
       WHERE id_seleccionado = $1
       RETURNING id_seleccionado`,
        [req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Entrevista no encontrada.' });
    }

    res.status(204).end();
  } catch (error) {
    errorResponse(res, error, 'No fue posible eliminar la entrevista.');
  }
});

app.get('/api/documentos', async (req, res) => { try { const values=[]; let clause=''; if(req.query.idPostulante){values.push(req.query.idPostulante); clause='WHERE d.id_aspirante=$1';} const result=await db.query(`SELECT d.*, po.nombre_completo AS aspirante FROM documento d JOIN aspirante po ON po.id_aspirante=d.id_aspirante ${clause} ORDER BY d.id_documento DESC`, values); res.json(result.rows); } catch(error){errorResponse(res,error,'No fue posible consultar documentos.');} });
app.get('/api/documentos/:id/archivo', async (req, res) => {
  try {
    const result = await db.query('SELECT archivo, tipo_documento, nombre_documento FROM documento WHERE id_documento = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).send('Documento no encontrado.');
    const documento = result.rows[0];
    const valor = String(documento.archivo || '');
    if (!valor || valor === 'pendiente') return res.status(404).send('Este documento no tiene un archivo guardado.');
    if (/^https?:\/\//i.test(valor)) return res.redirect(valor);
    const match = valor.match(/^data:([^;]+);base64,(.*)$/s);
    const mime = match?.[1] || ({ FOTO: 'image/jpeg', CEDULA: 'application/pdf', HOJA_DE_VIDA: 'application/pdf' }[String(documento.tipo_documento).toUpperCase()] || 'application/octet-stream');
    const contenido = match ? Buffer.from(match[2], 'base64') : Buffer.from(valor, 'base64');
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="${String(documento.nombre_documento || 'documento').replace(/[^a-z0-9_.-]/gi, '_')}"`);
    res.send(contenido);
  } catch (error) { errorResponse(res, error, 'No fue posible abrir el documento.'); }
});
app.post('/api/documentos', async (req,res)=>{const {nombreDocumento,nombreArchivo='Documento',tipoDocumento,tipoArchivo='PDF',archivo='pendiente',rutaArchivo,idPostulante,idAspirante}=req.body; try{const r=await db.query('INSERT INTO documento (nombre_documento,tipo_documento,archivo,id_aspirante) VALUES ($1,$2,$3,$4) RETURNING *',[nombreDocumento||nombreArchivo,tipoDocumento||tipoArchivo,rutaArchivo||archivo,idPostulante||idAspirante]);res.status(201).json(r.rows[0]);}catch(error){errorResponse(res,error,'No fue posible crear documento.');}});
app.patch('/api/documentos/:id', async(req,res)=>{const {nombreDocumento,nombreArchivo,tipoDocumento,tipoArchivo,archivo,rutaArchivo}=req.body; try{const r=await db.query('UPDATE documento SET nombre_documento=COALESCE($1,nombre_documento),tipo_documento=COALESCE($2,tipo_documento),archivo=COALESCE($3,archivo) WHERE id_documento=$4 RETURNING *',[nombreDocumento||nombreArchivo,tipoDocumento||tipoArchivo,rutaArchivo||archivo,req.params.id]);if(!r.rowCount)return res.status(404).json({error:'Documento no encontrado.'});res.json(r.rows[0]);}catch(error){errorResponse(res,error,'No fue posible actualizar documento.');}});
app.delete('/api/documentos/:id', async(req,res)=>{try{const r=await db.query('DELETE FROM documento WHERE id_documento=$1 RETURNING id_documento',[req.params.id]);if(!r.rowCount)return res.status(404).json({error:'Documento no encontrado.'});res.status(204).end();}catch(error){errorResponse(res,error,'No fue posible eliminar documento.');}});

app.get('/api/evaluaciones', async (_req,res)=>{try{const r=await db.query('SELECT ev.*, e.id_postulacion FROM evaluacion ev JOIN entrevista e ON e.id_entrevista=ev.id_entrevista ORDER BY ev.id_evaluacion DESC');res.json(r.rows);}catch(error){errorResponse(res,error,'No fue posible consultar evaluaciones.');}});
app.post('/api/evaluaciones', async(req,res)=>{const {preguntas='Evaluación gerencial',calificacion=0,comentarios='',idEntrevista}=req.body;try{const r=await db.query('INSERT INTO evaluacion (preguntas,calificacion,comentarios,id_entrevista) VALUES ($1,$2,$3,$4) RETURNING *',[preguntas,calificacion,comentarios,idEntrevista]);res.status(201).json(r.rows[0]);}catch(error){errorResponse(res,error,'No fue posible guardar evaluación.');}});

app.get('/api/contratos', async (req, res) => {
  try {
    const values = [];
    let clause = '';
    if (req.query.idPostulacion) { values.push(req.query.idPostulacion); clause = 'WHERE c.id_postulacion = $1'; }
    const result = await db.query(`SELECT c.*, p.id_aspirante, p.id_vacante, po.nombre_completo AS trabajador, po.numero_documento, po.correo, po.telefono, v.nombre_cargo AS cargo FROM contrato c JOIN postulacion p ON p.id_postulacion=c.id_postulacion JOIN aspirante po ON po.id_aspirante=p.id_aspirante JOIN vacante v ON v.id_vacante=p.id_vacante ${clause} ORDER BY c.id_contrato DESC`, values);
    res.json(result.rows);
  } catch (error) { errorResponse(res, error, 'No fue posible consultar contratos.'); }
});

app.get('/api/contratos/:id', async (req, res) => {
  try { const result = await db.query('SELECT * FROM contrato WHERE id_contrato=$1', [req.params.id]); if (!result.rowCount) return res.status(404).json({ error: 'Contrato no encontrado.' }); res.json(result.rows[0]); }
  catch (error) { errorResponse(res, error, 'No fue posible consultar el contrato.'); }
});

app.post('/api/contratos', async (req, res) => {
  const { idPostulacion, fechaInicio = new Date(), fechaFin = null, tipoContrato = 'Término Fijo', salario = 1423500, estado = 'Borrador', observaciones = '' } = req.body;
  if (!idPostulacion || !fechaInicio) return res.status(400).json({ error: 'La postulación y la fecha de inicio son obligatorias.' });
  try {
    const post = await db.query("SELECT id_postulacion FROM postulacion WHERE id_postulacion=$1 AND estado IN ('PENDIENTE_CONTRATO','EXAMENES_APROBADOS','FIRMA_CONTRATO_AGENDADA')", [idPostulacion]);
    if (!post.rowCount) return res.status(400).json({ error: 'Solo se puede crear contrato cuando los exámenes están aprobados.' });
    const result = await db.query('INSERT INTO contrato (id_postulacion, fecha_inicio, fecha_fin, tipo_contrato, salario, estado, observaciones) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [idPostulacion, fechaInicio, fechaFin, tipoContrato, salario, estado, observaciones]);
    res.status(201).json(result.rows[0]);
  } catch (error) { errorResponse(res, error, 'No fue posible crear el contrato.'); }
});

app.patch('/api/contratos/:id', async (req, res) => {
  const { fechaInicio, fechaFin, tipoContrato, salario, estado, observaciones } = req.body;
  try {
    const result = await db.query('UPDATE contrato SET fecha_inicio=COALESCE($1,fecha_inicio), fecha_fin=COALESCE($2,fecha_fin), tipo_contrato=COALESCE($3,tipo_contrato), salario=COALESCE($4,salario), estado=COALESCE($5,estado), observaciones=COALESCE($6,observaciones) WHERE id_contrato=$7 RETURNING *', [fechaInicio, fechaFin, tipoContrato, salario, estado, observaciones, req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Contrato no encontrado.' });
    res.json(result.rows[0]);
  } catch (error) { errorResponse(res, error, 'No fue posible actualizar el contrato.'); }
});

app.delete('/api/contratos/:id', async (req, res) => {
  try { const result = await db.query('DELETE FROM contrato WHERE id_contrato=$1 RETURNING id_contrato', [req.params.id]); if (!result.rowCount) return res.status(404).json({ error: 'Contrato no encontrado.' }); res.status(204).end(); }
  catch (error) { errorResponse(res, error, 'No fue posible eliminar el contrato.'); }
});

app.get('/api/trabajadores', async (_req, res) => {
  try { const result = await db.query(`SELECT c.id_contrato, c.id_postulacion, c.fecha_inicio, c.fecha_fin, c.tipo_contrato, c.salario, c.estado, po.id_aspirante, po.nombre_completo AS trabajador, po.numero_documento, po.correo, v.nombre_cargo AS cargo FROM contrato c JOIN postulacion p ON p.id_postulacion=c.id_postulacion JOIN aspirante po ON po.id_aspirante=p.id_aspirante JOIN vacante v ON v.id_vacante=p.id_vacante ORDER BY c.fecha_inicio DESC`); res.json(result.rows); }
  catch (error) { errorResponse(res, error, 'No fue posible consultar trabajadores.'); }
});

app.get('/api/reportes', async (_req, res) => {
  try {
    const [historial, estadisticas] = await Promise.all([
      db.query('SELECT * FROM vista_historial_aspirante ORDER BY ultima_postulacion DESC NULLS LAST'),
      db.query('SELECT * FROM vista_estadistica_postulaciones ORDER BY periodo_inicio DESC')
    ]);
    res.json({ historial: historial.rows, estadisticas: estadisticas.rows });
  } catch (viewError) {
    try {
      const [historial, estadisticas] = await Promise.all([
        db.query(`
          SELECT a.id_aspirante, a.tipo_documento, a.numero_documento, a.nombre_completo,
                 COUNT(p.id_postulacion)::int AS total_postulaciones,
                 MAX(p.fecha_postulacion) AS ultima_postulacion
          FROM aspirante a
          JOIN postulacion p ON p.id_aspirante = a.id_aspirante
          GROUP BY a.id_aspirante, a.tipo_documento, a.numero_documento, a.nombre_completo
          ORDER BY ultima_postulacion DESC NULLS LAST
        `),
        db.query(`
          SELECT ROW_NUMBER() OVER (ORDER BY DATE_TRUNC('month', p.fecha_postulacion) DESC)::int AS periodo_id,
                 'MES'::varchar AS tipo_periodo,
                 DATE_TRUNC('month', p.fecha_postulacion)::date AS periodo_inicio,
                 (DATE_TRUNC('month', p.fecha_postulacion) + INTERVAL '1 month - 1 day')::date AS periodo_fin,
                 COUNT(*)::int AS total_postulaciones
          FROM postulacion p
          GROUP BY DATE_TRUNC('month', p.fecha_postulacion)
          ORDER BY periodo_inicio DESC
        `)
      ]);
      res.json({ historial: historial.rows, estadisticas: estadisticas.rows });
    } catch (error) {
      errorResponse(res, error, 'No fue posible cargar reportes y estadísticas.');
    }
  }
});



// ==================== Flujo ampliado de selección SIDOVI ====================
const EXAM_TYPES = ['Examen médico ocupacional', 'Examen visual', 'Examen auditivo', 'Examen de laboratorio', 'Otros exámenes requeridos'];
const INTERVIEW_CRITERIA = ['Presentación personal','Comunicación','Actitud','Experiencia verificada','Conocimiento relacionado con el cargo','Aptitud para el cargo','Trabajo en equipo','Responsabilidad','Puntualidad','Capacidad de resolución de problemas','Manejo de presión','Adaptabilidad','Motivación','Perfil profesional'];
const pdfEscape = (value) => String(value ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[\r\n]+/g, ' ');
// Genera un PDF con encabezado, regla, cuerpo y pie de página, sin dependencias externas
// (sintaxis PDF 1.4 escrita a mano). subtitle es opcional (cargo/fecha/candidato, etc.).
function makeSimplePdf(title, rows, subtitle) {
  const generado = `SIDOVI · Colviseg Ltda. · Generado: ${new Date().toLocaleString('es-CO')}`;
  const bodyLines = [subtitle, ...rows].filter(Boolean).slice(0, 62);
  const ops = [];
  ops.push('BT', '/F2 18 Tf', '50 790 Td', `(${pdfEscape(title).slice(0, 90)}) Tj`, 'ET');
  ops.push('BT', '/F1 9 Tf', '50 772 Td', `(${pdfEscape(generado)}) Tj`, 'ET');
  ops.push('q 0.6 0.6 0.6 RG 1 w 50 762 m 562 762 l S Q');
  ops.push('BT', '/F1 10.5 Tf', '50 742 Td');
  bodyLines.forEach((line, i) => {
    ops.push(`(${pdfEscape(line).slice(0, 118)}) Tj`);
    if (i < bodyLines.length - 1) ops.push('0 -16 Td');
  });
  ops.push('ET');
  ops.push('q 0.6 0.6 0.6 RG 1 w 50 55 m 562 55 l S Q');
  ops.push('BT', '/F1 8 Tf', '50 42 Td', '(SIDOVI \\267 Sistema Integral de Documentacion y Vinculacion \\267 Colviseg Ltda.) Tj', 'ET');
  const content = ops.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'
  ];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((obj, i) => { offsets[i + 1] = Buffer.byteLength(pdf); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
// ---- PDF profesional de la entrevista gerencial (logo, colores, firma) ----
const LOGO_SIDOVI_PATH = path.join(__dirname, 'img', 'logo_sidovi.png');
const PDF_COLOR_NAVY = '#020621';
const PDF_COLOR_ACCENT = '#1e5aad';
const PDF_COLOR_GRAY = '#5b6b7c';
const PDF_COLOR_GRAY_BG = '#f4f6fa';
const PDF_COLOR_BORDER = '#dde3ed';
const PDF_COLOR_OK = '#1f7a4d';
const PDF_COLOR_NO = '#c8192b';

function generarPdfEntrevista(res, { row, comentarios, preguntas }) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="sidovi-entrevista-${row.id_entrevista}.pdf"`);
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const marginX = 50;
  const contentWidth = pageWidth - marginX * 2;

  // Encabezado con logo y marca
  doc.rect(0, 0, pageWidth, 92).fill(PDF_COLOR_NAVY);
  try { if (fs.existsSync(LOGO_SIDOVI_PATH)) doc.image(LOGO_SIDOVI_PATH, marginX, 20, { width: 48 }); } catch (_) { /* logo opcional */ }
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('SIDOVI', marginX + 62, 26);
  doc.font('Helvetica').fontSize(10).fillColor('#c9d4e3').text('Colviseg Ltda. · Sistema de Vinculación', marginX + 62, 50);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#ffffff').text('Informe de Entrevista Gerencial', marginX, 26, { width: contentWidth, align: 'right' });

  doc.y = 118;
  doc.x = marginX;

  // Panel con datos de la entrevista
  const infoTop = doc.y;
  const infoHeight = 96;
  doc.roundedRect(marginX, infoTop, contentWidth, infoHeight, 8).fill(PDF_COLOR_GRAY_BG);
  const colWidth = contentWidth / 2;
  const filas = [
    ['Candidato', row.nombre_completo || '—'],
    ['Documento', row.numero_documento || '—'],
    ['Cargo', row.cargo || '—'],
    ['Fecha y hora', `${String(row.fecha_entrevista || '').slice(0, 10)} ${String(row.hora_entrevista || '').slice(0, 5)}`],
    ['Entrevistador', row.entrevistador || 'Gerencia'],
    ['Modalidad', row.modalidad || '—']
  ];
  filas.forEach(([label, value], i) => {
    const colX = marginX + 20 + (i % 2) * colWidth;
    const rowY = infoTop + 14 + Math.floor(i / 2) * 26;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PDF_COLOR_GRAY).text(label.toUpperCase(), colX, rowY);
    doc.font('Helvetica').fontSize(11).fillColor('#1e2a38').text(value, colX, rowY + 11, { width: colWidth - 40 });
  });

  doc.y = infoTop + infoHeight + 26;

  // Preguntas agrupadas por categoría
  const grupos = [];
  preguntas.forEach((p) => {
    let grupo = grupos.find((g) => g.categoria === (p.categoria || 'Entrevista'));
    if (!grupo) { grupo = { categoria: p.categoria || 'Entrevista', items: [] }; grupos.push(grupo); }
    grupo.items.push(p);
  });

  function checkPageBreak(altura) {
    if (doc.y + altura > doc.page.height - 90) {
      doc.addPage();
      doc.x = marginX;
      doc.y = 50;
    }
  }

  grupos.forEach((grupo) => {
    checkPageBreak(50);
    doc.rect(marginX, doc.y, 4, 16).fill(PDF_COLOR_ACCENT);
    doc.font('Helvetica-Bold').fontSize(12.5).fillColor(PDF_COLOR_ACCENT).text(grupo.categoria, marginX + 12, doc.y - 1);
    doc.moveDown(0.6);

    grupo.items.forEach((item) => {
      const respuestaTexto = item.respuesta || 'Sin respuesta registrada.';
      const preguntaHeight = doc.heightOfString(item.pregunta || '', { width: contentWidth, fontSize: 10.5 });
      const respuestaHeight = doc.heightOfString(respuestaTexto, { width: contentWidth, fontSize: 10.5 });
      checkPageBreak(preguntaHeight + respuestaHeight + 24);

      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#1e2a38').text(item.pregunta || '', marginX, doc.y, { width: contentWidth });
      doc.moveDown(0.25);
      doc.font('Helvetica').fontSize(10.5).fillColor(PDF_COLOR_GRAY).text(respuestaTexto, marginX, doc.y, { width: contentWidth });
      doc.moveDown(0.9);
    });
    doc.moveDown(0.3);
  });

  // Observaciones generales
  checkPageBreak(70);
  doc.rect(marginX, doc.y, 4, 16).fill(PDF_COLOR_ACCENT);
  doc.font('Helvetica-Bold').fontSize(12.5).fillColor(PDF_COLOR_ACCENT).text('Observaciones generales', marginX + 12, doc.y - 1);
  doc.moveDown(0.6);
  const obsTexto = comentarios.observaciones || row.observacion || 'Sin observaciones adicionales.';
  doc.font('Helvetica').fontSize(10.5).fillColor('#1e2a38').text(obsTexto, marginX, doc.y, { width: contentWidth });
  doc.moveDown(1);

  [['Fortalezas', comentarios.fortalezas], ['Aspectos por mejorar', comentarios.aspectosMejora], ['Recomendación', comentarios.recomendacion]]
    .filter(([, value]) => value)
    .forEach(([label, value]) => {
      checkPageBreak(40);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(PDF_COLOR_GRAY).text(`${label}:`, marginX, doc.y);
      doc.font('Helvetica').fontSize(10.5).fillColor('#1e2a38').text(value, marginX, doc.y + 2, { width: contentWidth });
      doc.moveDown(0.8);
    });

  // Resultado final (insignia de color)
  checkPageBreak(90);
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(12.5).fillColor(PDF_COLOR_NAVY).text('Resultado de la entrevista', marginX, doc.y);
  doc.moveDown(0.6);

  const resultado = String(comentarios.resultado || row.estado || 'PENDIENTE').toUpperCase();
  const esAprobado = resultado === 'APROBADO';
  const esRechazado = resultado === 'RECHAZADO';
  const colorFondo = esAprobado ? PDF_COLOR_OK : esRechazado ? PDF_COLOR_NO : '#93a3b5';
  const textoResultado = esAprobado ? 'APROBADO' : esRechazado ? 'NO APROBADO' : 'PENDIENTE';

  doc.roundedRect(marginX, doc.y, 170, 30, 6).fill(colorFondo);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#ffffff').text(textoResultado, marginX, doc.y + 9, { width: 170, align: 'center' });
  doc.y += 46;

  // Espacio de firmas
  checkPageBreak(70);
  const firmaY = doc.y + 30;
  doc.moveTo(marginX, firmaY).lineTo(marginX + 210, firmaY).strokeColor(PDF_COLOR_BORDER).stroke();
  doc.font('Helvetica').fontSize(9).fillColor(PDF_COLOR_GRAY).text('Firma del entrevistador', marginX, firmaY + 6);

  doc.moveTo(marginX + contentWidth - 210, firmaY).lineTo(marginX + contentWidth, firmaY).strokeColor(PDF_COLOR_BORDER).stroke();
  doc.text('Firma del candidato', marginX + contentWidth - 210, firmaY + 6);

  // Pie de página en todas las hojas
  const rango = doc.bufferedPageRange();
  for (let i = rango.start; i < rango.start + rango.count; i++) {
    doc.switchToPage(i);
    doc.font('Helvetica').fontSize(8).fillColor('#96a1ac');
    doc.text(`SIDOVI · Colviseg Ltda. · Generado el ${new Date().toLocaleString('es-CO')}`, marginX, doc.page.height - 40, { width: contentWidth - 80 });
    doc.text(`Página ${i - rango.start + 1} de ${rango.count}`, marginX + contentWidth - 80, doc.page.height - 40, { width: 80, align: 'right' });
  }

  doc.end();
}

const MENSAJES_NOTIFICACION_ESTADO = {
  EXAMENES_PENDIENTES: 'Tu entrevista fue aprobada. En los próximos días te contactaremos para programar tus exámenes.',
  RECHAZADO: 'Gracias por participar en nuestro proceso de selección. En esta oportunidad no continuarás en el proceso.'
};
async function logTransition(client, idPostulacion, nuevo, detalle, usuarioId) {
  const old = await client.query('SELECT estado FROM postulacion WHERE id_postulacion=$1', [idPostulacion]);
  await client.query('UPDATE postulacion SET estado=$1 WHERE id_postulacion=$2', [nuevo, idPostulacion]);
  await client.query('INSERT INTO historial_proceso (id_postulacion, estado_anterior, estado_nuevo, detalle, usuario_id) VALUES ($1,$2,$3,$4,$5)', [idPostulacion, old.rows[0]?.estado || null, nuevo, detalle || '', usuarioId || null]);
  const mensaje = MENSAJES_NOTIFICACION_ESTADO[nuevo];
  if (mensaje) await client.query('INSERT INTO notificacion (mensaje, leida, id_usuario, id_postulacion) VALUES ($1,false,$2,$3)', [mensaje, usuarioId || null, idPostulacion]);
}

app.get('/api/reportes/detallado', requireRoles('RRHH', 'Gerente'), async (req, res) => {
  try {
    const values = []; const where = [];
    if (req.query.desde) { values.push(req.query.desde); where.push(`p.fecha_postulacion >= $${values.length}`); }
    if (req.query.hasta) { values.push(req.query.hasta); where.push(`p.fecha_postulacion <= $${values.length}`); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [summary, monthly, states, vacancy, gender, history] = await Promise.all([
      db.query(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE p.estado NOT ILIKE '%RECHAZ%')::int en_proceso, COUNT(*) FILTER (WHERE p.estado ILIKE '%RECHAZ%')::int rechazados, COUNT(*) FILTER (WHERE p.estado ILIKE '%CONTRAT%')::int contratados, MIN(p.fecha_postulacion) fecha_inicial, MAX(p.fecha_postulacion) fecha_final FROM postulacion p ${clause}`, values),
      db.query(`SELECT TO_CHAR(DATE_TRUNC('month',p.fecha_postulacion),'YYYY-MM') periodo, COUNT(*)::int cantidad FROM postulacion p ${clause} GROUP BY 1 ORDER BY 1`, values),
      db.query(`SELECT p.estado, COUNT(*)::int cantidad FROM postulacion p ${clause} GROUP BY p.estado ORDER BY cantidad DESC`, values),
      db.query(`SELECT v.titulo vacante, COALESCE(v.nombre_cargo,c.nombre_cargo,'Sin cargo') cargo, COALESCE(s.nombre_sede,'Sin sede') sede, COUNT(*)::int cantidad FROM postulacion p JOIN vacante v ON v.id_vacante=p.id_vacante LEFT JOIN cargo c ON c.id_cargo=v.id_cargo LEFT JOIN sede s ON s.id_sede=v.id_sede ${clause} GROUP BY v.titulo,v.nombre_cargo,c.nombre_cargo,s.nombre_sede ORDER BY cantidad DESC`, values),
      db.query(`SELECT COALESCE(NULLIF(a.sexo,''),'No registrado') sexo, COUNT(*)::int cantidad FROM postulacion p JOIN aspirante a ON a.id_aspirante=p.id_aspirante ${clause} GROUP BY 1 ORDER BY cantidad DESC`, values),
      db.query(`SELECT p.id_postulacion,p.fecha_postulacion,a.nombre_completo,a.tipo_documento,a.numero_documento,a.correo,a.telefono,v.nombre_cargo cargo,COALESCE(s.nombre_sede,'Sin sede') sede,p.estado,p.motivo_rechazo,p.fecha_rechazo,p.fecha_contratacion FROM postulacion p JOIN aspirante a ON a.id_aspirante=p.id_aspirante JOIN vacante v ON v.id_vacante=p.id_vacante LEFT JOIN sede s ON s.id_sede=v.id_sede ${clause} ORDER BY a.nombre_completo,p.fecha_postulacion`, values)
    ]);
    res.json({ generadoEn: new Date().toISOString(), resumen: summary.rows[0], mensual: monthly.rows, estados: states.rows, porVacante: vacancy.rows, genero: gender.rows, historial: history.rows });
  } catch (error) { errorResponse(res, error, 'No fue posible generar el reporte detallado. Ejecuta la migración 007.'); }
});
app.get('/api/reportes/historial/:idAspirante', requireRoles('RRHH', 'Gerente'), async (req, res) => {
  try {
    const r = await db.query(`SELECT a.*, p.id_postulacion,p.fecha_postulacion,p.estado,p.resultado,p.fecha_rechazo,p.motivo_rechazo,p.fecha_contratacion,v.titulo vacante,v.nombre_cargo cargo,COALESCE(s.nombre_sede,'Sin sede') sede,e.estado resultado_entrevista,e.observacion observaciones_entrevista,ex.estado estado_examen,ex.fecha fecha_examen,ex.hora hora_examen,ex.lugar lugar_examen,cf.fecha_firma_programada fecha_firma FROM aspirante a JOIN postulacion p ON p.id_aspirante=a.id_aspirante JOIN vacante v ON v.id_vacante=p.id_vacante LEFT JOIN sede s ON s.id_sede=v.id_sede LEFT JOIN entrevista e ON e.id_postulacion=p.id_postulacion LEFT JOIN examen_programado ex ON ex.id_postulacion=p.id_postulacion LEFT JOIN contrato cf ON cf.id_postulacion=p.id_postulacion WHERE a.id_aspirante=$1 ORDER BY p.fecha_postulacion`, [req.params.idAspirante]);
    if (!r.rowCount) return res.status(404).json({ error: 'Aspirante sin historial.' });
    res.json({ aspirante: r.rows[0], historial: r.rows });
  } catch (error) { errorResponse(res, error, 'No fue posible consultar el historial.'); }
});
app.get('/api/reportes/pdf', requireRoles('RRHH', 'Gerente'), async (req, res) => {
  try {
    const r = await db.query(`SELECT p.id_postulacion,p.fecha_postulacion,a.nombre_completo,v.nombre_cargo cargo,p.estado FROM postulacion p JOIN aspirante a ON a.id_aspirante=p.id_aspirante JOIN vacante v ON v.id_vacante=p.id_vacante ORDER BY p.fecha_postulacion DESC LIMIT 60`);
    const pdf = makeSimplePdf(`Reporte SIDOVI · ${req.query.tipo || 'Estadísticas de postulaciones'}`, r.rows.map(x => `${x.fecha_postulacion} | ${x.nombre_completo} | ${x.cargo} | ${x.estado}`));
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', 'attachment; filename="sidovi-reporte.pdf"'); res.send(pdf);
  } catch (error) { errorResponse(res, error, 'No fue posible generar el PDF.'); }
});

app.get('/api/entrevistas/:id/pdf', requireRoles('Gerente'), async (req, res) => {
  try {
    const r = await db.query(`
      SELECT e.id_entrevista,e.fecha_entrevista,e.hora_entrevista,e.modalidad,e.estado,e.observacion,
             a.nombre_completo,a.numero_documento,a.correo,a.telefono,
             v.nombre_cargo AS cargo,u.nombre_completo AS entrevistador,
             ev.preguntas,ev.calificacion,ev.comentarios
      FROM entrevista e
      JOIN postulacion p ON p.id_postulacion=e.id_postulacion
      JOIN aspirante a ON a.id_aspirante=p.id_aspirante
      JOIN vacante v ON v.id_vacante=p.id_vacante
      LEFT JOIN usuario u ON u.id_usuario=e.id_gerente
      LEFT JOIN evaluacion ev ON ev.id_entrevista=e.id_entrevista
      WHERE e.id_entrevista=$1 OR e.id_postulacion=$1
      ORDER BY ev.id_evaluacion DESC NULLS LAST
      LIMIT 1
    `, [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Entrevista no encontrada.' });
    const row = r.rows[0];
    let comentarios = {};
    try { comentarios = JSON.parse(row.comentarios || '{}'); } catch { comentarios = { observaciones: row.comentarios || '' }; }
    const preguntas = Array.isArray(comentarios.preguntas) ? comentarios.preguntas : [];
    generarPdfEntrevista(res, { row, comentarios, preguntas });
  } catch (error) {
    errorResponse(res, error, 'No fue posible generar el PDF de entrevista.');
  }
});

app.post('/api/evaluaciones/detallada', requireRoles('Gerente'), async (req, res) => {
  const { idEntrevista, criterios = [], preguntas = [], observaciones = '', fortalezas = '', aspectosMejora = '', recomendacion = '', resultado = 'PENDIENTE', motivoRechazo = '' } = req.body;
  if (!idEntrevista) return res.status(400).json({ error: 'La entrevista es obligatoria.' });
  if (!['APROBADO','RECHAZADO','PENDIENTE'].includes(resultado)) return res.status(400).json({ error: 'Resultado de entrevista no válido.' });
  if (resultado === 'RECHAZADO' && !String(motivoRechazo).trim()) return res.status(400).json({ error: 'El motivo de rechazo es obligatorio.' });
  const client = await db.connect();
  try { await client.query('BEGIN'); const score = criterios.reduce((a,c)=>a+Number(c.puntuacion||0),0)/(criterios.length||1); const payload = JSON.stringify({ preguntas, criterios, observaciones, fortalezas, aspectosMejora, recomendacion, resultado, motivoRechazo }); const ev = await client.query('INSERT INTO evaluacion (preguntas,calificacion,comentarios,id_entrevista) VALUES ($1,$2,$3,$4) RETURNING *', [JSON.stringify(preguntas), Math.round(score), payload, idEntrevista]); const p = await client.query('SELECT id_postulacion FROM entrevista WHERE id_entrevista=$1', [idEntrevista]); if (p.rowCount) await logTransition(client,p.rows[0].id_postulacion,resultado === 'APROBADO' ? 'EXAMENES_PENDIENTES' : resultado === 'RECHAZADO' ? 'RECHAZADO' : 'ENTREVISTA_AGENDADA', motivoRechazo || recomendacion || observaciones, req.session.id_usuario); await client.query('UPDATE entrevista SET estado=$1, observacion=$2 WHERE id_entrevista=$3', [resultado, motivoRechazo || observaciones, idEntrevista]); await client.query('COMMIT'); res.status(201).json(ev.rows[0]); } catch (error) { await client.query('ROLLBACK'); errorResponse(res,error,'No fue posible guardar la evaluación detallada.'); } finally { client.release(); }
});
app.post('/api/examenes', requireRoles('RRHH', 'Gerente'), async (req, res) => { const { idPostulacion, tipos = [], fecha, hora, lugar, direccion = '', observaciones = '' } = req.body; if (!idPostulacion || !fecha || !hora || !lugar || !Array.isArray(tipos) || !tipos.length) return res.status(400).json({ error: 'Postulación, tipos, fecha, hora y lugar son obligatorios.' }); try { const p = await db.query(`SELECT p.id_postulacion,a.nombre_completo FROM postulacion p JOIN aspirante a ON a.id_aspirante=p.id_aspirante WHERE p.id_postulacion=$1 AND p.estado IN ('EXAMENES_PENDIENTES','ENTREVISTA_APROBADA')`, [idPostulacion]); if (!p.rowCount) return res.status(400).json({ error: 'Solo se pueden agendar exámenes después de una entrevista aprobada.' }); const r = await db.query(`INSERT INTO examen_programado (id_postulacion,tipos,fecha,hora,lugar,direccion,observaciones,programado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [idPostulacion, tipos, fecha, hora, lugar, direccion, observaciones, req.session.id_usuario]); await db.query("UPDATE postulacion SET estado='EXAMENES_AGENDADOS' WHERE id_postulacion=$1", [idPostulacion]); res.status(201).json(r.rows[0]); } catch (error) { errorResponse(res,error,'No fue posible agendar los exámenes.'); } });
app.get('/api/examenes', requireRoles('RRHH','Gerente'), async (_req,res)=>{try{const r=await db.query(`SELECT ex.*,p.id_aspirante,a.nombre_completo,p.estado estado_postulacion,v.nombre_cargo cargo FROM examen_programado ex JOIN postulacion p ON p.id_postulacion=ex.id_postulacion JOIN aspirante a ON a.id_aspirante=p.id_aspirante JOIN vacante v ON v.id_vacante=p.id_vacante ORDER BY ex.fecha DESC,ex.hora DESC`);res.json(r.rows);}catch(error){errorResponse(res,error,'No fue posible consultar exámenes.');}});
app.post('/api/examenes/:id/documentos', requireRoles('RRHH'), async (req,res)=>{const {nombreDocumento,tipoDocumento='PDF',archivo,recibidoEn,observaciones=''}=req.body;if(!nombreDocumento||!archivo)return res.status(400).json({error:'Nombre y archivo son obligatorios.'});if(String(archivo).length>8*1024*1024)return res.status(413).json({error:'El archivo supera 8 MB.'});try{const r=await db.query(`UPDATE examen_programado SET documentos_resultado=COALESCE(documentos_resultado,'[]'::jsonb)||$1::jsonb,fecha_recepcion=COALESCE($2,CURRENT_DATE),observaciones_rrhh=$3,estado='EN_REVISION' WHERE id_examen=$4 RETURNING id_examen,id_postulacion,documentos_resultado,fecha_recepcion,observaciones_rrhh`,[JSON.stringify([{nombreDocumento,tipoDocumento,archivo,recibidoEn:recibidoEn||new Date().toISOString().slice(0,10),cargadoEn:new Date().toISOString()}]),recibidoEn||null,observaciones,req.params.id]);if(!r.rowCount)return res.status(404).json({error:'Examen no encontrado.'});await db.query("UPDATE postulacion SET estado='EXAMENES_EN_REVISION' WHERE id_postulacion=$1",[r.rows[0].id_postulacion]);res.status(201).json(r.rows[0]);}catch(error){errorResponse(res,error,'No fue posible cargar el resultado.');}});
app.post('/api/examenes/:id/verificar', requireRoles('RRHH'), async (req,res)=>{const {resultado,motivoRechazo='',observaciones=''}=req.body;if(!['APROBADO','RECHAZADO','PENDIENTE'].includes(resultado))return res.status(400).json({error:'Resultado inválido.'});if(resultado==='RECHAZADO'&&!String(motivoRechazo).trim())return res.status(400).json({error:'El motivo de rechazo es obligatorio.'});try{const e=await db.query('SELECT id_postulacion,documentos_resultado FROM examen_programado WHERE id_examen=$1',[req.params.id]);if(!e.rowCount)return res.status(404).json({error:'Examen no encontrado.'});if(!Array.isArray(e.rows[0].documentos_resultado)||!e.rows[0].documentos_resultado.length)return res.status(400).json({error:'No se puede verificar sin documentos cargados.'});const r=await db.query(`UPDATE examen_programado SET resultado=$1,motivo_rechazo=$2,observaciones_rrhh=$3,fecha_verificacion=CURRENT_TIMESTAMP,verificado_por=$4,estado=$5 WHERE id_examen=$6 RETURNING *`,[resultado,motivoRechazo,observaciones,req.session.id_usuario,resultado==='APROBADO'?'APROBADO':resultado==='RECHAZADO'?'RECHAZADO':'EN_REVISION',req.params.id]);const nuevo=resultado==='APROBADO'?'PENDIENTE_CONTRATO':resultado==='RECHAZADO'?'RECHAZADO':'EXAMENES_EN_REVISION';await db.query('UPDATE postulacion SET estado=$1,motivo_rechazo=$2,fecha_rechazo=CASE WHEN $1=\'RECHAZADO\' THEN CURRENT_DATE ELSE fecha_rechazo END WHERE id_postulacion=$3',[nuevo,motivoRechazo,e.rows[0].id_postulacion]);if(nuevo==='PENDIENTE_CONTRATO')await db.query('INSERT INTO notificacion (mensaje, leida, id_usuario, id_postulacion) VALUES ($1,false,$2,$3)',['Tus exámenes fueron aprobados. Tu proceso continúa a la etapa de contratación.',req.session.id_usuario,e.rows[0].id_postulacion]);res.json(r.rows[0]);}catch(error){errorResponse(res,error,'No fue posible verificar exámenes.');}});
app.post('/api/contratos/agenda-firma', requireRoles('Gerente'), async (req,res)=>{const {idPostulacion,fecha,hora,lugar,direccion='',observaciones=''}=req.body;if(!idPostulacion||!fecha||!hora||!lugar)return res.status(400).json({error:'Postulación, fecha, hora y lugar son obligatorios.'});try{const p=await db.query("SELECT p.id_postulacion,a.nombre_completo,a.correo FROM postulacion p JOIN aspirante a ON a.id_aspirante=p.id_aspirante WHERE p.id_postulacion=$1 AND p.estado IN ('PENDIENTE_CONTRATO','EXAMENES_APROBADOS')",[idPostulacion]);if(!p.rowCount)return res.status(400).json({error:'Los exámenes deben estar aprobados antes de agendar la firma.'});const r=await db.query(`UPDATE contrato SET fecha_firma_programada=$1,hora_firma=$2,lugar_firma=$3,direccion_firma=$4,responsable_firma=$5,observaciones=COALESCE(NULLIF($6,''),observaciones),estado='Firma programada' WHERE id_postulacion=$7 RETURNING *`,[fecha,hora,lugar,direccion,req.session.id_usuario,observaciones,idPostulacion]);if(!r.rowCount)return res.status(404).json({error:'Primero debe existir el contrato para agendar su firma.'});await db.query("UPDATE postulacion SET estado='FIRMA_CONTRATO_AGENDADA' WHERE id_postulacion=$1",[idPostulacion]);const mensaje=`Su proceso de selección ha avanzado satisfactoriamente. La firma de su contrato ha sido programada para el día ${fecha} a las ${hora}.`;await db.query('INSERT INTO notificacion (mensaje, leida, id_usuario, id_postulacion) VALUES ($1,false,$2,$3)',[mensaje,req.session.id_usuario,idPostulacion]);res.status(201).json({...r.rows[0],notificacion:mensaje,candidato:p.rows[0]});}catch(error){errorResponse(res,error,'No fue posible agendar la firma.');}});

// Consultar notificaciones (uso interno RRHH/Gerencia, filtrable por usuario o postulación).
app.get('/api/notificaciones', requireRoles('RRHH','Gerente'), async (req,res)=>{
  try{
    const values=[]; const where=[];
    if(req.query.idUsuario){values.push(req.query.idUsuario);where.push(`n.id_usuario=$${values.length}`);}
    if(req.query.idPostulacion){values.push(req.query.idPostulacion);where.push(`n.id_postulacion=$${values.length}`);}
    const r=await db.query(`SELECT n.* FROM notificacion n ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY n.creado_en DESC LIMIT 200`,values);
    res.json(r.rows);
  }catch(error){errorResponse(res,error,'No fue posible consultar notificaciones.');}
});

// Consulta pública: el candidato usa su número de postulación (radicado) para ver
// el estado de su proceso y las notificaciones registradas, sin necesidad de cuenta.
app.get('/api/postulaciones/:id/notificaciones', async (req,res)=>{
  try{
    const r=await db.query('SELECT id_notificacion,mensaje,creado_en FROM notificacion WHERE id_postulacion=$1 ORDER BY creado_en DESC',[req.params.id]);
    res.json(r.rows);
  }catch(error){errorResponse(res,error,'No fue posible consultar las notificaciones de la postulación.');}
});
app.post('/api/auth/login', async (req, res) => {
  const { correo, contrasena, rolSolicitado } = req.body;
  try {
    const identificador = String(correo || '').trim();
    const result = await db.query(`SELECT * FROM usuario
      WHERE (LOWER(correo) = LOWER($1) OR LOWER(nombre_completo) = LOWER($1))
        AND activo = true
      ORDER BY id_usuario DESC
      LIMIT 1`, [identificador]);
    if (!result.rowCount) return res.status(401).json({ error: 'Credenciales incorrectas.' });
    const usuario = result.rows[0];
    const passwordValida = usuario.contrasena_hash === contrasena
        || await bcrypt.compare(String(contrasena), String(usuario.contrasena_hash || '')).catch(() => false);
    if (!passwordValida) return res.status(401).json({ error: 'Credenciales incorrectas.' });
    const rolTexto = String(usuario.rol || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const rolNormalizado = ['rrhh', 'rh', 'recursos humanos', 'recursos_humanos', 'recursos-humanos', 'administrador', 'admin'].includes(rolTexto)
        ? 'RRHH'
        : rolTexto === 'gerente' || rolTexto === 'gerencia'
            ? 'Gerente'
            : usuario.rol;
    if (!['RRHH', 'Gerente'].includes(rolNormalizado)) return res.status(403).json({ error: 'Este usuario no tiene acceso al área interna.' });
    if (rolSolicitado && String(rolSolicitado).toLowerCase() !== String(rolNormalizado).toLowerCase()) return res.status(403).json({ error: 'El usuario no pertenece al rol seleccionado.' });
    usuario.rol = rolNormalizado;
    delete usuario.contrasena_hash;
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { id_usuario: usuario.id_usuario, rol: rolNormalizado, usuario, creado: Date.now() });
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `sid=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/${secure}`);
    res.json({ token, usuario });
  } catch (error) { errorResponse(res, error, 'No fue posible iniciar sesión.'); }
});

app.get('/api/auth/me', requireRoles('RRHH', 'Gerente'), (req, res) => res.json({ usuario: req.session.usuario, rol: req.session.rol }));

app.patch('/api/auth/perfil', requireRoles('RRHH', 'Gerente'), async (req, res) => {
  const { nombreCompleto, tipoDocumento, numeroDocumento, telefono, direccion, cargo, fotoPerfil } = req.body;
  if (fotoPerfil && String(fotoPerfil).length > 8 * 1024 * 1024) return res.status(413).json({ error: 'La foto supera el límite de 8 MB.' });
  try {
    const result = await db.query(`UPDATE usuario SET nombre_completo=COALESCE($1,nombre_completo), tipo_documento=COALESCE($2,tipo_documento), numero_documento=COALESCE($3,numero_documento), telefono=COALESCE($4,telefono), direccion=COALESCE($5,direccion), cargo=COALESCE($6,cargo), foto_perfil=COALESCE($7,foto_perfil) WHERE id_usuario=$8 RETURNING id_usuario,nombre_completo,correo,rol,tipo_documento,numero_documento,telefono,direccion,cargo,foto_perfil`, [nombreCompleto, tipoDocumento, numeroDocumento, telefono, direccion, cargo, fotoPerfil, req.session.id_usuario]);
    if (!result.rowCount) return res.status(404).json({ error: 'Usuario no encontrado.' });
    req.session.usuario = result.rows[0];
    res.json({ usuario: result.rows[0] });
  } catch (error) { errorResponse(res, error, 'No fue posible actualizar el perfil. Ejecuta primero la migración 005.'); }
});

app.post('/api/auth/logout', requireRoles('RRHH', 'Gerente'), (req, res) => {
  sessions.delete(getSessionToken(req));
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.status(204).end();
});

app.use((error, _req, res, _next) => errorResponse(res, error, 'Error interno del servidor.'));

if (require.main === module) {
  app.listen(PORT, () => console.log(`SIDOVI funcionando en http://localhost:${PORT}`));
}

module.exports = app;
