/** Cryptographic randomness for credentials displayed only to the provisioning staff member. */
export function generatePassword():string {
  const bytes=crypto.getRandomValues(new Uint8Array(24));
  return 'TkD!'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
