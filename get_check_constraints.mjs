import { createClient } from '@supabase/supabase-js';

const NEXT_PUBLIC_SUPABASE_URL = 'https://lyjxmkyvqazqxkzoeszr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: `
    SELECT pg_get_constraintdef(c.oid) AS constraint_def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'curriculum' AND c.conname = 'chk_curriculum_category';
  ` });
  
  console.log("Constraint definition:", data, error);
}

run();
