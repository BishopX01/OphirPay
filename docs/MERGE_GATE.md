# Pull request merge gate

While `integration/staging` exists, pull requests must target that branch. The
required checks below run on pull requests and are the merge gate. Run
`npm run ci` locally for the application checks; the repository-specific
commands are listed so failures can be reproduced individually.

| Required check | Workflow | Local command |
| --- | --- | --- |
| Typecheck | `ci.yml` | `npm run typecheck` |
| ESLint (zero warnings) | `ci.yml` | `npm run lint -- --max-warnings 0` |
| Unit tests | `ci.yml` | `npm test` |
| Next.js build | `ci.yml` | `npm run build` |
| Deploy configuration guards | `ci.yml` | `bash scripts/validate-deploy-config.sh` |
| Contract WASM and Rust tests | `ci.yml` | `cd contracts/ophirpay && cargo test`; repeat in `contracts/emitter` |
| Secrets scan | `ci.yml` | `gitleaks detect --config .gitleaks.toml --redact` |
| Helm lint/render | `ci.yml` | `helm lint helm/ophirpay` |
| Prisma schema and migration replay | `prisma-ci.yml` | `npm run db:validate:migrations` |
| Contract regression guard | `contract-regression.yml` | `node scripts/check-contract-regressions.mjs` |
| Integration-branch policy | `enforce-integration-branch.yml` | Open the PR against `integration/staging` |

The path-scoped Prisma and contract checks are required when their files are
changed. The integration-branch policy is required for every PR while the
batch-integration branch exists.

## Keeping `integration/staging` in sync with `main`

`main` still receives commits directly (release chores, hotfixes, and the
promotion merge itself), so the integration branch would drift behind it and
batch-mode PRs would be built and tested against a stale base.
[`sync-integration-branch.yml`](../.github/workflows/sync-integration-branch.yml)
closes that gap:

- It runs on every push to `main` (and on demand through `workflow_dispatch`).
- It checks out `integration/staging` and runs `git merge --ff origin/main`, so
  a clean fast-forward is used when possible and a merge commit otherwise, then
  pushes the result.
- The push is authenticated with the `INTEGRATION_SYNC_TOKEN` secret: a GitHub
  App installation token or a fine-grained PAT with **Contents: read and
  write** on this repository. `GITHUB_TOKEN` is deliberately not used — a push
  made with it does not trigger `on: push` workflows, so the sync commit would
  land without CI. The workflow fails with setup instructions when the secret
  is missing instead of pushing an untested commit.
- A conflicting merge is aborted. The workflow opens (or updates, keyed by a
  marker in the body) an open issue titled
  `integration-sync: main conflicts with integration/staging` listing the
  conflicting files and the commands to resolve them. The next push to `main`
  refreshes that issue; close it once the branch is current again.
- When `integration/staging` does not exist (batch mode over), the workflow is
  a no-op.

A PAT/App token is required because a push made with `GITHUB_TOKEN` does not
trigger `on: push` workflows: the sync commit would be invisible to any
branch-triggered CI. With a token, workflows triggered by a push to the
integration branch run on the sync commit, and
[`prompt-promotion-pr.yml`](../.github/workflows/prompt-promotion-pr.yml) can
report the real "0 commits behind" state.

## Scheduled or advisory workflows

The following workflows are operational or advisory and are not merge-gate
checks for an ordinary pull request:

- `dependency-scan.yml` — nightly dependency vulnerability scan.
- `e2e-nightly.yml` — scheduled/dispatch end-to-end coverage.
- `scheduled-payments-cron.yml` — scheduled payment sweep.
- `db-backup.yml` — scheduled database backup.
- `scorecard.yml` — scheduled OpenSSF scorecard analysis.
- `stale.yml` — scheduled issue and PR housekeeping.

`docker-smoke.yml` may run on pull requests, but it is an auxiliary deployment
smoke test unless branch protection explicitly marks its check required. Review
the repository’s branch-protection settings when changing the required list;
this document describes the intended gate, not a replacement for GitHub
settings.

## One-command local gate

```bash
npm ci
npm run ci
```

The command runs typecheck, lint, unit tests, production build, and deploy
configuration validation in the same order as the main application workflow.
