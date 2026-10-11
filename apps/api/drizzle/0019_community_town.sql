ALTER TABLE "communities" ADD COLUMN "place_id" integer DEFAULT 1841 NOT NULL;--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "communities_place_idx" ON "communities" USING btree ("place_id");--> statement-breakpoint
-- Existing communities meet where whoever started them lives.
UPDATE "communities" c SET "place_id" = p."place_id" FROM "profiles" p WHERE p."user_id" = c."created_by";
