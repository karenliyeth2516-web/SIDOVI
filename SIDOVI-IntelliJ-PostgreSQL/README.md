# SIDOVI CRUD — PostgreSQL + Node.js

SIDOVI conserva sus páginas HTML, estilos, imágenes, scripts del navegador, botones y rutas visibles. La actualización se limita al backend, las consultas SQL, las claves foráneas, las vistas y la conexión con PostgreSQL.

## Modelo relacional revisado

La tabla `cargo` contiene `id_rrhh`, que referencia `recursos_humanos(id_rrhh)`. Así, un área de Recursos Humanos puede gestionar muchos cargos. Las demás tablas y relaciones del proyecto se conservan. Las vistas `vista_historial_aspirante` y `vista_estadistica_postulaciones` siguen disponibles para las consultas y reportes de Recursos Humanos.

El script completo está en `db/Postgres.sql`. Incluye las tablas `empresa`, `cargo`, `usuario`, `aspirante`, `recursos_humanos`, `gerente`, `vacante`, `requisitodocumento`, `postulacion`, `documento`, `entrevista` y `notificacion`, además de sus restricciones, índices, vistas y datos iniciales.

## Configuración PostgreSQL local

El script reinicia la base `sidovi_colviseg`; no lo ejecutes sobre información que quieras conservar. Desde una terminal con PostgreSQL instalado, ejecuta:

```bash
psql -U postgres -f db/Postgres.sql
```

La aplicación puede conectarse mediante estas variables. Crea el archivo `.env` localmente o configúralas en IntelliJ IDEA; no guardes la contraseña en Git. En la validación final del sandbox, `PGSSL=false` fue respetado y el error observado fue exclusivamente `ECONNREFUSED ::1:5432` y `ECONNREFUSED 127.0.0.1:5432`, lo que confirma que allí no existe una instancia PostgreSQL escuchando en el puerto local:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sidovi_colviseg
DB_USER=postgres
DB_PASSWORD=<tu_clave_de_postgres>
PGSSL=false
```

`PGSSL=false` es el valor recomendado para una instalación PostgreSQL local. Usa `PGSSL=true` solo si un proveedor remoto exige SSL. El servidor prioriza las variables `DB_*` explícitas sobre cualquier `DATABASE_URL` reservado por otro entorno.

## Configuración desde IntelliJ IDEA

Abre la raíz del proyecto en IntelliJ IDEA. En **View > Tool Windows > Database**, crea una fuente **PostgreSQL** con host `localhost`, puerto `5432`, usuario `postgres` y la clave de tu instalación. Ejecuta `db/Postgres.sql` mediante **Run SQL Script**, refresca la conexión y confirma que existan `cargo`, `recursos_humanos`, `vista_historial_aspirante` y `vista_estadistica_postulaciones`.

Luego ve a **Run > Edit Configurations**, crea una configuración **npm**, selecciona el `package.json` de la raíz, usa el script `start` y agrega las variables `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` y `PGSSL=false` en **Environment variables**. También puedes ejecutar desde la terminal integrada:

```bash
npm install
npm start
```

La aplicación queda disponible en `http://localhost:3000`.

## Validación en el sandbox

El sandbox no contiene un proceso PostgreSQL local, por lo que no puede confirmar una conexión real a `localhost:5432` del computador del usuario. Sí se validó el arranque de `npm start`, la entrega de `index.html` con HTTP 200, la sintaxis de `server.js`, la conservación byte a byte de los archivos HTML/CSS/JS/IMG frente al ZIP original y las rutas REST mediante mocks controlados.

Las pruebas disponibles se ejecutan con:

```bash
./node_modules/.bin/vitest run server/postgres-schema.test.ts server/postgres-schema-fixture.test.ts server/api-endpoints.test.ts server/postgres-connection.test.ts --pool=threads
```

La suite verifica ocho pruebas y deja las tres pruebas de conexión omitidas si no se activa la validación real. En la ejecución explícita con la configuración definitiva `SIDOVI_RUN_DB_TEST=true PGSSL=false`, el sandbox respondió `ECONNREFUSED` en `::1:5432` y `127.0.0.1:5432`; no fue un fallo de SSL. La prueba real de PostgreSQL, que confirma un join válido y el rechazo de un `cargo.id_rrhh` inexistente con error `23503`, se activa desde un entorno que tenga PostgreSQL accesible:

```bash
SIDOVI_RUN_DB_TEST=true ./node_modules/.bin/vitest run server/postgres-connection.test.ts --pool=threads
```

## Validación real en IntelliJ IDEA

Después de crear la base, configurar las variables y arrancar el servidor desde IntelliJ, abre `http://localhost:3000/api/health`. Una respuesta con `ok: true` confirma que Express alcanzó PostgreSQL. Después prueba las pantallas existentes: `ofertas.html`, `postulacion.html`, `postulantes.html`, `agenda.html` y `reporte.html`. La ruta `/api/reportes` consulta las dos vistas del diagrama.

Para ejecutar la validación real de la FK desde IntelliJ, agrega `SIDOVI_RUN_DB_TEST=true` a las variables de la configuración de pruebas y ejecuta:

```bash
npm test -- server/postgres-connection.test.ts
```

La prueba usa una transacción y hace rollback; no deja registros de prueba permanentes.

## Sedes, cargos y filtros

La ampliación se encuentra en `db/001_sedes_cargos.sql`. Es una migración no destructiva: crea `sede` y `cargo`, agrega `id_sede` e `id_cargo` a `vacante`, relaciona las vacantes existentes y carga las sedes iniciales Tunja, Duitama, Sogamoso, Chiquinquirá y Bogotá. Ejecuta este archivo una sola vez conectado a la base configurada en `.env`; no ejecutes nuevamente el script completo `db/Postgres.sql` si ya tienes datos que deseas conservar.

El panel de Recursos Humanos incluye ahora `cargos.html`, donde se pueden crear, editar y desactivar cargos asociados a una sede. La página `ofertas.html` muestra las vacantes activas y permite filtrarlas por sede. El dashboard de Recursos Humanos también permite filtrar estadísticas y postulaciones por sede. Los nuevos cargos aparecen automáticamente en el formulario público de postulación cuando tienen una vacante activa.

## Rutas REST conservadas

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/api/health` | Comprobar PostgreSQL y hora del servidor |
| `GET` | `/api/sedes` | Cargar sedes activas |
| `GET` | `/api/cargos` | Consultar cargos activos por sede |
| `POST` | `/api/cargos` | Crear un cargo asociado a una sede |
| `PATCH` | `/api/cargos/:id` | Editar un cargo |
| `DELETE` | `/api/cargos/:id` | Desactivar un cargo sin romper vacantes históricas |
| `GET` | `/api/vacantes` | Cargar vacantes, cargos y sedes |
| `GET` | `/api/postulaciones` | Consultar postulaciones; admite `?idSede=` |

| `POST` | `/api/postulaciones` | Registrar una postulación |
| `PATCH` | `/api/postulaciones/:id` | Cambiar estado |
| `PATCH` | `/api/postulaciones/:id/datos` | Actualizar datos del candidato |
| `DELETE` | `/api/postulaciones/:id` | Eliminar una postulación |
| `GET` | `/api/entrevistas` | Consultar entrevistas |
| `POST` | `/api/entrevistas` | Programar una entrevista |
| `GET` | `/api/dashboard` | Consultar indicadores |
| `GET` | `/api/reportes` | Consultar historial y estadísticas |

> La interfaz y los botones originales no fueron rediseñados ni reemplazados. Los cambios están limitados a la integración de datos y PostgreSQL.

## Puesta en marcha corregida

Ejecuta `npm ci` y luego `npm start` desde la raíz. En la base de datos ejecuta `db/Postgres.sql`, después `db/001_sedes_cargos.sql` y, si utilizarás contratos, `db/002_contratos.sql`. Para activar el flujo ampliado de selección ejecuta después `db/007_flujo_examenes_reportes.sql`; esta migración es no destructiva y agrega evaluación por criterios, exámenes, documentos de resultados, verificaciones, trazabilidad y agenda de firma. La versión consolidada crea únicamente las tablas `examen_programado` e `historial_proceso`; la información de documentos se guarda como JSON dentro de `examen_programado` y la agenda de firma reutiliza `contrato`. Comprueba `http://localhost:3000/api/health` y confirma `ok: true` antes de presentar.

La migración carga las sedes **Tunja, Duitama, Sogamoso, Chiquinquirá y Bogotá**. Las credenciales demo del SQL usan contraseña `123`; por ejemplo, `juan2@gmail.com` con rol `RRHH` o `carlos3@gmail.com` con rol `Gerente`. El acceso también acepta nombre o nombre completo.

El dashboard de Recursos Humanos filtra por sede usando la vacante relacionada. El dashboard de Gerencia carga estadísticas, postulaciones y contratos desde PostgreSQL; ya no depende de cifras ni tarjetas estáticas.


## Módulos ampliados de selección

La versión incluye el traslado de **Mi perfil** al menú lateral de RRHH y Gerencia, reportes detallados con filtros por fecha y generación de PDF, historial completo por aspirante, evaluación de entrevistas con criterios de 1 a 5, y el flujo controlado **Entrevista aprobada → Exámenes programados → Documentos cargados → Verificación → Firma de contrato**. Para mantener un diagrama compacto, la migración 007 crea solo dos tablas nuevas: `examen_programado` e `historial_proceso`; además agrega campos de firma a `contrato` y campos de rechazo a `postulacion`. Las rutas nuevas respetan los roles existentes: Gerencia agenda y evalúa; RRHH carga y verifica resultados. Los botones y transiciones deben validarse contra PostgreSQL después de aplicar la migración 007.
