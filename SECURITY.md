# Security and credential handling

Keep server credentials in local environment files or the deployment host's secret store. Commit only placeholder configuration such as `.env.example`.

The Supabase service-role credential must never appear in source files, browser bundles, logs, screenshots or issue descriptions. Public browser keys are separate from privileged server credentials.

## Before pushing

- Review staged files and exclude environment files, generated output, temporary database tooling and private keys.
- Scan both the current files and Git history. Removing a credential from the latest file does not remove it from previous commits.
- Keep diagnostic scripts configured through environment variables rather than hardcoded values.

## If a credential is exposed

1. Revoke or rotate it in the provider dashboard and update each application that uses it. Creating another key alone may leave the exposed key valid.
2. Check provider logs for unexpected activity and review access to affected data.
3. Remove the credential from current code and coordinate a repository history cleanup with maintainers.
4. After rewriting history, collaborators should use a fresh clone rather than merge old branches that can restore the exposed content.
5. Check forks, pull requests and cached references separately. Ask GitHub Support for help with retained sensitive references where needed.

The repository review on 13 October 2026 found a hardcoded legacy Supabase service-role key in an existing diagnostic script and earlier commits. The script now reads its credential from the environment. The published `main` history was cleaned with maintainer approval, preserving all nine commits and the current application files. The exposed key has not yet been revoked or rotated; credential replacement and configuration updates remain required before treating the exposure as resolved. Older clones and retained GitHub references may still contain the original value.

See [Supabase key handling](https://supabase.com/docs/guides/getting-started/api-keys) and [GitHub's sensitive-data removal guide](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).
