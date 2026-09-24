-- Datos de perfil del personal interno.
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS tipo_documento varchar(20) NOT NULL DEFAULT 'CC';
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS numero_documento varchar(30) NOT NULL DEFAULT '';
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS telefono varchar(30) NOT NULL DEFAULT '';
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS direccion varchar(160) NOT NULL DEFAULT '';
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS cargo varchar(120) NOT NULL DEFAULT '';
-- foto_perfil fue creada por 004_perfiles_y_fotos.sql.
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS foto_perfil text;
