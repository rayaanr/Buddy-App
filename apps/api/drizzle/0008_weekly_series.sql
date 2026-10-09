ALTER TABLE "activities" ADD COLUMN "series_id" uuid;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "repeats_weekly" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "activities_series_starts_at_idx" ON "activities" USING btree ("series_id","starts_at");