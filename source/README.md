# LoanShield

Social Work & Sustainability course project: a five-stage response to illegal loan app harassment in India.

Live app: https://claude.ai/artifact/RvuocA8TjtWS3NRL1imJfX (private until you share it from the page's Share menu)

## What's here

- `LoanShield_Final.pptx` is the final presentation (also in `site/downloads/`).
- `site/` is a standalone copy of the website. It works if you open `site/index.html` directly, or upload the folder to GitHub Pages or Netlify. The shared live graph, AI second opinion and save prompts only work at the live link; the standalone copy falls back to sample data.
- `source/` holds everything needed to change and rebuild it.

## Source files

| File | What it is |
|---|---|
| `core.js` | All the logic: Truth Check, threat scanner, rights map, call-time check, Contact Shield text, script fingerprint, scam graph (union-find), evidence hash chain, complaint packet |
| `data.js` | Fictional sample reports and the 50-message test set |
| `app.js` | The website's interface, including the live shared graph |
| `index.src.html` | Page layout and styles |
| `build.js` | Builds `site/index.html` and the hosted version in `artifact/` |
| `test.js` | Checks the logic and prints precision and recall |
| `deck_mac.js` | Builds the final deck (needs pptxgenjs, react, react-icons, sharp and the screenshots in `deckimg/`) |

## Rebuild

```
node test.js
node build.js
node deck_mac.js
```

## Before you submit

Replace `[Team names] · [Course code] · [Institution]` on the deck's title slide and in the website footer.
