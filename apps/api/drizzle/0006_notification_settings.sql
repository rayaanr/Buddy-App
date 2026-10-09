ALTER TABLE "activity_members" ADD COLUMN "chat_muted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "notify_chat" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "notify_reminders" boolean DEFAULT true NOT NULL;