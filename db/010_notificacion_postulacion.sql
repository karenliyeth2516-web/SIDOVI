BEGIN;

-- Permite asociar cada notificación a la postulación
-- del candidato para poder consultarla desde el
-- flujo público de seguimiento.

ALTER TABLE notificacion
    ADD COLUMN IF NOT EXISTS id_postulacion integer
    REFERENCES postulacion(id_postulacion)
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notificacion_postulacion
    ON notificacion(id_postulacion);

COMMIT;
