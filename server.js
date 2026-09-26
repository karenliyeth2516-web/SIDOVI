require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
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
      password: process.env.DB_PASSWORD || 'KAREN123',
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
    if (!session) return res.status(401).json({ error: 'SesiÃ³n requerida.' });
    if (roles.length && !roles.includes(session.rol)) return res.status(403).json({ error: 'No tienes permisos para este mÃ³dulo.' });
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
  if (req.path.startsWith('/contratos')) return requireRoles('RRHH', 'Gerente')(req, res, next);
  if (req.path.startsWith('/evaluaciones')) return requireRoles('Gerente')(req, res, next);
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
  } catch (error) { errorResponse(res, error, 'No fue posible consultar las vacantes. Ejecuta primero la migraciÃ³n de sedes y cargos.'); }
});

app.get('/api/vacantes/:id', async (req, res) => {
  try { const result = await db.query('SELECT * FROM vacante WHERE id_vacante = $1', [req.params.id]); if (!result.rowCount) return res.status(404).json({ error: 'Vacante no encontrada.' }); res.json(result.rows[0]); }
  catch (error) { errorResponse(res, error, 'No fue posible consultar la vacante.'); }
});

app.post('/api/vacantes', async (req, res) => {
  const { titulo, descripcion, requisitos = '', fechaPublicacion = new Date(), estado = 'ABIERTA', idUsuario = 2, idSede, id_sede, idCargo, id_cargo } = req.body;
  if (!titulo || !descripcion) return res.status(400).json({ error: 'TÃ­tulo y descripciÃ³n son obligatorios.' });
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
  if (!nombre || !apellido || !documento || !correo || !telefono || !direccion) return res.status(400).json({ error: 'Nombre, apellido, documento, correo, telÃ©fono y direcciÃ³n son obligatorios.' });
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

const postulacionQuery = `
SELECT
  p.id_postulacion,
  p.id_aspirante,
  p.id_vacante,
  p.fecha_postulacion,
  p.estado AS estado,

  a.nombre_completo,
  a.numero_documento,
  a.correo,
  a.telefono,
  a.direccion,

  v.nombre_cargo AS cargo,
  v.descripcion AS descripcion_vacante,
  v.estado AS estado_vacante,
  v.id_sede,

  s.nombre_sede,

  p.fecha_firma_programada,
  p.hora_firma,
  p.lugar_firma,
  p.direccion_firma,
  p.responsable_firma,
  p.observaciones_firma

FROM postulacion p

JOIN aspirante a
  ON a.id_aspirante = p.id_aspirante

JOIN vacante v
  ON v.id_vacante = p.id_vacante

LEFT JOIN sede s
  ON s.id_sede = v.id_sede
`;
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
  try { const result = await db.query(`${postulacionQuery} WHERE p.id_postulacion = $1`, [req.params.id]); if (!result.rowCount) return res.status(404).json({ error: 'PostulaciÃ³n no encontrada.' }); const row = result.rows[0]; const docs = await db.query('SELECT * FROM documento WHERE id_aspirante = $1 ORDER BY id_documento', [row.id_aspirante]); const entrevistas = await db.query('SELECT * FROM entrevista WHERE id_postulacion = $1 ORDER BY id_entrevista DESC', [req.params.id]); res.json({ ...row, documentos: docs.rows, entrevista: entrevistas.rows[0] || null }); }
  catch (error) { errorResponse(res, error, 'No fue posible consultar la postulaciÃ³n.'); }
});

app.get('/api/hojas-de-vida', requireRoles('RRHH', 'Gerente'), async (_req, res) => {
  try {
    const result = await db.query(`SELECT p.id_postulacion, p.fecha_postulacion, p.estado, a.id_aspirante, a.nombre_completo, a.tipo_documento, a.numero_documento, a.correo, a.telefono, a.direccion, v.nombre_cargo AS cargo, COALESCE(json_agg(json_build_object('id_documento', d.id_documento, 'nombre_documento', d.nombre_documento, 'tipo_documento', d.tipo_documento, 'archivo', d.archivo) ORDER BY d.id_documento) FILTER (WHERE d.id_documento IS NOT NULL), '[]') AS documentos FROM postulacion p JOIN aspirante a ON a.id_aspirante = p.id_aspirante JOIN vacante v ON v.id_vacante = p.id_vacante LEFT JOIN documento d ON d.id_aspirante = a.id_aspirante GROUP BY p.id_postulacion, a.id_aspirante, v.nombre_cargo ORDER BY p.fecha_postulacion DESC, p.id_postulacion DESC`);
    res.json(result.rows);
  } catch (error) { errorResponse(res, error, 'No fue posible consultar las hojas de vida.'); }
});

// ============================================================
// REPORTES / CONCEPTOS DE RRHH SOBRE HOJAS DE VIDA
// ============================================================

// Consultar el reporte de RRHH de una postulaciÃ³n.
// RRHH y Gerencia pueden visualizarlo.
app.get(
    '/api/reportes-rrhh/:idPostulacion',
    requireRoles('RRHH', 'Gerente'),
    async (req, res) => {

      try {

        const result = await db.query(
            `
        SELECT
          r.id_reporte_rrhh,
          r.id_postulacion,
          r.id_rrhh,
          r.concepto,
          r.fortalezas,
          r.aspectos_considerar,
          r.recomendacion,
          r.creado_en,
          r.actualizado_en,
          u.nombre_completo AS nombre_rrhh
        FROM reporte_rrhh r
        LEFT JOIN recursos_humanos rh
          ON rh.id_rrhh = r.id_rrhh
        LEFT JOIN usuario u
          ON u.id_usuario = rh.id_rrhh
        WHERE r.id_postulacion = $1
        LIMIT 1
        `,
            [req.params.idPostulacion]
        );


        if (!result.rowCount) {
          return res.json(null);
        }


        res.json(result.rows[0]);


      } catch (error) {

        errorResponse(
            res,
            error,
            'No fue posible consultar el reporte de RRHH.'
        );

      }

    }
);


// Crear o actualizar el reporte de RRHH.
// Solamente Recursos Humanos puede modificarlo.
app.put(
    '/api/reportes-rrhh/:idPostulacion',
    requireRoles('RRHH'),
    async (req, res) => {

      const {
        concepto = '',
        fortalezas = '',
        aspectosConsiderar = '',
        recomendacion = ''
      } = req.body;


      const idPostulacion =
          Number(req.params.idPostulacion);


      if (!idPostulacion) {

        return res.status(400).json({
          error: 'La postulaciÃ³n es obligatoria.'
        });

      }


      if (!String(concepto).trim()) {

        return res.status(400).json({
          error: 'El concepto sobre la hoja de vida es obligatorio.'
        });

      }


      try {

        // Verificar que la postulaciÃ³n exista.
        const postulacion = await db.query(
            `
        SELECT
          id_postulacion
        FROM postulacion
        WHERE id_postulacion = $1
        `,
            [idPostulacion]
        );


        if (!postulacion.rowCount) {

          return res.status(404).json({
            error: 'La postulaciÃ³n no existe.'
          });

        }


        // Buscar el registro de RRHH asociado a la sesiÃ³n.
        const rrhh = await db.query(
            `
        SELECT id_rrhh
        FROM recursos_humanos
        WHERE id_rrhh = $1
          AND activo = TRUE
        LIMIT 1
        `,
            [req.session.id_usuario]
        );


        if (!rrhh.rowCount) {

          return res.status(403).json({
            error: 'El usuario actual no estÃ¡ registrado como Recursos Humanos.'
          });

        }


        const idRrhh = rrhh.rows[0].id_rrhh;


        const result = await db.query(
            `
        INSERT INTO reporte_rrhh (
          id_postulacion,
          id_rrhh,
          concepto,
          fortalezas,
          aspectos_considerar,
          recomendacion
        )
        VALUES ($1, $2, $3, $4, $5, $6)

        ON CONFLICT (id_postulacion)

        DO UPDATE SET
          id_rrhh = EXCLUDED.id_rrhh,
          concepto = EXCLUDED.concepto,
          fortalezas = EXCLUDED.fortalezas,
          aspectos_considerar = EXCLUDED.aspectos_considerar,
          recomendacion = EXCLUDED.recomendacion,
          actualizado_en = CURRENT_TIMESTAMP

        RETURNING *
        `,
            [
              idPostulacion,
              idRrhh,
              String(concepto).trim(),
              String(fortalezas).trim(),
              String(aspectosConsiderar).trim(),
              String(recomendacion).trim()
            ]
        );


        res.json({
          ok: true,
          mensaje: 'Reporte de RRHH guardado correctamente.',
          reporte: result.rows[0]
        });


      } catch (error) {

        errorResponse(
            res,
            error,
            'No fue posible guardar el reporte de RRHH.'
        );

      }

    }
);

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
      if (archivo.length > 8 * 1024 * 1024) throw Object.assign(new Error('Uno de los documentos supera el lÃ­mite permitido.'), { status: 413 });
      await client.query('INSERT INTO documento (nombre_documento, tipo_documento, archivo, id_aspirante) VALUES ($1,$2,$3,$4)', [doc.nombreArchivo || doc.nombreDocumento || 'Documento', doc.tipoDocumento || doc.tipoArchivo || 'PDF', archivo, id]);
    }
    await client.query('COMMIT'); res.status(201).json({ idPostulacion: post.rows[0].id_postulacion, ...post.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); errorResponse(res, error, 'No fue posible registrar la postulaciÃ³n.'); } finally { client.release(); }
});

const ESTADOS_POSTULACION_DB = {
  'EN PROCESO': 'EN_REVISION',
  'EN REVISION': 'EN_REVISION',
  'EN_REVISION': 'EN_REVISION',

  'HOJA VIDA APROBADA': 'APROBADO_RRHH',
  'HOJA_VIDA_APROBADA': 'APROBADO_RRHH',

  'APROBADO RRHH': 'APROBADO_RRHH',
  'APROBADO_RRHH': 'APROBADO_RRHH',

  'RECHAZADO RRHH': 'RECHAZADO_RRHH',
  'RECHAZADO_RRHH': 'RECHAZADO_RRHH',

  'ENTREVISTA': 'ENTREVISTA',
  'ENTREVISTA PENDIENTE': 'ENTREVISTA',
  'ENTREVISTA_PENDIENTE': 'ENTREVISTA',

  'ENTREVISTA AGENDADA': 'ENTREVISTA',
  'ENTREVISTA_AGENDADA': 'ENTREVISTA',

  'ENTREVISTA APROBADA': 'APROBADO',
  'ENTREVISTA_APROBADA': 'APROBADO',

  'ENTREVISTA RECHAZADA': 'RECHAZADO',
  'ENTREVISTA_RECHAZADA': 'RECHAZADO',

  'EXAMENES PENDIENTES': 'APROBADO',
  'EXAMENES_PENDIENTES': 'APROBADO',

  'EXAMENES AGENDADOS': 'APROBADO',
  'EXAMENES_AGENDADOS': 'APROBADO',

  'EXAMENES PROGRAMADOS': 'APROBADO',
  'EXAMENES_PROGRAMADOS': 'APROBADO',

  'EXAMENES EN REVISION': 'APROBADO',
  'EXAMENES_EN_REVISION': 'APROBADO',

  'EXAMENES APROBADOS': 'APROBADO',
  'EXAMENES_APROBADOS': 'APROBADO',

  'PENDIENTE CONTRATO': 'APROBADO',
  'PENDIENTE_CONTRATO': 'APROBADO',

  'FIRMA CONTRATO AGENDADA': 'APROBADO',
  'FIRMA_CONTRATO_AGENDADA': 'APROBADO',

  'APROBADO': 'APROBADO',

  'RECHAZADO': 'RECHAZADO',

  'CANCELADO': 'RECHAZADO',

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

  if (!estadoNormalizado) {
    return res.status(400).json({
      error: 'Estado de postulaciÃ³n no vÃ¡lido.'
    });
  }

  const idPostulacion = Number(req.params.id);

  if (!Number.isInteger(idPostulacion)) {
    return res.status(400).json({
      error: 'El ID de la postulaciÃ³n no es vÃ¡lido.'
    });
  }

  const motivoRechazo =
      req.body.motivoRechazo ||
      req.body.motivo ||
      null;

  try {
    const result = await db.query(
        `UPDATE postulacion
       SET estado = $1::text,
           fecha_rechazo = CASE
             WHEN $1::text = 'RECHAZADO'
             THEN CURRENT_DATE
             ELSE fecha_rechazo
           END,
           motivo_rechazo = CASE
             WHEN $1::text = 'RECHAZADO'
             THEN COALESCE($3::text, motivo_rechazo, '')
             ELSE motivo_rechazo
           END
       WHERE id_postulacion = $2::integer
       RETURNING *`,
        [
          estadoNormalizado,
          idPostulacion,
          motivoRechazo
        ]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        error: 'PostulaciÃ³n no encontrada.'
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    errorResponse(
        res,
        error,
        'No fue posible actualizar el estado.'
    );
  }
});


app.patch('/api/postulaciones/:id/datos', async (req, res) => {
  const {
    nombre,
    nombreCompleto,
    apellido,
    correo,
    email,
    telefono,
    direccion,
    ciudad,
    documento,
    cedula
  } = req.body;

  const idPostulacion = Number(req.params.id);

  if (!Number.isInteger(idPostulacion)) {
    return res.status(400).json({
      error: 'El ID de la postulaciÃ³n no es vÃ¡lido.'
    });
  }

  try {
    const post = await db.query(
      'SELECT id_aspirante FROM postulacion WHERE id_postulacion = $1::integer',
      [idPostulacion]
    );

    if (!post.rowCount) {
      return res.status(404).json({
        error: 'PostulaciÃ³n no encontrada.'
      });
    }

    const id = post.rows[0].id_aspirante;
    const names = splitName(nombreCompleto || nombre);

    await db.query(
      `UPDATE aspirante
SET nombre_completo = $1,
    correo = $2,
    telefono = $3,
    direccion = $4,
    numero_documento = $5
WHERE id_aspirante = $6`,
      [
        `${names.nombre} ${apellido || names.apellido}`.trim(),
        correo || email,
        telefono,
        direccion || ciudad,
        documento || cedula,
        id
      ]
    );

    const result = await db.query(
      `${postulacionQuery} WHERE p.id_postulacion = $1::integer`,
      [idPostulacion]
    );

    res.json(result.rows[0]);

  } catch (error) {
    errorResponse(
      res,
      error,
      'No fue posible actualizar el candidato.'
    );
  }
});


app.delete('/api/postulaciones/:id', async (req, res) => {
  const client = await db.connect(); try { await client.query('BEGIN'); const p = await client.query('SELECT id_aspirante FROM postulacion WHERE id_postulacion = $1', [req.params.id]); if (!p.rowCount) return res.status(404).json({ error: 'PostulaciÃ³n no encontrada.' }); const id = p.rows[0].id_aspirante; await client.query('DELETE FROM evaluacion WHERE id_entrevista IN (SELECT id_entrevista FROM entrevista WHERE id_postulacion = $1)', [req.params.id]); await client.query('DELETE FROM entrevista WHERE id_postulacion = $1', [req.params.id]); await client.query('DELETE FROM evidencia WHERE id_postulacion = $1', [req.params.id]); await client.query('DELETE FROM postulacion WHERE id_postulacion = $1', [req.params.id]); await client.query('DELETE FROM documento WHERE id_aspirante = $1', [id]); await client.query('DELETE FROM aspirante WHERE id_aspirante = $1', [id]); await client.query('COMMIT'); res.status(204).end(); } catch (error) { await client.query('ROLLBACK'); errorResponse(res, error, 'No fue posible eliminar la postulaciÃ³n.'); } finally { client.release(); }
});

app.get('/api/entrevistas', async (_req, res) => {
  try {

    const result = await db.query(`
      SELECT
        e.id_entrevista,
        e.fecha_entrevista,
        e.modalidad,
        e.estado AS resultado,
        e.observacion AS observaciones,

        s.id_seleccionado,
        s.id_postulacion,

        p.id_aspirante,

        po.nombre_completo AS candidato,
        po.telefono AS telefono,
        po.correo AS correo,

        v.nombre_cargo AS cargo

      FROM entrevista e

      JOIN aspirantes_seleccionados s
        ON s.id_seleccionado = e.id_seleccionado

      JOIN postulacion p
        ON p.id_postulacion = s.id_postulacion

      JOIN aspirante po
        ON po.id_aspirante = p.id_aspirante

      JOIN vacante v
        ON v.id_vacante = p.id_vacante

      ORDER BY e.fecha_entrevista DESC
    `);

    res.json(result.rows);

  } catch (error) {

    errorResponse(
        res,
        error,
        'No fue posible obtener las entrevistas.'
    );
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
       AND estado IN (
         'APROBADO',
         'APROBADO_RRHH',
         'ENTREVISTA'
       )`,
        [idPostulacion]
    );

    if (!approved.rowCount) {
      return res.status(400).json({
        error: 'La postulaciÃ³n debe estar aprobada antes de agendar la entrevista.'
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

    const fechaHoraEntrevista =
        `${fecha || fechaEntrevista} ${hora || '00:00'}:00`;

    const result = await db.query(`
  INSERT INTO entrevista
    (fecha_entrevista, modalidad, estado, observacion,
     id_seleccionado, id_gerente, id_postulacion)
  VALUES ($1, $2, 'PROGRAMADA', $3, $4, $5, $6)
  RETURNING *
`, [
      fechaHoraEntrevista,
      modalidadDB,
      indicaciones || observaciones,
      selected.rows[0].id_seleccionado,
      gerenteId,
      idPostulacion
    ]);

    await db.query(
        `UPDATE postulacion
   SET estado = 'ENTREVISTA'
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

  const estadoRecibido = String(
      estado || resultado || 'PROGRAMADA'
  )
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
      ? (
          String(modalidad)
              .toLowerCase()
              .includes('virtual')
              ? 'Virtual'
              : 'Presencial'
      )
      : null;

  try {

    /* =====================================================
       BUSCAR LA ENTREVISTA POR SU ID REAL
    ===================================================== */

    const actual = await db.query(`
      SELECT *
      FROM entrevista
      WHERE id_entrevista = $1
      LIMIT 1
    `, [
      Number(req.params.id)
    ]);


    if (!actual.rowCount) {
      return res.status(404).json({
        error: 'Entrevista no encontrada.'
      });
    }


    const entrevistaActual =
        actual.rows[0];


    /* =====================================================
       OBTENER FECHA ACTUAL
    ===================================================== */

    const fechaActual =
        entrevistaActual.fecha_entrevista
            ? new Date(
                entrevistaActual.fecha_entrevista
            )
            : null;


    /* =====================================================
       NUEVA FECHA
    ===================================================== */

    const fechaNueva =
        fecha ||
        fechaEntrevista ||
        (
            fechaActual
                ? fechaActual
                    .toISOString()
                    .slice(0, 10)
                : null
        );


    /* =====================================================
       NUEVA HORA
    ===================================================== */

    const horaNueva =
        hora ||
        horaEntrevista ||
        (
            fechaActual
                ? fechaActual
                    .toTimeString()
                    .slice(0, 5)
                : '00:00'
        );


    if (!fechaNueva) {
      return res.status(400).json({
        error:
            'La fecha de la entrevista es obligatoria.'
      });
    }


    /* =====================================================
       UNIR FECHA + HORA
    ===================================================== */

    const fechaHoraEntrevista =
        `${fechaNueva} ${horaNueva}:00`;


    /* =====================================================
       ACTUALIZAR
    ===================================================== */

    const result = await db.query(`
      UPDATE entrevista
      SET
        fecha_entrevista = $1,
        modalidad = COALESCE($2, modalidad),
        observacion = $3,
        estado = $4
      WHERE id_entrevista = $5
      RETURNING *
    `, [
      fechaHoraEntrevista,
      modalidadDB,
      observaciones,
      estadoDB,
      Number(req.params.id)
    ]);


    if (!result.rowCount) {
      return res.status(404).json({
        error:
            'No fue posible actualizar la entrevista.'
      });
    }


    const entrevista =
        result.rows[0];


    /* =====================================================
       RESPUESTA
    ===================================================== */

    res.json({
      ...entrevista,

      id_entrevista:
      entrevista.id_entrevista,

      fecha_entrevista:
      entrevista.fecha_entrevista,

      hora_entrevista:
      horaNueva,

      observaciones:
      entrevista.observacion,

      resultado:
      entrevista.estado,

      mensaje:
          'La entrevista fue reprogramada correctamente.'
    });

  } catch (error) {

    console.error(
        'Error al reprogramar entrevista:',
        error
    );

    errorResponse(
        res,
        error,
        'No fue posible reprogramar la entrevista.'
    );
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
app.post('/api/evaluaciones', async(req,res)=>{const {preguntas='EvaluaciÃ³n gerencial',calificacion=0,comentarios='',idEntrevista}=req.body;try{const r=await db.query('INSERT INTO evaluacion (preguntas,calificacion,comentarios,id_entrevista) VALUES ($1,$2,$3,$4) RETURNING *',[preguntas,calificacion,comentarios,idEntrevista]);res.status(201).json(r.rows[0]);}catch(error){errorResponse(res,error,'No fue posible guardar evaluaciÃ³n.');}});

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

app.post('/api/contratos', requireRoles('Gerente'), async (req, res) => {
  const {
    idPostulacion,
    fechaInicio,
    fechaFin = null,
    tipoContrato = 'TÃ©rmino Fijo',
    salario = 1423500,
    estado = 'Borrador',
    observaciones = ''
  } = req.body;

  if (!idPostulacion || !fechaInicio) {
    return res.status(400).json({
      error: 'La postulaciÃ³n y la fecha de inicio son obligatorias.'
    });
  }

  try {
    // Verificar que la persona estÃ© lista para contrataciÃ³n
    const post = await db.query(`
      SELECT
        p.id_postulacion,
        p.estado,
        a.nombre_completo,
        a.numero_documento,
        a.correo,
        a.telefono,
        a.direccion,
        v.nombre_cargo AS cargo,
        s.nombre_sede
      FROM postulacion p
      JOIN aspirante a
        ON a.id_aspirante = p.id_aspirante
      JOIN vacante v
        ON v.id_vacante = p.id_vacante
      LEFT JOIN sede s
        ON s.id_sede = v.id_sede
      WHERE p.id_postulacion = $1
        AND p.estado IN (
                         'PENDIENTE_CONTRATO',
                         'FIRMA_CONTRATO_AGENDADA'
        )
    `, [idPostulacion]);

    if (!post.rowCount) {
      return res.status(400).json({
        error: 'La persona todavÃ­a no estÃ¡ habilitada para generar el contrato.'
      });
    }

    // Evitar contratos duplicados
    const existente = await db.query(
        'SELECT id_contrato FROM contrato WHERE id_postulacion = $1',
        [idPostulacion]
    );

    if (existente.rowCount) {
      return res.status(409).json({
        error: 'Esta postulaciÃ³n ya tiene un contrato generado.',
        idContrato: existente.rows[0].id_contrato
      });
    }

    const result = await db.query(`
      INSERT INTO contrato (
        id_postulacion,
        fecha_inicio,
        fecha_fin,
        tipo_contrato,
        salario,
        estado,
        observaciones
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      idPostulacion,
      fechaInicio,
      fechaFin,
      tipoContrato,
      salario,
      estado,
      observaciones
    ]);

    res.status(201).json({
      ...result.rows[0],
      candidato: post.rows[0]
    });

  } catch (error) {
    errorResponse(res, error, 'No fue posible crear el contrato.');
  }
});

// ============================================================
// PROGRAMAR FIRMA DE CONTRATO
// Gerencia agenda la firma despuÃ©s de que RRHH aprueba
// los exÃ¡menes mÃ©dicos.
// ============================================================
// ============================================================
// PROGRAMAR / REPROGRAMAR FIRMA DE CONTRATO
// RRHH o Gerencia pueden programar y reprogramar.
// ============================================================

app.post('/api/contratos/agenda-firma', requireRoles('RRHH', 'Gerente'), async (req, res) => {

  const {
    idPostulacion,
    fecha,
    hora,
    lugar,
    direccion = '',
    observaciones = ''
  } = req.body;

  if (!idPostulacion || !fecha || !hora || !lugar) {
    return res.status(400).json({
      error: 'Postulación, fecha, hora y lugar son obligatorios.'
    });
  }

  try {

    // ========================================================
    // VERIFICAR LA POSTULACIÓN
    // ========================================================

    const post = await db.query(`
      SELECT
        p.id_postulacion,
        p.estado,
        p.fecha_firma_programada,
        p.hora_firma,
        p.lugar_firma,
        p.direccion_firma,
        a.nombre_completo,
        a.correo,
        a.telefono,
        v.nombre_cargo AS cargo,
        s.nombre_sede
      FROM postulacion p

      JOIN aspirante a
        ON a.id_aspirante = p.id_aspirante

      JOIN vacante v
        ON v.id_vacante = p.id_vacante

      LEFT JOIN sede s
        ON s.id_sede = v.id_sede

      WHERE p.id_postulacion = $1
    `, [idPostulacion]);

    if (!post.rowCount) {
      return res.status(404).json({
        error: 'La postulación no fue encontrada.'
      });
    }

    const candidato = post.rows[0];

    const estadoActual =
        String(candidato.estado || '').toUpperCase();


    // ========================================================
    // SOLO SE PERMITEN ESTOS DOS CASOS
    //
    // 1. PENDIENTE_CONTRATO
    //    → Primera programación
    //
    // 2. FIRMA_CONTRATO_AGENDADA
    //    → Reprogramación
    // ========================================================

    const puedeProgramar =
        estadoActual === 'PENDIENTE_CONTRATO' ||
        estadoActual === 'FIRMA_CONTRATO_AGENDADA';

    if (!puedeProgramar) {

      return res.status(400).json({
        error:
            'La persona no está disponible para programar o reprogramar la firma. ' +
            'Verifica que RRHH haya aprobado los exámenes.'
      });

    }


    // ========================================================
    // DETERMINAR SI ES PROGRAMACIÓN O REPROGRAMACIÓN
    // ========================================================

    const esReprogramacion =
        estadoActual === 'FIRMA_CONTRATO_AGENDADA';


    // ========================================================
    // GUARDAR / ACTUALIZAR LA FIRMA
    // ========================================================

    const resultado = await db.query(`
      UPDATE postulacion

      SET
        fecha_firma_programada = $1,
        hora_firma = $2,
        lugar_firma = $3,
        direccion_firma = $4,
        responsable_firma = $5,
        observaciones_firma = $6,
        estado = 'FIRMA_CONTRATO_AGENDADA'

      WHERE id_postulacion = $7

      RETURNING *
    `, [
      fecha,
      hora,
      lugar,
      direccion,
      req.session.id_usuario,
      String(observaciones).trim(),
      idPostulacion
    ]);


    // ========================================================
    // MENSAJE ESPECÍFICO DE FIRMA
    // NO ES EL MENSAJE DE LOS EXÁMENES
    // ========================================================

    const mensaje =
        `Hola ${candidato.nombre_completo || ''}. ` +
        `Te informamos que tus exámenes fueron aprobados. ` +
        `Tu proceso de contratación continúa y estás programado(a) ` +
        `para la firma de tu contrato el día ${fecha}, ` +
        `a las ${hora}, en ${lugar}. ` +
        `${direccion ? `Dirección: ${direccion}. ` : ''}` +
        `Te esperamos.`;


    // ========================================================
    // GUARDAR NOTIFICACIÓN
    // ========================================================

    await db.query(`
      INSERT INTO notificacion (
        mensaje,
        leida,
        id_usuario,
        id_postulacion
      )

      VALUES ($1, false, $2, $3)
    `, [
      mensaje,
      req.session.id_usuario,
      idPostulacion
    ]);


    // ========================================================
    // RESPUESTA
    // ========================================================

    res.status(201).json({

      ...resultado.rows[0],

      estado_postulacion:
          'FIRMA_CONTRATO_AGENDADA',

      tipo_operacion:
          esReprogramacion
              ? 'REPROGRAMACION'
              : 'PROGRAMACION',

      notificacion:
      mensaje,

      candidato

    });

  } catch (error) {

    console.error(
        'Error programando/reprogramando firma:',
        error
    );

    errorResponse(
        res,
        error,
        'No fue posible programar o reprogramar la firma.'
    );

  }

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
      errorResponse(res, error, 'No fue posible cargar reportes y estadÃ­sticas.');
    }
  }
});


// ==================== PDF DE REPORTES SIDOVI ====================

// PDF 1: Historial completo de un aspirante
app.get('/api/reportes/historial/:idAspirante/pdf', requireRoles('RRHH', 'Gerente'), async (req, res) => {
  try {
    const idAspirante = Number(req.params.idAspirante);

    if (!Number.isInteger(idAspirante) || idAspirante <= 0) {
      return res.status(400).json({ error: 'Identificador de aspirante no válido.' });
    }

    const aspiranteResult = await db.query(`
      SELECT
        a.id_aspirante,
        a.tipo_documento,
        a.numero_documento,
        a.nombre_completo,
        a.correo,
        a.telefono,
        a.direccion,
        a.fecha_registro,
        a.sexo,
        COUNT(p.id_postulacion)::int AS total_postulaciones,
        MIN(p.fecha_postulacion) AS primera_postulacion,
        MAX(p.fecha_postulacion) AS ultima_postulacion
      FROM aspirante a
      LEFT JOIN postulacion p
        ON p.id_aspirante = a.id_aspirante
      WHERE a.id_aspirante = $1
      GROUP BY
        a.id_aspirante,
        a.tipo_documento,
        a.numero_documento,
        a.nombre_completo,
        a.correo,
        a.telefono,
        a.direccion,
        a.fecha_registro,
        a.sexo
    `, [idAspirante]);

    if (!aspiranteResult.rowCount) {
      return res.status(404).json({ error: 'Aspirante no encontrado.' });
    }

    const postulacionesResult = await db.query(`
      SELECT
        p.id_postulacion,
        p.fecha_postulacion,
        p.estado,
        p.experiencia,
        p.descripcion,
        p.motivo_rechazo,
        p.resultado,
        p.fecha_rechazo,
        p.fecha_contratacion,
        p.fecha_firma_programada,
        p.hora_firma,
        p.lugar_firma,
        p.direccion_firma,
        p.observaciones_firma,

        v.id_vacante,
        v.nombre_cargo AS cargo,
        v.descripcion AS descripcion_vacante,
        v.requisitos,
        v.fecha_publicacion,
        v.fecha_cierre,

        s.id_sede,
        s.nombre_sede AS sede

      FROM postulacion p
      JOIN vacante v
        ON v.id_vacante = p.id_vacante
      JOIN sede s
        ON s.id_sede = v.id_sede
      WHERE p.id_aspirante = $1
      ORDER BY p.fecha_postulacion ASC, p.id_postulacion ASC
    `, [idAspirante]);

    const postulaciones = [];

    for (const postulacion of postulacionesResult.rows) {

      const historial = await db.query(`
        SELECT
          h.id_historial,
          h.estado_anterior,
          h.estado_nuevo,
          h.detalle,
          h.creado_en
        FROM historial_proceso h
        WHERE h.id_postulacion = $1
        ORDER BY h.creado_en ASC
      `, [postulacion.id_postulacion]);

      let documentos = { rows: [] };
      try {
        documentos = await db.query(`
          SELECT
            id_documento,
            nombre_documento,
            tipo_documento,
            estado,
            observacion,
            fecha_subida,
            fecha_revision
          FROM documento
          WHERE id_aspirante = $1
          ORDER BY fecha_subida ASC
        `, [idAspirante]);
      } catch (_) {}

      let entrevista = { rows: [] };
      try {
        entrevista = await db.query(`
          SELECT
            e.id_entrevista,
            e.fecha_entrevista,
            e.modalidad,
            e.estado,
            e.observacion,
            u.nombre_completo AS entrevistador,
            ev.preguntas,
            ev.calificacion,
            ev.comentarios
          FROM entrevista e
          LEFT JOIN usuario u
            ON u.id_usuario = e.id_gerente
          LEFT JOIN evaluacion ev
            ON ev.id_entrevista = e.id_entrevista
          WHERE e.id_postulacion = $1
          ORDER BY e.id_entrevista DESC, ev.id_evaluacion DESC
        `, [postulacion.id_postulacion]);
      } catch (_) {}

      let examen = { rows: [] };
      try {
        examen = await db.query(`
          SELECT
            id_examen,
            tipos,
            fecha,
            hora,
            lugar,
            direccion,
            observaciones,
            estado,
            documentos_resultado,
            fecha_recepcion,
            observaciones_rrhh,
            resultado,
            motivo_rechazo,
            fecha_verificacion
          FROM examen_programado
          WHERE id_postulacion = $1
          ORDER BY id_examen DESC
        `, [postulacion.id_postulacion]);
      } catch (_) {}

      let contrato = { rows: [] };
      try {
        contrato = await db.query(`
          SELECT
            id_contrato,
            fecha_inicio,
            fecha_fin,
            tipo_contrato,
            salario,
            estado,
            observaciones
          FROM contrato
          WHERE id_postulacion = $1
          ORDER BY id_contrato DESC
        `, [postulacion.id_postulacion]);
      } catch (_) {}

      let reporteRRHH = { rows: [] };
      try {
        reporteRRHH = await db.query(`
          SELECT *
          FROM reporte_rrhh
          WHERE id_postulacion = $1
          ORDER BY 1 DESC
        `, [postulacion.id_postulacion]);
      } catch (_) {}

      let etapaRechazo = '';
      let motivoRechazo = postulacion.motivo_rechazo || '';

      if (reporteRRHH.rows.length) {
        const rrhh = reporteRRHH.rows[0];

        const textoRRHH = [
          rrhh.concepto,
          rrhh.recomendacion,
          rrhh.motivo_rechazo,
          rrhh.observaciones,
          rrhh.observacion
        ]
            .filter(Boolean)
            .join(' ');

        if (/rechaz|no cumple|no aprobado/i.test(textoRRHH)) {
          etapaRechazo = 'Verificación de hoja de vida / revisión de RRHH';
          motivoRechazo = motivoRechazo || textoRRHH;
        }
      }

      if (
          postulacion.estado === 'RECHAZADO' &&
          !etapaRechazo &&
          examen.rows.length &&
          examen.rows[0].resultado === 'RECHAZADO'
      ) {
        etapaRechazo = 'Verificación de exámenes médicos';
        motivoRechazo =
            motivoRechazo ||
            examen.rows[0].motivo_rechazo ||
            examen.rows[0].observaciones_rrhh ||
            'No especificado';
      }

      if (
          postulacion.estado === 'RECHAZADO' &&
          !etapaRechazo &&
          entrevista.rows.length
      ) {
        let evaluacion = {};

        try {
          evaluacion = JSON.parse(
              entrevista.rows[0].comentarios || '{}'
          );
        } catch (_) {}

        if (evaluacion.resultado === 'RECHAZADO') {
          etapaRechazo = 'Entrevista';
          motivoRechazo =
              motivoRechazo ||
              evaluacion.motivoRechazo ||
              evaluacion.observaciones ||
              'No especificado';
        }
      }

      if (
          postulacion.estado === 'RECHAZADO' &&
          !etapaRechazo &&
          historial.rows.length
      ) {
        const ultimoRechazo = [...historial.rows]
            .reverse()
            .find(h =>
                String(h.estado_nuevo || '').includes('RECHAZADO')
            );

        if (ultimoRechazo) {
          etapaRechazo = 'Proceso de selección';
          motivoRechazo =
              motivoRechazo ||
              ultimoRechazo.detalle ||
              'No especificado';
        }
      }

      postulaciones.push({
        ...postulacion,
        historial: historial.rows,
        documentos: documentos.rows,
        entrevistas: entrevista.rows,
        examenes: examen.rows,
        contratos: contrato.rows,
        reportes_rrhh: reporteRRHH.rows,
        etapa_rechazo: etapaRechazo || 'No aplica',
        motivo_rechazo_completo:
            motivoRechazo || 'No especificado'
      });
    }

    const data = {
      aspirante: aspiranteResult.rows[0],
      postulaciones
    };

    const pdf = await makeHistoryReportPdf(data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
        'Content-Disposition',
        `attachment; filename="sidovi-historial-${idAspirante}.pdf"`
    );

    res.send(pdf);

  } catch (error) {
    console.error('Error generando PDF de historial:', error);
    errorResponse(
        res,
        error,
        'No fue posible generar el PDF de historial.'
    );
  }
});


// PDF 2: Estadísticas generales
app.get('/api/reportes/estadisticas/pdf', requireRoles('RRHH', 'Gerente'), async (req, res) => {
  try {
    const { desde = '', hasta = '' } = req.query;

    const filtros = [];
    const params = [];

    if (desde) {
      params.push(desde);
      filtros.push(`p.fecha_postulacion >= $${params.length}`);
    }

    if (hasta) {
      params.push(hasta);
      filtros.push(`p.fecha_postulacion <= $${params.length}`);
    }

    const where = filtros.length
        ? `WHERE ${filtros.join(' AND ')}`
        : '';

    const baseFrom = `
      FROM postulacion p
      JOIN aspirante a
        ON a.id_aspirante = p.id_aspirante
      JOIN vacante v
        ON v.id_vacante = p.id_vacante
      JOIN sede s
        ON s.id_sede = v.id_sede
      ${where}
    `;

    const [
      resumen,
      genero,
      mensual,
      semanal,
      sedes,
      cargos,
      estados,
      sedeGenero
    ] = await Promise.all([

      db.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (
            WHERE p.estado = 'CONTRATADO'
          )::int AS contratados,
          COUNT(*) FILTER (
            WHERE p.estado = 'RECHAZADO'
          )::int AS rechazados,
          COUNT(*) FILTER (
            WHERE p.estado NOT IN ('RECHAZADO','CONTRATADO')
          )::int AS en_proceso,
          COUNT(*) FILTER (
            WHERE UPPER(COALESCE(a.sexo,'')) IN ('M','MASCULINO','HOMBRE')
          )::int AS hombres,
          COUNT(*) FILTER (
            WHERE UPPER(COALESCE(a.sexo,'')) IN ('F','FEMENINO','MUJER')
          )::int AS mujeres
        ${baseFrom}
      `, params),

      db.query(`
        SELECT
          COALESCE(NULLIF(a.sexo,''),'NO ESPECIFICADO') AS sexo,
          COUNT(*)::int AS cantidad
        ${baseFrom}
        GROUP BY COALESCE(NULLIF(a.sexo,''),'NO ESPECIFICADO')
        ORDER BY cantidad DESC
      `, params),

      db.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', p.fecha_postulacion),'YYYY-MM') AS periodo,
          DATE_TRUNC('month', p.fecha_postulacion)::date AS fecha_inicio,
          COUNT(*)::int AS cantidad
        ${baseFrom}
        GROUP BY DATE_TRUNC('month', p.fecha_postulacion)
        ORDER BY fecha_inicio ASC
      `, params),

      db.query(`
        SELECT
          DATE_TRUNC('week', p.fecha_postulacion)::date AS semana_inicio,
          (
            DATE_TRUNC('week', p.fecha_postulacion)
            + INTERVAL '6 days'
          )::date AS semana_fin,
          COUNT(*)::int AS cantidad
        ${baseFrom}
        GROUP BY DATE_TRUNC('week', p.fecha_postulacion)
        ORDER BY semana_inicio ASC
      `, params),

      db.query(`
        SELECT
          s.nombre_sede AS sede,
          COUNT(*)::int AS cantidad,
          COUNT(*) FILTER (
            WHERE UPPER(COALESCE(a.sexo,'')) IN ('M','MASCULINO','HOMBRE')
          )::int AS hombres,
          COUNT(*) FILTER (
            WHERE UPPER(COALESCE(a.sexo,'')) IN ('F','FEMENINO','MUJER')
          )::int AS mujeres
        ${baseFrom}
        GROUP BY s.id_sede, s.nombre_sede
        ORDER BY cantidad DESC
      `, params),

      db.query(`
        SELECT
          v.nombre_cargo AS cargo,
          COUNT(*)::int AS cantidad
        ${baseFrom}
        GROUP BY v.nombre_cargo
        ORDER BY cantidad DESC
      `, params),

      db.query(`
        SELECT
          p.estado,
          COUNT(*)::int AS cantidad
        ${baseFrom}
        GROUP BY p.estado
        ORDER BY cantidad DESC
      `, params),

      db.query(`
        SELECT
          s.nombre_sede AS sede,
          COALESCE(NULLIF(a.sexo,''),'NO ESPECIFICADO') AS sexo,
          COUNT(*)::int AS cantidad
        ${baseFrom}
        GROUP BY s.id_sede, s.nombre_sede,
                 COALESCE(NULLIF(a.sexo,''),'NO ESPECIFICADO')
        ORDER BY s.nombre_sede, cantidad DESC
      `, params)

    ]);

    const data = {
      filtros: {
        desde: desde || null,
        hasta: hasta || null
      },
      resumen: resumen.rows[0] || {},
      genero: genero.rows,
      mensual: mensual.rows,
      semanal: semanal.rows,
      sedes: sedes.rows,
      cargos: cargos.rows,
      estados: estados.rows,
      sedeGenero: sedeGenero.rows
    };

    const pdf = await makeStatisticsReportPdf(data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
        'Content-Disposition',
        'attachment; filename="sidovi-estadisticas.pdf"'
    );

    res.send(pdf);

  } catch (error) {
    console.error('Error generando PDF de estadísticas:', error);
    errorResponse(
        res,
        error,
        'No fue posible generar el PDF de estadísticas.'
    );
  }
});

// ==================== Flujo ampliado de selecciÃ³n SIDOVI ====================
const EXAM_TYPES = ['Examen mÃ©dico ocupacional', 'Examen visual', 'Examen auditivo', 'Examen de laboratorio', 'Otros exÃ¡menes requeridos'];
const INTERVIEW_CRITERIA = ['PresentaciÃ³n personal','ComunicaciÃ³n','Actitud','Experiencia verificada','Conocimiento relacionado con el cargo','Aptitud para el cargo','Trabajo en equipo','Responsabilidad','Puntualidad','Capacidad de resoluciÃ³n de problemas','Manejo de presiÃ³n','Adaptabilidad','MotivaciÃ³n','Perfil profesional'];
const pdfEscape = (value) =>
    String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/[\r\n]+/g, ' ');
// Genera un PDF con encabezado, regla, cuerpo y pie de pÃ¡gina, sin dependencias externas
// (sintaxis PDF 1.4 escrita a mano). subtitle es opcional (cargo/fecha/candidato, etc.).
// Genera un PDF simple para los reportes generales de SIDOVI.
// El PDF de entrevista utiliza makeInterviewPdf() por separado.
// El PDF de entrevista utiliza makeInterviewPdf() por separado.

// ============================================================
// GENERADORES PDF DE REPORTES SIDOVI
// ============================================================

const PDFDocument = require('pdfkit');
const fs = require('fs');



// ============================================================
// LOGO SIDOVI / COLVISEG
// ============================================================

function getReportLogo() {

  const posibles = [
    path.join(__dirname, 'img', 'colviseg.png'),
    path.join(__dirname, 'img', 'colviseg.png'),
    path.join(__dirname, 'img', 'logo.png')
  ];

  for (const archivo of posibles) {

    if (fs.existsSync(archivo)) {
      return archivo;
    }

  }

  return null;
}


// ============================================================
// CONFIGURACIÓN GENERAL DEL PDF
// ============================================================

function configurarReportePdf(doc, titulo, subtitulo = '') {

  const logo = getReportLogo();

  // --------------------------------------------------------
  // Encabezado
  // --------------------------------------------------------

  if (logo) {

    try {

      doc.image(
          logo,
          42,
          35,
          {
            fit: [90, 45],
            align: 'left',
            valign: 'center'
          }
      );

    } catch (error) {

      console.warn(
          'No fue posible cargar el logo:',
          error.message
      );

    }

  }


  // --------------------------------------------------------
  // Título del reporte debajo del logo
  // --------------------------------------------------------

  doc
      .font('Helvetica-Bold')
      .fontSize(17)
      .fillColor('#17365D')
      .text(
          titulo,
          42,
          92,
          {
            width: 511,
            align: 'center'
          }
      );


  doc
      .moveTo(42, 120)
      .lineTo(553, 120)
      .lineWidth(1)
      .strokeColor('#7A1F3D')
      .stroke();


  // --------------------------------------------------------
  // Título
  // --------------------------------------------------------

  doc
      .moveDown(1)
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor('#17365D')
  doc
      .font('Helvetica-Bold')
      .fontSize(17)
      .fillColor('#17365D')
      .text(
          titulo,
          42,
          92,
          {
            width: 250,
            align: 'left'
          }
      );


  if (subtitulo) {

    doc
        .moveDown(0.4)
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#555555')
        .text(
            subtitulo,
            {
              width: 511,
              align: 'center'
            }
        );

  }


  doc.moveDown(1);

}


// ============================================================
// PIE DE PÁGINA
// ============================================================

function agregarPieReporte(doc) {

  const rango =
      doc.bufferedPageRange();

  for (
      let i = rango.start;
      i < rango.start + rango.count;
      i++
  ) {

    doc.switchToPage(i);

    const y =
        doc.page.height - 38;


    doc
        .moveTo(42, y - 8)
        .lineTo(553, y - 8)
        .lineWidth(0.5)
        .strokeColor('#CCCCCC')
        .stroke();


    doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor('#666666')
        .text(
            'SIDOVI · Sistema de Información para la Documentación y Vinculación de Personal',
            42,
            y,
            {
              width: 380
            }
        );


    doc
        .text(
            `Página ${i + 1} de ${rango.count}`,
            440,
            y,
            {
              width: 113,
              align: 'right'
            }
        );

  }

}


// ============================================================
// ESCRIBIR BLOQUE DE INFORMACIÓN
// ============================================================

function escribirCampoPdf(
    doc,
    etiqueta,
    valor
) {

  const texto =
      valor === null ||
      valor === undefined ||
      String(valor).trim() === ''
          ? 'No especificado'
          : String(valor);


  doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#17365D')
      .text(
          `${etiqueta}: `,
          {
            continued: true
          }
      );


  doc
      .font('Helvetica')
      .fillColor('#222222')
      .text(
          texto
      );


  doc.moveDown(0.15);

}


// ============================================================
// TÍTULO DE SECCIÓN
// ============================================================

function tituloSeccionPdf(
    doc,
    titulo
) {

  doc.moveDown(0.7);


  doc
      .roundedRect(
          42,
          doc.y,
          511,
          24,
          4
      )
      .fill('#17365D');


  doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#FFFFFF')
      .text(
          titulo,
          52,
          doc.y + 7,
          {
            width: 491
          }
      );


  doc.y += 28;

}


// ============================================================
// REPORTE PDF 1
// HISTORIAL INDIVIDUAL
// ============================================================

// ============================================================
// CONFIGURACIÓN GENERAL DEL PDF
// ============================================================

function configurarReportePdf(doc, titulo, subtitulo = '') {

  const logo = getReportLogo();

  if (logo) {
    try {
      doc.image(logo, 42, 35, {
        fit: [90, 45],
        align: 'left',
        valign: 'center'
      });
    } catch (error) {
      console.warn('No fue posible cargar el logo:', error.message);
    }
  }

  const tituloFontSize = 15;

  doc.font('Helvetica-Bold').fontSize(tituloFontSize);

  const alturaTitulo = doc.heightOfString(titulo, {
    width: 511,
    align: 'center'
  });

  doc
      .fillColor('#17365D')
      .text(titulo, 42, 92, {
        width: 511,
        align: 'center'
      });

  const yLinea = 92 + alturaTitulo + 10;

  doc
      .moveTo(42, yLinea)
      .lineTo(553, yLinea)
      .lineWidth(1)
      .strokeColor('#7A1F3D')
      .stroke();

  if (subtitulo) {
    doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#555555')
        .text(subtitulo, 42, yLinea + 8, {
          width: 511,
          align: 'center'
        });
  }

  doc.y = yLinea + 30;
}
function makeHistoryReportPdf(data) {

  return new Promise((resolve, reject) => {

    try {

      const doc =
          new PDFDocument({
            size: 'A4',
            margins: {
              top: 42,
              bottom: 55,
              left: 42,
              right: 42
            },
            bufferPages: true,
            info: {
              Title:
                  'Historial Individual de Aspirante - SIDOVI',

              Author:
                  'SIDOVI - Colviseg Ltda.',

              Subject:
                  'Historial completo del proceso de selección'
            }
          });


      const chunks = [];


      doc.on(
          'data',
          chunk => chunks.push(chunk)
      );


      doc.on(
          'end',
          () => {

            agregarPieReporte(doc);

            resolve(
                Buffer.concat(chunks)
            );

          }
      );


      doc.on(
          'error',
          reject
      );


      const aspirante =
          data.aspirante || {};

      const resumen =
          data.resumen || {};

      const historial =
          data.historial || [];


      configurarReportePdf(
          doc,
          'HISTORIAL INDIVIDUAL DEL ASPIRANTE',
          `Generado el ${new Date().toLocaleString('es-CO')}`
      );


      // ------------------------------------------------
      // DATOS DEL ASPIRANTE
      // ------------------------------------------------

      tituloSeccionPdf(
          doc,
          '1. INFORMACIÓN GENERAL DEL ASPIRANTE'
      );


      escribirCampoPdf(
          doc,
          'Nombre completo',
          aspirante.nombre_completo
      );


      escribirCampoPdf(
          doc,
          'Tipo de documento',
          aspirante.tipo_documento
      );


      escribirCampoPdf(
          doc,
          'Número de documento',
          aspirante.numero_documento
      );


      escribirCampoPdf(
          doc,
          'Sexo',
          aspirante.sexo
      );


      escribirCampoPdf(
          doc,
          'Correo electrónico',
          aspirante.correo
      );


      escribirCampoPdf(
          doc,
          'Teléfono',
          aspirante.telefono
      );


      escribirCampoPdf(
          doc,
          'Dirección',
          aspirante.direccion
      );


      escribirCampoPdf(
          doc,
          'Fecha de registro',
          aspirante.fecha_registro
              ? new Date(
                  aspirante.fecha_registro
              ).toLocaleDateString('es-CO')
              : null
      );


      // ------------------------------------------------
      // RESUMEN
      // ------------------------------------------------

      tituloSeccionPdf(
          doc,
          '2. RESUMEN DEL HISTORIAL'
      );


      escribirCampoPdf(
          doc,
          'Total de postulaciones',
          resumen.total_postulaciones
      );


      escribirCampoPdf(
          doc,
          'Postulaciones rechazadas',
          resumen.rechazadas
      );


      escribirCampoPdf(
          doc,
          'Postulaciones aprobadas',
          resumen.aprobadas
      );


      escribirCampoPdf(
          doc,
          'Primera postulación',
          resumen.primera_postulacion
              ? new Date(
                  resumen.primera_postulacion
              ).toLocaleDateString('es-CO')
              : null
      );


      escribirCampoPdf(
          doc,
          'Última postulación',
          resumen.ultima_postulacion
              ? new Date(
                  resumen.ultima_postulacion
              ).toLocaleDateString('es-CO')
              : null
      );


      // ------------------------------------------------
      // CADA POSTULACIÓN
      // ------------------------------------------------

      historial.forEach(
          (p, index) => {

            tituloSeccionPdf(
                doc,
                `3.${index + 1}. POSTULACIÓN #${index + 1}`
            );


            escribirCampoPdf(
                doc,
                'Fecha de postulación',
                p.fecha_postulacion
                    ? new Date(
                        p.fecha_postulacion
                    ).toLocaleDateString('es-CO')
                    : null
            );


            escribirCampoPdf(
                doc,
                'Cargo',
                p.nombre_cargo ||
                p.cargo ||
                p.titulo
            );


            escribirCampoPdf(
                doc,
                'Sede',
                p.nombre_sede
            );


            escribirCampoPdf(
                doc,
                'Estado',
                p.estado
            );


            escribirCampoPdf(
                doc,
                'Resultado',
                p.resultado
            );


            escribirCampoPdf(
                doc,
                'Etapa del rechazo',
                p.etapa_rechazo
            );


            escribirCampoPdf(
                doc,
                'Motivo de rechazo',
                p.motivo_rechazo_completo ||
                p.motivo_rechazo
            );


            escribirCampoPdf(
                doc,
                'Fecha de rechazo',
                p.fecha_rechazo
                    ? new Date(
                        p.fecha_rechazo
                    ).toLocaleDateString('es-CO')
                    : null
            );


            escribirCampoPdf(
                doc,
                'Experiencia',
                p.experiencia
            );


            escribirCampoPdf(
                doc,
                'Descripción',
                p.descripcion
            );


            // ----------------------------------------
            // HISTORIAL DEL PROCESO
            // ----------------------------------------

            const proceso =
                p.historial_proceso || [];


            if (proceso.length) {

              tituloSeccionPdf(
                  doc,
                  'Historial de cambios de estado'
              );


              proceso.forEach(
                  h => {

                    const fecha =
                        h.creado_en
                            ? new Date(
                                h.creado_en
                            ).toLocaleString(
                                'es-CO'
                            )
                            : 'No especificado';


                    escribirCampoPdf(
                        doc,
                        fecha,
                        `${h.estado_anterior || 'Inicio'} → ${h.estado_nuevo || 'No especificado'} | ${h.detalle || 'Sin detalle'}`
                    );

                  }
              );

            }


            // ----------------------------------------
            // REPORTE RRHH
            // ----------------------------------------

            if (p.reporte_rrhh) {

              tituloSeccionPdf(
                  doc,
                  'Verificación de Recursos Humanos'
              );


              escribirCampoPdf(
                  doc,
                  'Responsable',
                  p.reporte_rrhh.nombre_rrhh
              );


              escribirCampoPdf(
                  doc,
                  'Concepto',
                  p.reporte_rrhh.concepto
              );


              escribirCampoPdf(
                  doc,
                  'Fortalezas',
                  p.reporte_rrhh.fortalezas
              );


              escribirCampoPdf(
                  doc,
                  'Aspectos a considerar',
                  p.reporte_rrhh.aspectos_considerar
              );


              escribirCampoPdf(
                  doc,
                  'Recomendación',
                  p.reporte_rrhh.recomendacion
              );

            }


            // ----------------------------------------
            // DOCUMENTOS
            // ----------------------------------------

            const documentos =
                p.documentos || [];


            tituloSeccionPdf(
                doc,
                'Documentos registrados'
            );


            if (documentos.length) {

              documentos.forEach(
                  d => {

                    escribirCampoPdf(
                        doc,
                        d.nombre_documento ||
                        'Documento',
                        `${d.estado || 'Sin estado'} | ${d.observacion || 'Sin observación'}`
                    );

                  }
              );

            } else {

              escribirCampoPdf(
                  doc,
                  'Documentos',
                  'No hay documentos registrados.'
              );

            }


            // ----------------------------------------
            // ENTREVISTA
            // ----------------------------------------

            if (p.entrevista) {

              tituloSeccionPdf(
                  doc,
                  'Entrevista'
              );


              const e =
                  p.entrevista;


              escribirCampoPdf(
                  doc,
                  'Fecha',
                  e.fecha_entrevista
                      ? new Date(
                          e.fecha_entrevista
                      ).toLocaleString(
                          'es-CO'
                      )
                      : null
              );


              escribirCampoPdf(
                  doc,
                  'Modalidad',
                  e.modalidad
              );


              escribirCampoPdf(
                  doc,
                  'Estado',
                  e.estado
              );


              escribirCampoPdf(
                  doc,
                  'Entrevistador',
                  e.entrevistador
              );


              escribirCampoPdf(
                  doc,
                  'Calificación',
                  e.calificacion
              );


              if (e.evaluacion) {

                escribirCampoPdf(
                    doc,
                    'Resultado de entrevista',
                    e.evaluacion.resultado
                );


                escribirCampoPdf(
                    doc,
                    'Motivo de rechazo',
                    e.evaluacion.motivoRechazo
                );


                escribirCampoPdf(
                    doc,
                    'Observaciones',
                    e.evaluacion.observaciones
                );


                escribirCampoPdf(
                    doc,
                    'Fortalezas',
                    e.evaluacion.fortalezas
                );


                escribirCampoPdf(
                    doc,
                    'Aspectos por mejorar',
                    e.evaluacion.aspectosMejora
                );


                escribirCampoPdf(
                    doc,
                    'Recomendación',
                    e.evaluacion.recomendacion
                );

              }

            }


            // ----------------------------------------
            // EXÁMENES
            // ----------------------------------------

            if (p.examen) {

              tituloSeccionPdf(
                  doc,
                  'Exámenes médicos'
              );


              const ex =
                  p.examen;


              escribirCampoPdf(
                  doc,
                  'Fecha',
                  ex.fecha
                      ? new Date(
                          ex.fecha
                      ).toLocaleDateString(
                          'es-CO'
                      )
                      : null
              );


              escribirCampoPdf(
                  doc,
                  'Hora',
                  ex.hora
              );


              escribirCampoPdf(
                  doc,
                  'Lugar',
                  ex.lugar
              );


              escribirCampoPdf(
                  doc,
                  'Estado',
                  ex.estado
              );


              escribirCampoPdf(
                  doc,
                  'Resultado',
                  ex.resultado
              );


              escribirCampoPdf(
                  doc,
                  'Motivo de rechazo',
                  ex.motivo_rechazo
              );


              escribirCampoPdf(
                  doc,
                  'Observaciones de RRHH',
                  ex.observaciones_rrhh
              );


              escribirCampoPdf(
                  doc,
                  'Fecha de verificación',
                  ex.fecha_verificacion
                      ? new Date(
                          ex.fecha_verificacion
                      ).toLocaleString(
                          'es-CO'
                      )
                      : null
              );


              escribirCampoPdf(
                  doc,
                  'Verificado por',
                  ex.verificado_por_nombre
              );

            }


            // ----------------------------------------
            // CONTRATO
            // ----------------------------------------

            if (p.contrato) {

              tituloSeccionPdf(
                  doc,
                  'Contrato'
              );


              escribirCampoPdf(
                  doc,
                  'Fecha de contratación',
                  p.fecha_contratacion
              );


              escribirCampoPdf(
                  doc,
                  'Fecha de firma programada',
                  p.fecha_firma_programada
              );


              escribirCampoPdf(
                  doc,
                  'Hora de firma',
                  p.hora_firma
              );


              escribirCampoPdf(
                  doc,
                  'Lugar de firma',
                  p.lugar_firma
              );


              escribirCampoPdf(
                  doc,
                  'Dirección',
                  p.direccion_firma
              );


              escribirCampoPdf(
                  doc,
                  'Observaciones',
                  p.observaciones_firma
              );

            }


            // Separación entre postulaciones

            if (index < historial.length - 1) {

              doc
                  .moveDown(1);


              doc
                  .moveTo(42, doc.y)
                  .lineTo(553, doc.y)
                  .lineWidth(1)
                  .dash(4, {
                    space: 4
                  })
                  .strokeColor('#CCCCCC')
                  .stroke()
                  .undash();


              doc.moveDown(1);

            }

          }
      );


      doc.end();

    } catch (error) {

      reject(error);

    }

  });

}


// ============================================================
// REPORTE PDF 2
// ESTADÍSTICAS
// ============================================================

function makeStatisticsReportPdf(data) {

  return new Promise((resolve, reject) => {

    try {

      const doc =
          new PDFDocument({
            size: 'A4',
            margins: {
              top: 42,
              bottom: 55,
              left: 42,
              right: 42
            },
            bufferPages: true,
            info: {
              Title:
                  'Reporte Estadístico - SIDOVI',

              Author:
                  'SIDOVI - Colviseg Ltda.',

              Subject:
                  'Estadísticas del proceso de selección'
            }
          });


      const chunks = [];


      doc.on(
          'data',
          chunk => chunks.push(chunk)
      );


      doc.on(
          'end',
          () => {

            agregarPieReporte(doc);

            resolve(
                Buffer.concat(chunks)
            );

          }
      );


      doc.on(
          'error',
          reject
      );


      const resumen =
          data.resumen || {};

      const mensual =
          data.mensual || [];

      const semanal =
          data.semanal || [];

      const genero =
          data.genero || [];

      const porSede =
          data.porSede || [];

      const porCargo =
          data.porCargo || [];

      const estados =
          data.estados || [];

      const sedeGenero =
          data.sedeGenero || [];

      const historial =
          data.historial || [];


      configurarReportePdf(
          doc,
          'REPORTE ESTADÍSTICO DEL PROCESO DE SELECCIÓN',
          `Generado el ${new Date().toLocaleString('es-CO')}`
      );


      // ------------------------------------------------
      // FILTROS
      // ------------------------------------------------

      tituloSeccionPdf(
          doc,
          '1. PERÍODO DEL REPORTE'
      );


      escribirCampoPdf(
          doc,
          'Desde',
          data.filtros?.desde
              ? new Date(
                  data.filtros.desde
              ).toLocaleDateString('es-CO')
              : 'Todos'
      );


      escribirCampoPdf(
          doc,
          'Hasta',
          data.filtros?.hasta
              ? new Date(
                  data.filtros.hasta
              ).toLocaleDateString('es-CO')
              : 'Todos'
      );


      // ------------------------------------------------
      // RESUMEN
      // ------------------------------------------------

      tituloSeccionPdf(
          doc,
          '2. RESUMEN GENERAL'
      );


      escribirCampoPdf(
          doc,
          'Total de postulaciones',
          resumen.total
      );


      escribirCampoPdf(
          doc,
          'Postulaciones en proceso',
          resumen.en_proceso
      );


      escribirCampoPdf(
          doc,
          'Postulaciones rechazadas',
          resumen.rechazados
      );


      escribirCampoPdf(
          doc,
          'Personas contratadas',
          resumen.contratados
      );


      escribirCampoPdf(
          doc,
          'Hombres',
          resumen.hombres
      );


      escribirCampoPdf(
          doc,
          'Mujeres',
          resumen.mujeres
      );


      // ------------------------------------------------
      // GÉNERO
      // ------------------------------------------------

      tituloSeccionPdf(
          doc,
          '3. DISTRIBUCIÓN POR GÉNERO'
      );


      genero.forEach(
          item => {

            escribirCampoPdf(
                doc,
                item.sexo,
                `${item.cantidad} postulaciones`
            );

          }
      );


      // ------------------------------------------------
      // MES
      // ------------------------------------------------

      tituloSeccionPdf(
          doc,
          '4. POSTULACIONES POR MES'
      );


      mensual.forEach(
          item => {

            escribirCampoPdf(
                doc,
                item.periodo,
                `${item.cantidad} postulaciones`
            );

          }
      );


      // ------------------------------------------------
      // SEMANA
      // ------------------------------------------------

      tituloSeccionPdf(
          doc,
          '5. POSTULACIONES POR SEMANA'
      );


      semanal.forEach(
          item => {

            escribirCampoPdf(
                doc,
                `${item.semana_inicio} - ${item.semana_fin}`,
                `${item.cantidad} postulaciones`
            );

          }
      );


      // ------------------------------------------------
      // SEDES
      // ------------------------------------------------

      tituloSeccionPdf(
          doc,
          '6. POSTULACIONES POR SEDE'
      );


      porSede.forEach(
          item => {

            escribirCampoPdf(
                doc,
                item.sede,
                `${item.cantidad} postulaciones`
            );

          }
      );


      // ------------------------------------------------
      // CARGOS
      // ------------------------------------------------

      tituloSeccionPdf(
          doc,
          '7. POSTULACIONES POR CARGO'
      );


      porCargo.forEach(
          item => {

            escribirCampoPdf(
                doc,
                item.cargo,
                `${item.cantidad} postulaciones`
            );

          }
      );


      // ------------------------------------------------
      // ESTADOS
      // ------------------------------------------------

      tituloSeccionPdf(
          doc,
          '8. ESTADO DE LAS POSTULACIONES'
      );


      estados.forEach(
          item => {

            escribirCampoPdf(
                doc,
                item.estado,
                `${item.cantidad} postulaciones`
            );

          }
      );


      // ------------------------------------------------
      // SEDE + GÉNERO
      // ------------------------------------------------

      tituloSeccionPdf(
          doc,
          '9. DISTRIBUCIÓN POR SEDE Y GÉNERO'
      );


      sedeGenero.forEach(
          item => {

            escribirCampoPdf(
                doc,
                item.sede,
                `Hombres: ${item.hombres || 0} | Mujeres: ${item.mujeres || 0} | Total: ${item.total || 0}`
            );

          }
      );


      // ------------------------------------------------
      // HISTORIAL GENERAL
      // ------------------------------------------------

      tituloSeccionPdf(
          doc,
          '10. DETALLE DE POSTULACIONES'
      );


      historial.forEach(
          (item, index) => {

            const fecha =
                item.fecha_postulacion
                    ? new Date(
                        item.fecha_postulacion
                    ).toLocaleDateString(
                        'es-CO'
                    )
                    : 'No especificado';


            escribirCampoPdf(
                doc,
                `Postulación ${index + 1}`,
                `${fecha} | ${item.nombre_completo || 'Sin nombre'} | ${item.tipo_documento || ''} ${item.numero_documento || ''} | ${item.cargo || 'Sin cargo'} | ${item.sede || 'Sin sede'} | ${item.estado || 'Sin estado'}`
            );

          }
      );


      doc.end();

    } catch (error) {

      reject(error);

    }

  });

}

function makeInterviewPdf(row, preguntas, comentarios) {
  const PDFDocument = require('pdfkit');
  const fs = require('fs');


  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 45,
          bottom: 55,
          left: 42,
          right: 42
        },
        bufferPages: true,
        info: {
          Title: 'Reporte de Entrevista - SIDOVI',
          Author: 'SIDOVI - Colviseg Ltda.',
          Subject: 'Reporte de entrevista de candidato'
        }
      });

      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));

      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      doc.on('error', reject);

      // ==============================
      // COLORES CORPORATIVOS COLVISEG
      // ==============================
      const NAVY = '#0B1F3A';
      const BURGUNDY = '#ffffff';
      const LIGHT = '#F3F5F8';
      const GRAY = '#667085';
      const DARK = '#202938';
      const WHITE = '#FFFFFF';
      const GREEN = '#18794E';
      const RED = '#B42318';

      // ==============================
      // LOGO
      // ==============================
      const logoPath = path.join(
          __dirname,
          'img',
          'colviseg.png'
      );

      // ==============================
      // DATOS
      // ==============================
      const nombre = row.nombre_completo || 'No registrado';
      const documento = row.numero_documento || 'No registrado';
      const correo = row.correo || 'No registrado';
      const telefono = row.telefono || 'No registrado';
      const cargo = row.cargo || 'No registrado';
      const entrevistador = row.entrevistador || 'Gerencia';
      const modalidad = row.modalidad || 'No registrada';

      const fecha = row.fecha_entrevista
          ? new Date(row.fecha_entrevista).toLocaleDateString('es-CO')
          : 'No registrada';

      const hora = 'No registrada';

      const resultado = String(
          comentarios?.resultado || row.estado || 'PENDIENTE'
      ).toUpperCase();

      const observaciones =
          comentarios?.observaciones ||
          row.observacion ||
          'Sin observaciones';

      const fortalezas =
          comentarios?.fortalezas ||
          'Sin registro';

      const aspectosMejora =
          comentarios?.aspectosMejora ||
          'Sin registro';

      const recomendacion =
          comentarios?.recomendacion ||
          'Sin registro';

      const motivoRechazo =
          comentarios?.motivoRechazo ||
          '';

      // ==============================
      // FUNCIONES DE DISEÃ‘O
      // ==============================
      function drawHeader() {

        // ==========================================
        // ENCABEZADO CORPORATIVO
        // ==========================================

        // Zona izquierda - VINOTINTO
        doc
            .rect(0, 0, 190, 105)
            .fill(BURGUNDY);

        // Zona derecha - AZUL OSCURO
        doc
            .rect(190, 0, 405.28, 105)
            .fill(NAVY);

        // Franja inferior
        doc
            .rect(0, 98, 595.28, 7)
            .fill('#5A1721');

        // ==========================================
        // LOGO
        // ==========================================

        if (fs.existsSync(logoPath)) {
          try {
            doc.image(
                logoPath,
                35,
                15,
                {
                  fit: [125, 70],
                  align: 'left',
                  valign: 'center'
                }
            );
          } catch (e) {
            // ContinÃºa sin logo si existe algÃºn problema.
          }
        }

        // ==========================================
        // TÃTULO
        // ==========================================

        doc
            .fillColor(WHITE)
            .font('Helvetica-Bold')
            .fontSize(20)
            .text(
                'REPORTE DE ENTREVISTA',
                205,
                29,
                {
                  width: 350,
                  align: 'right'
                }
            );

        // ==========================================
        // DESCRIPCIÃ“N
        // ==========================================

        doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor('#D9E2F0')
            .text(
                'Sistema de InformaciÃ³n para la DocumentaciÃ³n y VinculaciÃ³n de Personal',
                205,
                58,
                {
                  width: 350,
                  align: 'right'
                }
            );

        // ==========================================
        // IDENTIFICACIÃ“N
        // ==========================================

        doc
            .fontSize(8)
            .fillColor('#B8C4D6')
            .text(
                'SIDOVI Â· Colviseg Ltda.',
                205,
                78,
                {
                  width: 350,
                  align: 'right'
                }
            );
      }


      function drawFooter() {
        const range = doc.bufferedPageRange();

        for (
            let i = range.start;
            i < range.start + range.count;
            i++
        ) {
          doc.switchToPage(i);

          doc
              .moveTo(42, 790)
              .lineTo(553, 790)
              .lineWidth(0.7)
              .strokeColor('#D0D5DD')
              .stroke();

          doc
              .font('Helvetica')
              .fontSize(7.5)
              .fillColor(GRAY)
              .text(
                  'SIDOVI Â· Colviseg Ltda. Â· Documento generado por el sistema',
                  42,
                  800,
                  {
                    width: 350
                  }
              );

          doc
              .text(
                  `PÃ¡gina ${i + 1} de ${range.count}`,
                  430,
                  800,
                  {
                    width: 123,
                    align: 'right'
                  }
              );
        }
      }

      function sectionTitle(title) {
        // Deja suficiente espacio para el tÃ­tulo
        // y parte del contenido antes de crear una nueva pÃ¡gina.
        if (doc.y > 700) {
          doc.addPage();
        }

        doc
            .roundedRect(
                42,
                doc.y,
                511,
                27,
                4
            )
            .fill(NAVY);

        doc
            .fillColor(WHITE)
            .font('Helvetica-Bold')
            .fontSize(10)
            .text(
                title,
                54,
                doc.y + 8
            );

        doc.y += 39;
      }

      function field(label, value, x, y, width) {
        doc
            .font('Helvetica-Bold')
            .fontSize(8)
            .fillColor(GRAY)
            .text(
                label.toUpperCase(),
                x,
                y,
                {
                  width
                }
            );

        doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor(DARK)
            .text(
                String(value || 'No registrado'),
                x,
                y + 12,
                {
                  width
                }
            );
      }

      function paragraph(title, value) {
        const text = String(value || 'Sin registro');

        doc
            .font('Helvetica-Bold')
            .fontSize(9)
            .fillColor(DARK)
            .text(title);

        doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor('#475467')
            .text(text, {
              width: 511,
              lineGap: 3
            });

        doc.moveDown(0.8);
      }

      // ==============================
      // HEADER
      // ==============================
      drawHeader();

      doc.y = 125;

      // ==============================
      // RESULTADO
      // ==============================

      const resultadoTexto =
          resultado === 'APROBADO'
              ? 'ENTREVISTA APROBADA'
              : resultado === 'RECHAZADO'
                  ? 'ENTREVISTA RECHAZADA'
                  : 'RESULTADO PENDIENTE';

      const resultadoColor =
          resultado === 'APROBADO'
              ? GREEN
              : resultado === 'RECHAZADO'
                  ? RED
                  : BURGUNDY;

      doc
          .roundedRect(
              42,
              doc.y,
              511,
              55,
              7
          )
          .fill('#F8FAFC')
          .lineWidth(1)
          .strokeColor('#D0D5DD')
          .stroke();

      doc
          .font('Helvetica-Bold')
          .fontSize(14)
          .fillColor(resultadoColor)
          .text(
              resultadoTexto,
              58,
              doc.y + 12
          );

      doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(GRAY)
          .text(
              `ID entrevista: ${row.id_entrevista || 'N/A'}`,
              58,
              doc.y + 32
          );

      doc.y += 75;

      // ==============================
      // INFORMACIÃ“N DEL CANDIDATO
      // ==============================

      sectionTitle('INFORMACIÃ“N DEL CANDIDATO');

      const yInfo = doc.y;

      field(
          'Nombre completo',
          nombre,
          42,
          yInfo,
          250
      );

      field(
          'Documento',
          documento,
          315,
          yInfo,
          238
      );

      field(
          'Correo electrÃ³nico',
          correo,
          42,
          yInfo + 48,
          250
      );

      field(
          'TelÃ©fono',
          telefono,
          315,
          yInfo + 48,
          238
      );

      field(
          'Cargo',
          cargo,
          42,
          yInfo + 96,
          250
      );

      field(
          'Modalidad',
          modalidad,
          315,
          yInfo + 96,
          238
      );

      doc.y = yInfo + 145;

      // ==============================
      // DATOS DE LA ENTREVISTA
      // ==============================

      sectionTitle('DATOS DE LA ENTREVISTA');

      const yEnt = doc.y;

      field(
          'Fecha',
          fecha,
          42,
          yEnt,
          160
      );

      field(
          'Hora',
          hora,
          220,
          yEnt,
          130
      );

      field(
          'Entrevistador',
          entrevistador,
          365,
          yEnt,
          188
      );

      doc.y = yEnt + 55;

      // ==============================
      // EVALUACIÃ“N
      // ==============================

      sectionTitle('EVALUACIÃ“N DEL CANDIDATO');

      const criterios =
          Array.isArray(comentarios?.criterios)
              ? comentarios.criterios
              : [];

      if (criterios.length) {
        criterios.forEach((criterio, index) => {
          if (doc.y > 735) {
            doc.addPage();
          }

          const nombreCriterio =
              criterio.criterio ||
              criterio.nombre ||
              criterio.categoria ||
              `Criterio ${index + 1}`;

          const puntuacion =
              criterio.puntuacion ??
              criterio.calificacion ??
              0;

          doc
              .font('Helvetica')
              .fontSize(9)
              .fillColor(DARK)
              .text(
                  nombreCriterio,
                  48,
                  doc.y,
                  {
                    width: 390
                  }
              );

          doc
              .font('Helvetica-Bold')
              .fontSize(9)
              .fillColor(BURGUNDY)
              .text(
                  `${puntuacion}/10`,
                  455,
                  doc.y,
                  {
                    width: 80,
                    align: 'right'
                  }
              );

          doc.y += 16;

          doc
              .moveTo(48, doc.y)
              .lineTo(545, doc.y)
              .lineWidth(0.5)
              .strokeColor('#EAECF0')
              .stroke();

          doc.y += 8;
        });
      } else {
        doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor(GRAY)
            .text(
                'No se registraron criterios individuales.'
            );
      }

      // ==============================
      // PREGUNTAS Y RESPUESTAS
      // ==============================

      sectionTitle('PREGUNTAS Y RESPUESTAS');

      if (Array.isArray(preguntas) && preguntas.length) {
        preguntas.forEach((p, index) => {
          if (doc.y > 690) {
            doc.addPage();
            sectionTitle('PREGUNTAS Y RESPUESTAS');
          }

          doc
              .font('Helvetica-Bold')
              .fontSize(9)
              .fillColor(NAVY)
              .text(
                  `${index + 1}. ${p.categoria || 'Entrevista'}`,
                  {
                    width: 511
                  }
              );

          doc
              .font('Helvetica-Bold')
              .fontSize(9)
              .fillColor(DARK)
              .text(
                  p.pregunta || 'Pregunta no registrada',
                  {
                    width: 511,
                    lineGap: 2
                  }
              );

          doc.moveDown(0.3);

          doc
              .roundedRect(
                  48,
                  doc.y,
                  499,
                  1,
                  0
              )
              .fill(BURGUNDY);

          doc.y += 7;

          doc
              .font('Helvetica')
              .fontSize(9)
              .fillColor('#475467')
              .text(
                  `Respuesta: ${p.respuesta || 'Sin respuesta'}`,
                  {
                    width: 499,
                    lineGap: 3
                  }
              );

          doc.moveDown(0.9);
        });
      } else {
        doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor(GRAY)
            .text(
                'No se registraron preguntas o respuestas.'
            );
      }

      // ==============================
      // OBSERVACIONES
      // ==============================

      sectionTitle('CONCLUSIONES DE LA ENTREVISTA');

      paragraph(
          'Observaciones',
          observaciones
      );

      paragraph(
          'Fortalezas',
          fortalezas
      );

      paragraph(
          'Aspectos por mejorar',
          aspectosMejora
      );

      paragraph(
          'RecomendaciÃ³n',
          recomendacion
      );

      if (motivoRechazo) {
        paragraph(
            'Motivo de rechazo',
            motivoRechazo
        );
      }

      // ==============================
      // CALIFICACIÃ“N GENERAL
      // ==============================

      sectionTitle('CALIFICACIÃ“N GENERAL');

      const calificacion =
          row.calificacion ??
          comentarios?.calificacion ??
          'No registrada';

      doc
          .roundedRect(
              42,
              doc.y,
              511,
              48,
              6
          )
          .fill(LIGHT);

      doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor(DARK)
          .text(
              'CalificaciÃ³n promedio',
              58,
              doc.y + 17
          );

      doc
          .font('Helvetica-Bold')
          .fontSize(16)
          .fillColor(BURGUNDY)
          .text(
              `${calificacion}${typeof calificacion === 'number' ? '/10' : ''}`,
              430,
              doc.y + 13,
              {
                width: 90,
                align: 'right'
              }
          );

      doc.y += 70;

      // ==============================
      // FIRMAS
      // ==============================

      sectionTitle('FIRMAS');

      const firmaY = doc.y + 45;

      doc
          .moveTo(55, firmaY)
          .lineTo(245, firmaY)
          .lineWidth(1)
          .strokeColor('#344054')
          .stroke();

      doc
          .moveTo(350, firmaY)
          .lineTo(540, firmaY)
          .lineWidth(1)
          .strokeColor('#344054')
          .stroke();

      doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(GRAY)
          .text(
              'Firma del entrevistador',
              55,
              firmaY + 8,
              {
                width: 190,
                align: 'center'
              }
          );

      doc
          .text(
              'Firma del candidato',
              350,
              firmaY + 8,
              {
                width: 190,
                align: 'center'
              }
          );

      doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor(DARK)
          .text(
              entrevistador,
              55,
              firmaY + 28,
              {
                width: 190,
                align: 'center'
              }
          );

      doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(GRAY)
          .text(
              nombre,
              350,
              firmaY + 28,
              {
                width: 190,
                align: 'center'
              }
          );
// ==============================
// ELIMINAR PÃGINAS VACÃAS
// ==============================

      const range = doc.bufferedPageRange();

      for (let i = range.count - 1; i >= 0; i--) {
        const page = doc._pageBuffer[i];

        if (!page || !page.content || page.content.length === 0) {
          doc._pageBuffer.splice(i, 1);
        }
      }
      // ==============================
      // PIE DE PÃGINA
      // ==============================

      drawFooter();

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}

function makeSimplePdf(title, rows, subtitle) {

  const ops = [];

  ops.push(
      'BT',
      '/F2 18 Tf',
      '50 790 Td',
      `(${pdfEscape(title).slice(0, 90)}) Tj`,
      'ET'
  );

  ops.push(
      'BT',
      '/F1 9 Tf',
      '50 772 Td',
      `(${pdfEscape(generado)}) Tj`,
      'ET'
  );

  ops.push(
      'q 0.6 0.6 0.6 RG 1 w 50 762 m 562 762 l S Q'
  );

  ops.push(
      'BT',
      '/F1 10.5 Tf',
      '50 742 Td'
  );

  bodyLines.forEach((line, i) => {
    ops.push(
        `(${pdfEscape(line).slice(0, 118)}) Tj`
    );

    if (i < bodyLines.length - 1) {
      ops.push('0 -16 Td');
    }
  });

  ops.push('ET');

  ops.push(
      'q 0.6 0.6 0.6 RG 1 w 50 55 m 562 55 l S Q'
  );

  ops.push(
      'BT',
      '/F1 8 Tf',
      '50 42 Td',
      '(SIDOVI \\267 Sistema Integral de Documentacion y Vinculacion \\267 Colviseg Ltda.) Tj',
      'ET'
  );

  const content = ops.join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',

    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',

    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',

    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,

    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',

    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((obj, i) => {
    offsets[i + 1] = Buffer.byteLength(pdf);

    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xref = Buffer.byteLength(pdf);

  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';

  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xref}\n`;
  pdf += '%%EOF';

  return Buffer.from(pdf);
}

// ============================================================
// REPORTES
// ============================================================

// ============================================================
// REPORTE 1
// HISTORIAL COMPLETO DE UN ASPIRANTE
// ============================================================

app.get(
    '/api/reportes/historial/:idAspirante',
    requireRoles('RRHH', 'Gerente'),
    async (req, res) => {

      try {

        const idAspirante = Number(req.params.idAspirante);

        if (!idAspirante) {
          return res.status(400).json({
            error: 'El aspirante es obligatorio.'
          });
        }

        // --------------------------------------------------------
        // Datos generales del aspirante
        // --------------------------------------------------------

        const aspiranteResult = await db.query(`
        SELECT
          a.id_aspirante,
          a.tipo_documento,
          a.numero_documento,
          a.nombre_completo,
          a.correo,
          a.telefono,
          a.direccion,
          a.sexo,
          a.fecha_registro
        FROM aspirante a
        WHERE a.id_aspirante = $1
      `, [idAspirante]);

        if (!aspiranteResult.rowCount) {
          return res.status(404).json({
            error: 'Aspirante no encontrado.'
          });
        }

        // --------------------------------------------------------
        // Todas las postulaciones del aspirante
        // --------------------------------------------------------

        const postulacionesResult = await db.query(`
        SELECT
          p.id_postulacion,
          p.fecha_postulacion,
          p.estado,
          p.resultado,
          p.motivo_rechazo,
          p.fecha_rechazo,
          p.fecha_contratacion,

          p.experiencia,
          p.descripcion,

          p.fecha_firma_programada,
          p.hora_firma,
          p.lugar_firma,
          p.direccion_firma,
          p.observaciones_firma,

          v.id_vacante,
          v.nombre_cargo,
          v.titulo,
          v.descripcion AS descripcion_vacante,
          v.requisitos,

          s.id_sede,
          s.nombre_sede

        FROM postulacion p

        JOIN vacante v
          ON v.id_vacante = p.id_vacante

        LEFT JOIN sede s
          ON s.id_sede = v.id_sede

        WHERE p.id_aspirante = $1

        ORDER BY
          p.fecha_postulacion ASC,
          p.id_postulacion ASC
      `, [idAspirante]);

        if (!postulacionesResult.rowCount) {
          return res.status(404).json({
            error: 'Aspirante sin historial de postulaciones.'
          });
        }

        const postulaciones = [];

        // --------------------------------------------------------
        // Construir historial detallado
        // --------------------------------------------------------

        for (const p of postulacionesResult.rows) {

          // ---------------------------------------------
          // Historial de cambios de estado
          // ---------------------------------------------

          const procesoResult = await db.query(`
          SELECT
            h.id_historial,
            h.estado_anterior,
            h.estado_nuevo,
            h.detalle,
            h.creado_en,
            u.nombre_completo AS usuario
          FROM historial_proceso h
          LEFT JOIN usuario u
            ON u.id_usuario = h.usuario_id
          WHERE h.id_postulacion = $1
          ORDER BY h.creado_en ASC
        `, [p.id_postulacion]);

          // ---------------------------------------------
          // Documentos de la hoja de vida
          // ---------------------------------------------

          const documentosResult = await db.query(`
          SELECT
            d.id_documento,
            d.nombre_documento,
            d.tipo_documento,
            d.estado,
            d.observacion,
            d.fecha_subida,
            d.fecha_revision
          FROM documento d
          WHERE d.id_aspirante = $1
          ORDER BY d.fecha_subida ASC
        `, [idAspirante]);

          // ---------------------------------------------
          // Reporte / concepto de RRHH
          // ---------------------------------------------

          const rrhhResult = await db.query(`
          SELECT
            r.id_reporte_rrhh,
            r.concepto,
            r.fortalezas,
            r.aspectos_considerar,
            r.recomendacion,
            r.creado_en,
            r.actualizado_en,
            u.nombre_completo AS nombre_rrhh
          FROM reporte_rrhh r
          LEFT JOIN recursos_humanos rh
            ON rh.id_rrhh = r.id_rrhh
          LEFT JOIN usuario u
            ON u.id_usuario = rh.id_rrhh
          WHERE r.id_postulacion = $1
          ORDER BY r.id_reporte_rrhh DESC
          LIMIT 1
        `, [p.id_postulacion]);

          // ---------------------------------------------
          // Entrevista
          // ---------------------------------------------

          const entrevistaResult = await db.query(`
          SELECT
            e.id_entrevista,
            e.fecha_entrevista,
            e.modalidad,
            e.estado,
            e.observacion,
            u.nombre_completo AS entrevistador,

            ev.id_evaluacion,
            ev.preguntas,
            ev.calificacion,
            ev.comentarios

          FROM entrevista e

          LEFT JOIN usuario u
            ON u.id_usuario = e.id_gerente

          LEFT JOIN evaluacion ev
            ON ev.id_entrevista = e.id_entrevista

          WHERE e.id_postulacion = $1

          ORDER BY
            e.id_entrevista DESC,
            ev.id_evaluacion DESC

          LIMIT 1
        `, [p.id_postulacion]);

          // ---------------------------------------------
          // Exámenes médicos
          // ---------------------------------------------

          const examenResult = await db.query(`
          SELECT
            ex.id_examen,
            ex.tipos,
            ex.fecha,
            ex.hora,
            ex.lugar,
            ex.direccion,
            ex.observaciones,
            ex.estado,
            ex.documentos_resultado,
            ex.fecha_recepcion,
            ex.observaciones_rrhh,
            ex.resultado,
            ex.motivo_rechazo,
            ex.fecha_verificacion,
            u.nombre_completo AS verificado_por_nombre

          FROM examen_programado ex

          LEFT JOIN usuario u
            ON u.id_usuario = ex.verificado_por

          WHERE ex.id_postulacion = $1

          ORDER BY ex.id_examen DESC

          LIMIT 1
        `, [p.id_postulacion]);

          // ---------------------------------------------
          // Contrato
          // ---------------------------------------------

          const contratoResult = await db.query(`
          SELECT *
          FROM contrato
          WHERE id_postulacion = $1
          ORDER BY id_contrato DESC
          LIMIT 1
        `, [p.id_postulacion]);

          // ---------------------------------------------
          // Determinar etapa del rechazo
          // ---------------------------------------------

          let etapaRechazo = null;
          let motivoRechazo = p.motivo_rechazo || null;

          const rrhh = rrhhResult.rows[0] || null;
          const entrevista = entrevistaResult.rows[0] || null;
          const examen = examenResult.rows[0] || null;

          // Concepto de RRHH
          if (
              p.estado === 'RECHAZADO' &&
              rrhh &&
              (
                  String(rrhh.concepto || '').toLowerCase().includes('rechaz') ||
                  String(rrhh.recomendacion || '').toLowerCase().includes('rechaz')
              )
          ) {
            etapaRechazo = 'Verificación de hoja de vida';

            if (!motivoRechazo) {
              motivoRechazo =
                  rrhh.concepto ||
                  rrhh.recomendacion ||
                  null;
            }
          }

          // Entrevista
          if (
              p.estado === 'RECHAZADO' &&
              entrevista
          ) {

            let comentariosEntrevista = {};

            try {
              comentariosEntrevista =
                  JSON.parse(entrevista.comentarios || '{}');
            } catch {
              comentariosEntrevista = {};
            }

            if (
                String(comentariosEntrevista.resultado || '').toUpperCase() === 'RECHAZADO'
            ) {

              etapaRechazo = 'Entrevista';

              if (!motivoRechazo) {
                motivoRechazo =
                    comentariosEntrevista.motivoRechazo ||
                    comentariosEntrevista.observaciones ||
                    entrevista.observacion ||
                    null;
              }
            }
          }

          // Exámenes
          if (
              p.estado === 'RECHAZADO' &&
              examen &&
              String(examen.resultado || '').toUpperCase() === 'RECHAZADO'
          ) {

            etapaRechazo = 'Exámenes médicos';

            if (!motivoRechazo) {
              motivoRechazo =
                  examen.motivo_rechazo ||
                  examen.observaciones_rrhh ||
                  null;
            }
          }

          // Si sabemos que fue rechazado pero no encontramos una
          // etapa específica, usamos la última transición registrada.
          if (
              p.estado === 'RECHAZADO' &&
              !etapaRechazo &&
              procesoResult.rows.length
          ) {

            const rechazo =
                [...procesoResult.rows]
                    .reverse()
                    .find(
                        h =>
                            String(h.estado_nuevo || '').toUpperCase() === 'RECHAZADO'
                    );

            if (rechazo) {
              etapaRechazo = 'Proceso de selección';

              if (!motivoRechazo) {
                motivoRechazo = rechazo.detalle || null;
              }
            }
          }

          // ---------------------------------------------
          // Parsear evaluación de entrevista
          // ---------------------------------------------

          let evaluacionEntrevista = null;

          if (entrevista) {

            let comentarios = {};

            try {
              comentarios =
                  JSON.parse(entrevista.comentarios || '{}');
            } catch {
              comentarios = {};
            }

            evaluacionEntrevista = {
              resultado: comentarios.resultado || null,
              motivoRechazo: comentarios.motivoRechazo || null,
              observaciones: comentarios.observaciones || '',
              fortalezas: comentarios.fortalezas || '',
              aspectosMejora: comentarios.aspectosMejora || '',
              recomendacion: comentarios.recomendacion || '',
              criterios: Array.isArray(comentarios.criterios)
                  ? comentarios.criterios
                  : [],
              preguntas: Array.isArray(comentarios.preguntas)
                  ? comentarios.preguntas
                  : []
            };
          }

          postulaciones.push({
            ...p,

            etapa_rechazo: etapaRechazo,
            motivo_rechazo_completo: motivoRechazo,

            historial_proceso: procesoResult.rows,

            documentos: documentosResult.rows,

            reporte_rrhh: rrhh,

            entrevista: entrevista
                ? {
                  ...entrevista,
                  evaluacion: evaluacionEntrevista
                }
                : null,

            examen: examen || null,

            contrato: contratoResult.rows[0] || null
          });
        }

        // --------------------------------------------------------
        // Resumen general del aspirante
        // --------------------------------------------------------

        const total = postulaciones.length;

        const rechazadas =
            postulaciones.filter(
                p => String(p.estado).toUpperCase() === 'RECHAZADO'
            ).length;

        const aprobadas =
            postulaciones.filter(
                p =>
                    ['APROBADO', 'CONTRATADO', 'PENDIENTE_CONTRATO', 'FIRMA_CONTRATO_AGENDADA']
                        .includes(String(p.estado).toUpperCase())
            ).length;

        const primeraPostulacion =
            postulaciones[0]?.fecha_postulacion || null;

        const ultimaPostulacion =
            postulaciones[postulaciones.length - 1]?.fecha_postulacion || null;

        res.json({

          aspirante: aspiranteResult.rows[0],

          resumen: {
            total_postulaciones: total,
            rechazadas,
            aprobadas,
            primera_postulacion: primeraPostulacion,
            ultima_postulacion: ultimaPostulacion
          },

          historial: postulaciones
        });

      } catch (error) {

        console.error(
            'Error generando historial detallado:',
            error
        );

        errorResponse(
            res,
            error,
            'No fue posible consultar el historial completo del aspirante.'
        );
      }
    }
);


// ============================================================
// REPORTE 2
// ESTADÍSTICAS DEL PROCESO
// ============================================================

app.get(
    '/api/reportes/detallado',
    requireRoles('RRHH', 'Gerente'),
    async (req, res) => {

      try {

        const desde = req.query.desde || null;
        const hasta = req.query.hasta || null;

        const values = [];
        const conditions = [];

        if (desde) {
          values.push(desde);
          conditions.push(`p.fecha_postulacion >= $${values.length}`);
        }

        if (hasta) {
          values.push(hasta);
          conditions.push(`p.fecha_postulacion <= $${values.length}`);
        }

        const where =
            conditions.length
                ? `WHERE ${conditions.join(' AND ')}`
                : '';

        // --------------------------------------------------------
        // Resumen
        // --------------------------------------------------------

        const resumenResult = await db.query(`
        SELECT
          COUNT(*)::int AS total,

          COUNT(*) FILTER (
            WHERE p.estado NOT IN ('RECHAZADO', 'CONTRATADO')
          )::int AS en_proceso,

          COUNT(*) FILTER (
            WHERE p.estado = 'RECHAZADO'
          )::int AS rechazados,

          COUNT(*) FILTER (
            WHERE p.estado = 'CONTRATADO'
          )::int AS contratados,

          COUNT(*) FILTER (
            WHERE UPPER(TRIM(COALESCE(a.sexo, ''))) IN
              ('M', 'MASCULINO', 'HOMBRE')
          )::int AS hombres,

          COUNT(*) FILTER (
            WHERE UPPER(TRIM(COALESCE(a.sexo, ''))) IN
              ('F', 'FEMENINO', 'MUJER')
          )::int AS mujeres

        FROM postulacion p

        JOIN aspirante a
          ON a.id_aspirante = p.id_aspirante

        ${where}
      `, values);

        // --------------------------------------------------------
        // Postulaciones por mes
        // --------------------------------------------------------

        const mensualResult = await db.query(`
        SELECT
          TO_CHAR(
            DATE_TRUNC('month', p.fecha_postulacion),
            'YYYY-MM'
          ) AS periodo,

          COUNT(*)::int AS cantidad

        FROM postulacion p

        ${where}

        GROUP BY DATE_TRUNC(
          'month',
          p.fecha_postulacion
        )

        ORDER BY DATE_TRUNC(
          'month',
          p.fecha_postulacion
        ) DESC
      `, values);

        // --------------------------------------------------------
        // Postulaciones por semana
        // --------------------------------------------------------

        const semanalResult = await db.query(`
        SELECT
          TO_CHAR(
            DATE_TRUNC('week', p.fecha_postulacion),
            'YYYY-MM-DD'
          ) AS semana_inicio,

          TO_CHAR(
            DATE_TRUNC('week', p.fecha_postulacion) + INTERVAL '6 days',
            'YYYY-MM-DD'
          ) AS semana_fin,

          COUNT(*)::int AS cantidad

        FROM postulacion p

        ${where}

        GROUP BY DATE_TRUNC(
          'week',
          p.fecha_postulacion
        )

        ORDER BY DATE_TRUNC(
          'week',
          p.fecha_postulacion
        ) DESC
      `, values);

        // --------------------------------------------------------
        // Hombres y mujeres
        // --------------------------------------------------------

        const generoResult = await db.query(`
        SELECT
          CASE
            WHEN UPPER(TRIM(COALESCE(a.sexo, ''))) IN
              ('M', 'MASCULINO', 'HOMBRE')
              THEN 'Hombres'

            WHEN UPPER(TRIM(COALESCE(a.sexo, ''))) IN
              ('F', 'FEMENINO', 'MUJER')
              THEN 'Mujeres'

            ELSE 'No especificado'
          END AS sexo,

          COUNT(*)::int AS cantidad

        FROM postulacion p

        JOIN aspirante a
          ON a.id_aspirante = p.id_aspirante

        ${where}

        GROUP BY 1

        ORDER BY cantidad DESC
      `, values);

        // --------------------------------------------------------
        // Por sede
        // --------------------------------------------------------

        const sedeResult = await db.query(`
        SELECT
          COALESCE(
            s.nombre_sede,
            'Sin sede'
          ) AS sede,

          COUNT(*)::int AS cantidad

        FROM postulacion p

        JOIN vacante v
          ON v.id_vacante = p.id_vacante

        LEFT JOIN sede s
          ON s.id_sede = v.id_sede

        ${where}

        GROUP BY
          COALESCE(s.nombre_sede, 'Sin sede')

        ORDER BY cantidad DESC
      `, values);

        // --------------------------------------------------------
        // Por cargo
        // --------------------------------------------------------

        const cargoResult = await db.query(`
        SELECT
          COALESCE(
            v.nombre_cargo,
            'Sin cargo'
          ) AS cargo,

          COUNT(*)::int AS cantidad

        FROM postulacion p

        JOIN vacante v
          ON v.id_vacante = p.id_vacante

        ${where}

        GROUP BY v.nombre_cargo

        ORDER BY cantidad DESC
      `, values);

        // --------------------------------------------------------
        // Estado
        // --------------------------------------------------------

        const estadoResult = await db.query(`
        SELECT
          p.estado,
          COUNT(*)::int AS cantidad

        FROM postulacion p

        ${where}

        GROUP BY p.estado

        ORDER BY cantidad DESC
      `, values);

        // --------------------------------------------------------
        // Sede + género
        // --------------------------------------------------------

        const sedeGeneroResult = await db.query(`
        SELECT
          COALESCE(
            s.nombre_sede,
            'Sin sede'
          ) AS sede,

          COUNT(*) FILTER (
            WHERE UPPER(TRIM(COALESCE(a.sexo, ''))) IN
              ('M', 'MASCULINO', 'HOMBRE')
          )::int AS hombres,

          COUNT(*) FILTER (
            WHERE UPPER(TRIM(COALESCE(a.sexo, ''))) IN
              ('F', 'FEMENINO', 'MUJER')
          )::int AS mujeres,

          COUNT(*)::int AS total

        FROM postulacion p

        JOIN aspirante a
          ON a.id_aspirante = p.id_aspirante

        JOIN vacante v
          ON v.id_vacante = p.id_vacante

        LEFT JOIN sede s
          ON s.id_sede = v.id_sede

        ${where}

        GROUP BY
          COALESCE(s.nombre_sede, 'Sin sede')

        ORDER BY total DESC
      `, values);

        // --------------------------------------------------------
        // Historial de postulaciones
        // --------------------------------------------------------

        const historialResult = await db.query(`
        SELECT
          p.id_postulacion,
          p.fecha_postulacion,

          a.id_aspirante,
          a.nombre_completo,
          a.tipo_documento,
          a.numero_documento,
          a.sexo,

          v.nombre_cargo AS cargo,

          COALESCE(
            s.nombre_sede,
            'Sin sede'
          ) AS sede,

          p.estado

        FROM postulacion p

        JOIN aspirante a
          ON a.id_aspirante = p.id_aspirante

        JOIN vacante v
          ON v.id_vacante = p.id_vacante

        LEFT JOIN sede s
          ON s.id_sede = v.id_sede

        ${where}

        ORDER BY
          p.fecha_postulacion DESC,
          p.id_postulacion DESC
      `, values);

        res.json({

          filtros: {
            desde,
            hasta
          },

          resumen: resumenResult.rows[0] || {
            total: 0,
            en_proceso: 0,
            rechazados: 0,
            contratados: 0,
            hombres: 0,
            mujeres: 0
          },

          mensual: mensualResult.rows,

          semanal: semanalResult.rows,

          genero: generoResult.rows,

          porSede: sedeResult.rows,

          porCargo: cargoResult.rows,

          estados: estadoResult.rows,

          sedeGenero: sedeGeneroResult.rows,

          historial: historialResult.rows

        });

      } catch (error) {

        console.error(
            'Error generando estadísticas detalladas:',
            error
        );

        errorResponse(
            res,
            error,
            'No fue posible generar las estadísticas detalladas.'
        );
      }
    }
);

app.get('/api/entrevistas/:id/pdf', requireRoles('Gerente'), async (req, res) => {
  try {
    const r = await db.query(`
      SELECT
        e.id_entrevista,
        e.fecha_entrevista,
        e.modalidad,
        e.estado,
        e.observacion,
        a.nombre_completo,
        a.numero_documento,
        a.correo,
        a.telefono,
        v.nombre_cargo AS cargo,
        u.nombre_completo AS entrevistador,
        ev.preguntas,
        ev.calificacion,
        ev.comentarios
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
    const lines = [
      `Candidato: ${row.nombre_completo} Â· Documento: ${row.numero_documento || 'No registrado'}`,
      `Cargo: ${row.cargo}`,
      `Fecha y hora: ${new Date(row.fecha_entrevista).toLocaleString('es-CO')} Â· Modalidad: ${row.modalidad}`,
      `Entrevistador: ${row.entrevistador || 'Gerencia'}`,
      `Resultado: ${comentarios.resultado || row.estado}`,
      `Observaciones: ${comentarios.observaciones || row.observacion || 'Sin observaciones'}`,
      `Fortalezas: ${comentarios.fortalezas || 'Sin registro'}`,
      `Aspectos por mejorar: ${comentarios.aspectosMejora || 'Sin registro'}`,
      `RecomendaciÃ³n: ${comentarios.recomendacion || 'Sin registro'}`,
      'Preguntas y respuestas:',
      ...preguntas.flatMap((p, index) => [`${index + 1}. ${p.categoria || 'Entrevista'} - ${p.pregunta}`, `Respuesta: ${p.respuesta || 'Sin respuesta'}`]),
      'Firma entrevistador: ____________________    Firma candidato: ____________________'
    ];
    const pdf = await makeInterviewPdf(
        row,
        preguntas,
        comentarios
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="sidovi-entrevista-${row.id_entrevista}.pdf"`);
    res.send(pdf);
  } catch (error) {
    errorResponse(res, error, 'No fue posible generar el PDF de entrevista.');
  }
});

app.post('/api/evaluaciones/detallada', requireRoles('Gerente'), async (req, res) => {
  const { idEntrevista, criterios = [], preguntas = [], observaciones = '', fortalezas = '', aspectosMejora = '', recomendacion = '', resultado = 'PENDIENTE', motivoRechazo = '' } = req.body;

  if (!idEntrevista) return res.status(400).json({ error: 'La entrevista es obligatoria.' });
  if (!['APROBADO','RECHAZADO','PENDIENTE'].includes(resultado)) return res.status(400).json({ error: 'Resultado de entrevista no vÃ¡lido.' });
  if (resultado === 'RECHAZADO' && !String(motivoRechazo).trim()) return res.status(400).json({ error: 'El motivo de rechazo es obligatorio.' });

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const score = criterios.reduce((a,c)=>a+Number(c.puntuacion||0),0)/(criterios.length||1);

    const payload = JSON.stringify({
      preguntas,
      criterios,
      observaciones,
      fortalezas,
      aspectosMejora,
      recomendacion,
      resultado,
      motivoRechazo
    });

    const ev = await client.query(
        'INSERT INTO evaluacion (preguntas,calificacion,comentarios,id_entrevista) VALUES ($1,$2,$3,$4) RETURNING *',
        [JSON.stringify(preguntas), Math.round(score), payload, idEntrevista]
    );

    const p = await client.query(
        'SELECT id_postulacion FROM entrevista WHERE id_entrevista=$1',
        [idEntrevista]
    );

    if (p.rowCount) {
      await logTransition(
          client,
          p.rows[0].id_postulacion,
          resultado === 'APROBADO'
              ? 'EXAMENES_PENDIENTES'
              : resultado === 'RECHAZADO'
                  ? 'RECHAZADO'
                  : 'ENTREVISTA_AGENDADA',
          motivoRechazo || recomendacion || observaciones,
          req.session.id_usuario
      );
    }

    await client.query(
        'UPDATE entrevista SET estado=$1, observacion=$2 WHERE id_entrevista=$3',
        ['REALIZADA', motivoRechazo || observaciones, idEntrevista]
    );

    await client.query('COMMIT');

    res.status(201).json(ev.rows[0]);

  } catch (error) {
    await client.query('ROLLBACK');
    errorResponse(res,error,'No fue posible guardar la evaluaciÃ³n detallada.');
  } finally {
    client.release();
  }
});

app.get('/api/examenes', requireRoles('RRHH', 'Gerente'), async (_req, res) => {
  try {
    const r = await db.query(`
      SELECT
        ex.*,
        p.id_aspirante,
        a.nombre_completo,
        a.correo,
        a.telefono,
        p.estado AS estado_postulacion,
        v.nombre_cargo AS cargo
      FROM examen_programado ex
      JOIN postulacion p
        ON p.id_postulacion = ex.id_postulacion
      JOIN aspirante a
        ON a.id_aspirante = p.id_aspirante
      JOIN vacante v
        ON v.id_vacante = p.id_vacante
      ORDER BY ex.fecha DESC, ex.hora DESC
    `);

    res.json(r.rows);

  } catch (error) {
    errorResponse(
        res,
        error,
        'No fue posible consultar exÃ¡menes.'
    );
  }
});

app.post('/api/examenes/:id/documentos', requireRoles('RRHH'), async (req, res) => {

  const {
    nombreDocumento,
    tipoDocumento = 'PDF',
    archivo,
    recibidoEn,
    observaciones = ''
  } = req.body;

  if (!nombreDocumento || !archivo) {
    return res.status(400).json({
      error: 'Nombre y archivo son obligatorios.'
    });
  }

  if (String(archivo).length > 8 * 1024 * 1024) {
    return res.status(413).json({
      error: 'El archivo supera 8 MB.'
    });
  }

  try {

    const examen = await db.query(
        `
            SELECT
                id_examen,
                id_postulacion,
                documentos_resultado
            FROM examen_programado
            WHERE id_examen = $1
            `,
        [req.params.id]
    );

    if (!examen.rowCount) {
      return res.status(404).json({
        error: 'Examen no encontrado.'
      });
    }

    const documento = {
      nombreDocumento,
      tipoDocumento,
      archivo,
      recibidoEn:
          recibidoEn ||
          new Date().toISOString().slice(0, 10),
      cargadoEn:
          new Date().toISOString()
    };

    const resultado = await db.query(
        `
            UPDATE examen_programado
            SET
                documentos_resultado =
                    COALESCE(documentos_resultado, '[]'::jsonb)
                    || $1::jsonb,

                fecha_recepcion =
                    COALESCE($2, CURRENT_DATE),

                observaciones_rrhh = $3,

                estado = 'EN_REVISION'

            WHERE id_examen = $4

            RETURNING
                id_examen,
                id_postulacion,
                documentos_resultado,
                fecha_recepcion,
                observaciones_rrhh,
                estado
            `,
        [
          JSON.stringify([documento]),
          recibidoEn || null,
          observaciones,
          req.params.id
        ]
    );

    await db.query(
        `
            UPDATE postulacion
            SET estado = 'EXAMENES_EN_REVISION'
            WHERE id_postulacion = $1
            `,
        [resultado.rows[0].id_postulacion]
    );

    res.status(201).json(resultado.rows[0]);

  } catch (error) {

    console.error(
        'Error cargando resultado del examen:',
        error
    );

    errorResponse(
        res,
        error,
        'No fue posible cargar el resultado.'
    );
  }

});

// ============================================================
// VERIFICAR RESULTADO DE EXÃMENES
// RRHH aprueba o rechaza los resultados.
// Si aprueba, la postulaciÃ³n pasa a PENDIENTE_CONTRATO
// y queda disponible para Gerencia.
// ============================================================

app.post('/api/examenes/:id/verificar', requireRoles('RRHH'), async (req, res) => {
  const { resultado, motivoRechazo = '', observaciones = '' } = req.body;

  if (!['APROBADO', 'RECHAZADO', 'PENDIENTE'].includes(resultado)) {
    return res.status(400).json({
      error: 'Resultado invÃ¡lido.'
    });
  }

  if (
      resultado === 'RECHAZADO' &&
      !String(motivoRechazo).trim()
  ) {
    return res.status(400).json({
      error: 'El motivo del rechazo es obligatorio.'
    });
  }

  try {
    // 1. Buscar el examen y su postulaciÃ³n
    const examenResult = await db.query(`
      SELECT
        ep.id_examen,
        ep.id_postulacion,
        ep.documentos_resultado
      FROM examen_programado ep
      WHERE ep.id_examen = $1
    `, [req.params.id]);

    if (examenResult.rowCount === 0) {
      return res.status(404).json({
        error: 'Examen no encontrado.'
      });
    }

    const examen = examenResult.rows[0];

    // 2. Verificar que existan resultados cargados
    const documentos = examen.documentos_resultado;

    if (
        !Array.isArray(documentos) ||
        documentos.length === 0
    ) {
      return res.status(400).json({
        error: 'No se puede verificar el examen porque todavÃ­a no se ha cargado el resultado.'
      });
    }

    // 3. Determinar estado del examen
    let estadoExamen;

    if (resultado === 'APROBADO') {
      estadoExamen = 'APROBADO';
    } else if (resultado === 'RECHAZADO') {
      estadoExamen = 'RECHAZADO';
    } else {
      estadoExamen = 'EN_REVISION';
    }

    // 4. Actualizar examen
    const examenActualizado = await db.query(`
      UPDATE examen_programado
      SET
        resultado = $1,
        motivo_rechazo = $2,
        observaciones_rrhh = $3,
        fecha_verificacion = CURRENT_TIMESTAMP,
        verificado_por = $4,
        estado = $5
      WHERE id_examen = $6
      RETURNING *
    `, [
      resultado,
      resultado === 'RECHAZADO'
          ? String(motivoRechazo).trim()
          : '',
      String(observaciones).trim(),
      req.session.id_usuario,
      estadoExamen,
      req.params.id
    ]);

    // 5. CAMBIAR ESTADO DE LA POSTULACIÃ“N
    let nuevoEstado;

    if (resultado === 'APROBADO') {
      nuevoEstado = 'PENDIENTE_CONTRATO';
    } else if (resultado === 'RECHAZADO') {
      nuevoEstado = 'RECHAZADO';
    } else {
      nuevoEstado = 'EXAMENES_EN_REVISION';
    }
    await db.query(`
  UPDATE postulacion
  SET
    estado = $1::text,
    motivo_rechazo = $2::text,
    fecha_rechazo = CASE
      WHEN $1::text = 'RECHAZADO'
      THEN CURRENT_DATE
      ELSE fecha_rechazo
    END
  WHERE id_postulacion = $3::integer
`, [
      String(nuevoEstado),
      resultado === 'RECHAZADO'
          ? String(motivoRechazo).trim()
          : '',
      Number(examen.id_postulacion)
    ]);
    const mensaje =
        resultado === 'APROBADO'
            ? 'El resultado de los exámenes fue aprobado. La postulación quedó pendiente para programar la firma del contrato.'
            : resultado === 'RECHAZADO'
                ? 'El resultado de los exámenes fue rechazado.'
                : 'El resultado de los exámenes quedó en revisión.';
    // 7. Respuesta
    res.json({
      ...examenActualizado.rows[0],
      estado_postulacion: nuevoEstado,
      mensaje
    });

  } catch (error) {
    console.error('Error verificando examen:', error);

    errorResponse(
        res,
        error,
        'No fue posible verificar el resultado del examen.'
    );
  }
});

// Consultar notificaciones (uso interno RRHH/Gerencia, filtrable por usuario o postulaciÃ³n).
app.get('/api/notificaciones', requireRoles('RRHH','Gerente'), async (req,res)=>{
  try{
    const values=[]; const where=[];
    if(req.query.idUsuario){values.push(req.query.idUsuario);where.push(`n.id_usuario=$${values.length}`);}
    if(req.query.idPostulacion){values.push(req.query.idPostulacion);where.push(`n.id_postulacion=$${values.length}`);}
    const r=await db.query(`SELECT n.* FROM notificacion n ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY n.creado_en DESC LIMIT 200`,values);
    res.json(r.rows);
  }catch(error){errorResponse(res,error,'No fue posible consultar notificaciones.');}
});

// Consulta pÃºblica: el candidato usa su nÃºmero de postulaciÃ³n (radicado) para ver
// el estado de su proceso y las notificaciones registradas, sin necesidad de cuenta.
app.get('/api/postulaciones/:id/notificaciones', async (req,res)=>{
  try{
    const r=await db.query('SELECT id_notificacion,mensaje,creado_en FROM notificacion WHERE id_postulacion=$1 ORDER BY creado_en DESC',[req.params.id]);
    res.json(r.rows);
  }catch(error){errorResponse(res,error,'No fue posible consultar las notificaciones de la postulaciÃ³n.');}
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
    if (!['RRHH', 'Gerente'].includes(rolNormalizado)) return res.status(403).json({ error: 'Este usuario no tiene acceso al Ã¡rea interna.' });
    if (rolSolicitado && String(rolSolicitado).toLowerCase() !== String(rolNormalizado).toLowerCase()) return res.status(403).json({ error: 'El usuario no pertenece al rol seleccionado.' });
    usuario.rol = rolNormalizado;
    delete usuario.contrasena_hash;
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { id_usuario: usuario.id_usuario, rol: rolNormalizado, usuario, creado: Date.now() });
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `sid=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/${secure}`);
    res.json({ token, usuario });
  } catch (error) { errorResponse(res, error, 'No fue posible iniciar sesiÃ³n.'); }
});

app.get('/api/auth/me', requireRoles('RRHH', 'Gerente'), (req, res) => res.json({ usuario: req.session.usuario, rol: req.session.rol }));

app.patch('/api/auth/perfil', requireRoles('RRHH', 'Gerente'), async (req, res) => {
  const { nombreCompleto, tipoDocumento, numeroDocumento, telefono, direccion, cargo, fotoPerfil } = req.body;
  if (fotoPerfil && String(fotoPerfil).length > 8 * 1024 * 1024) return res.status(413).json({ error: 'La foto supera el lÃ­mite de 8 MB.' });
  try {
    const result = await db.query(`UPDATE usuario SET nombre_completo=COALESCE($1,nombre_completo), tipo_documento=COALESCE($2,tipo_documento), numero_documento=COALESCE($3,numero_documento), telefono=COALESCE($4,telefono), direccion=COALESCE($5,direccion), cargo=COALESCE($6,cargo), foto_perfil=COALESCE($7,foto_perfil) WHERE id_usuario=$8 RETURNING id_usuario,nombre_completo,correo,rol,tipo_documento,numero_documento,telefono,direccion,cargo,foto_perfil`, [nombreCompleto, tipoDocumento, numeroDocumento, telefono, direccion, cargo, fotoPerfil, req.session.id_usuario]);
    if (!result.rowCount) return res.status(404).json({ error: 'Usuario no encontrado.' });
    req.session.usuario = result.rows[0];
    res.json({ usuario: result.rows[0] });
  } catch (error) { errorResponse(res, error, 'No fue posible actualizar el perfil. Ejecuta primero la migraciÃ³n 005.'); }
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


