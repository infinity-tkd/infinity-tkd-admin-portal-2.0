BEGIN;
-- Split ALL into equivalent commands, then combine permissive predicates with OR.
-- No grants or predicates are broadened: this preserves PostgreSQL's existing
-- permissive-policy semantics and avoids evaluating separate read policies.
DO $$ DECLARE p record; command text; predicate text; check_predicate text; role_list text; BEGIN
 FOR p IN SELECT * FROM pg_policies WHERE schemaname='public' AND permissive='PERMISSIVE' AND cmd='ALL' LOOP
 SELECT string_agg(CASE WHEN x='public' THEN 'PUBLIC' ELSE quote_ident(x) END,',') INTO role_list FROM unnest(p.roles) x;
 EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename);
 FOREACH command IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
 predicate:=COALESCE(p.qual,'true');
 check_predicate:=COALESCE(p.with_check,p.qual,'true');
 EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO %s%s%s',
 'portal_split_'||substr(md5(p.tablename||':'||p.policyname),1,12)||'_'||lower(command),p.tablename,command,role_list,
 CASE WHEN command IN ('SELECT','UPDATE','DELETE') THEN ' USING ('||predicate||')' ELSE '' END,
 CASE WHEN command IN ('INSERT','UPDATE') THEN ' WITH CHECK ('||check_predicate||')' ELSE '' END);
 END LOOP;
 END LOOP;
 FOR p IN SELECT tablename,cmd,roles,array_agg(policyname) names,
 string_agg('('||COALESCE(qual,'true')||')',' OR ') AS read_expression,
 string_agg('('||COALESCE(with_check,qual,'true')||')',' OR ') AS check_expression
 FROM pg_policies WHERE schemaname='public' AND permissive='PERMISSIVE'
 GROUP BY tablename,cmd,roles HAVING count(*)>1 LOOP
 SELECT string_agg(CASE WHEN x='public' THEN 'PUBLIC' ELSE quote_ident(x) END,',') INTO role_list FROM unnest(p.roles) x;
 FOREACH command IN ARRAY p.names LOOP EXECUTE format('DROP POLICY %I ON public.%I',command,p.tablename); END LOOP;
 EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO %s%s%s',
 'portal_combined_'||lower(p.cmd)||'_'||substr(md5(p.roles::text),1,8),p.tablename,p.cmd,role_list,
 CASE WHEN p.cmd IN ('SELECT','UPDATE','DELETE') THEN ' USING ('||p.read_expression||')' ELSE '' END,
 CASE WHEN p.cmd IN ('INSERT','UPDATE') THEN ' WITH CHECK ('||p.check_expression||')' ELSE '' END);
 END LOOP;
END $$;
COMMIT;
