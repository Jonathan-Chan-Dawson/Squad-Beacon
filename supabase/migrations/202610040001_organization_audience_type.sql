-- This must remain separate from the migration that first uses the new enum
-- value: PostgreSQL only permits a newly-added enum value after commit.
alter type public.audience_kind add value if not exists 'organization';
