import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());
const option = name => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1]; };
const secretFile = option('--secret-file');
const publicFile = option('--public-file');
if (!secretFile || !publicFile) throw new Error('Provide --secret-file and --public-file pointing to private files containing the replacement project keys. Never pass key values as arguments.');
const secret = (await fs.readFile(secretFile, 'utf8')).trim();
const publicKey = (await fs.readFile(publicFile, 'utf8')).trim();
if (!secret.startsWith('sb_secret_') || !publicKey.startsWith('sb_publishable_')) throw new Error('Use a new server secret key and publishable key from this project. Legacy JWT replacements are not accepted by this installer.');
if (secret === process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('The candidate is already installed. Provider revocation still needs to be confirmed separately.');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url || new URL(url).protocol !== 'https:') throw new Error('A valid HTTPS project URL is required.');
const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false }, db: { retry: false } });
try {
  const { error } = await client.from('students').select('id').limit(0).abortSignal(AbortSignal.timeout(15000));
  if (error) throw new Error('Replacement server-key validation failed. Existing configuration has not changed.');
  const response = await fetch(new URL('/auth/v1/settings', url), { headers: { apikey: publicKey }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Replacement public-key validation failed. Existing configuration has not changed.');
  const filename = '.env.local';
  const original = await fs.readFile(filename, 'utf8');
  const replace = (source, name, value) => {
    const pattern = new RegExp(`^${name}=.*$`, 'm');
    return pattern.test(source) ? source.replace(pattern, () => `${name}=${value}`) : source + `\n${name}=${value}\n`;
  };
  const updated = replace(replace(original, 'SUPABASE_SERVICE_ROLE_KEY', secret), 'NEXT_PUBLIC_SUPABASE_ANON_KEY', publicKey);
  const temporary = '.env.local.rotation-' + process.pid;
  try { await fs.writeFile(temporary, updated, { mode: 0o600, flag: 'wx' }); await fs.rename(temporary, filename); }
  finally { await fs.rm(temporary, { force: true }); }
  console.log('Replacement keys validated and installed locally. No key values were logged. Restart development or rebuild production, verify sign-in, and update every other consumer before disabling the exposed legacy keys in the provider dashboard.');
} finally { client.auth.dispose(); }
