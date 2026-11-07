# Replace the exposed Supabase credentials

The existing server credential must be revoked in the provider. Removing it from Git history and adding MFA do not revoke it.

1. Open the connected Infinity TKD project in Supabase, then Settings → API Keys. Create a dedicated modern server secret and obtain a publishable key. Keep both in the correct project. The owner must complete credential-changing dashboard steps.
2. Save each replacement value in a separate private local file outside the repository. Do not paste them into chat, commit them or pass them as terminal arguments.
3. Run `node scripts/install-rotated-keys.mjs --secret-file <private-server-key-file> --public-file <private-public-key-file>` from this project. The script validates both keys before updating `.env.local` and does not log their values. It does not delete the owner's input files.
4. Restart development or rebuild production because the browser public key is compiled into the client. Verify staff sign-in, authenticator enrollment/challenge, a protected read and a representative staged write. Update all other server consumers, scheduled jobs and deployed clients.
5. Disable the exposed legacy keys in the Supabase dashboard only after all consumers use the replacements. A new secret key alone leaves the old service-role key valid. Review the dashboard's impact warning before disabling legacy keys; old public keys may also stop working.
6. Remove the temporary private files securely, verify the old credential is rejected, and record the rotation date without recording any key values.

The installer prepares and validates application configuration. Provider revocation and real-device authenticator enrollment remain owner actions. Recovery for a lost authenticator requires owner identity verification and factor recovery through the provider; there is no application bypass.
