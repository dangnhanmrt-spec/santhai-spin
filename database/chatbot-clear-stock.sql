begin;
create table security_private.chatbot_clear_batches(id uuid primary key default gen_random_uuid(),actor uuid not null,created_at timestamptz not null default now(),completed_at timestamptz,pool_ids uuid[] not null,voucher_ids uuid[] not null,summary jsonb not null);
create table security_private.chatbot_cleared_vouchers(voucher_id uuid primary key,batch_id uuid not null references security_private.chatbot_clear_batches(id),record jsonb not null);
alter table security_private.chatbot_clear_batches enable row level security;
alter table security_private.chatbot_cleared_vouchers enable row level security;
create index chatbot_cleared_batch on security_private.chatbot_cleared_vouchers(batch_id);
create function security_private.chatbot_clear_stock(p_pool_ids uuid[] default null,p_batch_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare ids uuid[]; selected uuid[]; summary jsonb; batch security_private.chatbot_clear_batches; n integer; email text;
begin
 if security_private.chatbot_role() is distinct from 'owner' then raise exception 'Chỉ chủ sở hữu được dọn mã' using errcode='42501';end if;
 if p_batch_id is null then
  select array_agg(distinct x order by x) into selected from unnest(p_pool_ids) x where x is not null;
  if coalesce(cardinality(selected),0) not between 1 and 10 then raise exception 'Chọn từ 1 đến 10 kho trong cùng một đợt';end if;
  if (select count(*) from public.chatbot_voucher_pools where id=any(selected))<>cardinality(selected) or (select count(distinct round_id) from public.chatbot_voucher_pools where id=any(selected))<>1 then raise exception 'Kho không hợp lệ hoặc khác đợt';end if;
  -- Lock main before backup, matching issue/round operations. Import and issue wait until snapshot is captured.
  perform id from public.chatbot_voucher_pools where id=any(selected) order by (backup_for is not null),id for update;
  if exists(select 1 from public.chatbot_voucher_pools p join public.chatbot_rounds r on r.id=p.round_id where p.id=any(selected) and r.status='closed') then raise exception 'Không dọn mã của đợt đã chốt';end if;
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into ids from public.chatbot_vouchers where pool_id=any(selected) and status='available';
  select jsonb_agg(to_jsonb(x) order by x.backup,x.prize_code) into summary from (select p.id as pool_id,p.prize_code,p.backup_for is not null as backup,r.name as round_name,r.is_test,count(v.id) as available from public.chatbot_voucher_pools p join public.chatbot_rounds r on r.id=p.round_id left join public.chatbot_vouchers v on v.pool_id=p.id and v.status='available' where p.id=any(selected) group by p.id,r.id) x;
  if cardinality(ids)=0 then raise exception 'Các kho đã chọn không có mã chưa phát';end if;
  insert into security_private.chatbot_clear_batches(actor,pool_ids,voucher_ids,summary) values(auth.uid(),selected,ids,summary) returning * into batch;
  return jsonb_build_object('batch_id',batch.id,'total',cardinality(ids),'pools',summary);
 end if;
 select * into batch from security_private.chatbot_clear_batches where id=p_batch_id and actor=auth.uid() for update;
 if batch.id is null then raise exception 'Phiên xác nhận không hợp lệ';end if;
 if batch.completed_at is not null then return jsonb_build_object('removed',cardinality(batch.voucher_ids),'replayed',true);end if;
 if batch.created_at<now()-interval '10 minutes' then raise exception 'Xác nhận đã hết hạn. Vui lòng chọn lại kho';end if;
 perform id from public.chatbot_voucher_pools where id=any(batch.pool_ids) order by (backup_for is not null),id for update;
 if exists(select 1 from public.chatbot_voucher_pools p join public.chatbot_rounds r on r.id=p.round_id where p.id=any(batch.pool_ids) and r.status='closed') then raise exception 'Đợt đã chốt. Không thể dọn mã';end if;
 select coalesce(array_agg(id order by id),'{}'::uuid[]) into ids from public.chatbot_vouchers where pool_id=any(batch.pool_ids) and status='available';
 if ids<>batch.voucher_ids then raise exception 'Tồn kho đã thay đổi. Vui lòng xem lại số lượng và xác nhận lại';end if;
 with removed as (delete from public.chatbot_vouchers where id=any(batch.voucher_ids) and pool_id=any(batch.pool_ids) and status='available' returning *)
 insert into security_private.chatbot_cleared_vouchers(voucher_id,batch_id,record) select id,batch.id,to_jsonb(removed) from removed;
 get diagnostics n=row_count;
 if n<>cardinality(batch.voucher_ids) then raise exception 'Tồn kho thay đổi, chưa dọn mã';end if;
 update security_private.chatbot_clear_batches set completed_at=now() where id=batch.id;
 select u.email into email from auth.users u where u.id=auth.uid();
 insert into security_private.chatbot_audit(actor,email,action,details) values(auth.uid(),email,'clear_stock',jsonb_build_object('removed',n,'pools',batch.summary,'batch_id',batch.id));
 return jsonb_build_object('removed',n,'replayed',false);
end $$;
revoke all on function security_private.chatbot_clear_stock(uuid[],uuid) from public,anon;
grant execute on function security_private.chatbot_clear_stock(uuid[],uuid) to authenticated;
create function public.chatbot_clear_stock(p_pool_ids uuid[] default null,p_batch_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select security_private.chatbot_clear_stock(p_pool_ids,p_batch_id) $$;
revoke all on function public.chatbot_clear_stock(uuid[],uuid) from public,anon;
grant execute on function public.chatbot_clear_stock(uuid[],uuid) to authenticated;
commit;
