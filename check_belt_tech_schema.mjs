import fetch from 'node-fetch';

const NEXT_PUBLIC_SUPABASE_URL = 'https://lyjxmkyvqazqxkzoeszr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function run() {
  const res = await fetch(`${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_SERVICE_ROLE_KEY}`);
  const json = await res.json();
  
  if (json.definitions && json.definitions.belt_techniques) {
    console.log("=== Columns of belt_techniques ===");
    console.log(JSON.stringify(json.definitions.belt_techniques.properties, null, 2));
  } else {
    console.log("belt_techniques definition not found in OpenAPI spec.");
    console.log("Available definitions:", Object.keys(json.definitions || {}));
  }
}

run();
