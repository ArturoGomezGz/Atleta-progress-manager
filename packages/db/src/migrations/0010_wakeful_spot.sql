CREATE TYPE "public"."body_zone" AS ENUM('upper', 'lower', 'core');--> statement-breakpoint
CREATE TYPE "public"."muscle_role" AS ENUM('primary', 'secondary');--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_global" boolean DEFAULT false NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "exercise_equipment" (
	"exercise_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	CONSTRAINT "exercise_equipment_exercise_id_equipment_id_pk" PRIMARY KEY("exercise_id","equipment_id")
);
--> statement-breakpoint
CREATE TABLE "exercise_muscle" (
	"exercise_id" uuid NOT NULL,
	"muscle_id" uuid NOT NULL,
	"role" "muscle_role" NOT NULL,
	CONSTRAINT "exercise_muscle_exercise_id_muscle_id_pk" PRIMARY KEY("exercise_id","muscle_id")
);
--> statement-breakpoint
CREATE TABLE "muscle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"muscle_group_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "muscle_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"body_zone" "body_zone" NOT NULL,
	CONSTRAINT "muscle_group_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_equipment" ADD CONSTRAINT "exercise_equipment_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_equipment" ADD CONSTRAINT "exercise_equipment_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscle" ADD CONSTRAINT "exercise_muscle_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscle" ADD CONSTRAINT "exercise_muscle_muscle_id_muscle_id_fk" FOREIGN KEY ("muscle_id") REFERENCES "public"."muscle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muscle" ADD CONSTRAINT "muscle_muscle_group_id_muscle_group_id_fk" FOREIGN KEY ("muscle_group_id") REFERENCES "public"."muscle_group"("id") ON DELETE cascade ON UPDATE no action;