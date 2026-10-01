import { createClient } from '@supabase/supabase-js';

const NEXT_PUBLIC_SUPABASE_URL='https://lyjxmkyvqazqxkzoeszr.supabase.co';
const CORRECT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5anhta3l2cWF6cXhrem9lc3pyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTY5NjAyNiwiZXhwIjoyMDk1MjcyMDI2fQ.eR68liPQkX-tSsRxBVW-4kFGwqqKpaOyKPcXT22NDRg';

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
