-- Independent Botcake warehouse; no changes to legacy spin data.
begin;
create table public.chatbot_voucher_pools (
 id uuid primary key default gen_random_uuid(),
 campaign text not null check(length(campaign) between 1 and 100),
 prize_code text not null check(length(prize_code) between 1 and 40),
 name text not null,
 is_test boolean not null default true,
 enabled boolean not null default false,
 expires_at timestamptz,
 created_at timestamptz not null default now(),
 unique(campaign,prize_code,is_test)
);
create table public.chatbot_vouchers (
 id uuid primary key default gen_random_uuid(),
 pool_id uuid not null references public.chatbot_voucher_pools(id),
 code text not null unique check(code ~ '^[A-Z0-9_-]{5,64}$'),
 status text not null default 'available' check(status in ('available','issued','redeemed','void')),
 customer_id text,
 event_id text,
 issued_at timestamptz,
 created_at timestamptz not null default now(),
 unique(pool_id,event_id),
 check ((status='available' and customer_id is null and event_id is null and issued_at is null) or (status<>'available' and customer_id is not null and event_id is not null and issued_at is not null))
);
create index chatbot_vouchers_available on public.chatbot_vouchers(pool_id,created_at,id) where status='available';
alter table public.chatbot_voucher_pools enable row level security;
alter table public.chatbot_vouchers enable row level security;
revoke all on public.chatbot_voucher_pools, public.chatbot_vouchers from anon,authenticated;
grant select on public.chatbot_voucher_pools to authenticated;
grant select,insert on public.chatbot_vouchers to authenticated;
grant all on public.chatbot_voucher_pools,public.chatbot_vouchers to service_role;
create policy chatbot_pools_owner_read on public.chatbot_voucher_pools for select to authenticated using ((select security_private.is_owner()));
create policy chatbot_codes_owner_read on public.chatbot_vouchers for select to authenticated using ((select security_private.is_owner()));
create policy chatbot_codes_owner_import on public.chatbot_vouchers for insert to authenticated with check ((select security_private.is_owner()) and status='available' and customer_id is null and event_id is null and issued_at is null);
create function public.chatbot_import_codes(p_pool_id uuid,p_codes text[]) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare n int; distinct_n int;
begin
 if cardinality(p_codes) is null or cardinality(p_codes)<1 or cardinality(p_codes)>10000 then raise exception 'Nhập từ 1 đến 10.000 mã mỗi lần'; end if;
 if not exists(select 1 from public.chatbot_voucher_pools where id=p_pool_id) then raise exception 'Không có quyền hoặc kho không tồn tại'; end if;
 if exists(select 1 from unnest(p_codes) c where c is null or upper(btrim(c)) !~ '^[A-Z0-9_-]{5,64}$') then raise exception 'Mã cần 5–64 ký tự: chữ, số, gạch ngang hoặc gạch dưới'; end if;
 select count(distinct upper(btrim(c))) into distinct_n from unnest(p_codes) c;
 insert into public.chatbot_vouchers(pool_id,code) select p_pool_id,upper(btrim(c)) from unnest(p_codes) c on conflict(code) do nothing;
 get diagnostics n=row_count;
 return jsonb_build_object('inserted',n,'duplicates',cardinality(p_codes)-n,'total',cardinality(p_codes));
end $$;
revoke all on function public.chatbot_import_codes(uuid,text[]) from public,anon;
grant execute on function public.chatbot_import_codes(uuid,text[]) to authenticated,service_role;
-- Backend only. An event key must remain identical on retries and differ for a new win.
create function public.chatbot_issue_code(p_pool_id uuid,p_customer_id text,p_event_id text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v public.chatbot_vouchers; p public.chatbot_voucher_pools;
begin
 if nullif(btrim(p_customer_id),'') is null or nullif(btrim(p_event_id),'') is null then raise exception 'customer_id and event_id required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_pool_id::text||':'||p_event_id,0));
 select * into v from public.chatbot_vouchers where pool_id=p_pool_id and event_id=p_event_id;
 if found then
  if v.customer_id<>p_customer_id then raise exception 'Event belongs to another customer'; end if;
  return jsonb_build_object('status','success','voucher_code',v.code,'replayed',true);
 end if;
 select * into p from public.chatbot_voucher_pools where id=p_pool_id for share;
 if not found or not p.enabled then return jsonb_build_object('status','disabled'); end if;
 if p.expires_at is not null and p.expires_at<=now() then return jsonb_build_object('status','expired'); end if;
 select * into v from public.chatbot_vouchers where pool_id=p_pool_id and status='available' order by created_at,id limit 1 for update skip locked;
 if not found then return jsonb_build_object('status','out_of_stock'); end if;
 update public.chatbot_vouchers set status='issued',customer_id=p_customer_id,event_id=p_event_id,issued_at=now() where id=v.id;
 return jsonb_build_object('status','success','voucher_code',v.code,'replayed',false);
end $$;
revoke all on function public.chatbot_issue_code(uuid,text,text) from public,anon,authenticated;
grant execute on function public.chatbot_issue_code(uuid,text,text) to service_role;
insert into public.chatbot_voucher_pools(campaign,prize_code,name,is_test,enabled)
values('BOTCAKE_TEST_20261126','TP10k','Free topping — thử nghiệm',true,true);
commit;
