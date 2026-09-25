---
name: deploy-testing
description: Use every time the local `testing` branch gets a new commit — a commit made on it, a merge into it (e.g. merging a feature branch or master into testing), a cherry-pick, a conflict resolution. Pushes `testing` to origin right away so Railway auto-deploys it, then confirms a few seconds later that Railway started the deploy. Do not wait for the deploy to finish.
---

# Deploy on `testing`

Railway watches the `testing` branch and deploys it to the **testing** environment of the Atleta project on every push. Any change that lands on `testing` must reach origin immediately — never leave `testing` with unpushed commits.

## 1. Push

After every commit or merge on `testing`:

```bash
git push origin testing
```

Retry only on network errors (2s, 4s, 8s, 16s). If the push is rejected because origin moved, `git pull --no-rebase origin testing`, resolve, and push again — never force-push `testing`.

## 2. Confirm Railway started deploying

Wait ~10 seconds (`sleep 10`), then call the Railway MCP `list-deployments` tool:

- `projectId`: `018a40a5-e495-493d-90f5-caca3504a0c4` (Atleta)
- `environmentId`: `8b314db2-9c2c-4f5f-9581-336abbaf881b` (testing)
- `limit`: 6

Match deployments whose `meta.commitHash` equals the pushed HEAD (`git rev-parse testing`). Services: `web` (`9d0aa2a2-111a-4021-a5bb-77eccbf376c1`) and `api` (`9c0128ad-cf83-4b04-b1ac-bf4ae3ccece9`).

- A matching deployment in `WAITING`, `QUEUED`, `INITIALIZING`, `BUILDING`, `DEPLOYING` or `SUCCESS` → deploy started. Tell the user in one line which services are deploying.
- `SKIPPED` for a service is normal: none of that service's watched files changed. If every matching deployment is `SKIPPED`, say nothing was deployed because the commit didn't touch app code.
- No deployment for the commit yet → wait ~10 more seconds and check once more. Still nothing → tell the user Railway didn't pick up the push, with the commit hash.

Stop there. Do **not** poll until the deploy finishes — Railway notifies the user if it fails.

If the Railway MCP tools aren't available in the session, still push, and tell the user the deploy couldn't be confirmed.
