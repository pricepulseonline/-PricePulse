-- PricePulse V78.8.143 — authenticated user's own Plus membership read helper
-- Run AFTER supabase-plus-wallet-v141-final.sql.
-- Safe for repeat execution.

create or replace function public.pp_get_my_plus_membership()
returns table(
  status text,
  claimed_at timestamptz,
  activated_at timestamptz,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(m.status,'available')::text as status,
    m.claimed_at,
    m.activated_at,
    m.expires_at
  from (select auth.uid() as user_id) me
  left join public.pp_plus_memberships m on m.user_id = me.user_id
  where me.user_id is not null;
$$;

revoke all on function public.pp_get_my_plus_membership() from public, anon;
grant execute on function public.pp_get_my_plus_membership() to authenticated;
