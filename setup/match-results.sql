-- Run only in the Schussbuch project kyoowohgsqufqqnuebja.
-- Private PDF storage. Existing application tables and rows are unchanged.
begin;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('match-results','match-results',false,10485760,array['application/pdf'])
on conflict (id) do nothing;
-- Fail instead of silently using an existing public or incompatible bucket.
do $$ begin
 if not exists(select 1 from storage.buckets where id='match-results' and public=false and file_size_limit=10485760 and allowed_mime_types=array['application/pdf']) then
  raise exception 'Existing match-results bucket configuration must be reviewed';
 end if;
end $$;
create policy "match_results_read_own" on storage.objects for select to authenticated
 using (bucket_id='match-results' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "match_results_insert_own_competition" on storage.objects for insert to authenticated
 with check (
  bucket_id='match-results'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and array_length(storage.foldername(name),1)=2
  and lower(storage.extension(name))='pdf'
  and exists(select 1 from public.sessions s
   where s.id::text=(storage.foldername(name))[2]
   and s.user_id=(select auth.uid()) and s.session_type='Wettkampf')
 );
create policy "match_results_delete_own" on storage.objects for delete to authenticated
 using (bucket_id='match-results' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
-- Verify bucket privacy and ALL storage policies before releasing the feature.
select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='match-results';
select policyname,cmd,qual,with_check from pg_policies where schemaname='storage' and tablename='objects';
