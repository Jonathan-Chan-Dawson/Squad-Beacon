-- Exact-ID community summaries reuse the directory's viewer-specific
-- visibility predicate and fixed safe projection. Missing and unauthorized
-- communities both return zero rows.
create function public.community_profile_summary(
 p_entity_type text,
 p_entity_id uuid
) returns table(
 entity_type text,entity_id uuid,name text,description text,discoverability text,
 join_mode text,member_count integer,child_count integer,membership_status text,action text,
 parent_type text,parent_id uuid,parent_name text
)
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null or p_entity_id is null or p_entity_type is null
  or p_entity_type not in ('squad','space','organization')
  or not private.social_entity_visible(p_entity_type,p_entity_id,uid) then
  return;
 end if;

 if p_entity_type='organization' then
  return query
  select 'organization'::text,o.id,o.name,o.description,o.discoverability,o.join_mode,
   private.organization_member_count(o.id),
   (select count(distinct child_key)::integer from (
     select 'space:'||l.space_id::text child_key from public.organization_spaces l
      where l.organization_id=o.id and private.social_entity_visible('space',l.space_id,uid)
     union all
     select 'squad:'||l.squad_id::text from public.organization_squads l
      where l.organization_id=o.id and private.social_entity_visible('squad',l.squad_id,uid)
     union all
     select 'squad:'||sl.squad_id::text from public.organization_spaces ol
      join public.space_squads sl on sl.space_id=ol.space_id
      where ol.organization_id=o.id
       and private.social_entity_visible('space',ol.space_id,uid)
       and private.social_entity_visible('squad',sl.squad_id,uid)
   ) children),
   case when private.social_active('organization',o.id,uid) then 'active'
    when exists(select 1 from public.organization_members m where m.organization_id=o.id and m.user_id=uid and m.status='invited') then 'invited'
    when exists(select 1 from public.organization_members m where m.organization_id=o.id and m.user_id=uid and m.status='requested') then 'requested' else null end,
   case when private.social_active('organization',o.id,uid) then 'joined'
    when exists(select 1 from public.organization_members m where m.organization_id=o.id and m.user_id=uid and m.status='invited') then 'invited'
    when exists(select 1 from public.organization_members m where m.organization_id=o.id and m.user_id=uid and m.status='requested') then 'requested'
    when o.join_mode='open' then 'join' when o.join_mode='request' then 'request' else 'invite_required' end,
   null::text,null::uuid,null::text
  from public.organizations o
  where o.id=p_entity_id and private.social_entity_visible('organization',o.id,uid);
  return;
 end if;

 if p_entity_type='space' then
  return query
  select 'space'::text,s.id,s.name,s.description,s.discoverability,s.join_mode,
   (select count(*)::integer from public.space_members m where m.space_id=s.id and m.status='active'),
   (select count(distinct l.squad_id)::integer from public.space_squads l
    where l.space_id=s.id and private.social_entity_visible('squad',l.squad_id,uid)),
   case when private.social_active('space',s.id,uid) then 'active'
    when exists(select 1 from public.space_members m where m.space_id=s.id and m.user_id=uid and m.status='invited') then 'invited'
    when exists(select 1 from public.space_members m where m.space_id=s.id and m.user_id=uid and m.status='requested') then 'requested' else null end,
   case when private.social_active('space',s.id,uid) then 'joined'
    when exists(select 1 from public.space_members m where m.space_id=s.id and m.user_id=uid and m.status='invited') then 'invited'
    when exists(select 1 from public.space_members m where m.space_id=s.id and m.user_id=uid and m.status='requested') then 'requested'
    when s.join_mode='open' then 'join' when s.join_mode='request' then 'request' else 'invite_required' end,
   p.parent_type,p.parent_id,p.parent_name
  from public.spaces s
  left join lateral (
   select 'organization'::text parent_type,o.id parent_id,o.name parent_name
   from public.organization_spaces l join public.organizations o on o.id=l.organization_id
   where l.space_id=s.id and private.social_entity_visible('organization',o.id,uid)
   order by o.name,o.id limit 1
  ) p on true
  where s.id=p_entity_id and private.social_entity_visible('space',s.id,uid);
  return;
 end if;

 return query
 select 'squad'::text,s.id,s.name,s.description,s.discoverability,s.join_mode,
  (select count(*)::integer from public.squad_members m where m.squad_id=s.id),
  0::integer,
  case when private.social_active('squad',s.id,uid) then 'active'
   when exists(select 1 from public.squad_invites i where i.squad_id=s.id and i.recipient_id=uid) then 'invited'
   when exists(select 1 from public.squad_join_requests r where r.squad_id=s.id and r.user_id=uid) then 'requested' else null end,
  case when private.social_active('squad',s.id,uid) then 'joined'
   when exists(select 1 from public.squad_invites i where i.squad_id=s.id and i.recipient_id=uid) then 'invited'
   when exists(select 1 from public.squad_join_requests r where r.squad_id=s.id and r.user_id=uid) then 'requested'
   when s.join_mode='open' then 'join' when s.join_mode='request' then 'request' else 'invite_required' end,
  p.parent_type,p.parent_id,p.parent_name
 from public.squads s
 left join lateral (
  select link.parent_type,link.parent_id,link.parent_name from (
   select 'space'::text parent_type,sp.id parent_id,sp.name parent_name,0 priority
   from public.space_squads l join public.spaces sp on sp.id=l.space_id
   where l.squad_id=s.id and private.social_entity_visible('space',sp.id,uid)
   union all
   select 'organization',o.id,o.name,1 from public.organization_squads l
   join public.organizations o on o.id=l.organization_id
   where l.squad_id=s.id and private.social_entity_visible('organization',o.id,uid)
   union all
   select 'organization',o.id,o.name,2 from public.space_squads sl
   join public.organization_spaces ol on ol.space_id=sl.space_id
   join public.spaces sp on sp.id=sl.space_id
   join public.organizations o on o.id=ol.organization_id
   where sl.squad_id=s.id and private.social_entity_visible('space',sp.id,uid)
    and private.social_entity_visible('organization',o.id,uid)
  ) link order by link.priority,link.parent_name,link.parent_id limit 1
 ) p on true
 where s.id=p_entity_id and private.social_entity_visible('squad',s.id,uid);
end $$;

revoke all on function public.community_profile_summary(text,uuid) from public,anon;
grant execute on function public.community_profile_summary(text,uuid) to authenticated;
