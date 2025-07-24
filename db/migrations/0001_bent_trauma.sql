ALTER TABLE "agents" ALTER COLUMN "x" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "x" SET DEFAULT '5';--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "x" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "y" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "y" SET DEFAULT '5';--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "y" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "color" SET DEFAULT '#FF5733';--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "color" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "status" SET NOT NULL;