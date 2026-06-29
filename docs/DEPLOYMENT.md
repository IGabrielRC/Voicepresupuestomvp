# MVP Deployment Runbook

This project deploys to the paid Hostinger VPS managed by Easypanel. Docker is the deployment unit, GitHub Actions is the automation layer, and manual SSH should be avoided unless debugging a controlled incident.

## Quick path

1. Work on the smallest safe change and commit it normally.
2. Push to GitHub.
3. Let the `Deploy to Easypanel VPS` workflow run, or trigger it manually with a full 40-character commit SHA.
4. Confirm the workflow finishes successfully.
5. Verify production:
   - Backend: `https://presupuesto-mvp-presupuesto-back.fwtktk.easypanel.host/api/health`
   - Frontend: `https://presupuesto-mvp-presupuesto-front.fwtktk.easypanel.host`

## Current deployment model

| Area | Decision |
|------|----------|
| Default infrastructure | Hostinger VPS with Easypanel |
| Future alternatives | Railway/Render/etc. are optional, not the current default |
| Deployment unit | Docker images built from this repository |
| Automation | GitHub Actions SSHs into the VPS and updates only the two Easypanel/Swarm services for this app |
| Production branch | `main` |
| Manual deploy input | Must be a full lowercase 40-character Git commit SHA |

## Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `VPS_HOST` | Hostinger VPS host. Must match the pinned known host in the workflow. |
| `VPS_USER` | SSH user used by GitHub Actions. |
| `VPS_SSH_KEY` | Private deploy key for GitHub Actions. Never paste this into chat, logs, or Easypanel. |
| `VITE_API_URL` | Public backend URL used when building the frontend. |

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

## What not to do

- Do not paste private SSH keys into Easypanel.
- Do not paste `.env` contents into chat or GitHub issues.
- Do not disable strict SSH host checking to “make it work”.
- Do not run global Docker cleanup commands on the VPS casually.
- Do not manually deploy an arbitrary `commit_sha`; use a real full SHA from Git.

## Incident recovery

If deploy fails:

1. Read the failed GitHub Actions logs.
2. Identify whether the failure happened before SSH, during SSH, during build, during service update, or during smoke checks.
3. Do not retry blindly.
4. If credentials are involved, rotate the affected key/secret.
5. If a service update fails, rely on the workflow rollback first, then inspect Easypanel/Swarm state carefully.

## Next improvement

The next deployment simplification should be Docker registry based: GitHub Actions builds and pushes images, and the VPS only pulls and updates services. That reduces VPS build load and makes deploys more portable.
