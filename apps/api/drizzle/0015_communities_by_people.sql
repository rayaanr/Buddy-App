ALTER TABLE "communities" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "community_id" uuid;--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "communities_created_by_idx" ON "communities" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "communities_name_lower_idx" ON "communities" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "reports_community_idx" ON "reports" USING btree ("community_id");