ALTER TABLE "exercise" ADD COLUMN "is_public" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "owner_team_id" uuid;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "exercise" DROP CONSTRAINT "exercise_name_unique";--> statement-breakpoint
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_owner_team_id_team_id_fk" FOREIGN KEY ("owner_team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_name_system_unique" ON "exercise" USING btree ("name") WHERE "owner_user_id" IS NULL AND "owner_team_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_name_user_unique" ON "exercise" USING btree ("name","owner_user_id") WHERE "owner_user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_name_team_unique" ON "exercise" USING btree ("name","owner_team_id") WHERE "owner_team_id" IS NOT NULL;
