ALTER TABLE "profiles" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint
-- Anyone who already picked their interests had finished setup under the old rule.
UPDATE "profiles" SET "onboarded_at" = "created_at" WHERE cardinality("interests") >= 3;
