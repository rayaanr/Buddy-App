-- Images are stored without our hosts, so moving storage or the API only
-- means changing R2_PUBLIC_URL / BETTER_AUTH_URL: uploads as R2 keys
-- (covers/<user>/<id>.jpg), Buddy's pictures as paths (/fallbacks/<id>.svg).
-- Full URLs stay only for images we don't host (e.g. Google profile photos).
UPDATE "activities" SET "cover_url" = regexp_replace("cover_url", '^https?://[^/]+/((covers|logos|avatars)/.+)$', '\1') WHERE "cover_url" ~ '^https?://[^/]+/(covers|logos|avatars)/';--> statement-breakpoint
UPDATE "activities" SET "cover_url" = regexp_replace("cover_url", '^https?://[^/]+(/fallbacks/[a-z0-9-]+\.svg)$', '\1') WHERE "cover_url" ~ '^https?://[^/]+/fallbacks/';--> statement-breakpoint
UPDATE "communities" SET "cover_url" = regexp_replace("cover_url", '^https?://[^/]+/((covers|logos|avatars)/.+)$', '\1') WHERE "cover_url" ~ '^https?://[^/]+/(covers|logos|avatars)/';--> statement-breakpoint
UPDATE "communities" SET "cover_url" = regexp_replace("cover_url", '^https?://[^/]+(/fallbacks/[a-z0-9-]+\.svg)$', '\1') WHERE "cover_url" ~ '^https?://[^/]+/fallbacks/';--> statement-breakpoint
UPDATE "communities" SET "logo_url" = regexp_replace("logo_url", '^https?://[^/]+/((covers|logos|avatars)/.+)$', '\1') WHERE "logo_url" ~ '^https?://[^/]+/(covers|logos|avatars)/';--> statement-breakpoint
UPDATE "communities" SET "logo_url" = regexp_replace("logo_url", '^https?://[^/]+(/fallbacks/[a-z0-9-]+\.svg)$', '\1') WHERE "logo_url" ~ '^https?://[^/]+/fallbacks/';--> statement-breakpoint
UPDATE "profiles" SET "avatar_url" = regexp_replace("avatar_url", '^https?://[^/]+(/fallbacks/[a-z0-9-]+\.svg)$', '\1') WHERE "avatar_url" ~ '^https?://[^/]+/fallbacks/';
