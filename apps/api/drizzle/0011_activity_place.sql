ALTER TABLE "activities" ADD COLUMN "place_id" integer;--> statement-breakpoint
-- Existing activities: the town nearest their meeting point, preferring a
-- main town within 5 km (the same rule as nearestPlace in the API).
UPDATE "activities" a SET "place_id" = (
  SELECT p."id" FROM "places" p
  WHERE NOT p."approximate"
  ORDER BY (p."main" AND ST_DWithin(p."location", a."location", 5000)) DESC, p."location" <-> a."location"
  LIMIT 1
);--> statement-breakpoint
ALTER TABLE "activities" ALTER COLUMN "place_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_place_idx" ON "activities" USING btree ("place_id");
