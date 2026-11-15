CREATE TABLE "rent_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'AJOUT' NOT NULL,
	"room_id" integer NOT NULL,
	"date" date NOT NULL,
	"seances" integer DEFAULT 0 NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"rate" integer DEFAULT 0 NOT NULL,
	"label" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rent_entries" ADD CONSTRAINT "rent_entries_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_entries" ADD CONSTRAINT "rent_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rent_entries_date_idx" ON "rent_entries" USING btree ("date");--> statement-breakpoint
CREATE INDEX "rent_entries_room_idx" ON "rent_entries" USING btree ("room_id","date");