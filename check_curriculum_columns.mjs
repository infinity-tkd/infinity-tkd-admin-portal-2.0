import { createClient } from '@supabase/supabase-js';

const NEXT_PUBLIC_SUPABASE_URL = 'https://lyjxmkyvqazqxkzoeszr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkColumns() {
  console.log("=== Attempting valid insert on curriculum ===");
  const { data, error } = await supabase.from('curriculum').insert({
    id: 999999,
    target_belt: 'White',
    title: 'Dummy Title',
    category: 'Chagi'
  }).select();

  if (error) {
    console.log("Insert error:", error);
  } else {
    console.log("Insert SUCCESS! Columns are:");
    if (data && data.length > 0) {
      console.log(Object.keys(data[0]));
      console.log("Inserted row data:", data[0]);
    }
    // Clean up
    await supabase.from('curriculum').delete().eq('id', 999999);
  }
}

checkColumns();
