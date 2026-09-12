-- ═══════════════════════════════════════════════════════════════════════════
-- 03 · Cuentas de prueba y equipo Neo
-- Generado por packages/db/scripts/build-sql.ts — no editar a mano.
-- Idempotente: seguro de re-ejecutar.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;
-- La cuenta "chinita@gmail.com" de versiones anteriores pasa a ser "tester@gmail.com"
UPDATE "user" SET "email" = 'tester@gmail.com', "name" = 'Tester', "updated_at" = now()
  WHERE "email" = 'chinita@gmail.com'
    AND NOT EXISTS (SELECT 1 FROM "user" WHERE "email" = 'tester@gmail.com');
INSERT INTO "team" ("id", "name", "max_athletes", "max_coaches")
  VALUES ('09ec5433-f03f-5a98-aad6-6d57e97e4d18', 'Neo', 50, 10)
  ON CONFLICT ("id") DO UPDATE SET "max_athletes" = EXCLUDED."max_athletes", "max_coaches" = EXCLUDED."max_coaches";

-- Arturo Gómez <arturogomezgz04@gmail.com> · contraseña: admin · rol: coach
INSERT INTO "user" ("id", "name", "email", "email_verified", "created_at", "updated_at")
  VALUES ('9ecf7ae2-78a4-5133-a1b4-64aed076c9a3', 'Arturo Gómez', 'arturogomezgz04@gmail.com', true, now(), now())
  ON CONFLICT ("email") DO UPDATE SET "name" = EXCLUDED."name", "email_verified" = true, "updated_at" = now();
DELETE FROM "account" WHERE "provider_id" = 'credential'
  AND "user_id" = (SELECT "id" FROM "user" WHERE "email" = 'arturogomezgz04@gmail.com');
INSERT INTO "account" ("id", "account_id", "provider_id", "user_id", "password", "created_at", "updated_at")
  SELECT 'e3ad4d96-71a3-5011-a497-87308d0bb954', u."id", 'credential', u."id", '4c772c1f2e2cf704103f42e167ee0e00:23e9be9c36d17254504a06c32748187b8547183280491a86624bd32430f7307487772bde0cf01d577683cb6d76c84a18c167d2daa8405c2a49546d193f61dbca', now(), now()
  FROM "user" u WHERE u."email" = 'arturogomezgz04@gmail.com';
INSERT INTO "team_member" ("team_id", "user_id", "role")
  SELECT '09ec5433-f03f-5a98-aad6-6d57e97e4d18', u."id", 'coach' FROM "user" u
  WHERE u."email" = 'arturogomezgz04@gmail.com'
    AND NOT EXISTS (SELECT 1 FROM "team_member" tm WHERE tm."team_id" = '09ec5433-f03f-5a98-aad6-6d57e97e4d18' AND tm."user_id" = u."id");

-- Tester <tester@gmail.com> · contraseña: 12345678 · rol: athlete
INSERT INTO "user" ("id", "name", "email", "email_verified", "created_at", "updated_at")
  VALUES ('d894738d-e509-5506-a8b4-c3e087e83d2d', 'Tester', 'tester@gmail.com', true, now(), now())
  ON CONFLICT ("email") DO UPDATE SET "name" = EXCLUDED."name", "email_verified" = true, "updated_at" = now();
DELETE FROM "account" WHERE "provider_id" = 'credential'
  AND "user_id" = (SELECT "id" FROM "user" WHERE "email" = 'tester@gmail.com');
INSERT INTO "account" ("id", "account_id", "provider_id", "user_id", "password", "created_at", "updated_at")
  SELECT '7f71742c-ab98-510f-a2db-0eb376db5472', u."id", 'credential', u."id", '3c3f2ffdce52b5af0ab948bb853c4494:0cd1251b1c175ec7ba54c58429c9724cab33baea2b2aa6c6db72d514c83f3b655a52e7d9c512288e9f0574fc614169c56186d908ce81576c193fa45841c015e1', now(), now()
  FROM "user" u WHERE u."email" = 'tester@gmail.com';
INSERT INTO "team_member" ("team_id", "user_id", "role")
  SELECT '09ec5433-f03f-5a98-aad6-6d57e97e4d18', u."id", 'athlete' FROM "user" u
  WHERE u."email" = 'tester@gmail.com'
    AND NOT EXISTS (SELECT 1 FROM "team_member" tm WHERE tm."team_id" = '09ec5433-f03f-5a98-aad6-6d57e97e4d18' AND tm."user_id" = u."id");

-- Rosa Martínez <abuela@gmail.com> · contraseña: 12345678 · rol: athlete
INSERT INTO "user" ("id", "name", "email", "email_verified", "created_at", "updated_at")
  VALUES ('298480ef-64c0-5577-ab7e-f7754fde70a0', 'Rosa Martínez', 'abuela@gmail.com', true, now(), now())
  ON CONFLICT ("email") DO UPDATE SET "name" = EXCLUDED."name", "email_verified" = true, "updated_at" = now();
DELETE FROM "account" WHERE "provider_id" = 'credential'
  AND "user_id" = (SELECT "id" FROM "user" WHERE "email" = 'abuela@gmail.com');
INSERT INTO "account" ("id", "account_id", "provider_id", "user_id", "password", "created_at", "updated_at")
  SELECT 'd5b14414-4e71-5f4b-ae93-d3419278b9f7', u."id", 'credential', u."id", '78da54bfcce663b11afe12bbe03683ba:c75a0b4aa1277eacea3c1358e7ace977608733f86fc473d07b5a8d641dc8622bc27a4af7a75a07c1c1fc3596b817717d36ace39a69dbfd3c0642d4c097873238', now(), now()
  FROM "user" u WHERE u."email" = 'abuela@gmail.com';
INSERT INTO "team_member" ("team_id", "user_id", "role")
  SELECT '09ec5433-f03f-5a98-aad6-6d57e97e4d18', u."id", 'athlete' FROM "user" u
  WHERE u."email" = 'abuela@gmail.com'
    AND NOT EXISTS (SELECT 1 FROM "team_member" tm WHERE tm."team_id" = '09ec5433-f03f-5a98-aad6-6d57e97e4d18' AND tm."user_id" = u."id");
COMMIT;
