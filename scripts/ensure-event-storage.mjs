import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
nextEnv.loadEnvConfig(process.cwd());
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error('Configure the server database connection before preparing event storage.');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
try{
 const current=await client.storage.getBucket('academy-events');
 if(current.error){
  if(!['404','400'].includes(String(current.error.status??current.error.statusCode))&&!/not found/i.test(current.error.message))throw new Error('Event Storage could not be checked.');
  const result=await client.storage.createBucket('academy-events',{public:false,fileSizeLimit:15*1024*1024,allowedMimeTypes:['image/jpeg','image/png','image/webp','application/pdf']});
  if(result.error)throw new Error('Private event Storage could not be created.');
 }else if(current.data.public)throw new Error('The event bucket is public. Review its access before enabling file uploads.');
 console.log(JSON.stringify({bucket:'academy-events',private:true,configured:true}));
}finally{client.auth.dispose();}
