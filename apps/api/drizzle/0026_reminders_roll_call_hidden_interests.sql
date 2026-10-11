ALTER TABLE "activities" ADD COLUMN "day_before_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "activity_members" ADD COLUMN "attended" boolean;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "hidden_interests" text[] DEFAULT '{}'::text[] NOT NULL;