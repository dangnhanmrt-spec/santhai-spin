begin;
-- Keep the used pools and all voucher IDs/history; remove only the unused empty duplicate set.
lock table public.chatbot_voucher_pools in share row exclusive mode;
lock table public.chatbot_vouchers in share row exclusive mode;
do $$ declare before_digest text; after_digest text; used_round uuid; empty_round uuid; begin
 select id into used_round from public.chatbot_rounds where campaign='BOTCAKE_TEST_20261126';
 select id into empty_round from public.chatbot_rounds where campaign='BOTCAKE_LIVE';
 if used_round is null or empty_round is null then raise exception 'Expected rounds missing';end if;
 if exists(select 1 from public.chatbot_vouchers v join public.chatbot_voucher_pools p on p.id=v.pool_id where p.round_id=empty_round) then raise exception 'Duplicate live pools are not empty; manual reconciliation required';end if;
 select md5(string_agg(to_jsonb(v)::text,',' order by v.id)) into before_digest from public.chatbot_vouchers v;
 delete from public.chatbot_voucher_pools where round_id=empty_round and backup_for is not null;
 delete from public.chatbot_voucher_pools where round_id=empty_round;
 delete from public.chatbot_rounds where id=empty_round;
 update public.chatbot_rounds set name='Đợt phát hiện tại',campaign='BOTCAKE_LIVE',is_test=false where id=used_round;
 update public.chatbot_voucher_pools set campaign=case when backup_for is null then 'BOTCAKE_LIVE' else 'BOTCAKE_LIVE_BACKUP' end,is_test=false where round_id=used_round;
 select md5(string_agg(to_jsonb(v)::text,',' order by v.id)) into after_digest from public.chatbot_vouchers v;
 if before_digest is distinct from after_digest then raise exception 'Voucher history changed';end if;
 insert into security_private.chatbot_audit(action,details) values('unify_stock',jsonb_build_object('round_id',used_round,'voucher_digest',after_digest,'voucher_count',(select count(*) from public.chatbot_vouchers),'issued_count',(select count(*) from public.chatbot_vouchers where status<>'available')));
end $$;
commit;
