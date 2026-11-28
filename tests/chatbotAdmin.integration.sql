begin;
-- Fixture users and all business changes are rolled back.
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values('00000000-0000-4000-8000-000000000091','voucher-viewer-test@example.com',now(),false),('00000000-0000-4000-8000-000000000092','voucher-manager-test@example.com',now(),false);
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from auth.users where lower(email)='dangnhan.mrt@gmail.com'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare a jsonb; b jsonb; c jsonb; source uuid; target uuid; pool uuid; v jsonb; before_count bigint; after_count bigint;
begin
 if public.chatbot_admin('context')->>'role'<>'owner' then raise exception 'owner role failed'; end if;
 perform public.chatbot_admin('grant','{"email":"voucher-viewer-test@example.com","role":"viewer"}');
 perform public.chatbot_admin('grant','{"email":"voucher-manager-test@example.com","role":"manager"}');
 a:=public.chatbot_admin('create','{"name":"Integration source","is_test":true}');
 b:=public.chatbot_admin('create','{"name":"Integration target","is_test":true}');
 source:=(a->>'id')::uuid; target:=(b->>'id')::uuid;
 select id into pool from public.chatbot_voucher_pools where round_id=source and prize_code='TP10k' and backup_for is null;
 c:=public.chatbot_import_codes(pool,array['ADMINTEST9001','ADMINTEST9002','ADMINTEST9002']);
 if c->>'inserted'<>'2' or c->>'duplicates'<>'1' then raise exception 'import dedup failed'; end if;
 begin perform public.chatbot_admin('transfer',jsonb_build_object('from',source,'to',target));raise exception 'draft transfer accepted';exception when raise_exception then if sqlerrm='draft transfer accepted' then raise;end if;end;
 perform set_config('test.source',source::text,true);perform set_config('test.target',target::text,true);perform set_config('test.pool',pool::text,true);
end $$;
reset role;
-- Simulate the fixture's completed round, including one issued voucher.
update public.chatbot_voucher_pools set enabled=true where round_id=current_setting('test.source')::uuid;
select public.chatbot_issue_code(current_setting('test.pool')::uuid,'123456789','admin-fixture-event');
update public.chatbot_rounds set status='closed' where is_test=false and status='active';
set local role authenticated;
select public.chatbot_admin('activate',jsonb_build_object('round_id',current_setting('test.source')));
select public.chatbot_admin('close',jsonb_build_object('round_id',current_setting('test.source')));
do $$ begin if (select snapshot is null from public.chatbot_rounds where id=current_setting('test.source')::uuid) then raise exception 'snapshot missing';end if;end $$;
do $$ declare result jsonb; begin
 result:=public.chatbot_admin('transfer',jsonb_build_object('from',current_setting('test.source'),'to',current_setting('test.target')));
 if result->>'moved'<>'1' then raise exception 'transfer included issued or lost available';end if;
 if (select count(*) from public.chatbot_vouchers where code in ('ADMINTEST9001','ADMINTEST9002'))<>2 then raise exception 'code duplicated';end if;
 if (select count(*) from public.chatbot_vouchers where pool_id=current_setting('test.pool')::uuid and status='issued')<>1 then raise exception 'issued history moved';end if;
 result:=public.chatbot_admin('transfer',jsonb_build_object('from',current_setting('test.source'),'to',current_setting('test.target')));
 if result->>'moved'<>'0' then raise exception 'transfer replay duplicated';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000091","role":"authenticated"}',true);
do $$ begin
 if public.chatbot_admin('context')->>'role'<>'viewer' then raise exception 'viewer role failed';end if;
 if not exists(select 1 from public.chatbot_voucher_pools) then raise exception 'viewer cannot read';end if;
 begin perform public.chatbot_import_codes(current_setting('test.pool')::uuid,array['ADMINTEST9003']);raise exception 'viewer import allowed';exception when insufficient_privilege then null;end;
 begin perform public.chatbot_admin('grant','{"email":"evil@example.com","role":"manager"}');raise exception 'viewer grant allowed';exception when insufficient_privilege then null;end;
 begin perform public.chatbot_admin('export',jsonb_build_object('pool_id',current_setting('test.pool')));raise exception 'viewer export allowed';exception when insufficient_privilege then null;end;
 begin insert into public.chatbot_vouchers(pool_id,code) values(current_setting('test.pool')::uuid,'ADMINTEST9004');raise exception 'direct insert allowed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000092","role":"authenticated"}',true);
do $$ begin
 if public.chatbot_admin('context')->>'role'<>'manager' then raise exception 'manager role failed';end if;
 begin perform public.chatbot_admin('create','{"name":"Escalation","is_test":true}');raise exception 'manager create allowed';exception when insufficient_privilege then null;end;
 begin perform public.chatbot_admin('logs');raise exception 'manager logs allowed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000099","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.chatbot_vouchers) then raise exception 'unauthorized read';end if;
 begin perform public.chatbot_admin('context');raise exception 'unauthorized context';exception when insufficient_privilege then null;end;
end $$;
rollback;
select 'PASS: roles, direct-write denial, import dedup, transfer eligibility, issued history and repeated transfer' as result;
