-- Add format/length checks for username and slug fields.
-- Aligns with @brint/core-validation rules.

ALTER TABLE "users"
ADD CONSTRAINT "users_username_format_check"
CHECK (
  username IS NULL
  OR (
    length(username) >= 3
    AND length(username) <= 24
    AND username ~ '^[A-Za-z0-9](?:[A-Za-z0-9_\\-]*[A-Za-z0-9])$'
  )
);

ALTER TABLE "workspaces"
ADD CONSTRAINT "workspaces_slug_format_check"
CHECK (
  length(slug) >= 3
  AND length(slug) <= 64
  AND slug ~ '^[A-Za-z0-9](?:[A-Za-z0-9_\\-]*[A-Za-z0-9])$'
);

ALTER TABLE "brands"
ADD CONSTRAINT "brands_slug_format_check"
CHECK (
  length(slug) >= 3
  AND length(slug) <= 64
  AND slug ~ '^[A-Za-z0-9](?:[A-Za-z0-9_\\-]*[A-Za-z0-9])$'
);
