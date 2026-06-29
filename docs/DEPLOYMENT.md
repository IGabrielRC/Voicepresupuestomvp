# MVP Deployment Runbook

This project deploys to the paid Hostinger VPS managed by Easypanel. GitHub Actions builds and pushes Docker images to GHCR, then SSHs into the VPS to pull the exact images and update only the two Easypanel/Swarm services. Manual SSH should be avoided unless debugging a controlled incident.

## Quick path

1. Work on the smallest safe change and commit it normally.
2. Push to GitHub.
3. Let the `Deploy to Easypanel VPS via GHCR` workflow run, or trigger it manually with a full 40-character commit SHA.
4. Confirm the workflow finishes successfully.
5. Verify production:
   - Backend: `https://presupuesto-mvp-presupuesto-back.fwtktk.easypanel.host/api/health`
   - Frontend: `https://presupuesto-mvp-presupuesto-front.fwtktk.easypanel.host`

> Docs-only pushes (`docs/**`, `**/*.md`, `README*`) do **not** trigger production deploys.

## Current deployment model

| Area | Decision |
|------|----------|
| Default infrastructure | Hostinger VPS with Easypanel |
| Future alternatives | Railway/Render/etc. are optional, not the current default |
| Deployment unit | Docker images published to GHCR by GitHub Actions |
| Image names | `ghcr.io/igabrielrc/voicepresupuestomvp/presupuesto_back` and `.../presupuesto_front` |
| Image tags | Exact commit SHA (deployed) plus `latest` (convenience) |
| Automation | GitHub Actions pushes images, then SSHs into the VPS to pull and update only the two Easypanel/Swarm services |
| Production branch | `main` |
| Manual deploy input | Must be a full lowercase 40-character Git commit SHA |
| Path filters | Pushes that change only docs/markdown do not trigger deploys |

## Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `VPS_HOST` | Hostinger VPS host. Must match the pinned known host in the workflow. |
| `VPS_USER` | SSH user used by GitHub Actions. |
| `VPS_SSH_KEY` | Private deploy key for GitHub Actions. Never paste this into chat, logs, or Easypanel. |
| `VITE_API_URL` | Public backend URL used when building the frontend. |
| `GITHUB_TOKEN` | Provided automatically by GitHub Actions. Used to push images to GHCR. |

## GHCR package visibility

The repository is public, so the published GHCR packages should remain public so the VPS can pull images without extra credentials. If a package is accidentally made private, `docker pull` on the VPS will fail until the package visibility is reset to public or the VPS is authenticated to GHCR.

## SSH key rule

- GitHub gets the **private** key in `VPS_SSH_KEY`.
- The VPS/Easypanel user gets the **public** key in `~/.ssh/authorized_keys`.
- Do not reuse personal SSH keys for deploy automation.
- If a private key is pasted in the wrong place, rotate it.

## Safety checklist before deploy

- [ ] No `.env` file is committed.
- [ ] No private key, token, Supabase service-role key, Telegram token, or API key appears in code, logs, screenshots, or chat.
- [ ] `git status` is clean except for intentional changes.
- [ ] The deploy target is the intended commit.
- [ ] The workflow references only this app's Easypanel/Swarm services:
  - `presupuesto_mvp_presupuesto_back`
  - `presupuesto_mvp_presupuesto_front`
- [ ] No host-global cleanup command such as `docker system prune` or broad `docker image prune` is added.
- [ ] GHCR packages remain public so the VPS can pull images.

## What not to do

- Do not paste private SSH keys into Easypanel.
- Do not paste `.env` contents into chat or GitHub issues.
- Do not disable strict SSH host checking to “make it work”.
- Do not run global Docker cleanup commands on the VPS casually.
- Do not manually deploy an arbitrary `commit_sha`; use a real full SHA from Git.
- Do not build images directly on the VPS as part of the normal deploy flow.

## Incident recovery

If deploy fails:

1. Read the failed GitHub Actions logs.
2. Identify whether the failure happened during image build/push in GitHub Actions, during SSH, during image pull on the VPS, during service update, or during smoke checks.
3. Do not retry blindly.
4. If credentials are involved, rotate the affected key/secret.
5. If a service update fails, rely on the workflow rollback first, then inspect Easypanel/Swarm state carefully.

## Next improvement

Consider adding a staging environment that uses a different GHCR tag prefix or a separate set of Swarm services, so changes can be smoke-tested before production traffic reaches them.
