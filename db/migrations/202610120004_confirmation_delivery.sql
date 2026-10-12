-- Private delivery state permits retry after the submission commits but its
-- confirmation email fails. Provider idempotency prevents duplicate sends.
alter table public.email_verifications add column confirmation_sent_at timestamptz;
