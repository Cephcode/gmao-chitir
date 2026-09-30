-- Étape 7b (validée le 2026-09-30) : envoi des notifications par mail et push.
-- Chaque nouvelle notification (quelle que soit sa source : panne, clôture, stock, tâche
-- du matin) déclenche l'Edge Function envoyer-notification, avec seulement son id.
-- La fonction « réserve » la notification (delivered_at) avant d'envoyer : pas de double
-- envoi, et un appel avec un id quelconque ne fait rien. Aucun secret n'est stocké ici.

-- Date de remise aux canaux externes (mail, push). Null = pas encore envoyée.
alter table notifications add column delivered_at timestamptz;

-- Appareils qui reçoivent les push (jeton Firebase Cloud Messaging d'un navigateur).
create table push_tokens (
  token text primary key,
  user_id uuid not null references users (id) on delete cascade,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_tokens_user_idx on push_tokens (user_id);

-- Chacun ne voit et ne gère que ses propres appareils.
alter table push_tokens enable row level security;
create policy push_tokens_select on push_tokens for select to authenticated
  using (user_id = auth.uid());
create policy push_tokens_insert on push_tokens for insert to authenticated
  with check (user_id = auth.uid());
create policy push_tokens_update on push_tokens for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_tokens_delete on push_tokens for delete to authenticated
  using (user_id = auth.uid());

-- Appel asynchrone de l'Edge Function (pg_net) : ne bloque pas la transaction, et rien
-- ne part si elle est annulée. L'URL contient la référence du projet hébergé (publique,
-- déjà présente dans l'application) ; en local, l'appel ne trouve pas la notification
-- dans la base hébergée et ne fait rien.
create extension if not exists pg_net with schema extensions;

create function envoyer_notification_trigger()
returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
begin
  perform net.http_post(
    url := 'https://jmxeewnhthhlutqgeixj.supabase.co/functions/v1/envoyer-notification',
    body := jsonb_build_object('id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
end;
$$;

revoke execute on function envoyer_notification_trigger() from public, anon, authenticated;

create trigger trg_notifications_envoi
  after insert on notifications
  for each row execute function envoyer_notification_trigger();
