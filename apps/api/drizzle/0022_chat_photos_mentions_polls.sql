CREATE TABLE "poll_votes" (
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"option_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "poll_votes_message_id_user_id_option_id_pk" PRIMARY KEY("message_id","user_id","option_id")
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "image_key" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "image_width" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "image_height" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "mentions" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "poll" jsonb;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "poll_votes_user_idx" ON "poll_votes" USING btree ("user_id");