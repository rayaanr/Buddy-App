CREATE TABLE "activity_invites" (
	"activity_id" uuid NOT NULL,
	"invitee_id" uuid NOT NULL,
	"inviter_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_invites_activity_id_invitee_id_pk" PRIMARY KEY("activity_id","invitee_id")
);
--> statement-breakpoint
ALTER TABLE "activity_invites" ADD CONSTRAINT "activity_invites_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_invites" ADD CONSTRAINT "activity_invites_invitee_id_user_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_invites" ADD CONSTRAINT "activity_invites_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_invites_invitee_idx" ON "activity_invites" USING btree ("invitee_id");--> statement-breakpoint
CREATE INDEX "activity_invites_inviter_idx" ON "activity_invites" USING btree ("inviter_id");