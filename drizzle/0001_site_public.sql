CREATE TABLE "enrollment_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"child_last_name" text NOT NULL,
	"child_first_name" text NOT NULL,
	"class_id" integer,
	"school" text,
	"message" text,
	"status" text DEFAULT 'NOUVELLE' NOT NULL,
	"student_id" integer,
	"handled_by" uuid,
	"handled_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"path" text NOT NULL,
	"section" text NOT NULL,
	"visitor" text NOT NULL,
	"device" text NOT NULL,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enrollment_requests" ADD CONSTRAINT "enrollment_requests_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_requests" ADD CONSTRAINT "enrollment_requests_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_requests" ADD CONSTRAINT "enrollment_requests_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enrollment_requests_status_idx" ON "enrollment_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "page_views_day_idx" ON "page_views" USING btree ("day");--> statement-breakpoint
CREATE INDEX "page_views_section_idx" ON "page_views" USING btree ("section","day");