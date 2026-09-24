-- Datos opcionales para personalizar el acceso y los paneles internos.
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS foto_perfil text;
COMMENT ON COLUMN usuario.foto_perfil IS 'Foto del gerente o usuario interno, como data URL/URL.';
