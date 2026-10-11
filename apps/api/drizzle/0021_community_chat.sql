CREATE TABLE "community_chat_reads" (
	"community_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone NOT NULL,
	CONSTRAINT "community_chat_reads_community_id_user_id_pk" PRIMARY KEY("community_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "activity_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "community_members" ADD COLUMN "chat_muted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "community_id" uuid;--> statement-breakpoint
ALTER TABLE "community_chat_reads" ADD CONSTRAINT "community_chat_reads_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_chat_reads" ADD CONSTRAINT "community_chat_reads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "community_chat_reads_user_idx" ON "community_chat_reads" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_community_created_idx" ON "messages" USING btree ("community_id","created_at","id");--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_check" CHECK (("messages"."activity_id" is null) <> ("messages"."community_id" is null));