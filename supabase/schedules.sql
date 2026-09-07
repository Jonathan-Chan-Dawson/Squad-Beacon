-- Run after migrations and Edge Function deployment.
-- In Supabase Vault, first create secrets named beacon_worker_url and beacon_worker_secret.
-- beacon_worker_url = https://YOUR_PROJECT.supabase.co/functions/v1/push-worker
-- beacon_worker_secret must match the Edge Function WORKER_SECRET.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('beacon-worker-minute','* * * * *',$job$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='beacon_worker_url'),
  headers := jsonb_build_object('Content-Type','application/json','x-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='beacon_worker_secret')),
  body := '{}'::jsonb,
  timeout_milliseconds := 10000
 );
$job$);
-- Separate SQL cleanup keeps expiry cleanup running even when push providers are unavailable.
select cron.schedule('beacon-maintenance-minute','* * * * *','select public.beacon_maintenance();');
