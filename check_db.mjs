import { createClient } from '@supabase/supabase-js';

const NEXT_PUBLIC_SUPABASE_URL='https://lyjxmkyvqazqxkzoeszr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkFK() {
  console.log("Checking foreign keys...");
  
  // Try joining members to member_addresses using standard syntax
  const { data: mData, error: mErr } = await supabase.from('members').select('*, member_addresses(*)').limit(1);
  if (mErr) console.log("member join error:", mErr.message);
  else console.log("member join SUCCESS!");

  const { data: sData, error: sErr } = await supabase.from('students').select('*, student_addresses(*)').limit(1);
  if (sErr) console.log("student join error:", sErr.message);
  else console.log("student join SUCCESS!");
}

checkFK();
