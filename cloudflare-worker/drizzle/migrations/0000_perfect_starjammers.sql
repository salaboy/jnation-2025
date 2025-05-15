CREATE TABLE `geese` (
	`id` integer PRIMARY KEY NOT NULL,
	`region` text NOT NULL,
	`name` text NOT NULL,
	`info` text NOT NULL,
	`base_price` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
