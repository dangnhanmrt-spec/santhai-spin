begin;
-- Read-only; the stock function uses invoker RLS for authenticated readers.
grant execute on function public.chatbot_check_stock(uuid[]) to authenticated;
create function public.chatbot_stock_overview(p_round_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 with inventory as (
 select p.id,p.prize_code,p.backup_for,p.enabled,p.expires_at,
 count(v.id) as total,count(v.id) filter(where v.status='available') as remaining,
 count(v.id) filter(where v.status in ('issued','redeemed')) as issued
 from public.chatbot_voucher_pools p left join public.chatbot_vouchers v on v.pool_id=p.id
 where p.round_id=p_round_id group by p.id
 )
 select jsonb_build_object('checked_at',now(),'round_id',r.id,'campaign',r.campaign,'round_status',r.status,
 'gate',public.chatbot_check_stock(array(select id from inventory where backup_for is null)),
 'main_remaining',coalesce((select sum(remaining) from inventory where backup_for is null),0),
 'main_total',coalesce((select sum(total) from inventory where backup_for is null),0),
 'backup_remaining',coalesce((select sum(remaining) from inventory where backup_for is not null),0),
 'backup_total',coalesce((select sum(total) from inventory where backup_for is not null),0),
 'prizes',coalesce((select jsonb_agg(jsonb_build_object('prize_code',m.prize_code,'main_remaining',m.remaining,'main_total',m.total,'backup_remaining',coalesce(b.remaining,0),'backup_total',coalesce(b.total,0),'issued',m.issued+coalesce(b.issued,0),'enabled',m.enabled,'expired',coalesce(m.expires_at<=now(),false))) from inventory m left join inventory b on b.backup_for=m.id where m.backup_for is null),'[]'::jsonb))
 from public.chatbot_rounds r where r.id=p_round_id;
$$;
revoke all on function public.chatbot_stock_overview(uuid) from public,anon;
grant execute on function public.chatbot_stock_overview(uuid) to authenticated;
commit;
