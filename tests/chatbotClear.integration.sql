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
update public.chatbot_rounds set status='closed' where is_test=true and status='active';
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
reset role;
insert into public.chatbot_vouchers(pool_id,code,status,customer_id,event_id,issued_at) select id,'CLEARISSUED01','issued','123456789','clear-fixture-issued',now() from public.chatbot_voucher_pools where round_id=current_setting('test.target')::uuid and prize_code='TP10k' and backup_for is null;
set local role authenticated;
do $$ declare main uuid; backup uuid; untouched uuid; preview jsonb; result jsonb; count_before bigint; begin
 select id into main from public.chatbot_voucher_pools where round_id=current_setting('test.target')::uuid and prize_code='TP10k' and backup_for is null;
 select id into backup from public.chatbot_voucher_pools where backup_for=main;
 select id into untouched from public.chatbot_voucher_pools where round_id=current_setting('test.target')::uuid and prize_code='x2TP' and backup_for is null;
 perform public.chatbot_import_codes(backup,array['CLEARBACKUP01']);
 perform public.chatbot_import_codes(untouched,array['CLEARKEEP01']);
 preview:=public.chatbot_clear_stock(array[main,backup]);
 if preview->>'total'<>'2' then raise exception 'wrong preview total';end if;
 perform public.chatbot_import_codes(main,array['CLEARNEW01']);
 begin perform public.chatbot_clear_stock(p_batch_id:=(preview->>'batch_id')::uuid);raise exception 'stale confirmation accepted';exception when raise_exception then if sqlerrm='stale confirmation accepted' then raise;end if;end;
 if (select count(*) from public.chatbot_vouchers where pool_id in (main,backup) and status='available')<>3 then raise exception 'stale attempt mutated';end if;
 preview:=public.chatbot_clear_stock(array[main,backup]);
 result:=public.chatbot_clear_stock(p_batch_id:=(preview->>'batch_id')::uuid);
 if result->>'removed'<>'3' then raise exception 'clear count wrong';end if;
 result:=public.chatbot_clear_stock(p_batch_id:=(preview->>'batch_id')::uuid);
 if result->>'replayed'<>'true' then raise exception 'double click not idempotent';end if;
 if exists(select 1 from public.chatbot_vouchers where pool_id in (main,backup) and status='available') then raise exception 'selected stock remains';end if;
 if not exists(select 1 from public.chatbot_vouchers where pool_id=main and code='CLEARISSUED01' and status='issued') then raise exception 'issued in selected pool touched';end if;
 if (select count(*) from public.chatbot_vouchers where pool_id=untouched)<>1 then raise exception 'unselected pool touched';end if;
 if (select count(*) from public.chatbot_vouchers where pool_id=current_setting('test.pool')::uuid and status='issued')<>1 then raise exception 'issued code touched';end if;
 perform public.chatbot_import_codes(main,array['CLEARNEW01']);
 if not exists(select 1 from public.chatbot_vouchers where pool_id=main and code='CLEARNEW01') then raise exception 'reimport failed';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000091","role":"authenticated"}',true);
do $$ begin
 begin perform public.chatbot_clear_stock(array[current_setting('test.pool')::uuid]);raise exception 'viewer clear allowed';exception when insufficient_privilege then null;end;
 if public.chatbot_admin('context')->>'role'<>'viewer' then raise exception 'viewer role failed';end if;
 if not exists(select 1 from public.chatbot_voucher_pools) then raise exception 'viewer cannot read';end if;
 begin perform public.chatbot_import_codes(current_setting('test.pool')::uuid,array['ADMINTEST9003']);raise exception 'viewer import allowed';exception when insufficient_privilege then null;end;
 begin perform public.chatbot_admin('grant','{"email":"evil@example.com","role":"manager"}');raise exception 'viewer grant allowed';exception when insufficient_privilege then null;end;
 begin perform public.chatbot_admin('export',jsonb_build_object('pool_id',current_setting('test.pool')));raise exception 'viewer export allowed';exception when insufficient_privilege then null;end;
 begin insert into public.chatbot_vouchers(pool_id,code) values(current_setting('test.pool')::uuid,'ADMINTEST9004');raise exception 'direct insert allowed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000092","role":"authenticated"}',true);
do $$ begin
 begin perform public.chatbot_clear_stock(array[current_setting('test.pool')::uuid]);raise exception 'manager clear allowed';exception when insufficient_privilege then null;end;
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
select 'PASS: selected multi-pool clear, stale confirmation rejection, idempotent replay, retained issued/unselected stock, reimport, role denial' as result;
