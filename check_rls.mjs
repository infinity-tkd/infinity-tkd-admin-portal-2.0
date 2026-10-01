import { createClient } from '@supabase/supabase-js';

const NEXT_PUBLIC_SUPABASE_URL='https://lyjxmkyvqazqxkzoeszr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkRLS() {
  const { data, error } = await supabase.rpc('get_policies_for_table', { table_name: 'members' });
  if (error) {
     console.log("No RPC or failed. Let's just query pg_policies");
     const { data: polData, error: polErr } = await supabase.from('pg_policies').select('*').in('tablename', ['members', 'profiles', 'member_addresses']);
     if (polErr) console.log(polErr.message);
     else console.log(polData);
  } else {
     console.log(data);
  }
}

checkRLS();
