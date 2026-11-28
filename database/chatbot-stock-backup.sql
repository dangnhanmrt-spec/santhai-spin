begin;
alter table public.chatbot_voucher_pools add column backup_for uuid unique references public.chatbot_voucher_pools(id);
alter table public.chatbot_voucher_pools add constraint chatbot_backup_not_self check(backup_for is null or backup_for<>id);
insert into public.chatbot_voucher_pools(campaign,prize_code,name,is_test,enabled,backup_for)
select campaign||'_BACKUP',prize_code,name||' — Backup',is_test,enabled,id from public.chatbot_voucher_pools where backup_for is null and campaign in ('BOTCAKE_LIVE','BOTCAKE_TEST_20261126');
create or replace function public.chatbot_issue_code(p_pool_id uuid,p_customer_id text,p_event_id text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v public.chatbot_vouchers; p public.chatbot_voucher_pools; b public.chatbot_voucher_pools; source text:='main';
begin
 if nullif(btrim(p_customer_id),'') is null or nullif(btrim(p_event_id),'') is null then raise exception 'customer_id and event_id required'; end if;
 -- Serialize allocations for a prize so a locked final main code is not mistaken for empty stock.
 perform pg_advisory_xact_lock(hashtextextended('chatbot-prize:'||p_pool_id::text,0));
 select * into p from public.chatbot_voucher_pools where id=p_pool_id for share;
 if not found or p.backup_for is not null then return jsonb_build_object('status','disabled'); end if;
 select * into b from public.chatbot_voucher_pools where backup_for=p.id and prize_code=p.prize_code and is_test=p.is_test for share;
 select * into v from public.chatbot_vouchers where pool_id in (p.id,b.id) and event_id=p_event_id;
 if found then
  if v.customer_id<>p_customer_id then raise exception 'Event belongs to another customer'; end if;
  return jsonb_build_object('status','success','voucher_code',v.code,'replayed',true,'source',case when v.pool_id=p.id then 'main' else 'backup' end);
 end if;
 if not p.enabled then return jsonb_build_object('status','disabled'); end if;
 if p.expires_at is not null and p.expires_at<=now() then return jsonb_build_object('status','expired'); end if;
 select * into v from public.chatbot_vouchers where pool_id=p.id and status='available' order by created_at,id limit 1 for update;
 if not found then
  if b.id is null or not b.enabled or (b.expires_at is not null and b.expires_at<=now()) then return jsonb_build_object('status','out_of_stock'); end if;
  select * into v from public.chatbot_vouchers where pool_id=b.id and status='available' order by created_at,id limit 1 for update;
  if not found then return jsonb_build_object('status','out_of_stock'); end if;
  source:='backup';
 end if;
 update public.chatbot_vouchers set status='issued',customer_id=p_customer_id,event_id=p_event_id,issued_at=now() where id=v.id;
 return jsonb_build_object('status','success','voucher_code',v.code,'replayed',false,'source',source);
end $$;
create function public.chatbot_check_stock(p_pool_ids uuid[]) returns jsonb
language sql stable security invoker set search_path='' as $$
 with stocks as (
 select p.id,p.prize_code,p.enabled and (p.expires_at is null or p.expires_at>now()) as active,
 (select count(*) from public.chatbot_vouchers v where v.pool_id=p.id and v.status='available') as remaining
 from public.chatbot_voucher_pools p where p.id=any(p_pool_ids) and p.backup_for is null
 ), summary as (select count(*) as pool_count,count(*) filter(where remaining=0) as empty_count,bool_and(active) as active from stocks)
 select jsonb_build_object('status',case when pool_count<>5 or not coalesce(active,false) then 'unavailable' else 'success' end,
 'stock_gate',case when pool_count=5 and active and empty_count<3 then 'OPEN' else 'CLOSED' end,
 'empty_main_pools',empty_count,'main_pool_count',pool_count,'close_threshold',3,
 'pools',coalesce((select jsonb_agg(jsonb_build_object('prize_code',prize_code,'remaining',remaining)) from stocks),'[]'::jsonb)) from summary;
$$;
revoke all on function public.chatbot_check_stock(uuid[]) from public,anon,authenticated;
grant execute on function public.chatbot_check_stock(uuid[]) to service_role;
commit;
