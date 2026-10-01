import { createClient } from '@supabase/supabase-js';

const NEXT_PUBLIC_SUPABASE_URL='https://lyjxmkyvqazqxkzoeszr.supabase.co';
const CORRECT_KEY = 'REDACTED_EXPOSED_SERVICE_ROLE_KEY';

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, CORRECT_KEY);

async function checkMuscles() {
  const { data, error } = await supabase.from('muscles').select('id, name, muscle_group');
  if (error) {
    console.error(error);
    return;
  }
  console.log("Database Muscles:", data.map(m => m.name));
}

checkMuscles();
