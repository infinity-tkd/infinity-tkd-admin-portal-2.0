import fetch from 'node-fetch';

const NEXT_PUBLIC_SUPABASE_URL = 'https://lyjxmkyvqazqxkzoeszr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function getSwagger() {
  const url = `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_SERVICE_ROLE_KEY}`;
  
  const res = await fetch(url);
  const schema = await res.json();
  
  const achievements = schema.definitions && schema.definitions.achievements;
  if (achievements) {
    console.log("Found achievements definition properties:", Object.keys(achievements.properties));
    console.log("Full property details:", JSON.stringify(achievements.properties, null, 2));
  } else {
    console.log("Could not find achievements definition. All definitions:", Object.keys(schema.definitions || {}));
  }
}

getSwagger().catch(console.error);
