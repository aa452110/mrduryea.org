# mrduryea.org

Static class hub for Mr. Duryea. The site is plain HTML/CSS with a couple of JavaScript-enhanced assignment pages. There is no build step or dependency install.

## Quick start

- Open `index.html` in a browser, or
- Run a simple local server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

### Hall Pass + Admin (Cloudflare Pages Functions)

The Hall Pass (`/api/hallpass`) and Admin panel (`/admin/`) are Cloudflare Pages Functions + a Durable Object. They will **not** work when you run the Python static server above.

- Easiest: test on the deployed site.
- Local Functions dev (requires Wrangler + Cloudflare login):

```bash
wrangler pages dev . --port 8000 \
  --do HALLPASS=HallPassDurableObject@mrduryea-hallpass
```

If you want Admin auth locally, set `ADMIN_USER` and `ADMIN_PASS` as environment variables in your Pages dev session (or in Cloudflare Pages project settings for production). The admin credentials are not stored in this repo.

The Durable Object code lives in `workers/hallpass-worker/` and is deployed as the `mrduryea-hallpass` Worker.
If you have not deployed it yet, run `wrangler deploy` from that directory first.

## Structure

- `index.html` - landing page with links to each class.
- `styles.css` - shared styles for all pages.
- `expl-comp-sci/`, `web-dev/`, `dig-lit/`, `intro-to-python/` - class pages.
- `dig-lit/assignments/` - current assignment pages with interactive elements.
- `img/` - site images.

## Notable behaviors

- `dig-lit/assignments/recreate-challenge.html` uses localStorage to track checklist progress.
- `dig-lit/assignments/powerpoint-guided-notes.html` collects responses and exports a JSON payload for Canvas.

## Missing/placeholder pages

Some class pages link to assignment files that do not exist yet:

- `expl-comp-sci/assignments/assignment-1.html`
- `expl-comp-sci/assignments/assignment-2.html`
- `expl-comp-sci/assignments/assignment-3.html`
- `web-dev/assignments/assignment-1.html`
- `web-dev/assignments/assignment-2.html`
- `web-dev/assignments/assignment-3.html`
- `intro-to-python/assignments/assignment-1.html`
- `intro-to-python/assignments/assignment-2.html`
- `intro-to-python/assignments/assignment-3.html`
- `dig-lit/assignments/assignment-2.html`
- `dig-lit/assignments/assignment-3.html`

## Sync mode

This site is deployed via Cloudflare syncing from GitHub. The only thing you need to do is commit your changes locally and push them to the `main` branch on GitHub.

### The simple loop

1. **Check what changed**
	- `git status`

2. **Stage your changes**
	- Stage everything: `git add .`
	- Or stage a single file: `git add path/to/file.html`

3. **Commit with a short message about udpates**
	- `git commit -m "Updated xxxxx..."`

4. **Push to GitHub (`main`)**
	- `git push origin main`

Once GitHub has the new commit, Cloudflare will auto-build/auto-deploy and your site will update after that deploy finishes.

### Quick checks / common gotchas

- If `git status` shows you’re on another branch (not `main`), switch back before pushing:
  - `git switch main`
- If you see “everything up-to-date” but the site didn’t change, make sure you actually committed (`git log -1`) and pushed the right branch.
- If a push is rejected due to remote changes, pull/rebase then push again:
  - `git pull --rebase origin main`
