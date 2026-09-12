-- ═══════════════════════════════════════════════════════════════════════════
-- 04 · 100 ejercicios de calistenia (YouTube) + rutina de ejemplo
-- Generado por packages/db/scripts/build-sql.ts — no editar a mano.
-- Idempotente: seguro de re-ejecutar.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

-- Push Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('f6617eb1-491f-54dd-ab3f-cdedfb84fa77', 'Push Ups', 'Flexión clásica en el suelo con cuerpo en línea recta; base del empuje horizontal.', 'beginner', '{push}', 'wfTgTs8YqUc', 'How To Do Push Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f6617eb1-491f-54dd-ab3f-cdedfb84fa77', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f6617eb1-491f-54dd-ab3f-cdedfb84fa77')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f6617eb1-491f-54dd-ab3f-cdedfb84fa77', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f6617eb1-491f-54dd-ab3f-cdedfb84fa77')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f6617eb1-491f-54dd-ab3f-cdedfb84fa77', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f6617eb1-491f-54dd-ab3f-cdedfb84fa77')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f6617eb1-491f-54dd-ab3f-cdedfb84fa77', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f6617eb1-491f-54dd-ab3f-cdedfb84fa77')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f6617eb1-491f-54dd-ab3f-cdedfb84fa77', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f6617eb1-491f-54dd-ab3f-cdedfb84fa77')
  ON CONFLICT DO NOTHING;

-- Knee Push Up
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('361bade8-4e53-5ed1-aadb-cab652d79648', 'Knee Push Up', 'Flexión apoyando rodillas para reducir la carga; regresión de la flexión clásica.', 'beginner', '{push}', 'uam7Z8aVO4w', 'How To Do Knee Push Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '361bade8-4e53-5ed1-aadb-cab652d79648', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '361bade8-4e53-5ed1-aadb-cab652d79648')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '361bade8-4e53-5ed1-aadb-cab652d79648', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '361bade8-4e53-5ed1-aadb-cab652d79648')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '361bade8-4e53-5ed1-aadb-cab652d79648', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '361bade8-4e53-5ed1-aadb-cab652d79648')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '361bade8-4e53-5ed1-aadb-cab652d79648', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '361bade8-4e53-5ed1-aadb-cab652d79648')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '361bade8-4e53-5ed1-aadb-cab652d79648', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '361bade8-4e53-5ed1-aadb-cab652d79648')
  ON CONFLICT DO NOTHING;

-- Wall Push Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('708f2891-b0c0-5277-a17f-fe809c50a078', 'Wall Push Ups', 'Flexión de pie contra la pared; nivel de inicio absoluto para empuje.', 'beginner', '{pull}', 'pxLvvuAvjzo', 'How To Do Wall Push Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '708f2891-b0c0-5277-a17f-fe809c50a078', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '708f2891-b0c0-5277-a17f-fe809c50a078')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '708f2891-b0c0-5277-a17f-fe809c50a078', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '708f2891-b0c0-5277-a17f-fe809c50a078')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '708f2891-b0c0-5277-a17f-fe809c50a078', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '708f2891-b0c0-5277-a17f-fe809c50a078')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '708f2891-b0c0-5277-a17f-fe809c50a078', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '708f2891-b0c0-5277-a17f-fe809c50a078')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '708f2891-b0c0-5277-a17f-fe809c50a078', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '708f2891-b0c0-5277-a17f-fe809c50a078')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '708f2891-b0c0-5277-a17f-fe809c50a078', e."id" FROM "equipment" e
  WHERE e."name" = 'Pared' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '708f2891-b0c0-5277-a17f-fe809c50a078')
  ON CONFLICT DO NOTHING;

-- Hip Height Incline Push ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('99315fbd-f149-535f-ab2c-034683d17e73', 'Hip Height Incline Push ups', 'Flexión con manos elevadas a la altura de la cadera para reducir carga.', 'beginner', '{push}', 'OQfIpU_xC5s', 'How To Do Hip Height Incline Push Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '99315fbd-f149-535f-ab2c-034683d17e73', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '99315fbd-f149-535f-ab2c-034683d17e73')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '99315fbd-f149-535f-ab2c-034683d17e73', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '99315fbd-f149-535f-ab2c-034683d17e73')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '99315fbd-f149-535f-ab2c-034683d17e73', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '99315fbd-f149-535f-ab2c-034683d17e73')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '99315fbd-f149-535f-ab2c-034683d17e73', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '99315fbd-f149-535f-ab2c-034683d17e73')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '99315fbd-f149-535f-ab2c-034683d17e73', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '99315fbd-f149-535f-ab2c-034683d17e73')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '99315fbd-f149-535f-ab2c-034683d17e73', e."id" FROM "equipment" e
  WHERE e."name" = 'Pared' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '99315fbd-f149-535f-ab2c-034683d17e73')
  ON CONFLICT DO NOTHING;

-- Knee Height Incline Push Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('2167e7ba-be4f-5094-a0ed-939427b1375c', 'Knee Height Incline Push Ups', 'Flexión con manos en superficie a la altura de la rodilla.', 'beginner', '{push}', 'nptMG5hV90c', 'How To Do Knee Height Incline Push Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '2167e7ba-be4f-5094-a0ed-939427b1375c', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '2167e7ba-be4f-5094-a0ed-939427b1375c')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '2167e7ba-be4f-5094-a0ed-939427b1375c', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '2167e7ba-be4f-5094-a0ed-939427b1375c')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '2167e7ba-be4f-5094-a0ed-939427b1375c', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '2167e7ba-be4f-5094-a0ed-939427b1375c')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '2167e7ba-be4f-5094-a0ed-939427b1375c', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '2167e7ba-be4f-5094-a0ed-939427b1375c')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '2167e7ba-be4f-5094-a0ed-939427b1375c', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '2167e7ba-be4f-5094-a0ed-939427b1375c')
  ON CONFLICT DO NOTHING;

-- Negative Push Up
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('16ba7b16-46d9-5661-ae7d-1e3dbf972c73', 'Negative Push Up', 'Descenso lento y controlado de la flexión para ganar fuerza excéntrica.', 'beginner', '{push}', 'vyOLKo7PizM', 'How To Do Negative Push Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '16ba7b16-46d9-5661-ae7d-1e3dbf972c73', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '16ba7b16-46d9-5661-ae7d-1e3dbf972c73')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '16ba7b16-46d9-5661-ae7d-1e3dbf972c73', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '16ba7b16-46d9-5661-ae7d-1e3dbf972c73')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '16ba7b16-46d9-5661-ae7d-1e3dbf972c73', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '16ba7b16-46d9-5661-ae7d-1e3dbf972c73')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '16ba7b16-46d9-5661-ae7d-1e3dbf972c73', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '16ba7b16-46d9-5661-ae7d-1e3dbf972c73')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '16ba7b16-46d9-5661-ae7d-1e3dbf972c73', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '16ba7b16-46d9-5661-ae7d-1e3dbf972c73')
  ON CONFLICT DO NOTHING;

-- Diamond Push Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('47c63e46-1d89-5b40-a160-f51925c9e27f', 'Diamond Push Ups', 'Flexión con manos juntas formando un diamante; enfatiza tríceps.', 'intermediate', '{push}', 'cINBeEWEV9s', 'How To Do Diamond Push Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '47c63e46-1d89-5b40-a160-f51925c9e27f', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '47c63e46-1d89-5b40-a160-f51925c9e27f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '47c63e46-1d89-5b40-a160-f51925c9e27f', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '47c63e46-1d89-5b40-a160-f51925c9e27f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '47c63e46-1d89-5b40-a160-f51925c9e27f', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '47c63e46-1d89-5b40-a160-f51925c9e27f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '47c63e46-1d89-5b40-a160-f51925c9e27f', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '47c63e46-1d89-5b40-a160-f51925c9e27f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '47c63e46-1d89-5b40-a160-f51925c9e27f', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '47c63e46-1d89-5b40-a160-f51925c9e27f')
  ON CONFLICT DO NOTHING;

-- Wide Push Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('68cbf386-4ffe-5bd8-a852-b61eb0d2dd11', 'Wide Push Ups', 'Flexión con agarre amplio; mayor énfasis en pecho.', 'intermediate', '{push}', '6dZ71O7BzVQ', 'How To Do Wide Push Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '68cbf386-4ffe-5bd8-a852-b61eb0d2dd11', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '68cbf386-4ffe-5bd8-a852-b61eb0d2dd11')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '68cbf386-4ffe-5bd8-a852-b61eb0d2dd11', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '68cbf386-4ffe-5bd8-a852-b61eb0d2dd11')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '68cbf386-4ffe-5bd8-a852-b61eb0d2dd11', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '68cbf386-4ffe-5bd8-a852-b61eb0d2dd11')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '68cbf386-4ffe-5bd8-a852-b61eb0d2dd11', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '68cbf386-4ffe-5bd8-a852-b61eb0d2dd11')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '68cbf386-4ffe-5bd8-a852-b61eb0d2dd11', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '68cbf386-4ffe-5bd8-a852-b61eb0d2dd11')
  ON CONFLICT DO NOTHING;

-- Narrow Push Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('b4e4436e-6879-5f4f-a64f-276c37df37e6', 'Narrow Push Ups', 'Flexión con manos a la anchura de hombros o menos; más tríceps.', 'beginner', '{push}', '6e6uUJ8QzXw', 'How To Do Narrow Push Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b4e4436e-6879-5f4f-a64f-276c37df37e6', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b4e4436e-6879-5f4f-a64f-276c37df37e6')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b4e4436e-6879-5f4f-a64f-276c37df37e6', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b4e4436e-6879-5f4f-a64f-276c37df37e6')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b4e4436e-6879-5f4f-a64f-276c37df37e6', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b4e4436e-6879-5f4f-a64f-276c37df37e6')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b4e4436e-6879-5f4f-a64f-276c37df37e6', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b4e4436e-6879-5f4f-a64f-276c37df37e6')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b4e4436e-6879-5f4f-a64f-276c37df37e6', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b4e4436e-6879-5f4f-a64f-276c37df37e6')
  ON CONFLICT DO NOTHING;

-- Decline Push Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('8133a783-457b-53b9-a69e-2880a86015d1', 'Decline Push Ups', 'Flexión con pies elevados; más carga en hombro y pecho superior.', 'intermediate', '{push}', 'N5Hel1XfCy0', 'How To Do Decline Push Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '8133a783-457b-53b9-a69e-2880a86015d1', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '8133a783-457b-53b9-a69e-2880a86015d1')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '8133a783-457b-53b9-a69e-2880a86015d1', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '8133a783-457b-53b9-a69e-2880a86015d1')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '8133a783-457b-53b9-a69e-2880a86015d1', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '8133a783-457b-53b9-a69e-2880a86015d1')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '8133a783-457b-53b9-a69e-2880a86015d1', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '8133a783-457b-53b9-a69e-2880a86015d1')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '8133a783-457b-53b9-a69e-2880a86015d1', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '8133a783-457b-53b9-a69e-2880a86015d1')
  ON CONFLICT DO NOTHING;

-- Archer Push Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('a637a507-1fa7-5282-a45a-8650dabf6d1d', 'Archer Push Ups', 'Flexión desplazando el peso a un brazo mientras el otro se extiende.', 'advanced', '{push}', 'OVRBYrjszy4', 'How To Do Archer Push Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a637a507-1fa7-5282-a45a-8650dabf6d1d', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a637a507-1fa7-5282-a45a-8650dabf6d1d')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a637a507-1fa7-5282-a45a-8650dabf6d1d', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a637a507-1fa7-5282-a45a-8650dabf6d1d')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a637a507-1fa7-5282-a45a-8650dabf6d1d', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a637a507-1fa7-5282-a45a-8650dabf6d1d')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a637a507-1fa7-5282-a45a-8650dabf6d1d', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a637a507-1fa7-5282-a45a-8650dabf6d1d')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a637a507-1fa7-5282-a45a-8650dabf6d1d', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a637a507-1fa7-5282-a45a-8650dabf6d1d')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a637a507-1fa7-5282-a45a-8650dabf6d1d', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Oblicuo externo' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a637a507-1fa7-5282-a45a-8650dabf6d1d')
  ON CONFLICT DO NOTHING;

-- Pseudo Push Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('d84b00de-6ceb-5742-affc-7af41235464e', 'Pseudo Push Ups', 'Flexión con manos a la altura de la cadera y hombros adelantados; preparación para planche.', 'intermediate', '{push}', 'xhpwupEd4e8', 'How To Do Pseudo Push Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'd84b00de-6ceb-5742-affc-7af41235464e', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'd84b00de-6ceb-5742-affc-7af41235464e')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'd84b00de-6ceb-5742-affc-7af41235464e', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'd84b00de-6ceb-5742-affc-7af41235464e')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'd84b00de-6ceb-5742-affc-7af41235464e', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'd84b00de-6ceb-5742-affc-7af41235464e')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'd84b00de-6ceb-5742-affc-7af41235464e', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'd84b00de-6ceb-5742-affc-7af41235464e')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'd84b00de-6ceb-5742-affc-7af41235464e', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'd84b00de-6ceb-5742-affc-7af41235464e')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'd84b00de-6ceb-5742-affc-7af41235464e', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'd84b00de-6ceb-5742-affc-7af41235464e')
  ON CONFLICT DO NOTHING;

-- Clap Push Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('cf67ada2-c733-5ebe-add5-9356c1fbb995', 'Clap Push Ups', 'Flexión explosiva despegando las manos para aplaudir.', 'advanced', '{push}', 'dEB7ZXdm410', 'How To Do Clap Push Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'cf67ada2-c733-5ebe-add5-9356c1fbb995', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'cf67ada2-c733-5ebe-add5-9356c1fbb995')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'cf67ada2-c733-5ebe-add5-9356c1fbb995', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'cf67ada2-c733-5ebe-add5-9356c1fbb995')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'cf67ada2-c733-5ebe-add5-9356c1fbb995', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'cf67ada2-c733-5ebe-add5-9356c1fbb995')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'cf67ada2-c733-5ebe-add5-9356c1fbb995', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'cf67ada2-c733-5ebe-add5-9356c1fbb995')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'cf67ada2-c733-5ebe-add5-9356c1fbb995', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'cf67ada2-c733-5ebe-add5-9356c1fbb995')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'cf67ada2-c733-5ebe-add5-9356c1fbb995', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'cf67ada2-c733-5ebe-add5-9356c1fbb995')
  ON CONFLICT DO NOTHING;

-- Pike Push Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('ef33fa00-5bce-5425-a630-bb933697dd07', 'Pike Push Ups', 'Flexión con cadera elevada en V invertida; empuje vertical para hombros.', 'intermediate', '{push}', '226O2XfevJ0', 'How To Do Pike Push Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'ef33fa00-5bce-5425-a630-bb933697dd07', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ef33fa00-5bce-5425-a630-bb933697dd07')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'ef33fa00-5bce-5425-a630-bb933697dd07', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ef33fa00-5bce-5425-a630-bb933697dd07')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'ef33fa00-5bce-5425-a630-bb933697dd07', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ef33fa00-5bce-5425-a630-bb933697dd07')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'ef33fa00-5bce-5425-a630-bb933697dd07', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ef33fa00-5bce-5425-a630-bb933697dd07')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'ef33fa00-5bce-5425-a630-bb933697dd07', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ef33fa00-5bce-5425-a630-bb933697dd07')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'ef33fa00-5bce-5425-a630-bb933697dd07', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ef33fa00-5bce-5425-a630-bb933697dd07')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'ef33fa00-5bce-5425-a630-bb933697dd07', e."id" FROM "equipment" e
  WHERE e."name" = 'Pared' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ef33fa00-5bce-5425-a630-bb933697dd07')
  ON CONFLICT DO NOTHING;

-- Incline Pike Push Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('f52956e9-d572-58a6-a4d9-faa2be0f0d0f', 'Incline Pike Push Ups', 'Flexión pica con manos elevadas; regresión para hombros.', 'beginner', '{push}', 'HLjASz4wexo', 'How To Do Incline Pike Push Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f52956e9-d572-58a6-a4d9-faa2be0f0d0f', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f52956e9-d572-58a6-a4d9-faa2be0f0d0f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f52956e9-d572-58a6-a4d9-faa2be0f0d0f', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f52956e9-d572-58a6-a4d9-faa2be0f0d0f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f52956e9-d572-58a6-a4d9-faa2be0f0d0f', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f52956e9-d572-58a6-a4d9-faa2be0f0d0f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f52956e9-d572-58a6-a4d9-faa2be0f0d0f', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f52956e9-d572-58a6-a4d9-faa2be0f0d0f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f52956e9-d572-58a6-a4d9-faa2be0f0d0f', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f52956e9-d572-58a6-a4d9-faa2be0f0d0f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'f52956e9-d572-58a6-a4d9-faa2be0f0d0f', e."id" FROM "equipment" e
  WHERE e."name" = 'Pared' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f52956e9-d572-58a6-a4d9-faa2be0f0d0f')
  ON CONFLICT DO NOTHING;

-- 90 Degree Handstand Push Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('b27d44e6-61eb-5bf9-aad0-0707b64d1fa6', '90 Degree Handstand Push Ups', 'Flexión en parada de manos bajando hasta codos a 90 grados.', 'advanced', '{push}', 'XiT4FBHY_v8', 'How To Do 90 Degree Handstand Push Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b27d44e6-61eb-5bf9-aad0-0707b64d1fa6', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b27d44e6-61eb-5bf9-aad0-0707b64d1fa6')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b27d44e6-61eb-5bf9-aad0-0707b64d1fa6', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b27d44e6-61eb-5bf9-aad0-0707b64d1fa6')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b27d44e6-61eb-5bf9-aad0-0707b64d1fa6', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b27d44e6-61eb-5bf9-aad0-0707b64d1fa6')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b27d44e6-61eb-5bf9-aad0-0707b64d1fa6', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b27d44e6-61eb-5bf9-aad0-0707b64d1fa6')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b27d44e6-61eb-5bf9-aad0-0707b64d1fa6', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b27d44e6-61eb-5bf9-aad0-0707b64d1fa6')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b27d44e6-61eb-5bf9-aad0-0707b64d1fa6', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b27d44e6-61eb-5bf9-aad0-0707b64d1fa6')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b27d44e6-61eb-5bf9-aad0-0707b64d1fa6', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b27d44e6-61eb-5bf9-aad0-0707b64d1fa6')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b27d44e6-61eb-5bf9-aad0-0707b64d1fa6', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Erector espinal' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b27d44e6-61eb-5bf9-aad0-0707b64d1fa6')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b27d44e6-61eb-5bf9-aad0-0707b64d1fa6', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b27d44e6-61eb-5bf9-aad0-0707b64d1fa6')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'b27d44e6-61eb-5bf9-aad0-0707b64d1fa6', e."id" FROM "equipment" e
  WHERE e."name" = 'Paralelas bajas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b27d44e6-61eb-5bf9-aad0-0707b64d1fa6')
  ON CONFLICT DO NOTHING;

-- Shoulder Tap Push Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('7b9c73c8-865f-5d94-a907-2104cd326b60', 'Shoulder Tap Push Ups', 'Flexión alternando toques de hombro; añade antirrotación del core.', 'beginner', '{push}', 'ZVlxdH2r7Vo', 'How To Do Shoulder Taps Push Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '7b9c73c8-865f-5d94-a907-2104cd326b60', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '7b9c73c8-865f-5d94-a907-2104cd326b60')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '7b9c73c8-865f-5d94-a907-2104cd326b60', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '7b9c73c8-865f-5d94-a907-2104cd326b60')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '7b9c73c8-865f-5d94-a907-2104cd326b60', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '7b9c73c8-865f-5d94-a907-2104cd326b60')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '7b9c73c8-865f-5d94-a907-2104cd326b60', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '7b9c73c8-865f-5d94-a907-2104cd326b60')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '7b9c73c8-865f-5d94-a907-2104cd326b60', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Oblicuo externo' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '7b9c73c8-865f-5d94-a907-2104cd326b60')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '7b9c73c8-865f-5d94-a907-2104cd326b60', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '7b9c73c8-865f-5d94-a907-2104cd326b60')
  ON CONFLICT DO NOTHING;

-- Ring Push Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('596937ec-8e1f-5899-a68c-6edf8f01fa26', 'Ring Push Ups', 'Flexión con manos en anillas; exige estabilidad de hombro.', 'intermediate', '{push}', 'J6TpAoHj92A', 'How To Do Ring Push Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '596937ec-8e1f-5899-a68c-6edf8f01fa26', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '596937ec-8e1f-5899-a68c-6edf8f01fa26')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '596937ec-8e1f-5899-a68c-6edf8f01fa26', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '596937ec-8e1f-5899-a68c-6edf8f01fa26')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '596937ec-8e1f-5899-a68c-6edf8f01fa26', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '596937ec-8e1f-5899-a68c-6edf8f01fa26')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '596937ec-8e1f-5899-a68c-6edf8f01fa26', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '596937ec-8e1f-5899-a68c-6edf8f01fa26')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '596937ec-8e1f-5899-a68c-6edf8f01fa26', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '596937ec-8e1f-5899-a68c-6edf8f01fa26')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '596937ec-8e1f-5899-a68c-6edf8f01fa26', e."id" FROM "equipment" e
  WHERE e."name" = 'Anillas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '596937ec-8e1f-5899-a68c-6edf8f01fa26')
  ON CONFLICT DO NOTHING;

-- Tiger Push Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('097c82be-eb16-5fca-ad41-7f6c5aee18b7', 'Tiger Push Ups', 'Transición de apoyo en antebrazos a brazos extendidos; tríceps intenso.', 'advanced', '{push}', '-Y3hHxuD56c', 'How To Do Tiger Push Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '097c82be-eb16-5fca-ad41-7f6c5aee18b7', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '097c82be-eb16-5fca-ad41-7f6c5aee18b7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '097c82be-eb16-5fca-ad41-7f6c5aee18b7', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '097c82be-eb16-5fca-ad41-7f6c5aee18b7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '097c82be-eb16-5fca-ad41-7f6c5aee18b7', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '097c82be-eb16-5fca-ad41-7f6c5aee18b7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '097c82be-eb16-5fca-ad41-7f6c5aee18b7', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '097c82be-eb16-5fca-ad41-7f6c5aee18b7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '097c82be-eb16-5fca-ad41-7f6c5aee18b7', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '097c82be-eb16-5fca-ad41-7f6c5aee18b7')
  ON CONFLICT DO NOTHING;

-- Russian Push Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('2c606ac5-31ef-53a7-ad88-6d97435918de', 'Russian Push Ups', 'Flexión con transición a antebrazos y regreso; tríceps y hombro.', 'intermediate', '{push}', 'L1mh75FRtQM', 'How To Do Russian Push Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '2c606ac5-31ef-53a7-ad88-6d97435918de', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '2c606ac5-31ef-53a7-ad88-6d97435918de')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '2c606ac5-31ef-53a7-ad88-6d97435918de', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '2c606ac5-31ef-53a7-ad88-6d97435918de')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '2c606ac5-31ef-53a7-ad88-6d97435918de', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '2c606ac5-31ef-53a7-ad88-6d97435918de')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '2c606ac5-31ef-53a7-ad88-6d97435918de', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '2c606ac5-31ef-53a7-ad88-6d97435918de')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '2c606ac5-31ef-53a7-ad88-6d97435918de', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '2c606ac5-31ef-53a7-ad88-6d97435918de')
  ON CONFLICT DO NOTHING;

-- Scapula Push up
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('f81184e1-0a11-5023-a4fc-6782d096a7f5', 'Scapula Push up', 'Protracción y retracción escapular en posición de plancha, sin doblar codos.', 'beginner', '{push}', 'LolK1AbFpMQ', 'How To Do Scapula Push Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f81184e1-0a11-5023-a4fc-6782d096a7f5', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f81184e1-0a11-5023-a4fc-6782d096a7f5')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f81184e1-0a11-5023-a4fc-6782d096a7f5', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f81184e1-0a11-5023-a4fc-6782d096a7f5')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f81184e1-0a11-5023-a4fc-6782d096a7f5', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f81184e1-0a11-5023-a4fc-6782d096a7f5')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f81184e1-0a11-5023-a4fc-6782d096a7f5', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f81184e1-0a11-5023-a4fc-6782d096a7f5')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f81184e1-0a11-5023-a4fc-6782d096a7f5', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f81184e1-0a11-5023-a4fc-6782d096a7f5')
  ON CONFLICT DO NOTHING;

-- Dips
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('40afa1bc-49db-5aad-a1fd-a147213c68b0', 'Dips', 'Descenso y empuje en barras paralelas; pecho, tríceps y hombro.', 'intermediate', '{push}', 'nigZNnJAQrY', 'How To Do Dips', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '40afa1bc-49db-5aad-a1fd-a147213c68b0', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '40afa1bc-49db-5aad-a1fd-a147213c68b0')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '40afa1bc-49db-5aad-a1fd-a147213c68b0', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '40afa1bc-49db-5aad-a1fd-a147213c68b0')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '40afa1bc-49db-5aad-a1fd-a147213c68b0', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '40afa1bc-49db-5aad-a1fd-a147213c68b0')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '40afa1bc-49db-5aad-a1fd-a147213c68b0', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '40afa1bc-49db-5aad-a1fd-a147213c68b0')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '40afa1bc-49db-5aad-a1fd-a147213c68b0', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '40afa1bc-49db-5aad-a1fd-a147213c68b0')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '40afa1bc-49db-5aad-a1fd-a147213c68b0', e."id" FROM "equipment" e
  WHERE e."name" = 'Paralelas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '40afa1bc-49db-5aad-a1fd-a147213c68b0')
  ON CONFLICT DO NOTHING;

-- Assisted Dips
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('b99eb1ec-6d50-59a6-a1f1-f2ca9459dac2', 'Assisted Dips', 'Fondos con banda de resistencia para reducir carga.', 'beginner', '{push}', 'ld4f2iJ2_us', 'How To Do Assisted Dips', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b99eb1ec-6d50-59a6-a1f1-f2ca9459dac2', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b99eb1ec-6d50-59a6-a1f1-f2ca9459dac2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b99eb1ec-6d50-59a6-a1f1-f2ca9459dac2', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b99eb1ec-6d50-59a6-a1f1-f2ca9459dac2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b99eb1ec-6d50-59a6-a1f1-f2ca9459dac2', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b99eb1ec-6d50-59a6-a1f1-f2ca9459dac2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b99eb1ec-6d50-59a6-a1f1-f2ca9459dac2', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b99eb1ec-6d50-59a6-a1f1-f2ca9459dac2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b99eb1ec-6d50-59a6-a1f1-f2ca9459dac2', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b99eb1ec-6d50-59a6-a1f1-f2ca9459dac2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'b99eb1ec-6d50-59a6-a1f1-f2ca9459dac2', e."id" FROM "equipment" e
  WHERE e."name" = 'Paralelas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b99eb1ec-6d50-59a6-a1f1-f2ca9459dac2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'b99eb1ec-6d50-59a6-a1f1-f2ca9459dac2', e."id" FROM "equipment" e
  WHERE e."name" = 'Banda elástica' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b99eb1ec-6d50-59a6-a1f1-f2ca9459dac2')
  ON CONFLICT DO NOTHING;

-- Negative Dips
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('75071fde-e9b9-572a-a7d2-7ce74e3572be', 'Negative Dips', 'Descenso lento en paralelas para construir fuerza de fondos.', 'beginner', '{push}', 'y9yrMvmS-yU', 'How To Do Negative Dips', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '75071fde-e9b9-572a-a7d2-7ce74e3572be', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '75071fde-e9b9-572a-a7d2-7ce74e3572be')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '75071fde-e9b9-572a-a7d2-7ce74e3572be', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '75071fde-e9b9-572a-a7d2-7ce74e3572be')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '75071fde-e9b9-572a-a7d2-7ce74e3572be', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '75071fde-e9b9-572a-a7d2-7ce74e3572be')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '75071fde-e9b9-572a-a7d2-7ce74e3572be', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '75071fde-e9b9-572a-a7d2-7ce74e3572be')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '75071fde-e9b9-572a-a7d2-7ce74e3572be', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '75071fde-e9b9-572a-a7d2-7ce74e3572be')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '75071fde-e9b9-572a-a7d2-7ce74e3572be', e."id" FROM "equipment" e
  WHERE e."name" = 'Paralelas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '75071fde-e9b9-572a-a7d2-7ce74e3572be')
  ON CONFLICT DO NOTHING;

-- Dip Support Hold
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('00111f4f-37e9-57bb-a386-cefb20cad43e', 'Dip Support Hold', 'Mantener el cuerpo arriba con brazos extendidos en paralelas.', 'beginner', '{push}', '_vPttkLHZMw', 'How To Do Dip Support Hold', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '00111f4f-37e9-57bb-a386-cefb20cad43e', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '00111f4f-37e9-57bb-a386-cefb20cad43e')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '00111f4f-37e9-57bb-a386-cefb20cad43e', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '00111f4f-37e9-57bb-a386-cefb20cad43e')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '00111f4f-37e9-57bb-a386-cefb20cad43e', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '00111f4f-37e9-57bb-a386-cefb20cad43e')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '00111f4f-37e9-57bb-a386-cefb20cad43e', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '00111f4f-37e9-57bb-a386-cefb20cad43e')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '00111f4f-37e9-57bb-a386-cefb20cad43e', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '00111f4f-37e9-57bb-a386-cefb20cad43e')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '00111f4f-37e9-57bb-a386-cefb20cad43e', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '00111f4f-37e9-57bb-a386-cefb20cad43e')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '00111f4f-37e9-57bb-a386-cefb20cad43e', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '00111f4f-37e9-57bb-a386-cefb20cad43e')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '00111f4f-37e9-57bb-a386-cefb20cad43e', e."id" FROM "equipment" e
  WHERE e."name" = 'Paralelas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '00111f4f-37e9-57bb-a386-cefb20cad43e')
  ON CONFLICT DO NOTHING;

-- Chair Dips With Bent Knees
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('4cb99816-a65c-599d-aeb6-59ce4409069f', 'Chair Dips With Bent Knees', 'Fondos de tríceps en silla con pies cerca; nivel inicial.', 'beginner', '{push}', 'Y-zpMnf8-Ms', 'How To Do Chair Dips With Bent Knees', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4cb99816-a65c-599d-aeb6-59ce4409069f', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4cb99816-a65c-599d-aeb6-59ce4409069f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4cb99816-a65c-599d-aeb6-59ce4409069f', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4cb99816-a65c-599d-aeb6-59ce4409069f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4cb99816-a65c-599d-aeb6-59ce4409069f', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4cb99816-a65c-599d-aeb6-59ce4409069f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4cb99816-a65c-599d-aeb6-59ce4409069f', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4cb99816-a65c-599d-aeb6-59ce4409069f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4cb99816-a65c-599d-aeb6-59ce4409069f', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4cb99816-a65c-599d-aeb6-59ce4409069f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '4cb99816-a65c-599d-aeb6-59ce4409069f', e."id" FROM "equipment" e
  WHERE e."name" = 'Paralelas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4cb99816-a65c-599d-aeb6-59ce4409069f')
  ON CONFLICT DO NOTHING;

-- Ring Dips
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('f3b77da6-b4fe-5caf-a6f2-61e772b7d060', 'Ring Dips', 'Fondos en anillas; requiere gran estabilidad.', 'advanced', '{push}', 'YtKfqs6AUYE', 'How To Do Ring Dips', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f3b77da6-b4fe-5caf-a6f2-61e772b7d060', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f3b77da6-b4fe-5caf-a6f2-61e772b7d060')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f3b77da6-b4fe-5caf-a6f2-61e772b7d060', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f3b77da6-b4fe-5caf-a6f2-61e772b7d060')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f3b77da6-b4fe-5caf-a6f2-61e772b7d060', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f3b77da6-b4fe-5caf-a6f2-61e772b7d060')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f3b77da6-b4fe-5caf-a6f2-61e772b7d060', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f3b77da6-b4fe-5caf-a6f2-61e772b7d060')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f3b77da6-b4fe-5caf-a6f2-61e772b7d060', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f3b77da6-b4fe-5caf-a6f2-61e772b7d060')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f3b77da6-b4fe-5caf-a6f2-61e772b7d060', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f3b77da6-b4fe-5caf-a6f2-61e772b7d060')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f3b77da6-b4fe-5caf-a6f2-61e772b7d060', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f3b77da6-b4fe-5caf-a6f2-61e772b7d060')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'f3b77da6-b4fe-5caf-a6f2-61e772b7d060', e."id" FROM "equipment" e
  WHERE e."name" = 'Anillas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f3b77da6-b4fe-5caf-a6f2-61e772b7d060')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'f3b77da6-b4fe-5caf-a6f2-61e772b7d060', e."id" FROM "equipment" e
  WHERE e."name" = 'Caja / Step' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f3b77da6-b4fe-5caf-a6f2-61e772b7d060')
  ON CONFLICT DO NOTHING;

-- Ring Support Hold
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('b3ee489f-fa93-5054-a338-53af4bcaf67b', 'Ring Support Hold', 'Mantener soporte con brazos extendidos en anillas.', 'intermediate', '{push}', 'iiOypUW-TAA', 'How To Do Ring Support Hold', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b3ee489f-fa93-5054-a338-53af4bcaf67b', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b3ee489f-fa93-5054-a338-53af4bcaf67b')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b3ee489f-fa93-5054-a338-53af4bcaf67b', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b3ee489f-fa93-5054-a338-53af4bcaf67b')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b3ee489f-fa93-5054-a338-53af4bcaf67b', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b3ee489f-fa93-5054-a338-53af4bcaf67b')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b3ee489f-fa93-5054-a338-53af4bcaf67b', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b3ee489f-fa93-5054-a338-53af4bcaf67b')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b3ee489f-fa93-5054-a338-53af4bcaf67b', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b3ee489f-fa93-5054-a338-53af4bcaf67b')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b3ee489f-fa93-5054-a338-53af4bcaf67b', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b3ee489f-fa93-5054-a338-53af4bcaf67b')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b3ee489f-fa93-5054-a338-53af4bcaf67b', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b3ee489f-fa93-5054-a338-53af4bcaf67b')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b3ee489f-fa93-5054-a338-53af4bcaf67b', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b3ee489f-fa93-5054-a338-53af4bcaf67b')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b3ee489f-fa93-5054-a338-53af4bcaf67b', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b3ee489f-fa93-5054-a338-53af4bcaf67b')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b3ee489f-fa93-5054-a338-53af4bcaf67b', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Cuádriceps' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b3ee489f-fa93-5054-a338-53af4bcaf67b')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'b3ee489f-fa93-5054-a338-53af4bcaf67b', e."id" FROM "equipment" e
  WHERE e."name" = 'Anillas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b3ee489f-fa93-5054-a338-53af4bcaf67b')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'b3ee489f-fa93-5054-a338-53af4bcaf67b', e."id" FROM "equipment" e
  WHERE e."name" = 'Caja / Step' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b3ee489f-fa93-5054-a338-53af4bcaf67b')
  ON CONFLICT DO NOTHING;

-- Weighted Dips
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('89db6af5-a1d4-5ab5-aada-d43d62a95efd', 'Weighted Dips', 'Fondos con cinturón de lastre para progresar fuerza.', 'advanced', '{push}', 'FaDwJniHyjM', 'How To Do Weighted Dips', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '89db6af5-a1d4-5ab5-aada-d43d62a95efd', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '89db6af5-a1d4-5ab5-aada-d43d62a95efd')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '89db6af5-a1d4-5ab5-aada-d43d62a95efd', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '89db6af5-a1d4-5ab5-aada-d43d62a95efd')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '89db6af5-a1d4-5ab5-aada-d43d62a95efd', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '89db6af5-a1d4-5ab5-aada-d43d62a95efd')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '89db6af5-a1d4-5ab5-aada-d43d62a95efd', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '89db6af5-a1d4-5ab5-aada-d43d62a95efd')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '89db6af5-a1d4-5ab5-aada-d43d62a95efd', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '89db6af5-a1d4-5ab5-aada-d43d62a95efd')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '89db6af5-a1d4-5ab5-aada-d43d62a95efd', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '89db6af5-a1d4-5ab5-aada-d43d62a95efd')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '89db6af5-a1d4-5ab5-aada-d43d62a95efd', e."id" FROM "equipment" e
  WHERE e."name" = 'Cinturón de lastre' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '89db6af5-a1d4-5ab5-aada-d43d62a95efd')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '89db6af5-a1d4-5ab5-aada-d43d62a95efd', e."id" FROM "equipment" e
  WHERE e."name" = 'Paralelas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '89db6af5-a1d4-5ab5-aada-d43d62a95efd')
  ON CONFLICT DO NOTHING;

-- Explosive Dips
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('bcfc277c-0aeb-55b6-a01b-9a37fdcf0e27', 'Explosive Dips', 'Fondos con fase concéntrica explosiva.', 'advanced', '{push}', 'x3XSb7HoOCo', 'How To Do Explosive Dips', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'bcfc277c-0aeb-55b6-a01b-9a37fdcf0e27', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'bcfc277c-0aeb-55b6-a01b-9a37fdcf0e27')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'bcfc277c-0aeb-55b6-a01b-9a37fdcf0e27', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'bcfc277c-0aeb-55b6-a01b-9a37fdcf0e27')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'bcfc277c-0aeb-55b6-a01b-9a37fdcf0e27', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'bcfc277c-0aeb-55b6-a01b-9a37fdcf0e27')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'bcfc277c-0aeb-55b6-a01b-9a37fdcf0e27', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'bcfc277c-0aeb-55b6-a01b-9a37fdcf0e27')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'bcfc277c-0aeb-55b6-a01b-9a37fdcf0e27', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'bcfc277c-0aeb-55b6-a01b-9a37fdcf0e27')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'bcfc277c-0aeb-55b6-a01b-9a37fdcf0e27', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'bcfc277c-0aeb-55b6-a01b-9a37fdcf0e27')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'bcfc277c-0aeb-55b6-a01b-9a37fdcf0e27', e."id" FROM "equipment" e
  WHERE e."name" = 'Paralelas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'bcfc277c-0aeb-55b6-a01b-9a37fdcf0e27')
  ON CONFLICT DO NOTHING;

-- Planche Lean
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('b5d67f58-2240-52a7-aecf-c7c263761a1b', 'Planche Lean', 'Plancha con hombros por delante de las manos; base para planche.', 'beginner', '{push}', '9R4OxINluw0', 'How To Do Planche Lean', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b5d67f58-2240-52a7-aecf-c7c263761a1b', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b5d67f58-2240-52a7-aecf-c7c263761a1b')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b5d67f58-2240-52a7-aecf-c7c263761a1b', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b5d67f58-2240-52a7-aecf-c7c263761a1b')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b5d67f58-2240-52a7-aecf-c7c263761a1b', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b5d67f58-2240-52a7-aecf-c7c263761a1b')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b5d67f58-2240-52a7-aecf-c7c263761a1b', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b5d67f58-2240-52a7-aecf-c7c263761a1b')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b5d67f58-2240-52a7-aecf-c7c263761a1b', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b5d67f58-2240-52a7-aecf-c7c263761a1b')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b5d67f58-2240-52a7-aecf-c7c263761a1b', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b5d67f58-2240-52a7-aecf-c7c263761a1b')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b5d67f58-2240-52a7-aecf-c7c263761a1b', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b5d67f58-2240-52a7-aecf-c7c263761a1b')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'b5d67f58-2240-52a7-aecf-c7c263761a1b', e."id" FROM "equipment" e
  WHERE e."name" = 'Paralelas bajas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b5d67f58-2240-52a7-aecf-c7c263761a1b')
  ON CONFLICT DO NOTHING;

-- Tuck Planche
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('2974c3cc-c45f-5965-ae93-096495a1b292', 'Tuck Planche', 'Planche con rodillas al pecho sobre paralelas o suelo.', 'beginner', '{push}', 'aTaYfWqOBzI', 'How To Do Tuck Planche', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '2974c3cc-c45f-5965-ae93-096495a1b292', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '2974c3cc-c45f-5965-ae93-096495a1b292')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '2974c3cc-c45f-5965-ae93-096495a1b292', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '2974c3cc-c45f-5965-ae93-096495a1b292')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '2974c3cc-c45f-5965-ae93-096495a1b292', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '2974c3cc-c45f-5965-ae93-096495a1b292')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '2974c3cc-c45f-5965-ae93-096495a1b292', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '2974c3cc-c45f-5965-ae93-096495a1b292')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '2974c3cc-c45f-5965-ae93-096495a1b292', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '2974c3cc-c45f-5965-ae93-096495a1b292')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '2974c3cc-c45f-5965-ae93-096495a1b292', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '2974c3cc-c45f-5965-ae93-096495a1b292')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '2974c3cc-c45f-5965-ae93-096495a1b292', e."id" FROM "equipment" e
  WHERE e."name" = 'Paralelas bajas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '2974c3cc-c45f-5965-ae93-096495a1b292')
  ON CONFLICT DO NOTHING;

-- Advanced Tuck Planche
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('3b4c6fde-9a97-524b-a604-d3c573afe092', 'Advanced Tuck Planche', 'Planche con espalda plana y cadera extendida parcialmente.', 'intermediate', '{push}', 'A3dXIMhSHmk', 'How To Do Advanced Tuck Planche', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '3b4c6fde-9a97-524b-a604-d3c573afe092', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '3b4c6fde-9a97-524b-a604-d3c573afe092')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '3b4c6fde-9a97-524b-a604-d3c573afe092', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '3b4c6fde-9a97-524b-a604-d3c573afe092')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '3b4c6fde-9a97-524b-a604-d3c573afe092', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '3b4c6fde-9a97-524b-a604-d3c573afe092')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '3b4c6fde-9a97-524b-a604-d3c573afe092', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '3b4c6fde-9a97-524b-a604-d3c573afe092')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '3b4c6fde-9a97-524b-a604-d3c573afe092', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '3b4c6fde-9a97-524b-a604-d3c573afe092')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '3b4c6fde-9a97-524b-a604-d3c573afe092', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '3b4c6fde-9a97-524b-a604-d3c573afe092')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '3b4c6fde-9a97-524b-a604-d3c573afe092', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores de cadera' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '3b4c6fde-9a97-524b-a604-d3c573afe092')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '3b4c6fde-9a97-524b-a604-d3c573afe092', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Erector espinal' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '3b4c6fde-9a97-524b-a604-d3c573afe092')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '3b4c6fde-9a97-524b-a604-d3c573afe092', e."id" FROM "equipment" e
  WHERE e."name" = 'Paralelas bajas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '3b4c6fde-9a97-524b-a604-d3c573afe092')
  ON CONFLICT DO NOTHING;

-- Straddle Planche
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('137ad165-b8c8-57ef-af4c-a571bb13eda7', 'Straddle Planche', 'Planche con piernas extendidas y abiertas.', 'advanced', '{push}', 'ZGrEdcMpxHk', 'How To Do Straddle Planche', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '137ad165-b8c8-57ef-af4c-a571bb13eda7', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '137ad165-b8c8-57ef-af4c-a571bb13eda7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '137ad165-b8c8-57ef-af4c-a571bb13eda7', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '137ad165-b8c8-57ef-af4c-a571bb13eda7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '137ad165-b8c8-57ef-af4c-a571bb13eda7', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '137ad165-b8c8-57ef-af4c-a571bb13eda7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '137ad165-b8c8-57ef-af4c-a571bb13eda7', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '137ad165-b8c8-57ef-af4c-a571bb13eda7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '137ad165-b8c8-57ef-af4c-a571bb13eda7', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '137ad165-b8c8-57ef-af4c-a571bb13eda7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '137ad165-b8c8-57ef-af4c-a571bb13eda7', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '137ad165-b8c8-57ef-af4c-a571bb13eda7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '137ad165-b8c8-57ef-af4c-a571bb13eda7', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '137ad165-b8c8-57ef-af4c-a571bb13eda7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '137ad165-b8c8-57ef-af4c-a571bb13eda7', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '137ad165-b8c8-57ef-af4c-a571bb13eda7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '137ad165-b8c8-57ef-af4c-a571bb13eda7', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Erector espinal' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '137ad165-b8c8-57ef-af4c-a571bb13eda7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '137ad165-b8c8-57ef-af4c-a571bb13eda7', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo medio' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '137ad165-b8c8-57ef-af4c-a571bb13eda7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '137ad165-b8c8-57ef-af4c-a571bb13eda7', e."id" FROM "equipment" e
  WHERE e."name" = 'Paralelas bajas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '137ad165-b8c8-57ef-af4c-a571bb13eda7')
  ON CONFLICT DO NOTHING;

-- Full Planche
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('cd74fcd7-a3d3-51ee-ae28-5c3a4d075884', 'Full Planche', 'Cuerpo horizontal y recto sostenido solo con brazos extendidos.', 'advanced', '{push}', 'KbroJBvHssM', 'How To Do Full Planche', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'cd74fcd7-a3d3-51ee-ae28-5c3a4d075884', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'cd74fcd7-a3d3-51ee-ae28-5c3a4d075884')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'cd74fcd7-a3d3-51ee-ae28-5c3a4d075884', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'cd74fcd7-a3d3-51ee-ae28-5c3a4d075884')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'cd74fcd7-a3d3-51ee-ae28-5c3a4d075884', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'cd74fcd7-a3d3-51ee-ae28-5c3a4d075884')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'cd74fcd7-a3d3-51ee-ae28-5c3a4d075884', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'cd74fcd7-a3d3-51ee-ae28-5c3a4d075884')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'cd74fcd7-a3d3-51ee-ae28-5c3a4d075884', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'cd74fcd7-a3d3-51ee-ae28-5c3a4d075884')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'cd74fcd7-a3d3-51ee-ae28-5c3a4d075884', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'cd74fcd7-a3d3-51ee-ae28-5c3a4d075884')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'cd74fcd7-a3d3-51ee-ae28-5c3a4d075884', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'cd74fcd7-a3d3-51ee-ae28-5c3a4d075884')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'cd74fcd7-a3d3-51ee-ae28-5c3a4d075884', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'cd74fcd7-a3d3-51ee-ae28-5c3a4d075884')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'cd74fcd7-a3d3-51ee-ae28-5c3a4d075884', e."id" FROM "equipment" e
  WHERE e."name" = 'Paralelas bajas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'cd74fcd7-a3d3-51ee-ae28-5c3a4d075884')
  ON CONFLICT DO NOTHING;

-- Frog stand
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('9117cbe6-6d4c-5228-a326-fcab4fdfd390', 'Frog stand', 'Equilibrio sobre las manos con rodillas apoyadas en los codos.', 'beginner', '{core}', 'kBj1gth949w', 'How To Do Frogstand', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '9117cbe6-6d4c-5228-a326-fcab4fdfd390', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '9117cbe6-6d4c-5228-a326-fcab4fdfd390')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '9117cbe6-6d4c-5228-a326-fcab4fdfd390', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '9117cbe6-6d4c-5228-a326-fcab4fdfd390')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '9117cbe6-6d4c-5228-a326-fcab4fdfd390', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '9117cbe6-6d4c-5228-a326-fcab4fdfd390')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '9117cbe6-6d4c-5228-a326-fcab4fdfd390', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '9117cbe6-6d4c-5228-a326-fcab4fdfd390')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '9117cbe6-6d4c-5228-a326-fcab4fdfd390', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '9117cbe6-6d4c-5228-a326-fcab4fdfd390')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '9117cbe6-6d4c-5228-a326-fcab4fdfd390', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores de cadera' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '9117cbe6-6d4c-5228-a326-fcab4fdfd390')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '9117cbe6-6d4c-5228-a326-fcab4fdfd390', e."id" FROM "equipment" e
  WHERE e."name" = 'Paralelas bajas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '9117cbe6-6d4c-5228-a326-fcab4fdfd390')
  ON CONFLICT DO NOTHING;

-- Wall Handstand Hold
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('aac09ca5-88c6-5342-a5b8-ca3f6a9fbbe2', 'Wall Handstand Hold', 'Sostener la parada de manos apoyando pies en la pared.', 'intermediate', '{core}', '2v1YDTzMcO8', 'How To Do Wall Handstand Hold', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'aac09ca5-88c6-5342-a5b8-ca3f6a9fbbe2', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'aac09ca5-88c6-5342-a5b8-ca3f6a9fbbe2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'aac09ca5-88c6-5342-a5b8-ca3f6a9fbbe2', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'aac09ca5-88c6-5342-a5b8-ca3f6a9fbbe2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'aac09ca5-88c6-5342-a5b8-ca3f6a9fbbe2', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'aac09ca5-88c6-5342-a5b8-ca3f6a9fbbe2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'aac09ca5-88c6-5342-a5b8-ca3f6a9fbbe2', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'aac09ca5-88c6-5342-a5b8-ca3f6a9fbbe2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'aac09ca5-88c6-5342-a5b8-ca3f6a9fbbe2', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'aac09ca5-88c6-5342-a5b8-ca3f6a9fbbe2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'aac09ca5-88c6-5342-a5b8-ca3f6a9fbbe2', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'aac09ca5-88c6-5342-a5b8-ca3f6a9fbbe2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'aac09ca5-88c6-5342-a5b8-ca3f6a9fbbe2', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'aac09ca5-88c6-5342-a5b8-ca3f6a9fbbe2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'aac09ca5-88c6-5342-a5b8-ca3f6a9fbbe2', e."id" FROM "equipment" e
  WHERE e."name" = 'Pared' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'aac09ca5-88c6-5342-a5b8-ca3f6a9fbbe2')
  ON CONFLICT DO NOTHING;

-- Wall Walks
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('88a1ac5d-470f-5ed4-ad3a-3c7ccdf616aa', 'Wall Walks', 'Subir caminando con pies por la pared hasta parada de manos.', 'beginner', '{push}', 'wk5gF0FWQBc', 'How To Do Wall Walks', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '88a1ac5d-470f-5ed4-ad3a-3c7ccdf616aa', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '88a1ac5d-470f-5ed4-ad3a-3c7ccdf616aa')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '88a1ac5d-470f-5ed4-ad3a-3c7ccdf616aa', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '88a1ac5d-470f-5ed4-ad3a-3c7ccdf616aa')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '88a1ac5d-470f-5ed4-ad3a-3c7ccdf616aa', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '88a1ac5d-470f-5ed4-ad3a-3c7ccdf616aa')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '88a1ac5d-470f-5ed4-ad3a-3c7ccdf616aa', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '88a1ac5d-470f-5ed4-ad3a-3c7ccdf616aa')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '88a1ac5d-470f-5ed4-ad3a-3c7ccdf616aa', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '88a1ac5d-470f-5ed4-ad3a-3c7ccdf616aa')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '88a1ac5d-470f-5ed4-ad3a-3c7ccdf616aa', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '88a1ac5d-470f-5ed4-ad3a-3c7ccdf616aa')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '88a1ac5d-470f-5ed4-ad3a-3c7ccdf616aa', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '88a1ac5d-470f-5ed4-ad3a-3c7ccdf616aa')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '88a1ac5d-470f-5ed4-ad3a-3c7ccdf616aa', e."id" FROM "equipment" e
  WHERE e."name" = 'Pared' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '88a1ac5d-470f-5ed4-ad3a-3c7ccdf616aa')
  ON CONFLICT DO NOTHING;

-- Pull ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('136f1447-c8f3-5577-ad07-18d212ca9ef6', 'Pull ups', 'Tirón vertical con agarre prono hasta pasar la barbilla sobre la barra.', 'beginner', '{pull}', 'h8iSy8hl_i0', 'How To Do Pull Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '136f1447-c8f3-5577-ad07-18d212ca9ef6', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '136f1447-c8f3-5577-ad07-18d212ca9ef6')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '136f1447-c8f3-5577-ad07-18d212ca9ef6', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '136f1447-c8f3-5577-ad07-18d212ca9ef6')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '136f1447-c8f3-5577-ad07-18d212ca9ef6', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '136f1447-c8f3-5577-ad07-18d212ca9ef6')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '136f1447-c8f3-5577-ad07-18d212ca9ef6', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '136f1447-c8f3-5577-ad07-18d212ca9ef6')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '136f1447-c8f3-5577-ad07-18d212ca9ef6', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '136f1447-c8f3-5577-ad07-18d212ca9ef6')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '136f1447-c8f3-5577-ad07-18d212ca9ef6', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '136f1447-c8f3-5577-ad07-18d212ca9ef6')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '136f1447-c8f3-5577-ad07-18d212ca9ef6', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '136f1447-c8f3-5577-ad07-18d212ca9ef6')
  ON CONFLICT DO NOTHING;

-- Chin Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('1302dc2b-769a-518f-afc0-071fc180e623', 'Chin Ups', 'Dominada con agarre supino; más bíceps.', 'intermediate', '{pull}', 'S7Gg9noaZ54', 'How To Do Chin Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1302dc2b-769a-518f-afc0-071fc180e623', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1302dc2b-769a-518f-afc0-071fc180e623')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1302dc2b-769a-518f-afc0-071fc180e623', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1302dc2b-769a-518f-afc0-071fc180e623')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1302dc2b-769a-518f-afc0-071fc180e623', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1302dc2b-769a-518f-afc0-071fc180e623')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1302dc2b-769a-518f-afc0-071fc180e623', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1302dc2b-769a-518f-afc0-071fc180e623')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1302dc2b-769a-518f-afc0-071fc180e623', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1302dc2b-769a-518f-afc0-071fc180e623')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1302dc2b-769a-518f-afc0-071fc180e623', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1302dc2b-769a-518f-afc0-071fc180e623')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1302dc2b-769a-518f-afc0-071fc180e623', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1302dc2b-769a-518f-afc0-071fc180e623')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '1302dc2b-769a-518f-afc0-071fc180e623', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1302dc2b-769a-518f-afc0-071fc180e623')
  ON CONFLICT DO NOTHING;

-- Assisted Pull Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('8ecc7d11-8bbc-57ce-a152-11aa8b0a10e7', 'Assisted Pull Ups', 'Dominadas con banda para reducir peso corporal.', 'beginner', '{pull}', 'S4ssMONPZ6k', 'How To Do Assisted Pull Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '8ecc7d11-8bbc-57ce-a152-11aa8b0a10e7', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '8ecc7d11-8bbc-57ce-a152-11aa8b0a10e7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '8ecc7d11-8bbc-57ce-a152-11aa8b0a10e7', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '8ecc7d11-8bbc-57ce-a152-11aa8b0a10e7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '8ecc7d11-8bbc-57ce-a152-11aa8b0a10e7', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '8ecc7d11-8bbc-57ce-a152-11aa8b0a10e7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '8ecc7d11-8bbc-57ce-a152-11aa8b0a10e7', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '8ecc7d11-8bbc-57ce-a152-11aa8b0a10e7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '8ecc7d11-8bbc-57ce-a152-11aa8b0a10e7', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '8ecc7d11-8bbc-57ce-a152-11aa8b0a10e7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '8ecc7d11-8bbc-57ce-a152-11aa8b0a10e7', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '8ecc7d11-8bbc-57ce-a152-11aa8b0a10e7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '8ecc7d11-8bbc-57ce-a152-11aa8b0a10e7', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '8ecc7d11-8bbc-57ce-a152-11aa8b0a10e7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '8ecc7d11-8bbc-57ce-a152-11aa8b0a10e7', e."id" FROM "equipment" e
  WHERE e."name" = 'Banda elástica' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '8ecc7d11-8bbc-57ce-a152-11aa8b0a10e7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '8ecc7d11-8bbc-57ce-a152-11aa8b0a10e7', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '8ecc7d11-8bbc-57ce-a152-11aa8b0a10e7')
  ON CONFLICT DO NOTHING;

-- Negative Pull Up
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('56922e78-beba-54d2-ac80-e658ecf69953', 'Negative Pull Up', 'Descenso lento desde arriba de la barra.', 'beginner', '{pull}', '3w8Pnbl70SQ', 'How To Do Negative Pull Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '56922e78-beba-54d2-ac80-e658ecf69953', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '56922e78-beba-54d2-ac80-e658ecf69953')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '56922e78-beba-54d2-ac80-e658ecf69953', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '56922e78-beba-54d2-ac80-e658ecf69953')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '56922e78-beba-54d2-ac80-e658ecf69953', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '56922e78-beba-54d2-ac80-e658ecf69953')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '56922e78-beba-54d2-ac80-e658ecf69953', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '56922e78-beba-54d2-ac80-e658ecf69953')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '56922e78-beba-54d2-ac80-e658ecf69953', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '56922e78-beba-54d2-ac80-e658ecf69953')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '56922e78-beba-54d2-ac80-e658ecf69953', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '56922e78-beba-54d2-ac80-e658ecf69953')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '56922e78-beba-54d2-ac80-e658ecf69953', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '56922e78-beba-54d2-ac80-e658ecf69953')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '56922e78-beba-54d2-ac80-e658ecf69953', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '56922e78-beba-54d2-ac80-e658ecf69953')
  ON CONFLICT DO NOTHING;

-- Scapula Pull-Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('017bbed9-6a5b-5f6d-ae67-b4813c0e9665', 'Scapula Pull-Ups', 'Depresión y retracción escapular colgado, sin doblar codos.', 'beginner', '{pull}', 'W7bcEoXlmOg', 'How To Do Scapula Pull Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '017bbed9-6a5b-5f6d-ae67-b4813c0e9665', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '017bbed9-6a5b-5f6d-ae67-b4813c0e9665')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '017bbed9-6a5b-5f6d-ae67-b4813c0e9665', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '017bbed9-6a5b-5f6d-ae67-b4813c0e9665')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '017bbed9-6a5b-5f6d-ae67-b4813c0e9665', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '017bbed9-6a5b-5f6d-ae67-b4813c0e9665')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '017bbed9-6a5b-5f6d-ae67-b4813c0e9665', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '017bbed9-6a5b-5f6d-ae67-b4813c0e9665')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '017bbed9-6a5b-5f6d-ae67-b4813c0e9665', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '017bbed9-6a5b-5f6d-ae67-b4813c0e9665')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '017bbed9-6a5b-5f6d-ae67-b4813c0e9665', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '017bbed9-6a5b-5f6d-ae67-b4813c0e9665')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '017bbed9-6a5b-5f6d-ae67-b4813c0e9665', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Manguito rotador' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '017bbed9-6a5b-5f6d-ae67-b4813c0e9665')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '017bbed9-6a5b-5f6d-ae67-b4813c0e9665', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '017bbed9-6a5b-5f6d-ae67-b4813c0e9665')
  ON CONFLICT DO NOTHING;

-- Dead Hang
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('95cec25c-93d0-5a1f-acf7-fb54d9bcfd60', 'Dead Hang', 'Colgarse de la barra con brazos extendidos; agarre y hombros.', 'beginner', '{pull}', 'vG159HkLrhY', 'How To Do Dead Hang', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '95cec25c-93d0-5a1f-acf7-fb54d9bcfd60', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '95cec25c-93d0-5a1f-acf7-fb54d9bcfd60')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '95cec25c-93d0-5a1f-acf7-fb54d9bcfd60', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '95cec25c-93d0-5a1f-acf7-fb54d9bcfd60')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '95cec25c-93d0-5a1f-acf7-fb54d9bcfd60', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '95cec25c-93d0-5a1f-acf7-fb54d9bcfd60')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '95cec25c-93d0-5a1f-acf7-fb54d9bcfd60', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Manguito rotador' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '95cec25c-93d0-5a1f-acf7-fb54d9bcfd60')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '95cec25c-93d0-5a1f-acf7-fb54d9bcfd60', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '95cec25c-93d0-5a1f-acf7-fb54d9bcfd60')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '95cec25c-93d0-5a1f-acf7-fb54d9bcfd60', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '95cec25c-93d0-5a1f-acf7-fb54d9bcfd60')
  ON CONFLICT DO NOTHING;

-- Active Hang
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('4469e5ab-f710-50f6-a996-9dd6fdc9f476', 'Active Hang', 'Colgado con escápulas activadas y deprimidas.', 'beginner', '{pull}', '0_YZc2yuKkE', 'How To Do Active Hang', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4469e5ab-f710-50f6-a996-9dd6fdc9f476', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4469e5ab-f710-50f6-a996-9dd6fdc9f476')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4469e5ab-f710-50f6-a996-9dd6fdc9f476', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4469e5ab-f710-50f6-a996-9dd6fdc9f476')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4469e5ab-f710-50f6-a996-9dd6fdc9f476', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4469e5ab-f710-50f6-a996-9dd6fdc9f476')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4469e5ab-f710-50f6-a996-9dd6fdc9f476', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4469e5ab-f710-50f6-a996-9dd6fdc9f476')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4469e5ab-f710-50f6-a996-9dd6fdc9f476', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4469e5ab-f710-50f6-a996-9dd6fdc9f476')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4469e5ab-f710-50f6-a996-9dd6fdc9f476', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Manguito rotador' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4469e5ab-f710-50f6-a996-9dd6fdc9f476')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4469e5ab-f710-50f6-a996-9dd6fdc9f476', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4469e5ab-f710-50f6-a996-9dd6fdc9f476')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '4469e5ab-f710-50f6-a996-9dd6fdc9f476', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4469e5ab-f710-50f6-a996-9dd6fdc9f476')
  ON CONFLICT DO NOTHING;

-- Wide Pull Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('c56d4c4f-f833-5181-a3b9-191a181637a9', 'Wide Pull Ups', 'Dominada con agarre amplio; mayor énfasis en dorsales.', 'intermediate', '{pull}', 'BP5qGD4KQfI', 'How To Do Wide Pull Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'c56d4c4f-f833-5181-a3b9-191a181637a9', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c56d4c4f-f833-5181-a3b9-191a181637a9')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'c56d4c4f-f833-5181-a3b9-191a181637a9', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c56d4c4f-f833-5181-a3b9-191a181637a9')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'c56d4c4f-f833-5181-a3b9-191a181637a9', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c56d4c4f-f833-5181-a3b9-191a181637a9')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'c56d4c4f-f833-5181-a3b9-191a181637a9', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c56d4c4f-f833-5181-a3b9-191a181637a9')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'c56d4c4f-f833-5181-a3b9-191a181637a9', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c56d4c4f-f833-5181-a3b9-191a181637a9')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'c56d4c4f-f833-5181-a3b9-191a181637a9', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c56d4c4f-f833-5181-a3b9-191a181637a9')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'c56d4c4f-f833-5181-a3b9-191a181637a9', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c56d4c4f-f833-5181-a3b9-191a181637a9')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'c56d4c4f-f833-5181-a3b9-191a181637a9', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c56d4c4f-f833-5181-a3b9-191a181637a9')
  ON CONFLICT DO NOTHING;

-- Close Grip Pull ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('426c4161-a63f-5956-acae-b94f20422846', 'Close Grip Pull ups', 'Dominada con manos juntas.', 'intermediate', '{pull}', 'kNJZt0atC5Q', 'How To Do Close Grip Pull Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '426c4161-a63f-5956-acae-b94f20422846', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '426c4161-a63f-5956-acae-b94f20422846')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '426c4161-a63f-5956-acae-b94f20422846', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '426c4161-a63f-5956-acae-b94f20422846')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '426c4161-a63f-5956-acae-b94f20422846', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '426c4161-a63f-5956-acae-b94f20422846')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '426c4161-a63f-5956-acae-b94f20422846', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '426c4161-a63f-5956-acae-b94f20422846')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '426c4161-a63f-5956-acae-b94f20422846', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '426c4161-a63f-5956-acae-b94f20422846')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '426c4161-a63f-5956-acae-b94f20422846', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '426c4161-a63f-5956-acae-b94f20422846')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '426c4161-a63f-5956-acae-b94f20422846', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '426c4161-a63f-5956-acae-b94f20422846')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '426c4161-a63f-5956-acae-b94f20422846', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '426c4161-a63f-5956-acae-b94f20422846')
  ON CONFLICT DO NOTHING;

-- Commando Pull Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('4c77e1d4-d7a6-5d88-aebb-18f45359d270', 'Commando Pull Ups', 'Dominada con agarre alterno llevando la cabeza a cada lado de la barra.', 'advanced', '{pull}', '417O4VGusNU', 'How To Do Commando Pull Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4c77e1d4-d7a6-5d88-aebb-18f45359d270', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4c77e1d4-d7a6-5d88-aebb-18f45359d270')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4c77e1d4-d7a6-5d88-aebb-18f45359d270', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4c77e1d4-d7a6-5d88-aebb-18f45359d270')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4c77e1d4-d7a6-5d88-aebb-18f45359d270', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4c77e1d4-d7a6-5d88-aebb-18f45359d270')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4c77e1d4-d7a6-5d88-aebb-18f45359d270', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Oblicuo externo' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4c77e1d4-d7a6-5d88-aebb-18f45359d270')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4c77e1d4-d7a6-5d88-aebb-18f45359d270', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4c77e1d4-d7a6-5d88-aebb-18f45359d270')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4c77e1d4-d7a6-5d88-aebb-18f45359d270', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4c77e1d4-d7a6-5d88-aebb-18f45359d270')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4c77e1d4-d7a6-5d88-aebb-18f45359d270', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4c77e1d4-d7a6-5d88-aebb-18f45359d270')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4c77e1d4-d7a6-5d88-aebb-18f45359d270', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4c77e1d4-d7a6-5d88-aebb-18f45359d270')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '4c77e1d4-d7a6-5d88-aebb-18f45359d270', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4c77e1d4-d7a6-5d88-aebb-18f45359d270')
  ON CONFLICT DO NOTHING;

-- Explosive Pull Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('f5628fac-cb7b-58be-a38e-5119fcbda1ca', 'Explosive Pull Ups', 'Dominada con subida rápida y potente.', 'intermediate', '{pull}', '7VHPDTRUkaU', 'How To Do Explosive Pull Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f5628fac-cb7b-58be-a38e-5119fcbda1ca', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f5628fac-cb7b-58be-a38e-5119fcbda1ca')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f5628fac-cb7b-58be-a38e-5119fcbda1ca', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f5628fac-cb7b-58be-a38e-5119fcbda1ca')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f5628fac-cb7b-58be-a38e-5119fcbda1ca', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f5628fac-cb7b-58be-a38e-5119fcbda1ca')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f5628fac-cb7b-58be-a38e-5119fcbda1ca', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f5628fac-cb7b-58be-a38e-5119fcbda1ca')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f5628fac-cb7b-58be-a38e-5119fcbda1ca', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f5628fac-cb7b-58be-a38e-5119fcbda1ca')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f5628fac-cb7b-58be-a38e-5119fcbda1ca', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f5628fac-cb7b-58be-a38e-5119fcbda1ca')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f5628fac-cb7b-58be-a38e-5119fcbda1ca', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f5628fac-cb7b-58be-a38e-5119fcbda1ca')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'f5628fac-cb7b-58be-a38e-5119fcbda1ca', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f5628fac-cb7b-58be-a38e-5119fcbda1ca')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'f5628fac-cb7b-58be-a38e-5119fcbda1ca', e."id" FROM "equipment" e
  WHERE e."name" = 'Caja / Step' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f5628fac-cb7b-58be-a38e-5119fcbda1ca')
  ON CONFLICT DO NOTHING;

-- High Pull Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('a5e33e59-1e5d-50cf-a925-7e2688eb72b5', 'High Pull Ups', 'Dominada explosiva llevando la barra al pecho bajo; hacia muscle up.', 'advanced', '{pull}', 'sa38UPXqgPo', 'How To Do High Pull Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a5e33e59-1e5d-50cf-a925-7e2688eb72b5', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a5e33e59-1e5d-50cf-a925-7e2688eb72b5')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a5e33e59-1e5d-50cf-a925-7e2688eb72b5', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a5e33e59-1e5d-50cf-a925-7e2688eb72b5')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a5e33e59-1e5d-50cf-a925-7e2688eb72b5', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a5e33e59-1e5d-50cf-a925-7e2688eb72b5')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a5e33e59-1e5d-50cf-a925-7e2688eb72b5', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a5e33e59-1e5d-50cf-a925-7e2688eb72b5')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a5e33e59-1e5d-50cf-a925-7e2688eb72b5', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a5e33e59-1e5d-50cf-a925-7e2688eb72b5')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a5e33e59-1e5d-50cf-a925-7e2688eb72b5', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a5e33e59-1e5d-50cf-a925-7e2688eb72b5')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a5e33e59-1e5d-50cf-a925-7e2688eb72b5', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a5e33e59-1e5d-50cf-a925-7e2688eb72b5')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'a5e33e59-1e5d-50cf-a925-7e2688eb72b5', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a5e33e59-1e5d-50cf-a925-7e2688eb72b5')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'a5e33e59-1e5d-50cf-a925-7e2688eb72b5', e."id" FROM "equipment" e
  WHERE e."name" = 'Caja / Step' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a5e33e59-1e5d-50cf-a925-7e2688eb72b5')
  ON CONFLICT DO NOTHING;

-- Weighted Pull Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('56e21a4e-291c-5758-a516-7dd423d9a518', 'Weighted Pull Ups', 'Dominadas con lastre añadido.', 'advanced', '{pull}', 'k9bGWaitSc0', 'How To Do Weighted Pull Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '56e21a4e-291c-5758-a516-7dd423d9a518', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '56e21a4e-291c-5758-a516-7dd423d9a518')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '56e21a4e-291c-5758-a516-7dd423d9a518', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '56e21a4e-291c-5758-a516-7dd423d9a518')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '56e21a4e-291c-5758-a516-7dd423d9a518', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '56e21a4e-291c-5758-a516-7dd423d9a518')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '56e21a4e-291c-5758-a516-7dd423d9a518', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '56e21a4e-291c-5758-a516-7dd423d9a518')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '56e21a4e-291c-5758-a516-7dd423d9a518', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '56e21a4e-291c-5758-a516-7dd423d9a518')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '56e21a4e-291c-5758-a516-7dd423d9a518', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '56e21a4e-291c-5758-a516-7dd423d9a518')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '56e21a4e-291c-5758-a516-7dd423d9a518', e."id" FROM "equipment" e
  WHERE e."name" = 'Cinturón de lastre' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '56e21a4e-291c-5758-a516-7dd423d9a518')
  ON CONFLICT DO NOTHING;

-- Weighted Chin Ups
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('8e554aa8-3a43-57fe-ab85-db92922bfae4', 'Weighted Chin Ups', 'Dominadas supinas con lastre.', 'advanced', '{pull}', '6kXRno8A_HE', 'How To Do Weighted Chin Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '8e554aa8-3a43-57fe-ab85-db92922bfae4', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '8e554aa8-3a43-57fe-ab85-db92922bfae4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '8e554aa8-3a43-57fe-ab85-db92922bfae4', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '8e554aa8-3a43-57fe-ab85-db92922bfae4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '8e554aa8-3a43-57fe-ab85-db92922bfae4', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '8e554aa8-3a43-57fe-ab85-db92922bfae4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '8e554aa8-3a43-57fe-ab85-db92922bfae4', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '8e554aa8-3a43-57fe-ab85-db92922bfae4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '8e554aa8-3a43-57fe-ab85-db92922bfae4', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '8e554aa8-3a43-57fe-ab85-db92922bfae4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '8e554aa8-3a43-57fe-ab85-db92922bfae4', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '8e554aa8-3a43-57fe-ab85-db92922bfae4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '8e554aa8-3a43-57fe-ab85-db92922bfae4', e."id" FROM "equipment" e
  WHERE e."name" = 'Cinturón de lastre' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '8e554aa8-3a43-57fe-ab85-db92922bfae4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '8e554aa8-3a43-57fe-ab85-db92922bfae4', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '8e554aa8-3a43-57fe-ab85-db92922bfae4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '8e554aa8-3a43-57fe-ab85-db92922bfae4', e."id" FROM "equipment" e
  WHERE e."name" = 'Caja / Step' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '8e554aa8-3a43-57fe-ab85-db92922bfae4')
  ON CONFLICT DO NOTHING;

-- Pull Up Top Hold
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('a74e698b-1d47-5086-ae9f-68ec0c0fa4f7', 'Pull Up Top Hold', 'Mantener la barbilla sobre la barra.', 'intermediate', '{pull}', 'CIJx_HfIh6E', 'How To Do Pull Up Top Hold', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a74e698b-1d47-5086-ae9f-68ec0c0fa4f7', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a74e698b-1d47-5086-ae9f-68ec0c0fa4f7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a74e698b-1d47-5086-ae9f-68ec0c0fa4f7', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a74e698b-1d47-5086-ae9f-68ec0c0fa4f7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a74e698b-1d47-5086-ae9f-68ec0c0fa4f7', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a74e698b-1d47-5086-ae9f-68ec0c0fa4f7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a74e698b-1d47-5086-ae9f-68ec0c0fa4f7', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a74e698b-1d47-5086-ae9f-68ec0c0fa4f7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a74e698b-1d47-5086-ae9f-68ec0c0fa4f7', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a74e698b-1d47-5086-ae9f-68ec0c0fa4f7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a74e698b-1d47-5086-ae9f-68ec0c0fa4f7', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a74e698b-1d47-5086-ae9f-68ec0c0fa4f7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a74e698b-1d47-5086-ae9f-68ec0c0fa4f7', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a74e698b-1d47-5086-ae9f-68ec0c0fa4f7')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'a74e698b-1d47-5086-ae9f-68ec0c0fa4f7', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a74e698b-1d47-5086-ae9f-68ec0c0fa4f7')
  ON CONFLICT DO NOTHING;

-- 90 Degree Pull Up Hold
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('d8987f0f-7189-5440-a9eb-c323a5ad2f09', '90 Degree Pull Up Hold', 'Mantener la dominada con codos a 90 grados.', 'advanced', '{pull}', 'TccYl5G-gUQ', 'How To Do 90 Degree Pull Up Hold', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'd8987f0f-7189-5440-a9eb-c323a5ad2f09', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'd8987f0f-7189-5440-a9eb-c323a5ad2f09')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'd8987f0f-7189-5440-a9eb-c323a5ad2f09', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'd8987f0f-7189-5440-a9eb-c323a5ad2f09')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'd8987f0f-7189-5440-a9eb-c323a5ad2f09', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'd8987f0f-7189-5440-a9eb-c323a5ad2f09')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'd8987f0f-7189-5440-a9eb-c323a5ad2f09', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'd8987f0f-7189-5440-a9eb-c323a5ad2f09')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'd8987f0f-7189-5440-a9eb-c323a5ad2f09', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'd8987f0f-7189-5440-a9eb-c323a5ad2f09')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'd8987f0f-7189-5440-a9eb-c323a5ad2f09', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'd8987f0f-7189-5440-a9eb-c323a5ad2f09')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'd8987f0f-7189-5440-a9eb-c323a5ad2f09', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'd8987f0f-7189-5440-a9eb-c323a5ad2f09')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'd8987f0f-7189-5440-a9eb-c323a5ad2f09', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'd8987f0f-7189-5440-a9eb-c323a5ad2f09')
  ON CONFLICT DO NOTHING;

-- Bodyweight Rows / Australian Rows
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('fd189f7f-eb76-5ddb-a31a-a57c04c99258', 'Bodyweight Rows / Australian Rows', 'Remo con cuerpo inclinado bajo una barra o anillas.', 'beginner', '{pull}', '6Ej6xG7fOO0', 'How To Do Bodyweight Rows / Australian Rows', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'fd189f7f-eb76-5ddb-a31a-a57c04c99258', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'fd189f7f-eb76-5ddb-a31a-a57c04c99258')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'fd189f7f-eb76-5ddb-a31a-a57c04c99258', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'fd189f7f-eb76-5ddb-a31a-a57c04c99258')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'fd189f7f-eb76-5ddb-a31a-a57c04c99258', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'fd189f7f-eb76-5ddb-a31a-a57c04c99258')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'fd189f7f-eb76-5ddb-a31a-a57c04c99258', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'fd189f7f-eb76-5ddb-a31a-a57c04c99258')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'fd189f7f-eb76-5ddb-a31a-a57c04c99258', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'fd189f7f-eb76-5ddb-a31a-a57c04c99258')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'fd189f7f-eb76-5ddb-a31a-a57c04c99258', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'fd189f7f-eb76-5ddb-a31a-a57c04c99258')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'fd189f7f-eb76-5ddb-a31a-a57c04c99258', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'fd189f7f-eb76-5ddb-a31a-a57c04c99258')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'fd189f7f-eb76-5ddb-a31a-a57c04c99258', e."id" FROM "equipment" e
  WHERE e."name" = 'Paralelas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'fd189f7f-eb76-5ddb-a31a-a57c04c99258')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'fd189f7f-eb76-5ddb-a31a-a57c04c99258', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra baja' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'fd189f7f-eb76-5ddb-a31a-a57c04c99258')
  ON CONFLICT DO NOTHING;

-- Bodyweight Incline Rows
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('081e043d-6d65-5cde-ab6e-693763797917', 'Bodyweight Incline Rows', 'Remo con cuerpo más vertical para reducir carga.', 'beginner', '{pull}', '4Ww59oqo4ZY', 'How To Do Incline Bodyweight Rows / Australian Pull Ups', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '081e043d-6d65-5cde-ab6e-693763797917', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '081e043d-6d65-5cde-ab6e-693763797917')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '081e043d-6d65-5cde-ab6e-693763797917', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '081e043d-6d65-5cde-ab6e-693763797917')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '081e043d-6d65-5cde-ab6e-693763797917', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '081e043d-6d65-5cde-ab6e-693763797917')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '081e043d-6d65-5cde-ab6e-693763797917', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '081e043d-6d65-5cde-ab6e-693763797917')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '081e043d-6d65-5cde-ab6e-693763797917', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '081e043d-6d65-5cde-ab6e-693763797917')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '081e043d-6d65-5cde-ab6e-693763797917', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '081e043d-6d65-5cde-ab6e-693763797917')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '081e043d-6d65-5cde-ab6e-693763797917', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '081e043d-6d65-5cde-ab6e-693763797917')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '081e043d-6d65-5cde-ab6e-693763797917', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '081e043d-6d65-5cde-ab6e-693763797917')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '081e043d-6d65-5cde-ab6e-693763797917', e."id" FROM "equipment" e
  WHERE e."name" = 'Anillas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '081e043d-6d65-5cde-ab6e-693763797917')
  ON CONFLICT DO NOTHING;

-- Scapula Rows
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('a623ba2b-a2be-52bc-af7a-4aead6f5e120', 'Scapula Rows', 'Retracción escapular en posición de remo sin doblar codos.', 'beginner', '{pull}', 'U_GKYVeHEgo', 'How To Do Scapula Rows', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a623ba2b-a2be-52bc-af7a-4aead6f5e120', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a623ba2b-a2be-52bc-af7a-4aead6f5e120')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a623ba2b-a2be-52bc-af7a-4aead6f5e120', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a623ba2b-a2be-52bc-af7a-4aead6f5e120')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a623ba2b-a2be-52bc-af7a-4aead6f5e120', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a623ba2b-a2be-52bc-af7a-4aead6f5e120')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a623ba2b-a2be-52bc-af7a-4aead6f5e120', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a623ba2b-a2be-52bc-af7a-4aead6f5e120')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a623ba2b-a2be-52bc-af7a-4aead6f5e120', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a623ba2b-a2be-52bc-af7a-4aead6f5e120')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a623ba2b-a2be-52bc-af7a-4aead6f5e120', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a623ba2b-a2be-52bc-af7a-4aead6f5e120')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'a623ba2b-a2be-52bc-af7a-4aead6f5e120', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a623ba2b-a2be-52bc-af7a-4aead6f5e120')
  ON CONFLICT DO NOTHING;

-- Weighted Ring Rows
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('a305bd9c-e57e-5984-ae7c-3cdc596c5079', 'Weighted Ring Rows', 'Remo en anillas con lastre.', 'intermediate', '{pull}', 'k31j_yP3yiY', 'How To Do Weighted Ring Rows', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a305bd9c-e57e-5984-ae7c-3cdc596c5079', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a305bd9c-e57e-5984-ae7c-3cdc596c5079')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a305bd9c-e57e-5984-ae7c-3cdc596c5079', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a305bd9c-e57e-5984-ae7c-3cdc596c5079')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a305bd9c-e57e-5984-ae7c-3cdc596c5079', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a305bd9c-e57e-5984-ae7c-3cdc596c5079')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a305bd9c-e57e-5984-ae7c-3cdc596c5079', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a305bd9c-e57e-5984-ae7c-3cdc596c5079')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a305bd9c-e57e-5984-ae7c-3cdc596c5079', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a305bd9c-e57e-5984-ae7c-3cdc596c5079')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a305bd9c-e57e-5984-ae7c-3cdc596c5079', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a305bd9c-e57e-5984-ae7c-3cdc596c5079')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a305bd9c-e57e-5984-ae7c-3cdc596c5079', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Erector espinal' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a305bd9c-e57e-5984-ae7c-3cdc596c5079')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a305bd9c-e57e-5984-ae7c-3cdc596c5079', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a305bd9c-e57e-5984-ae7c-3cdc596c5079')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a305bd9c-e57e-5984-ae7c-3cdc596c5079', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a305bd9c-e57e-5984-ae7c-3cdc596c5079')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a305bd9c-e57e-5984-ae7c-3cdc596c5079', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Isquiotibiales' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a305bd9c-e57e-5984-ae7c-3cdc596c5079')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'a305bd9c-e57e-5984-ae7c-3cdc596c5079', e."id" FROM "equipment" e
  WHERE e."name" = 'Anillas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a305bd9c-e57e-5984-ae7c-3cdc596c5079')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'a305bd9c-e57e-5984-ae7c-3cdc596c5079', e."id" FROM "equipment" e
  WHERE e."name" = 'Cinturón de lastre' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a305bd9c-e57e-5984-ae7c-3cdc596c5079')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'a305bd9c-e57e-5984-ae7c-3cdc596c5079', e."id" FROM "equipment" e
  WHERE e."name" = 'Banco' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a305bd9c-e57e-5984-ae7c-3cdc596c5079')
  ON CONFLICT DO NOTHING;

-- Face Pull In Rings
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('04f266e1-7283-5eae-af1d-bf650fc55c0f', 'Face Pull In Rings', 'Tirón hacia la cara en anillas; deltoide posterior y manguito rotador.', 'intermediate', '{pull}', 'XlzHTUEsz20', 'How To Do Face Pulls', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '04f266e1-7283-5eae-af1d-bf650fc55c0f', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '04f266e1-7283-5eae-af1d-bf650fc55c0f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '04f266e1-7283-5eae-af1d-bf650fc55c0f', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '04f266e1-7283-5eae-af1d-bf650fc55c0f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '04f266e1-7283-5eae-af1d-bf650fc55c0f', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Manguito rotador' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '04f266e1-7283-5eae-af1d-bf650fc55c0f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '04f266e1-7283-5eae-af1d-bf650fc55c0f', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '04f266e1-7283-5eae-af1d-bf650fc55c0f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '04f266e1-7283-5eae-af1d-bf650fc55c0f', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '04f266e1-7283-5eae-af1d-bf650fc55c0f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '04f266e1-7283-5eae-af1d-bf650fc55c0f', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '04f266e1-7283-5eae-af1d-bf650fc55c0f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '04f266e1-7283-5eae-af1d-bf650fc55c0f', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '04f266e1-7283-5eae-af1d-bf650fc55c0f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '04f266e1-7283-5eae-af1d-bf650fc55c0f', e."id" FROM "equipment" e
  WHERE e."name" = 'Anillas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '04f266e1-7283-5eae-af1d-bf650fc55c0f')
  ON CONFLICT DO NOTHING;

-- Ring Biceps Curl
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('e5ab78f3-924e-5b69-a004-6c7013139fd4', 'Ring Biceps Curl', 'Curl con peso corporal en anillas.', 'beginner', '{pull}', 's9gkrO9f_Gg', 'How To Do Ring Biceps Curl', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'e5ab78f3-924e-5b69-a004-6c7013139fd4', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e5ab78f3-924e-5b69-a004-6c7013139fd4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'e5ab78f3-924e-5b69-a004-6c7013139fd4', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e5ab78f3-924e-5b69-a004-6c7013139fd4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'e5ab78f3-924e-5b69-a004-6c7013139fd4', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e5ab78f3-924e-5b69-a004-6c7013139fd4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'e5ab78f3-924e-5b69-a004-6c7013139fd4', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e5ab78f3-924e-5b69-a004-6c7013139fd4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'e5ab78f3-924e-5b69-a004-6c7013139fd4', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e5ab78f3-924e-5b69-a004-6c7013139fd4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'e5ab78f3-924e-5b69-a004-6c7013139fd4', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Erector espinal' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e5ab78f3-924e-5b69-a004-6c7013139fd4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'e5ab78f3-924e-5b69-a004-6c7013139fd4', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e5ab78f3-924e-5b69-a004-6c7013139fd4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'e5ab78f3-924e-5b69-a004-6c7013139fd4', e."id" FROM "equipment" e
  WHERE e."name" = 'Anillas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e5ab78f3-924e-5b69-a004-6c7013139fd4')
  ON CONFLICT DO NOTHING;

-- Ring Triceps Extension
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('b37d8b2a-9274-56ca-ac41-e64f1e207d22', 'Ring Triceps Extension', 'Extensión de codos en anillas con peso corporal.', 'intermediate', '{push}', 'MK6h_OCJuWI', 'How To Do Ring Triceps Extension', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b37d8b2a-9274-56ca-ac41-e64f1e207d22', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b37d8b2a-9274-56ca-ac41-e64f1e207d22')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b37d8b2a-9274-56ca-ac41-e64f1e207d22', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b37d8b2a-9274-56ca-ac41-e64f1e207d22')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b37d8b2a-9274-56ca-ac41-e64f1e207d22', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Oblicuo externo' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b37d8b2a-9274-56ca-ac41-e64f1e207d22')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b37d8b2a-9274-56ca-ac41-e64f1e207d22', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b37d8b2a-9274-56ca-ac41-e64f1e207d22')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b37d8b2a-9274-56ca-ac41-e64f1e207d22', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b37d8b2a-9274-56ca-ac41-e64f1e207d22')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b37d8b2a-9274-56ca-ac41-e64f1e207d22', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b37d8b2a-9274-56ca-ac41-e64f1e207d22')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'b37d8b2a-9274-56ca-ac41-e64f1e207d22', e."id" FROM "equipment" e
  WHERE e."name" = 'Anillas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b37d8b2a-9274-56ca-ac41-e64f1e207d22')
  ON CONFLICT DO NOTHING;

-- False Grip Hang
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('6b65aaf8-6249-5eb1-ae64-3184c7d43393', 'False Grip Hang', 'Colgado con muñeca sobre la barra; preparación para muscle up.', 'beginner', '{pull}', 'tsgIPpuzQg4', 'How To Do False Grip Hang', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '6b65aaf8-6249-5eb1-ae64-3184c7d43393', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '6b65aaf8-6249-5eb1-ae64-3184c7d43393')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '6b65aaf8-6249-5eb1-ae64-3184c7d43393', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '6b65aaf8-6249-5eb1-ae64-3184c7d43393')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '6b65aaf8-6249-5eb1-ae64-3184c7d43393', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '6b65aaf8-6249-5eb1-ae64-3184c7d43393')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '6b65aaf8-6249-5eb1-ae64-3184c7d43393', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '6b65aaf8-6249-5eb1-ae64-3184c7d43393')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '6b65aaf8-6249-5eb1-ae64-3184c7d43393', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '6b65aaf8-6249-5eb1-ae64-3184c7d43393')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '6b65aaf8-6249-5eb1-ae64-3184c7d43393', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '6b65aaf8-6249-5eb1-ae64-3184c7d43393')
  ON CONFLICT DO NOTHING;

-- Ring Muscle Up Transition
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('ae9e8fad-8590-5923-a4f3-12f60029f290', 'Ring Muscle Up Transition', 'Practicar el paso de tirón a empuje en anillas bajas.', 'beginner', '{pull}', 'Uwa5eGV7X30', 'How To Do Ring Muscle Up Transition', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'ae9e8fad-8590-5923-a4f3-12f60029f290', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ae9e8fad-8590-5923-a4f3-12f60029f290')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'ae9e8fad-8590-5923-a4f3-12f60029f290', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ae9e8fad-8590-5923-a4f3-12f60029f290')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'ae9e8fad-8590-5923-a4f3-12f60029f290', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ae9e8fad-8590-5923-a4f3-12f60029f290')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'ae9e8fad-8590-5923-a4f3-12f60029f290', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ae9e8fad-8590-5923-a4f3-12f60029f290')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'ae9e8fad-8590-5923-a4f3-12f60029f290', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ae9e8fad-8590-5923-a4f3-12f60029f290')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'ae9e8fad-8590-5923-a4f3-12f60029f290', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ae9e8fad-8590-5923-a4f3-12f60029f290')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'ae9e8fad-8590-5923-a4f3-12f60029f290', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ae9e8fad-8590-5923-a4f3-12f60029f290')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'ae9e8fad-8590-5923-a4f3-12f60029f290', e."id" FROM "equipment" e
  WHERE e."name" = 'Anillas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ae9e8fad-8590-5923-a4f3-12f60029f290')
  ON CONFLICT DO NOTHING;

-- Negative Ring Muscle Up
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('77561d4d-3057-5c35-a2b5-51c064553a1f', 'Negative Ring Muscle Up', 'Descenso controlado del muscle up en anillas.', 'intermediate', '{core}', 'DqYHpRaS0NA', 'How To Do Negative Ring Muscle Up', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '77561d4d-3057-5c35-a2b5-51c064553a1f', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '77561d4d-3057-5c35-a2b5-51c064553a1f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '77561d4d-3057-5c35-a2b5-51c064553a1f', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '77561d4d-3057-5c35-a2b5-51c064553a1f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '77561d4d-3057-5c35-a2b5-51c064553a1f', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '77561d4d-3057-5c35-a2b5-51c064553a1f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '77561d4d-3057-5c35-a2b5-51c064553a1f', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '77561d4d-3057-5c35-a2b5-51c064553a1f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '77561d4d-3057-5c35-a2b5-51c064553a1f', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '77561d4d-3057-5c35-a2b5-51c064553a1f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '77561d4d-3057-5c35-a2b5-51c064553a1f', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '77561d4d-3057-5c35-a2b5-51c064553a1f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '77561d4d-3057-5c35-a2b5-51c064553a1f', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '77561d4d-3057-5c35-a2b5-51c064553a1f')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '77561d4d-3057-5c35-a2b5-51c064553a1f', e."id" FROM "equipment" e
  WHERE e."name" = 'Anillas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '77561d4d-3057-5c35-a2b5-51c064553a1f')
  ON CONFLICT DO NOTHING;

-- Band Assisted Ring Muscle Up
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('a913aa3c-b637-5234-a9f4-b936f71cdb20', 'Band Assisted Ring Muscle Up', 'Muscle up en anillas con ayuda de banda.', 'intermediate', '{core}', 'JXEcPt4RuQo', 'How To Do Band Assisted Ring Muscle Up', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a913aa3c-b637-5234-a9f4-b936f71cdb20', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a913aa3c-b637-5234-a9f4-b936f71cdb20')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a913aa3c-b637-5234-a9f4-b936f71cdb20', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a913aa3c-b637-5234-a9f4-b936f71cdb20')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a913aa3c-b637-5234-a9f4-b936f71cdb20', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a913aa3c-b637-5234-a9f4-b936f71cdb20')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a913aa3c-b637-5234-a9f4-b936f71cdb20', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a913aa3c-b637-5234-a9f4-b936f71cdb20')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a913aa3c-b637-5234-a9f4-b936f71cdb20', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a913aa3c-b637-5234-a9f4-b936f71cdb20')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a913aa3c-b637-5234-a9f4-b936f71cdb20', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a913aa3c-b637-5234-a9f4-b936f71cdb20')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a913aa3c-b637-5234-a9f4-b936f71cdb20', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a913aa3c-b637-5234-a9f4-b936f71cdb20')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a913aa3c-b637-5234-a9f4-b936f71cdb20', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a913aa3c-b637-5234-a9f4-b936f71cdb20')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'a913aa3c-b637-5234-a9f4-b936f71cdb20', e."id" FROM "equipment" e
  WHERE e."name" = 'Anillas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a913aa3c-b637-5234-a9f4-b936f71cdb20')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'a913aa3c-b637-5234-a9f4-b936f71cdb20', e."id" FROM "equipment" e
  WHERE e."name" = 'Banda elástica' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a913aa3c-b637-5234-a9f4-b936f71cdb20')
  ON CONFLICT DO NOTHING;

-- Pull Over
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('667f7528-07bc-5fe0-ae24-17176f49f4e2', 'Pull Over', 'Tirón que lleva la cadera por encima de la barra hasta soporte.', 'advanced', '{pull}', 'SnnpKtrz14c', 'How To Do Pull Over', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '667f7528-07bc-5fe0-ae24-17176f49f4e2', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '667f7528-07bc-5fe0-ae24-17176f49f4e2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '667f7528-07bc-5fe0-ae24-17176f49f4e2', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '667f7528-07bc-5fe0-ae24-17176f49f4e2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '667f7528-07bc-5fe0-ae24-17176f49f4e2', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores de cadera' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '667f7528-07bc-5fe0-ae24-17176f49f4e2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '667f7528-07bc-5fe0-ae24-17176f49f4e2', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '667f7528-07bc-5fe0-ae24-17176f49f4e2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '667f7528-07bc-5fe0-ae24-17176f49f4e2', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '667f7528-07bc-5fe0-ae24-17176f49f4e2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '667f7528-07bc-5fe0-ae24-17176f49f4e2', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '667f7528-07bc-5fe0-ae24-17176f49f4e2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '667f7528-07bc-5fe0-ae24-17176f49f4e2', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '667f7528-07bc-5fe0-ae24-17176f49f4e2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '667f7528-07bc-5fe0-ae24-17176f49f4e2', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '667f7528-07bc-5fe0-ae24-17176f49f4e2')
  ON CONFLICT DO NOTHING;

-- Advanced Tuck Front Lever
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('4715df61-ebc2-50a1-a008-f6e703703ca1', 'Advanced Tuck Front Lever', 'Front lever con espalda plana y rodillas flexionadas.', 'intermediate', '{pull}', 'foJ5wVhF7hc', 'How To Do Advanced Tuck Front Lever', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4715df61-ebc2-50a1-a008-f6e703703ca1', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4715df61-ebc2-50a1-a008-f6e703703ca1')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4715df61-ebc2-50a1-a008-f6e703703ca1', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4715df61-ebc2-50a1-a008-f6e703703ca1')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4715df61-ebc2-50a1-a008-f6e703703ca1', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4715df61-ebc2-50a1-a008-f6e703703ca1')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4715df61-ebc2-50a1-a008-f6e703703ca1', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4715df61-ebc2-50a1-a008-f6e703703ca1')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4715df61-ebc2-50a1-a008-f6e703703ca1', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4715df61-ebc2-50a1-a008-f6e703703ca1')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4715df61-ebc2-50a1-a008-f6e703703ca1', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores de cadera' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4715df61-ebc2-50a1-a008-f6e703703ca1')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '4715df61-ebc2-50a1-a008-f6e703703ca1', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4715df61-ebc2-50a1-a008-f6e703703ca1')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '4715df61-ebc2-50a1-a008-f6e703703ca1', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '4715df61-ebc2-50a1-a008-f6e703703ca1')
  ON CONFLICT DO NOTHING;

-- Halflay Front Lever
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('21803403-6caf-5739-aff4-297208202e76', 'Halflay Front Lever', 'Front lever con piernas a media extensión.', 'advanced', '{pull}', 'ty8y7VMSnRI', 'How To Do Halflay Front Lever', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '21803403-6caf-5739-aff4-297208202e76', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '21803403-6caf-5739-aff4-297208202e76')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '21803403-6caf-5739-aff4-297208202e76', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '21803403-6caf-5739-aff4-297208202e76')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '21803403-6caf-5739-aff4-297208202e76', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '21803403-6caf-5739-aff4-297208202e76')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '21803403-6caf-5739-aff4-297208202e76', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '21803403-6caf-5739-aff4-297208202e76')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '21803403-6caf-5739-aff4-297208202e76', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Isquiotibiales' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '21803403-6caf-5739-aff4-297208202e76')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '21803403-6caf-5739-aff4-297208202e76', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '21803403-6caf-5739-aff4-297208202e76')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '21803403-6caf-5739-aff4-297208202e76', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '21803403-6caf-5739-aff4-297208202e76')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '21803403-6caf-5739-aff4-297208202e76', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '21803403-6caf-5739-aff4-297208202e76')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '21803403-6caf-5739-aff4-297208202e76', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '21803403-6caf-5739-aff4-297208202e76')
  ON CONFLICT DO NOTHING;

-- Assisted Front Lever
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('b0479acf-f941-5dfa-a6c9-4221fcb869ad', 'Assisted Front Lever', 'Front lever con banda de resistencia.', 'advanced', '{pull}', 'ErmDE9DNI3c', 'How To Do Assisted Front Lever', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b0479acf-f941-5dfa-a6c9-4221fcb869ad', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b0479acf-f941-5dfa-a6c9-4221fcb869ad')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b0479acf-f941-5dfa-a6c9-4221fcb869ad', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b0479acf-f941-5dfa-a6c9-4221fcb869ad')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b0479acf-f941-5dfa-a6c9-4221fcb869ad', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b0479acf-f941-5dfa-a6c9-4221fcb869ad')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b0479acf-f941-5dfa-a6c9-4221fcb869ad', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b0479acf-f941-5dfa-a6c9-4221fcb869ad')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b0479acf-f941-5dfa-a6c9-4221fcb869ad', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b0479acf-f941-5dfa-a6c9-4221fcb869ad')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b0479acf-f941-5dfa-a6c9-4221fcb869ad', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b0479acf-f941-5dfa-a6c9-4221fcb869ad')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b0479acf-f941-5dfa-a6c9-4221fcb869ad', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b0479acf-f941-5dfa-a6c9-4221fcb869ad')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'b0479acf-f941-5dfa-a6c9-4221fcb869ad', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b0479acf-f941-5dfa-a6c9-4221fcb869ad')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'b0479acf-f941-5dfa-a6c9-4221fcb869ad', e."id" FROM "equipment" e
  WHERE e."name" = 'Banda elástica' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b0479acf-f941-5dfa-a6c9-4221fcb869ad')
  ON CONFLICT DO NOTHING;

-- German Hang
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('1bcfc4c2-929c-502f-a2b6-4056914d4881', 'German Hang', 'Colgado con hombros en extensión profunda tras pasar las piernas.', 'advanced', '{pull}', 'v65qjfCG6es', 'How To Do German Hang', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1bcfc4c2-929c-502f-a2b6-4056914d4881', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1bcfc4c2-929c-502f-a2b6-4056914d4881')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1bcfc4c2-929c-502f-a2b6-4056914d4881', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1bcfc4c2-929c-502f-a2b6-4056914d4881')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1bcfc4c2-929c-502f-a2b6-4056914d4881', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1bcfc4c2-929c-502f-a2b6-4056914d4881')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1bcfc4c2-929c-502f-a2b6-4056914d4881', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1bcfc4c2-929c-502f-a2b6-4056914d4881')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1bcfc4c2-929c-502f-a2b6-4056914d4881', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1bcfc4c2-929c-502f-a2b6-4056914d4881')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1bcfc4c2-929c-502f-a2b6-4056914d4881', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1bcfc4c2-929c-502f-a2b6-4056914d4881')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1bcfc4c2-929c-502f-a2b6-4056914d4881', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1bcfc4c2-929c-502f-a2b6-4056914d4881')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1bcfc4c2-929c-502f-a2b6-4056914d4881', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1bcfc4c2-929c-502f-a2b6-4056914d4881')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '1bcfc4c2-929c-502f-a2b6-4056914d4881', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1bcfc4c2-929c-502f-a2b6-4056914d4881')
  ON CONFLICT DO NOTHING;

-- Skin The Cat
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('ee784afd-dd84-5d64-a13a-f191cfd10902', 'Skin The Cat', 'Rotación completa pasando las piernas entre los brazos colgado.', 'advanced', '{core}', 'kMSNap6xBqo', 'How To Do Skin The Cat', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'ee784afd-dd84-5d64-a13a-f191cfd10902', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ee784afd-dd84-5d64-a13a-f191cfd10902')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'ee784afd-dd84-5d64-a13a-f191cfd10902', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ee784afd-dd84-5d64-a13a-f191cfd10902')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'ee784afd-dd84-5d64-a13a-f191cfd10902', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ee784afd-dd84-5d64-a13a-f191cfd10902')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'ee784afd-dd84-5d64-a13a-f191cfd10902', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ee784afd-dd84-5d64-a13a-f191cfd10902')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'ee784afd-dd84-5d64-a13a-f191cfd10902', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ee784afd-dd84-5d64-a13a-f191cfd10902')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'ee784afd-dd84-5d64-a13a-f191cfd10902', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ee784afd-dd84-5d64-a13a-f191cfd10902')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'ee784afd-dd84-5d64-a13a-f191cfd10902', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pectoral mayor' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ee784afd-dd84-5d64-a13a-f191cfd10902')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'ee784afd-dd84-5d64-a13a-f191cfd10902', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Manguito rotador' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ee784afd-dd84-5d64-a13a-f191cfd10902')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'ee784afd-dd84-5d64-a13a-f191cfd10902', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ee784afd-dd84-5d64-a13a-f191cfd10902')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'ee784afd-dd84-5d64-a13a-f191cfd10902', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores de cadera' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ee784afd-dd84-5d64-a13a-f191cfd10902')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'ee784afd-dd84-5d64-a13a-f191cfd10902', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'ee784afd-dd84-5d64-a13a-f191cfd10902')
  ON CONFLICT DO NOTHING;

-- Resistance Band Lat Pull Down
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('e2150598-0d7c-5172-a6e0-100be2c2db25', 'Resistance Band Lat Pull Down', 'Jalón al pecho con banda de resistencia.', 'beginner', '{pull}', '2K6U6ScTdUI', 'How To Do Resistance Band Lat Pull Down', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'e2150598-0d7c-5172-a6e0-100be2c2db25', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e2150598-0d7c-5172-a6e0-100be2c2db25')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'e2150598-0d7c-5172-a6e0-100be2c2db25', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Bíceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e2150598-0d7c-5172-a6e0-100be2c2db25')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'e2150598-0d7c-5172-a6e0-100be2c2db25', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e2150598-0d7c-5172-a6e0-100be2c2db25')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'e2150598-0d7c-5172-a6e0-100be2c2db25', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e2150598-0d7c-5172-a6e0-100be2c2db25')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'e2150598-0d7c-5172-a6e0-100be2c2db25', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e2150598-0d7c-5172-a6e0-100be2c2db25')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'e2150598-0d7c-5172-a6e0-100be2c2db25', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e2150598-0d7c-5172-a6e0-100be2c2db25')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'e2150598-0d7c-5172-a6e0-100be2c2db25', e."id" FROM "equipment" e
  WHERE e."name" = 'Banda elástica' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e2150598-0d7c-5172-a6e0-100be2c2db25')
  ON CONFLICT DO NOTHING;

-- Straight Arm Pull down
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('f508b5c5-fbc0-58f2-ac03-d6f4c2f12f55', 'Straight Arm Pull down', 'Jalón con brazos extendidos para dorsales.', 'beginner', '{pull}', 'Fn_c94pLpVE', 'How To Do Resistance Band Straight Arm Pull Down', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f508b5c5-fbc0-58f2-ac03-d6f4c2f12f55', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f508b5c5-fbc0-58f2-ac03-d6f4c2f12f55')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f508b5c5-fbc0-58f2-ac03-d6f4c2f12f55', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f508b5c5-fbc0-58f2-ac03-d6f4c2f12f55')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f508b5c5-fbc0-58f2-ac03-d6f4c2f12f55', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f508b5c5-fbc0-58f2-ac03-d6f4c2f12f55')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f508b5c5-fbc0-58f2-ac03-d6f4c2f12f55', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f508b5c5-fbc0-58f2-ac03-d6f4c2f12f55')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f508b5c5-fbc0-58f2-ac03-d6f4c2f12f55', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f508b5c5-fbc0-58f2-ac03-d6f4c2f12f55')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'f508b5c5-fbc0-58f2-ac03-d6f4c2f12f55', e."id" FROM "equipment" e
  WHERE e."name" = 'Banda elástica' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f508b5c5-fbc0-58f2-ac03-d6f4c2f12f55')
  ON CONFLICT DO NOTHING;

-- Plank
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('2509e39c-6fd5-58d4-a714-9eb6134b9fd5', 'Plank', 'Plancha frontal con cuerpo alineado.', 'beginner', '{core}', 'coint6OCeDY', 'How To Do Plank', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '2509e39c-6fd5-58d4-a714-9eb6134b9fd5', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '2509e39c-6fd5-58d4-a714-9eb6134b9fd5')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '2509e39c-6fd5-58d4-a714-9eb6134b9fd5', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Oblicuo externo' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '2509e39c-6fd5-58d4-a714-9eb6134b9fd5')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '2509e39c-6fd5-58d4-a714-9eb6134b9fd5', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '2509e39c-6fd5-58d4-a714-9eb6134b9fd5')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '2509e39c-6fd5-58d4-a714-9eb6134b9fd5', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '2509e39c-6fd5-58d4-a714-9eb6134b9fd5')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '2509e39c-6fd5-58d4-a714-9eb6134b9fd5', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '2509e39c-6fd5-58d4-a714-9eb6134b9fd5')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '2509e39c-6fd5-58d4-a714-9eb6134b9fd5', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Cuádriceps' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '2509e39c-6fd5-58d4-a714-9eb6134b9fd5')
  ON CONFLICT DO NOTHING;

-- Long Plank
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('b2db7ab5-f76b-585c-aef5-1bc6869eacfd', 'Long Plank', 'Plancha con manos adelantadas para aumentar la palanca.', 'beginner', '{core}', '_9yeH6brSns', 'How To Do Long Plank', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b2db7ab5-f76b-585c-aef5-1bc6869eacfd', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b2db7ab5-f76b-585c-aef5-1bc6869eacfd')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b2db7ab5-f76b-585c-aef5-1bc6869eacfd', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b2db7ab5-f76b-585c-aef5-1bc6869eacfd')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b2db7ab5-f76b-585c-aef5-1bc6869eacfd', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b2db7ab5-f76b-585c-aef5-1bc6869eacfd')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b2db7ab5-f76b-585c-aef5-1bc6869eacfd', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b2db7ab5-f76b-585c-aef5-1bc6869eacfd')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b2db7ab5-f76b-585c-aef5-1bc6869eacfd', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Erector espinal' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b2db7ab5-f76b-585c-aef5-1bc6869eacfd')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b2db7ab5-f76b-585c-aef5-1bc6869eacfd', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b2db7ab5-f76b-585c-aef5-1bc6869eacfd')
  ON CONFLICT DO NOTHING;

-- Reversed Plank
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('adeef891-7bfb-57e0-add8-9246a7391154', 'Reversed Plank', 'Plancha boca arriba con cadera elevada.', 'beginner', '{core}', 'qxodHz5z0OY', 'How To Do Reversed Plank', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'adeef891-7bfb-57e0-add8-9246a7391154', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'adeef891-7bfb-57e0-add8-9246a7391154')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'adeef891-7bfb-57e0-add8-9246a7391154', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Erector espinal' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'adeef891-7bfb-57e0-add8-9246a7391154')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'adeef891-7bfb-57e0-add8-9246a7391154', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Isquiotibiales' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'adeef891-7bfb-57e0-add8-9246a7391154')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'adeef891-7bfb-57e0-add8-9246a7391154', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'adeef891-7bfb-57e0-add8-9246a7391154')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'adeef891-7bfb-57e0-add8-9246a7391154', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'adeef891-7bfb-57e0-add8-9246a7391154')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'adeef891-7bfb-57e0-add8-9246a7391154', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'adeef891-7bfb-57e0-add8-9246a7391154')
  ON CONFLICT DO NOTHING;

-- Hollow Body Hold
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('7fff17cf-1ebe-5fcc-aeb9-faa7214ac6e4', 'Hollow Body Hold', 'Isométrico boca arriba con zona lumbar pegada al suelo.', 'beginner', '{core}', 'TuLnKCIf5xI', 'How To Do Hollow Body Hold', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '7fff17cf-1ebe-5fcc-aeb9-faa7214ac6e4', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '7fff17cf-1ebe-5fcc-aeb9-faa7214ac6e4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '7fff17cf-1ebe-5fcc-aeb9-faa7214ac6e4', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores de cadera' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '7fff17cf-1ebe-5fcc-aeb9-faa7214ac6e4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '7fff17cf-1ebe-5fcc-aeb9-faa7214ac6e4', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Oblicuo externo' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '7fff17cf-1ebe-5fcc-aeb9-faa7214ac6e4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '7fff17cf-1ebe-5fcc-aeb9-faa7214ac6e4', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '7fff17cf-1ebe-5fcc-aeb9-faa7214ac6e4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '7fff17cf-1ebe-5fcc-aeb9-faa7214ac6e4', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Cuádriceps' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '7fff17cf-1ebe-5fcc-aeb9-faa7214ac6e4')
  ON CONFLICT DO NOTHING;

-- Tuck Hollow Body Hold
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('1cdd21c8-e0b0-59b1-a621-888eb458ab2b', 'Tuck Hollow Body Hold', 'Hollow body con rodillas flexionadas; regresión.', 'beginner', '{core}', 'UVyCKFb0aIg', 'How To Do Tuck Hollow Body Hold', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1cdd21c8-e0b0-59b1-a621-888eb458ab2b', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1cdd21c8-e0b0-59b1-a621-888eb458ab2b')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1cdd21c8-e0b0-59b1-a621-888eb458ab2b', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores de cadera' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1cdd21c8-e0b0-59b1-a621-888eb458ab2b')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1cdd21c8-e0b0-59b1-a621-888eb458ab2b', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Oblicuo externo' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1cdd21c8-e0b0-59b1-a621-888eb458ab2b')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1cdd21c8-e0b0-59b1-a621-888eb458ab2b', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Cuádriceps' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1cdd21c8-e0b0-59b1-a621-888eb458ab2b')
  ON CONFLICT DO NOTHING;

-- Hollow Body Rocks
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('68aaa8cd-9a52-5cad-afb2-86d7b0bbd10a', 'Hollow Body Rocks', 'Balanceo manteniendo la forma de hollow body.', 'intermediate', '{core}', 'XWNXnEfIdZU', 'How To Do Hollow Body Rocks', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '68aaa8cd-9a52-5cad-afb2-86d7b0bbd10a', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '68aaa8cd-9a52-5cad-afb2-86d7b0bbd10a')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '68aaa8cd-9a52-5cad-afb2-86d7b0bbd10a', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores de cadera' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '68aaa8cd-9a52-5cad-afb2-86d7b0bbd10a')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '68aaa8cd-9a52-5cad-afb2-86d7b0bbd10a', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Oblicuo externo' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '68aaa8cd-9a52-5cad-afb2-86d7b0bbd10a')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '68aaa8cd-9a52-5cad-afb2-86d7b0bbd10a', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Cuádriceps' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '68aaa8cd-9a52-5cad-afb2-86d7b0bbd10a')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '68aaa8cd-9a52-5cad-afb2-86d7b0bbd10a', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '68aaa8cd-9a52-5cad-afb2-86d7b0bbd10a')
  ON CONFLICT DO NOTHING;

-- Superman Hold
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('a8295f8d-ce3a-512f-a3b1-f69b2d0aa515', 'Superman Hold', 'Isométrico boca abajo elevando brazos y piernas.', 'intermediate', '{core}', 'hmc934fftKM', 'How To Do Superman Hold', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a8295f8d-ce3a-512f-a3b1-f69b2d0aa515', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Erector espinal' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a8295f8d-ce3a-512f-a3b1-f69b2d0aa515')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a8295f8d-ce3a-512f-a3b1-f69b2d0aa515', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a8295f8d-ce3a-512f-a3b1-f69b2d0aa515')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a8295f8d-ce3a-512f-a3b1-f69b2d0aa515', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Isquiotibiales' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a8295f8d-ce3a-512f-a3b1-f69b2d0aa515')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a8295f8d-ce3a-512f-a3b1-f69b2d0aa515', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides posterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a8295f8d-ce3a-512f-a3b1-f69b2d0aa515')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a8295f8d-ce3a-512f-a3b1-f69b2d0aa515', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a8295f8d-ce3a-512f-a3b1-f69b2d0aa515')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'a8295f8d-ce3a-512f-a3b1-f69b2d0aa515', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'a8295f8d-ce3a-512f-a3b1-f69b2d0aa515')
  ON CONFLICT DO NOTHING;

-- Dead Bug
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('93cf1c2c-bfc1-5152-aeb8-730c4b436b72', 'Dead Bug', 'Extensión alterna de brazo y pierna boca arriba con core estable.', 'beginner', '{core}', 'UKOwvzv1zuw', 'How To Do Dead Bug', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '93cf1c2c-bfc1-5152-aeb8-730c4b436b72', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '93cf1c2c-bfc1-5152-aeb8-730c4b436b72')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '93cf1c2c-bfc1-5152-aeb8-730c4b436b72', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Oblicuo externo' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '93cf1c2c-bfc1-5152-aeb8-730c4b436b72')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '93cf1c2c-bfc1-5152-aeb8-730c4b436b72', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores de cadera' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '93cf1c2c-bfc1-5152-aeb8-730c4b436b72')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '93cf1c2c-bfc1-5152-aeb8-730c4b436b72', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '93cf1c2c-bfc1-5152-aeb8-730c4b436b72')
  ON CONFLICT DO NOTHING;

-- Bird Dog
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('e6082de5-ca7e-5236-a545-3f87eadfab6c', 'Bird Dog', 'En cuadrupedia, extender brazo y pierna opuestos.', 'beginner', '{core}', 'pBOXOVDDiUM', 'How To Do Bird Dog', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'e6082de5-ca7e-5236-a545-3f87eadfab6c', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e6082de5-ca7e-5236-a545-3f87eadfab6c')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'e6082de5-ca7e-5236-a545-3f87eadfab6c', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Erector espinal' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e6082de5-ca7e-5236-a545-3f87eadfab6c')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'e6082de5-ca7e-5236-a545-3f87eadfab6c', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e6082de5-ca7e-5236-a545-3f87eadfab6c')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'e6082de5-ca7e-5236-a545-3f87eadfab6c', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e6082de5-ca7e-5236-a545-3f87eadfab6c')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'e6082de5-ca7e-5236-a545-3f87eadfab6c', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Oblicuo externo' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e6082de5-ca7e-5236-a545-3f87eadfab6c')
  ON CONFLICT DO NOTHING;

-- L-sit Hold
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('c9ac3869-e26e-543c-acd2-787969052058', 'L-sit Hold', 'Sostener las piernas extendidas al frente con brazos rectos.', 'beginner', '{core}', 'jxUIHjgdz_U', 'How To Do L-sit Hold', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'c9ac3869-e26e-543c-acd2-787969052058', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c9ac3869-e26e-543c-acd2-787969052058')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'c9ac3869-e26e-543c-acd2-787969052058', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores de cadera' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c9ac3869-e26e-543c-acd2-787969052058')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'c9ac3869-e26e-543c-acd2-787969052058', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c9ac3869-e26e-543c-acd2-787969052058')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'c9ac3869-e26e-543c-acd2-787969052058', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c9ac3869-e26e-543c-acd2-787969052058')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'c9ac3869-e26e-543c-acd2-787969052058', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Cuádriceps' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c9ac3869-e26e-543c-acd2-787969052058')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'c9ac3869-e26e-543c-acd2-787969052058', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c9ac3869-e26e-543c-acd2-787969052058')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'c9ac3869-e26e-543c-acd2-787969052058', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c9ac3869-e26e-543c-acd2-787969052058')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'c9ac3869-e26e-543c-acd2-787969052058', e."id" FROM "equipment" e
  WHERE e."name" = 'Paralelas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c9ac3869-e26e-543c-acd2-787969052058')
  ON CONFLICT DO NOTHING;

-- Tuck L-sit Hold
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('f660abd8-7a75-5959-a7eb-2da40960e810', 'Tuck L-sit Hold', 'L-sit con rodillas al pecho.', 'beginner', '{core}', 'fEQg1Tr6LN4', 'How To Do Tuck L sit Hold', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f660abd8-7a75-5959-a7eb-2da40960e810', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f660abd8-7a75-5959-a7eb-2da40960e810')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f660abd8-7a75-5959-a7eb-2da40960e810', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores de cadera' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f660abd8-7a75-5959-a7eb-2da40960e810')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f660abd8-7a75-5959-a7eb-2da40960e810', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f660abd8-7a75-5959-a7eb-2da40960e810')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f660abd8-7a75-5959-a7eb-2da40960e810', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f660abd8-7a75-5959-a7eb-2da40960e810')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f660abd8-7a75-5959-a7eb-2da40960e810', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f660abd8-7a75-5959-a7eb-2da40960e810')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f660abd8-7a75-5959-a7eb-2da40960e810', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f660abd8-7a75-5959-a7eb-2da40960e810')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'f660abd8-7a75-5959-a7eb-2da40960e810', e."id" FROM "equipment" e
  WHERE e."name" = 'Paralelas bajas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f660abd8-7a75-5959-a7eb-2da40960e810')
  ON CONFLICT DO NOTHING;

-- Hanging Knee raises
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('20a3bc19-6d34-50de-a4f1-c9e21603cd92', 'Hanging Knee raises', 'Elevar rodillas al pecho colgado de la barra.', 'beginner', '{core}', 'VCu3UeReMww', 'How To Do Hanging Knee Raises', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '20a3bc19-6d34-50de-a4f1-c9e21603cd92', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '20a3bc19-6d34-50de-a4f1-c9e21603cd92')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '20a3bc19-6d34-50de-a4f1-c9e21603cd92', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores de cadera' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '20a3bc19-6d34-50de-a4f1-c9e21603cd92')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '20a3bc19-6d34-50de-a4f1-c9e21603cd92', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '20a3bc19-6d34-50de-a4f1-c9e21603cd92')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '20a3bc19-6d34-50de-a4f1-c9e21603cd92', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Oblicuo externo' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '20a3bc19-6d34-50de-a4f1-c9e21603cd92')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '20a3bc19-6d34-50de-a4f1-c9e21603cd92', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '20a3bc19-6d34-50de-a4f1-c9e21603cd92')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '20a3bc19-6d34-50de-a4f1-c9e21603cd92', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '20a3bc19-6d34-50de-a4f1-c9e21603cd92')
  ON CONFLICT DO NOTHING;

-- Hanging Leg raises
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('f874e599-9349-5597-aa52-3902c869c5b5', 'Hanging Leg raises', 'Elevar piernas extendidas colgado.', 'intermediate', '{core}', 'VD2UJLRjrXo', 'How To Do Hanging Leg Raises', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f874e599-9349-5597-aa52-3902c869c5b5', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f874e599-9349-5597-aa52-3902c869c5b5')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f874e599-9349-5597-aa52-3902c869c5b5', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores de cadera' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f874e599-9349-5597-aa52-3902c869c5b5')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f874e599-9349-5597-aa52-3902c869c5b5', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Oblicuo externo' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f874e599-9349-5597-aa52-3902c869c5b5')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f874e599-9349-5597-aa52-3902c869c5b5', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f874e599-9349-5597-aa52-3902c869c5b5')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f874e599-9349-5597-aa52-3902c869c5b5', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f874e599-9349-5597-aa52-3902c869c5b5')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'f874e599-9349-5597-aa52-3902c869c5b5', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f874e599-9349-5597-aa52-3902c869c5b5')
  ON CONFLICT DO NOTHING;

-- Toes To bar
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('414eafd7-a136-53aa-ac20-e8ad7f0604de', 'Toes To bar', 'Elevar las piernas colgado hasta tocar la barra.', 'intermediate', '{core}', 'kdXaQUvbIYs', 'How To Do Toes To Bar', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '414eafd7-a136-53aa-ac20-e8ad7f0604de', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '414eafd7-a136-53aa-ac20-e8ad7f0604de')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '414eafd7-a136-53aa-ac20-e8ad7f0604de', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores de cadera' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '414eafd7-a136-53aa-ac20-e8ad7f0604de')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '414eafd7-a136-53aa-ac20-e8ad7f0604de', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores del antebrazo' AND g."name" = 'Antebrazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '414eafd7-a136-53aa-ac20-e8ad7f0604de')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '414eafd7-a136-53aa-ac20-e8ad7f0604de', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Dorsal ancho' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '414eafd7-a136-53aa-ac20-e8ad7f0604de')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '414eafd7-a136-53aa-ac20-e8ad7f0604de', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Oblicuo externo' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '414eafd7-a136-53aa-ac20-e8ad7f0604de')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '414eafd7-a136-53aa-ac20-e8ad7f0604de', e."id" FROM "equipment" e
  WHERE e."name" = 'Barra de dominadas' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '414eafd7-a136-53aa-ac20-e8ad7f0604de')
  ON CONFLICT DO NOTHING;

-- Laying Leg Raises
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('e18c3868-b790-5aac-a445-06208210700e', 'Laying Leg Raises', 'Elevar piernas extendidas boca arriba.', 'beginner', '{core}', '2qWUjVvmdfs', 'How To Do Laying Leg Raises', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'e18c3868-b790-5aac-a445-06208210700e', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e18c3868-b790-5aac-a445-06208210700e')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'e18c3868-b790-5aac-a445-06208210700e', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores de cadera' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e18c3868-b790-5aac-a445-06208210700e')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'e18c3868-b790-5aac-a445-06208210700e', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Oblicuo externo' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e18c3868-b790-5aac-a445-06208210700e')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'e18c3868-b790-5aac-a445-06208210700e', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Cuádriceps' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'e18c3868-b790-5aac-a445-06208210700e')
  ON CONFLICT DO NOTHING;

-- Russian Twist
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('057d4c07-bc30-5d0a-a7f9-9ef8afbb0af1', 'Russian Twist', 'Rotación de tronco sentado con pies elevados.', 'beginner', '{core}', 'ZxHYp0A4kcY', 'How To Do Russian Twist', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '057d4c07-bc30-5d0a-a7f9-9ef8afbb0af1', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Oblicuo externo' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '057d4c07-bc30-5d0a-a7f9-9ef8afbb0af1')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '057d4c07-bc30-5d0a-a7f9-9ef8afbb0af1', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '057d4c07-bc30-5d0a-a7f9-9ef8afbb0af1')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '057d4c07-bc30-5d0a-a7f9-9ef8afbb0af1', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores de cadera' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '057d4c07-bc30-5d0a-a7f9-9ef8afbb0af1')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '057d4c07-bc30-5d0a-a7f9-9ef8afbb0af1', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Erector espinal' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '057d4c07-bc30-5d0a-a7f9-9ef8afbb0af1')
  ON CONFLICT DO NOTHING;

-- Mountain Climbers
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('80b7bff0-e5fa-5141-adf0-5a654d08f6fe', 'Mountain Climbers', 'Llevar rodillas al pecho alternando en posición de plancha.', 'beginner', '{core}', 'eJllA-pZlb8', 'How To Do Mountain Climbers', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '80b7bff0-e5fa-5141-adf0-5a654d08f6fe', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '80b7bff0-e5fa-5141-adf0-5a654d08f6fe')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '80b7bff0-e5fa-5141-adf0-5a654d08f6fe', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores de cadera' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '80b7bff0-e5fa-5141-adf0-5a654d08f6fe')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '80b7bff0-e5fa-5141-adf0-5a654d08f6fe', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '80b7bff0-e5fa-5141-adf0-5a654d08f6fe')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '80b7bff0-e5fa-5141-adf0-5a654d08f6fe', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '80b7bff0-e5fa-5141-adf0-5a654d08f6fe')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '80b7bff0-e5fa-5141-adf0-5a654d08f6fe', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Cuádriceps' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '80b7bff0-e5fa-5141-adf0-5a654d08f6fe')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '80b7bff0-e5fa-5141-adf0-5a654d08f6fe', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '80b7bff0-e5fa-5141-adf0-5a654d08f6fe')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '80b7bff0-e5fa-5141-adf0-5a654d08f6fe', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '80b7bff0-e5fa-5141-adf0-5a654d08f6fe')
  ON CONFLICT DO NOTHING;

-- Bodyweight Squats
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('c3a0039d-5bcb-5819-ae4a-b36104bad568', 'Bodyweight Squats', 'Sentadilla con peso corporal.', 'beginner', '{squat}', 'eAFSpUExcwc', 'How To Do Bodyweight Squats', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'c3a0039d-5bcb-5819-ae4a-b36104bad568', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Cuádriceps' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c3a0039d-5bcb-5819-ae4a-b36104bad568')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'c3a0039d-5bcb-5819-ae4a-b36104bad568', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c3a0039d-5bcb-5819-ae4a-b36104bad568')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'c3a0039d-5bcb-5819-ae4a-b36104bad568', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Isquiotibiales' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c3a0039d-5bcb-5819-ae4a-b36104bad568')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'c3a0039d-5bcb-5819-ae4a-b36104bad568', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c3a0039d-5bcb-5819-ae4a-b36104bad568')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'c3a0039d-5bcb-5819-ae4a-b36104bad568', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pantorrillas' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c3a0039d-5bcb-5819-ae4a-b36104bad568')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'c3a0039d-5bcb-5819-ae4a-b36104bad568', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Aductores' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c3a0039d-5bcb-5819-ae4a-b36104bad568')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'c3a0039d-5bcb-5819-ae4a-b36104bad568', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores de cadera' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c3a0039d-5bcb-5819-ae4a-b36104bad568')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'c3a0039d-5bcb-5819-ae4a-b36104bad568', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Erector espinal' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'c3a0039d-5bcb-5819-ae4a-b36104bad568')
  ON CONFLICT DO NOTHING;

-- Jumping Squats
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('da04dc79-3de9-519a-a26d-c230260cf034', 'Jumping Squats', 'Sentadilla explosiva con salto.', 'beginner', '{squat}', 'vF2aEkQq2w8', 'How To Do Jumping Squats', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'da04dc79-3de9-519a-a26d-c230260cf034', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Cuádriceps' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'da04dc79-3de9-519a-a26d-c230260cf034')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'da04dc79-3de9-519a-a26d-c230260cf034', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'da04dc79-3de9-519a-a26d-c230260cf034')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'da04dc79-3de9-519a-a26d-c230260cf034', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pantorrillas' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'da04dc79-3de9-519a-a26d-c230260cf034')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'da04dc79-3de9-519a-a26d-c230260cf034', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Isquiotibiales' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'da04dc79-3de9-519a-a26d-c230260cf034')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'da04dc79-3de9-519a-a26d-c230260cf034', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'da04dc79-3de9-519a-a26d-c230260cf034')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'da04dc79-3de9-519a-a26d-c230260cf034', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores de cadera' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'da04dc79-3de9-519a-a26d-c230260cf034')
  ON CONFLICT DO NOTHING;

-- Bulgarian Squats
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('dfbc62c8-dc92-5147-a7c6-2a480b185cb4', 'Bulgarian Squats', 'Sentadilla a una pierna con pie trasero elevado.', 'intermediate', '{squat}', 'pfRlldgfGRQ', 'How To Do Bulgarian Squats', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'dfbc62c8-dc92-5147-a7c6-2a480b185cb4', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Cuádriceps' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'dfbc62c8-dc92-5147-a7c6-2a480b185cb4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'dfbc62c8-dc92-5147-a7c6-2a480b185cb4', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'dfbc62c8-dc92-5147-a7c6-2a480b185cb4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'dfbc62c8-dc92-5147-a7c6-2a480b185cb4', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Isquiotibiales' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'dfbc62c8-dc92-5147-a7c6-2a480b185cb4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'dfbc62c8-dc92-5147-a7c6-2a480b185cb4', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Aductores' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'dfbc62c8-dc92-5147-a7c6-2a480b185cb4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'dfbc62c8-dc92-5147-a7c6-2a480b185cb4', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pantorrillas' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'dfbc62c8-dc92-5147-a7c6-2a480b185cb4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'dfbc62c8-dc92-5147-a7c6-2a480b185cb4', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'dfbc62c8-dc92-5147-a7c6-2a480b185cb4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'dfbc62c8-dc92-5147-a7c6-2a480b185cb4', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores de cadera' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'dfbc62c8-dc92-5147-a7c6-2a480b185cb4')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'dfbc62c8-dc92-5147-a7c6-2a480b185cb4', e."id" FROM "equipment" e
  WHERE e."name" = 'Silla' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'dfbc62c8-dc92-5147-a7c6-2a480b185cb4')
  ON CONFLICT DO NOTHING;

-- Negative Pistol Squat
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('f30cfc7d-74e9-5efa-ad30-19c2849eb0f2', 'Negative Pistol Squat', 'Descenso controlado a una pierna.', 'intermediate', '{squat}', 'YMvPC1byyGo', 'How To Do Negative Pistol Squat', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f30cfc7d-74e9-5efa-ad30-19c2849eb0f2', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Cuádriceps' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f30cfc7d-74e9-5efa-ad30-19c2849eb0f2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f30cfc7d-74e9-5efa-ad30-19c2849eb0f2', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f30cfc7d-74e9-5efa-ad30-19c2849eb0f2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f30cfc7d-74e9-5efa-ad30-19c2849eb0f2', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores de cadera' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f30cfc7d-74e9-5efa-ad30-19c2849eb0f2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f30cfc7d-74e9-5efa-ad30-19c2849eb0f2', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f30cfc7d-74e9-5efa-ad30-19c2849eb0f2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f30cfc7d-74e9-5efa-ad30-19c2849eb0f2', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Aductores' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f30cfc7d-74e9-5efa-ad30-19c2849eb0f2')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f30cfc7d-74e9-5efa-ad30-19c2849eb0f2', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pantorrillas' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f30cfc7d-74e9-5efa-ad30-19c2849eb0f2')
  ON CONFLICT DO NOTHING;

-- Sissy Squat
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('00e88d18-5a64-59c3-a9fe-38eea0f97e8c', 'Sissy Squat', 'Sentadilla con rodillas adelantadas y cadera extendida; cuádriceps.', 'intermediate', '{squat}', '7QNShsR89U8', 'How To Do Sissy Squat', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '00e88d18-5a64-59c3-a9fe-38eea0f97e8c', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Cuádriceps' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '00e88d18-5a64-59c3-a9fe-38eea0f97e8c')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '00e88d18-5a64-59c3-a9fe-38eea0f97e8c', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '00e88d18-5a64-59c3-a9fe-38eea0f97e8c')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '00e88d18-5a64-59c3-a9fe-38eea0f97e8c', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '00e88d18-5a64-59c3-a9fe-38eea0f97e8c')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '00e88d18-5a64-59c3-a9fe-38eea0f97e8c', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Erector espinal' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '00e88d18-5a64-59c3-a9fe-38eea0f97e8c')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '00e88d18-5a64-59c3-a9fe-38eea0f97e8c', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pantorrillas' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '00e88d18-5a64-59c3-a9fe-38eea0f97e8c')
  ON CONFLICT DO NOTHING;

-- Step back Lunges
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('1dabf288-21ac-5bdb-a5b4-da8ebdaa8062', 'Step back Lunges', 'Zancada dando el paso hacia atrás.', 'beginner', '{squat}', 'hwdGTe09_18', 'How To Do  Step Back Lunges', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1dabf288-21ac-5bdb-a5b4-da8ebdaa8062', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Cuádriceps' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1dabf288-21ac-5bdb-a5b4-da8ebdaa8062')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1dabf288-21ac-5bdb-a5b4-da8ebdaa8062', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1dabf288-21ac-5bdb-a5b4-da8ebdaa8062')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1dabf288-21ac-5bdb-a5b4-da8ebdaa8062', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Isquiotibiales' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1dabf288-21ac-5bdb-a5b4-da8ebdaa8062')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1dabf288-21ac-5bdb-a5b4-da8ebdaa8062', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pantorrillas' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1dabf288-21ac-5bdb-a5b4-da8ebdaa8062')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1dabf288-21ac-5bdb-a5b4-da8ebdaa8062', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1dabf288-21ac-5bdb-a5b4-da8ebdaa8062')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1dabf288-21ac-5bdb-a5b4-da8ebdaa8062', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Flexores de cadera' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1dabf288-21ac-5bdb-a5b4-da8ebdaa8062')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '1dabf288-21ac-5bdb-a5b4-da8ebdaa8062', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Aductores' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '1dabf288-21ac-5bdb-a5b4-da8ebdaa8062')
  ON CONFLICT DO NOTHING;

-- Glute Bridge
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('b894c4d0-8cef-5fb5-a6f9-9bd4fe2b8803', 'Glute Bridge', 'Elevación de cadera boca arriba.', 'beginner', '{squat}', 'e24JjTDrtKs', 'How To Do Glute Bridge', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b894c4d0-8cef-5fb5-a6f9-9bd4fe2b8803', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b894c4d0-8cef-5fb5-a6f9-9bd4fe2b8803')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b894c4d0-8cef-5fb5-a6f9-9bd4fe2b8803', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Isquiotibiales' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b894c4d0-8cef-5fb5-a6f9-9bd4fe2b8803')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b894c4d0-8cef-5fb5-a6f9-9bd4fe2b8803', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Erector espinal' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b894c4d0-8cef-5fb5-a6f9-9bd4fe2b8803')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b894c4d0-8cef-5fb5-a6f9-9bd4fe2b8803', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b894c4d0-8cef-5fb5-a6f9-9bd4fe2b8803')
  ON CONFLICT DO NOTHING;

-- Calf Raises
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('b66526a2-72ea-533e-a806-5110f9addbfa', 'Calf Raises', 'Elevarse sobre las puntas de los pies.', 'beginner', '{squat}', 'Qv55w6-sxRM', 'How To Do Calf Raises', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b66526a2-72ea-533e-a806-5110f9addbfa', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pantorrillas' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b66526a2-72ea-533e-a806-5110f9addbfa')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b66526a2-72ea-533e-a806-5110f9addbfa', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tibial anterior' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b66526a2-72ea-533e-a806-5110f9addbfa')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b66526a2-72ea-533e-a806-5110f9addbfa', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Cuádriceps' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b66526a2-72ea-533e-a806-5110f9addbfa')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'b66526a2-72ea-533e-a806-5110f9addbfa', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'b66526a2-72ea-533e-a806-5110f9addbfa')
  ON CONFLICT DO NOTHING;

-- Wall Sit
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('f5665e13-b620-5d64-ae57-cd15a7025bcd', 'Wall Sit', 'Mantener posición sentada con espalda en la pared.', 'beginner', '{squat}', '3h0aEHYDHzY', 'How To Do Wall Sit', 'horizontal', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f5665e13-b620-5d64-ae57-cd15a7025bcd', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Cuádriceps' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f5665e13-b620-5d64-ae57-cd15a7025bcd')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f5665e13-b620-5d64-ae57-cd15a7025bcd', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f5665e13-b620-5d64-ae57-cd15a7025bcd')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f5665e13-b620-5d64-ae57-cd15a7025bcd', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Isquiotibiales' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f5665e13-b620-5d64-ae57-cd15a7025bcd')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f5665e13-b620-5d64-ae57-cd15a7025bcd', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Pantorrillas' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f5665e13-b620-5d64-ae57-cd15a7025bcd')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f5665e13-b620-5d64-ae57-cd15a7025bcd', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f5665e13-b620-5d64-ae57-cd15a7025bcd')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT 'f5665e13-b620-5d64-ae57-cd15a7025bcd', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Aductores' AND g."name" = 'Pierna' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f5665e13-b620-5d64-ae57-cd15a7025bcd')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT 'f5665e13-b620-5d64-ae57-cd15a7025bcd', e."id" FROM "equipment" e
  WHERE e."name" = 'Pared' AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = 'f5665e13-b620-5d64-ae57-cd15a7025bcd')
  ON CONFLICT DO NOTHING;

-- 45 Degree Handstand Hold
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('620f89c7-99a1-55c9-abcf-41b2c2ff2d5c', '45 Degree Handstand Hold', 'Isométrico en parada de manos inclinada a 45 grados (el único Short vertical del catálogo).', 'intermediate', '{core}', 'pIY21KwH3zo', 'Learn How To Do A 45 Degree Handstand Hold 🔥 #calisthenics #handstandhold #shorts #ytshorts', 'vertical', true, (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'), (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com'))
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '620f89c7-99a1-55c9-abcf-41b2c2ff2d5c', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Deltoides anterior' AND g."name" = 'Hombro' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '620f89c7-99a1-55c9-abcf-41b2c2ff2d5c')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '620f89c7-99a1-55c9-abcf-41b2c2ff2d5c', m."id", 'primary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Tríceps' AND g."name" = 'Brazo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '620f89c7-99a1-55c9-abcf-41b2c2ff2d5c')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '620f89c7-99a1-55c9-abcf-41b2c2ff2d5c', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Recto abdominal' AND g."name" = 'Abdomen' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '620f89c7-99a1-55c9-abcf-41b2c2ff2d5c')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '620f89c7-99a1-55c9-abcf-41b2c2ff2d5c', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Serrato anterior' AND g."name" = 'Pecho' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '620f89c7-99a1-55c9-abcf-41b2c2ff2d5c')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '620f89c7-99a1-55c9-abcf-41b2c2ff2d5c', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Trapecio' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '620f89c7-99a1-55c9-abcf-41b2c2ff2d5c')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '620f89c7-99a1-55c9-abcf-41b2c2ff2d5c', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Romboides' AND g."name" = 'Espalda' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '620f89c7-99a1-55c9-abcf-41b2c2ff2d5c')
  ON CONFLICT DO NOTHING;
INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '620f89c7-99a1-55c9-abcf-41b2c2ff2d5c', m."id", 'secondary' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = 'Glúteo mayor' AND g."name" = 'Glúteo' AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '620f89c7-99a1-55c9-abcf-41b2c2ff2d5c')
  ON CONFLICT DO NOTHING;

-- Rutina de ejemplo del equipo Neo
INSERT INTO "routine" ("id", "name", "team_id", "created_by", "category", "content")
  SELECT 'eb1ebb89-541d-526b-a2d5-c8a405edce79', 'rutina de ejemplo', '09ec5433-f03f-5a98-aad6-6d57e97e4d18', u."id", 'training', '{"v":1,"items":[{"type":"exercise","id":"2913c693-cc5e-5951-aea1-e50cc034b0b8","exerciseId":"f6617eb1-491f-54dd-ab3f-cdedfb84fa77","order":0,"restSeconds":60,"notes":"Baja despacio y mantén el cuerpo recto.","sets":[{"setNumber":1,"setType":"reps","targetReps":8},{"setNumber":2,"setType":"reps","targetReps":8},{"setNumber":3,"setType":"reps","targetReps":8}]},{"type":"exercise","id":"ad2e09ba-8cda-56ef-abc8-8942733ffe27","exerciseId":"361bade8-4e53-5ed1-aadb-cab652d79648","order":1,"restSeconds":90,"sets":[{"setNumber":1,"setType":"reps","targetReps":10},{"setNumber":2,"setType":"reps","targetReps":10},{"setNumber":3,"setType":"reps","targetReps":10}]},{"type":"exercise","id":"2f13cec7-03a2-5e5a-ac28-cee364ca8c95","exerciseId":"708f2891-b0c0-5277-a17f-fe809c50a078","order":2,"restSeconds":90,"sets":[{"setNumber":1,"setType":"reps","targetReps":10},{"setNumber":2,"setType":"reps","targetReps":10},{"setNumber":3,"setType":"reps","targetReps":10}]},{"type":"block","id":"31529096-6f19-5123-a19c-f4b9945ef6e5","order":3,"name":"Circuito final","rounds":2,"exercises":[{"id":"da361698-ffa0-5ea7-aad2-dfc28dd74534","exerciseId":"9117cbe6-6d4c-5228-a326-fcab4fdfd390","order":4,"sets":[{"setNumber":1,"setType":"time","targetDurationSeconds":30}]},{"id":"e8857931-8859-525c-a1ee-a66902273426","exerciseId":"aac09ca5-88c6-5342-a5b8-ca3f6a9fbbe2","order":5,"sets":[{"setNumber":1,"setType":"time","targetDurationSeconds":30}]}]}]}'::jsonb
  FROM "user" u WHERE u."email" = 'arturogomezgz04@gmail.com'
  ON CONFLICT ("id") DO NOTHING;
COMMIT;
