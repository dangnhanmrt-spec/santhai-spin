begin;
create table security_private.chatbot_members(email text primary key check(email=lower(btrim(email))), role text not null check(role in ('manager','viewer')), created_at timestamptz not null default now());
create table public.chatbot_rounds(id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 100), campaign text unique not null, is_test boolean not null, status text not null check(status in ('draft','active','closed')), created_at timestamptz not null default now(), closed_at timestamptz, snapshot jsonb);
alter table public.chatbot_rounds enable row level security;
alter table public.chatbot_voucher_pools add column round_id uuid references public.chatbot_rounds(id);
insert into public.chatbot_rounds(name,campaign,is_test,status) select case when is_test then 'Đợt thử nghiệm hiện tại' else 'Đợt phát hiện tại' end,campaign,is_test,'active' from public.chatbot_voucher_pools where backup_for is null group by campaign,is_test;
update public.chatbot_voucher_pools p set round_id=r.id from public.chatbot_rounds r where p.campaign=r.campaign or p.campaign=r.campaign||'_BACKUP';
create unique index chatbot_one_active_round on public.chatbot_rounds(is_test) where status='active';
create index chatbot_pool_round on public.chatbot_voucher_pools(round_id);
create table security_private.chatbot_audit(id bigint generated always as identity primary key, at timestamptz not null default now(), actor uuid, email text, action text not null, details jsonb not null default '{}'::jsonb);
create table security_private.chatbot_sessions(session_id uuid primary key, user_id uuid not null, login_at timestamptz not null, first_seen timestamptz not null default now());
alter table security_private.chatbot_members enable row level security;
alter table security_private.chatbot_audit enable row level security;
alter table security_private.chatbot_sessions enable row level security;
create index chatbot_audit_at on security_private.chatbot_audit(at desc);
create function security_private.chatbot_role() returns text language sql stable security definer set search_path='' as $$
 select case when security_private.is_owner() then 'owner' else (select m.role from security_private.chatbot_members m join auth.users u on lower(u.email)=m.email where u.id=auth.uid() and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)) end;
$$;
revoke all on function security_private.chatbot_role() from public,anon;
grant execute on function security_private.chatbot_role() to authenticated;
drop policy chatbot_pools_owner_read on public.chatbot_voucher_pools;
drop policy chatbot_codes_owner_read on public.chatbot_vouchers;
drop policy chatbot_codes_owner_import on public.chatbot_vouchers;
create policy chatbot_pools_member_read on public.chatbot_voucher_pools for select to authenticated using ((select security_private.chatbot_role()) is not null);
create policy chatbot_codes_member_read on public.chatbot_vouchers for select to authenticated using ((select security_private.chatbot_role()) is not null);
create policy chatbot_rounds_member_read on public.chatbot_rounds for select to authenticated using ((select security_private.chatbot_role()) is not null);
grant select on public.chatbot_rounds to authenticated;
grant all on public.chatbot_rounds to service_role;
revoke insert on public.chatbot_vouchers from authenticated;
create function security_private.chatbot_admin(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare role_name text:=security_private.chatbot_role(); result jsonb; actor_email text; p public.chatbot_voucher_pools; r public.chatbot_rounds; target public.chatbot_rounds; n integer; total integer; sid uuid; login_time timestamptz; main_id uuid; prize text; camp text; codes text[];
begin
 if role_name is null then raise exception 'Tài khoản chưa được cấp quyền' using errcode='42501'; end if;
 select email into actor_email from auth.users where id=auth.uid();
 if p_action='context' then
  sid:=nullif(auth.jwt()->>'session_id','')::uuid;
  select created_at into login_time from auth.sessions where id=sid and user_id=auth.uid();
  if login_time is not null then
   insert into security_private.chatbot_sessions(session_id,user_id,login_at) values(sid,auth.uid(),login_time) on conflict do nothing;
   if found then insert into security_private.chatbot_audit(actor,email,action,details) values(auth.uid(),actor_email,'session',jsonb_build_object('login_at',login_time)); end if;
  end if;
  return jsonb_build_object('role',role_name);
 end if;
 if p_action='rounds' then return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from public.chatbot_rounds x),'[]'); end if;
 if p_action in ('members','grant','revoke','logs','create','close','transfer','activate') and role_name<>'owner' then raise exception 'Chỉ chủ sở hữu được thực hiện' using errcode='42501'; end if;
 if p_action in ('import','export') and role_name not in ('owner','manager') then raise exception 'Cần quyền quản lý kho' using errcode='42501'; end if;
 if p_action='members' then return coalesce((select jsonb_agg(to_jsonb(m) order by email) from security_private.chatbot_members m),'[]');
 elsif p_action='logs' then return coalesce((select jsonb_agg(to_jsonb(x) order by id desc) from (select * from security_private.chatbot_audit order by id desc limit 100 offset greatest(0,least(coalesce((p_data->>'offset')::integer,0),1000000))) x),'[]');
 elsif p_action in ('grant','revoke') then
  if lower(btrim(p_data->>'email'))='dangnhan.mrt@gmail.com' then raise exception 'Không thay đổi chủ sở hữu'; end if;
  if coalesce(p_data->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Email không hợp lệ'; end if;
  if p_action='grant' then insert into security_private.chatbot_members(email,role) values(lower(btrim(p_data->>'email')),p_data->>'role') on conflict(email) do update set role=excluded.role;
  else delete from security_private.chatbot_members where email=lower(btrim(p_data->>'email')); end if;
  result:=jsonb_build_object('email',lower(btrim(p_data->>'email')),'role',p_data->>'role');
 elsif p_action='import' then
  select * into p from public.chatbot_voucher_pools where id=(p_data->>'pool_id')::uuid for share;
  select * into r from public.chatbot_rounds where id=p.round_id;
  if p.id is null or r.status='closed' then raise exception 'Kho đã chốt hoặc không tồn tại'; end if;
  select array_agg(upper(btrim(value))) into codes from jsonb_array_elements_text(p_data->'codes');
  total:=coalesce(array_length(codes,1),0);
  if total<1 or total>10000 or exists(select 1 from unnest(codes) c where c !~ '^[A-Z0-9_-]{5,64}$') then raise exception 'Nhập 1–10.000 mã hợp lệ, mỗi mã 5–64 ký tự'; end if;
  insert into public.chatbot_vouchers(pool_id,code) select p.id,c from unnest(codes) c on conflict(code) do nothing;
  get diagnostics n=row_count;
  result:=jsonb_build_object('pool_id',p.id,'pool',p.name,'inserted',n,'duplicates',total-n,'total',total);
 elsif p_action='export' then
  select * into p from public.chatbot_voucher_pools where id=(p_data->>'pool_id')::uuid;
  if p.id is null then raise exception 'Kho không tồn tại'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (select code,status from public.chatbot_vouchers where pool_id=p.id and (coalesce(p_data->>'filter','all')='all' or status=p_data->>'filter') order by created_at,id limit 1000 offset greatest(0,coalesce((p_data->>'offset')::integer,0))) x;
  insert into security_private.chatbot_audit(actor,email,action,details) values(auth.uid(),actor_email,'export',jsonb_build_object('pool',p.name,'count',jsonb_array_length(result),'filter',p_data->>'filter'));
  return result;
 elsif p_action='create' then
  camp:='ROUND_'||replace(gen_random_uuid()::text,'-','');
  insert into public.chatbot_rounds(name,campaign,is_test,status) values(btrim(p_data->>'name'),camp,(p_data->>'is_test')::boolean,'draft') returning * into r;
  foreach prize in array array['TP10k','x2TP','M2T1','Upsiz','15%'] loop
   insert into public.chatbot_voucher_pools(campaign,prize_code,name,is_test,enabled,round_id,expires_at) values(camp,prize,prize,r.is_test,false,r.id,nullif(p_data->>'expires_at','')::timestamptz) returning id into main_id;
   insert into public.chatbot_voucher_pools(campaign,prize_code,name,is_test,enabled,round_id,backup_for,expires_at) values(camp||'_BACKUP',prize,prize||' — Backup',r.is_test,false,r.id,main_id,nullif(p_data->>'expires_at','')::timestamptz);
  end loop;
  result:=to_jsonb(r);
 elsif p_action in ('close','activate') then
  select * into r from public.chatbot_rounds where id=(p_data->>'round_id')::uuid for update;
  if r.id is null then raise exception 'Đợt không tồn tại'; end if;
  -- Same lock order as issuance (main first, then backup); wait for in-flight allocations.
  perform id from public.chatbot_voucher_pools where round_id=r.id order by (backup_for is not null),id for update;
  if p_action='close' then
   if r.status<>'active' then raise exception 'Chỉ chốt đợt đang phát'; end if;
   update public.chatbot_voucher_pools set enabled=false where round_id=r.id;
   select jsonb_agg(to_jsonb(x)) into result from (select cp.prize_code,(cp.backup_for is not null) as backup,v.status,count(v.id) as quantity from public.chatbot_voucher_pools cp left join public.chatbot_vouchers v on v.pool_id=cp.id where cp.round_id=r.id group by cp.prize_code,cp.backup_for,v.status) x;
   update public.chatbot_rounds set status='closed',closed_at=now(),snapshot=result where id=r.id;
  else
   if r.status<>'draft' then raise exception 'Chỉ mở đợt chuẩn bị'; end if;
   if exists(select 1 from public.chatbot_rounds where is_test=r.is_test and status='active') then raise exception 'Cần chốt đợt cũ sau khi khách đã dùng hết lượt'; end if;
   if exists(select 1 from public.chatbot_voucher_pools where round_id=r.id and expires_at<=now()) then raise exception 'Đợt có kho hết hạn'; end if;
   update public.chatbot_rounds set status='active' where id=r.id;
   update public.chatbot_voucher_pools set enabled=true where round_id=r.id;
  end if;
  result:=jsonb_build_object('round',r.name,'round_id',r.id);
 elsif p_action='transfer' then
  -- Lock rounds in stable order; issuance also locks pools before changing vouchers.
  perform id from public.chatbot_rounds where id in ((p_data->>'from')::uuid,(p_data->>'to')::uuid) order by id for update;
  select * into r from public.chatbot_rounds where id=(p_data->>'from')::uuid;
  select * into target from public.chatbot_rounds where id=(p_data->>'to')::uuid;
  if r.id is null or target.id is null or r.status<>'closed' or target.status<>'draft' or r.is_test<>target.is_test then raise exception 'Chuyển từ đợt đã chốt sang đợt chuẩn bị cùng chế độ'; end if;
  perform id from public.chatbot_voucher_pools where round_id in (r.id,target.id) order by (backup_for is not null),id for update;
  if exists(select 1 from public.chatbot_voucher_pools s join public.chatbot_voucher_pools d on d.round_id=target.id and d.prize_code=s.prize_code and (d.backup_for is null)=(s.backup_for is null) where s.round_id=r.id and s.expires_at>now() and (d.expires_at is null or d.expires_at>s.expires_at) and exists(select 1 from public.chatbot_vouchers v where v.pool_id=s.id and v.status='available')) then raise exception 'Hạn dùng đợt mới không được kéo dài hạn mã tồn'; end if;
  update public.chatbot_vouchers v set pool_id=d.id from public.chatbot_voucher_pools s join public.chatbot_voucher_pools d on d.round_id=target.id and d.prize_code=s.prize_code and (d.backup_for is null)=(s.backup_for is null) where s.round_id=r.id and v.pool_id=s.id and v.status='available' and (s.expires_at is null or s.expires_at>now()) and (d.expires_at is null or d.expires_at>now());
  get diagnostics n=row_count;
  result:=jsonb_build_object('from',r.name,'to',target.name,'moved',n);
 else raise exception 'Thao tác không hợp lệ'; end if;
 insert into security_private.chatbot_audit(actor,email,action,details) values(auth.uid(),actor_email,p_action,result);
 return result;
end $$;
revoke all on function security_private.chatbot_admin(text,jsonb) from public,anon;
grant execute on function security_private.chatbot_admin(text,jsonb) to authenticated;
create function public.chatbot_admin(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$ select security_private.chatbot_admin(p_action,p_data) $$;
revoke all on function public.chatbot_admin(text,jsonb) from public,anon;
grant execute on function public.chatbot_admin(text,jsonb) to authenticated;
create or replace function public.chatbot_import_codes(p_pool_id uuid,p_codes text[]) returns jsonb language sql security invoker set search_path='' as $$ select security_private.chatbot_admin('import',jsonb_build_object('pool_id',p_pool_id,'codes',to_jsonb(p_codes))) $$;
create function public.chatbot_resolve_campaign(p_campaign text) returns jsonb language sql stable security invoker set search_path='' as $$ select coalesce(jsonb_agg(jsonb_build_object('campaignId',p.campaign,'prizeCode',p.prize_code,'poolId',p.id,'isTest',p.is_test)),'[]') from public.chatbot_voucher_pools p join public.chatbot_rounds r on r.id=p.round_id where p.campaign=p_campaign and p.backup_for is null $$;
revoke all on function public.chatbot_resolve_campaign(text) from public,anon,authenticated;
grant execute on function public.chatbot_resolve_campaign(text) to service_role;
create function security_private.chatbot_issue_audit() returns trigger language plpgsql security definer set search_path='' as $$ begin if new.status='issued' and old.status='available' then insert into security_private.chatbot_audit(action,details) values('issue',jsonb_build_object('voucher_id',new.id,'pool_id',new.pool_id,'customer_id',new.customer_id)); end if; return new; end $$;
revoke all on function security_private.chatbot_issue_audit() from public,anon,authenticated;
create trigger chatbot_issue_audit after update of status on public.chatbot_vouchers for each row execute function security_private.chatbot_issue_audit();
commit;
