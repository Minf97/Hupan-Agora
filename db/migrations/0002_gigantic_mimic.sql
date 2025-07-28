ALTER TABLE "agents" ADD COLUMN "x" integer;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "y" integer;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "color" varchar(7);--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "status" varchar(20) DEFAULT 'idle';