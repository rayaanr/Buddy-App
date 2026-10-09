CREATE TABLE "activity_waitlist" (
	"activity_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_waitlist_activity_id_user_id_pk" PRIMARY KEY("activity_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "activity_waitlist" ADD CONSTRAINT "activity_waitlist_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_waitlist" ADD CONSTRAINT "activity_waitlist_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_waitlist_user_idx" ON "activity_waitlist" USING btree ("user_id");