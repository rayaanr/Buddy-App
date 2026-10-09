CREATE TABLE "activity_removals" (
	"activity_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_removals_activity_id_user_id_pk" PRIMARY KEY("activity_id","user_id"),
	CONSTRAINT "activity_removals_reason_check" CHECK ("activity_removals"."reason" in ('not_a_fit', 'behaviour', 'other'))
);
--> statement-breakpoint
ALTER TABLE "activity_removals" ADD CONSTRAINT "activity_removals_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_removals" ADD CONSTRAINT "activity_removals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;