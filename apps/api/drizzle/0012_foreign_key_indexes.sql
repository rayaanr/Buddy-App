CREATE INDEX "activity_removals_user_idx" ON "activity_removals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_reads_user_idx" ON "chat_reads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "messages_sender_idx" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "reports_reporter_target_idx" ON "reports" USING btree ("reporter_id","target_user_id","created_at");--> statement-breakpoint
CREATE INDEX "reports_target_idx" ON "reports" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "reports_activity_idx" ON "reports" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "reports_message_idx" ON "reports" USING btree ("message_id");