# mrduryea.org

Static class hub for Mr. Duryea. The site is plain HTML/CSS with a couple of JavaScript-enhanced assignment pages. There is no build step or dependency install.

## Quick start

- Open `index.html` in a browser, or
- Run a simple local server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

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

