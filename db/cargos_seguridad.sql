-- Ajuste de datos demo: dejar únicamente cargos de seguridad publicados.
-- Ejecutar conectado a la base SIDOVI.

UPDATE vacante
SET titulo = 'Guarda de Seguridad',
    descripcion = 'Vigilancia y control de acceso en instalaciones de clientes.',
    requisitos = 'Curso de vigilancia vigente',
    estado = 'Activa'
WHERE id_vacante = 1;

UPDATE vacante
SET titulo = 'Supervisor de Seguridad',
    descripcion = 'Coordinación de turnos y supervisión del personal operativo.',
    requisitos = 'Experiencia en supervisión de seguridad',
    estado = 'Activa'
WHERE id_vacante = 2;

UPDATE vacante
SET titulo = 'Auxiliar de RRHH',
    descripcion = 'Apoyo administrativo en selección, archivo y contratación.',
    requisitos = 'Técnico o tecnólogo en gestión humana',
    estado = 'Activa'
WHERE id_vacante = 3;

UPDATE vacante
SET titulo = 'Técnico CCTV',
    descripcion = 'Instalación, monitoreo y soporte de cámaras y redes IP.',
    requisitos = 'Certificación técnica CCTV',
    estado = 'Activa'
WHERE id_vacante = 4;

UPDATE vacante
SET estado = 'Cerrada'
WHERE id_vacante > 4;

SELECT id_vacante, titulo, estado
FROM vacante
ORDER BY id_vacante;
