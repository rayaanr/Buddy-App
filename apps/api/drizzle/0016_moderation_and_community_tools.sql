CREATE TABLE "community_removals" (
	"community_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_removals_community_id_user_id_pk" PRIMARY KEY("community_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "notify_communities" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "resolution" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "resolved_by" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "community_removals" ADD CONSTRAINT "community_removals_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_removals" ADD CONSTRAINT "community_removals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "community_removals_user_idx" ON "community_removals" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reports_resolved_by_idx" ON "reports" USING btree ("resolved_by");--> statement-breakpoint
-- Search on Discover matches activity titles and places as you type (pg_trgm is enabled in 0009).
CREATE INDEX "activities_title_trgm_idx" ON "activities" USING gin (lower("title") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "activities_place_trgm_idx" ON "activities" USING gin (lower("place") gin_trgm_ops);
