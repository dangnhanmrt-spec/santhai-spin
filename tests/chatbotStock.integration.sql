begin;
do $$
declare ids uuid[]:='{}'; pid uuid; bid uuid; r jsonb; n int;
begin
 for n in 1..5 loop
 insert into public.chatbot_voucher_pools(campaign,prize_code,name,is_test,enabled) values('QA_STOCK_ROLLBACK',n::text,'QA',true,true) returning id into pid;
 ids:=array_append(ids,pid);
 insert into public.chatbot_voucher_pools(campaign,prize_code,name,is_test,enabled,backup_for) values('QA_STOCK_BACKUP_ROLLBACK',n::text,'QA backup',true,true,pid) returning id into bid;
 insert into public.chatbot_vouchers(pool_id,code) values(pid,'QAMAIN'||n),(bid,'QABACK'||n);
 end loop;
 r:=public.chatbot_check_stock(ids); if r->>'stock_gate'<>'OPEN' then raise exception 'initial gate';end if;
 for n in 1..2 loop
 r:=public.chatbot_issue_code(ids[n],'123456789','qa-main-'||n);if r->>'source'<>'main' then raise exception 'main priority';end if;
 end loop;
 r:=public.chatbot_check_stock(ids);if r->>'stock_gate'<>'OPEN' or (r->>'empty_main_pools')::int<>2 then raise exception '2/5 gate';end if;
 perform public.chatbot_issue_code(ids[3],'123456789','qa-main-3');
 r:=public.chatbot_check_stock(ids);if r->>'stock_gate'<>'CLOSED' or (r->>'empty_main_pools')::int<>3 then raise exception '3/5 gate';end if;
 r:=public.chatbot_issue_code(ids[1],'123456789','qa-backup-1');if r->>'voucher_code'<>'QABACK1' or r->>'source'<>'backup' then raise exception 'backup mapping after gate closed';end if;
 r:=public.chatbot_issue_code(ids[1],'123456789','qa-backup-1');if r->>'voucher_code'<>'QABACK1' or r->>'replayed'<>'true' then raise exception 'backup retry';end if;
 r:=public.chatbot_issue_code(ids[1],'123456789','qa-backup-2');if r->>'status'<>'out_of_stock' then raise exception 'must not use another prize';end if;
 if has_function_privilege('anon','public.chatbot_check_stock(uuid[])','execute') or has_function_privilege('authenticated','public.chatbot_issue_code(uuid,text,text)','execute') then raise exception 'permissions';end if;
end $$;
rollback;
