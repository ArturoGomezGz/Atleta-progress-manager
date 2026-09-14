-- ═══════════════════════════════════════════════════════════════════════════
-- 02 · Catálogos (músculos y equipamiento)
-- Generado por packages/db/scripts/build-sql.ts — no editar a mano.
-- Idempotente: seguro de re-ejecutar.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;
INSERT INTO "muscle_group" ("name", "body_zone") VALUES ('Pecho', 'upper')
  ON CONFLICT ("name") DO UPDATE SET "body_zone" = EXCLUDED."body_zone";
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Pectoral mayor', id FROM "muscle_group" WHERE "name" = 'Pecho'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Pectoral menor', id FROM "muscle_group" WHERE "name" = 'Pecho'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Serrato anterior', id FROM "muscle_group" WHERE "name" = 'Pecho'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle_group" ("name", "body_zone") VALUES ('Espalda', 'upper')
  ON CONFLICT ("name") DO UPDATE SET "body_zone" = EXCLUDED."body_zone";
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Dorsal ancho', id FROM "muscle_group" WHERE "name" = 'Espalda'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Trapecio', id FROM "muscle_group" WHERE "name" = 'Espalda'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Romboides', id FROM "muscle_group" WHERE "name" = 'Espalda'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Erector espinal', id FROM "muscle_group" WHERE "name" = 'Espalda'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Redondo mayor', id FROM "muscle_group" WHERE "name" = 'Espalda'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle_group" ("name", "body_zone") VALUES ('Hombro', 'upper')
  ON CONFLICT ("name") DO UPDATE SET "body_zone" = EXCLUDED."body_zone";
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Deltoides anterior', id FROM "muscle_group" WHERE "name" = 'Hombro'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Deltoides lateral', id FROM "muscle_group" WHERE "name" = 'Hombro'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Deltoides posterior', id FROM "muscle_group" WHERE "name" = 'Hombro'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Manguito rotador', id FROM "muscle_group" WHERE "name" = 'Hombro'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle_group" ("name", "body_zone") VALUES ('Brazo', 'upper')
  ON CONFLICT ("name") DO UPDATE SET "body_zone" = EXCLUDED."body_zone";
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Bíceps', id FROM "muscle_group" WHERE "name" = 'Brazo'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Tríceps', id FROM "muscle_group" WHERE "name" = 'Brazo'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Braquial', id FROM "muscle_group" WHERE "name" = 'Brazo'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Braquiorradial', id FROM "muscle_group" WHERE "name" = 'Brazo'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle_group" ("name", "body_zone") VALUES ('Antebrazo', 'upper')
  ON CONFLICT ("name") DO UPDATE SET "body_zone" = EXCLUDED."body_zone";
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Flexores del antebrazo', id FROM "muscle_group" WHERE "name" = 'Antebrazo'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Extensores del antebrazo', id FROM "muscle_group" WHERE "name" = 'Antebrazo'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle_group" ("name", "body_zone") VALUES ('Abdomen', 'core')
  ON CONFLICT ("name") DO UPDATE SET "body_zone" = EXCLUDED."body_zone";
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Recto abdominal', id FROM "muscle_group" WHERE "name" = 'Abdomen'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Oblicuo externo', id FROM "muscle_group" WHERE "name" = 'Abdomen'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Oblicuo interno', id FROM "muscle_group" WHERE "name" = 'Abdomen'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Transverso abdominal', id FROM "muscle_group" WHERE "name" = 'Abdomen'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle_group" ("name", "body_zone") VALUES ('Pierna', 'lower')
  ON CONFLICT ("name") DO UPDATE SET "body_zone" = EXCLUDED."body_zone";
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Cuádriceps', id FROM "muscle_group" WHERE "name" = 'Pierna'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Isquiotibiales', id FROM "muscle_group" WHERE "name" = 'Pierna'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Pantorrillas', id FROM "muscle_group" WHERE "name" = 'Pierna'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Sóleo', id FROM "muscle_group" WHERE "name" = 'Pierna'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Aductores', id FROM "muscle_group" WHERE "name" = 'Pierna'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Tibial anterior', id FROM "muscle_group" WHERE "name" = 'Pierna'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Flexores de cadera', id FROM "muscle_group" WHERE "name" = 'Pierna'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle_group" ("name", "body_zone") VALUES ('Glúteo', 'lower')
  ON CONFLICT ("name") DO UPDATE SET "body_zone" = EXCLUDED."body_zone";
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Glúteo mayor', id FROM "muscle_group" WHERE "name" = 'Glúteo'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Glúteo medio', id FROM "muscle_group" WHERE "name" = 'Glúteo'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;
INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT 'Glúteo menor', id FROM "muscle_group" WHERE "name" = 'Glúteo'
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;

INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Barra de dominadas', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Barra baja', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Paralelas', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Paralelas bajas', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Anillas', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Banda elástica', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Cinturón de lastre', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Pared', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Silla', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Banco', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Caja / Step', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Mancuernas', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Barra olímpica', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Barra EZ', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Kettlebell', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Máquina / Cable', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Polea alta', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Polea baja', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('TRX / Suspensión', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Balón medicinal', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Rueda abdominal', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Pelota de estabilidad', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Bosu', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Sled', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Cuerda de batalla', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Trap bar', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Máquina Smith', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Disco', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Landmine', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Saco de arena', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Deslizadores', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Pica / Palo', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Comba', true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES ('Chaleco lastrado', true, NULL) ON CONFLICT DO NOTHING;
COMMIT;
