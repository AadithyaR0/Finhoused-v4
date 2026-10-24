# Household Finance PWA

A zero-backend Progressive Web App built with **React**, **Vite**, **Tailwind CSS**, and **IndexedDB** (with `navigator.storage.persist()` safeguard for iPhone/iOS Safari).

## Repository Structure
- `src/App.jsx` — Complete application with IndexedDB (`Dexie` compatible), Dashboard, Monthly Cashflow Planner, Full Data Sheet, Future Compound Interest Predictor, and P2P Sync.
- `src/main.jsx` — Entry point with Service Worker registration & `navigator.storage.persist()` safeguard.
- `public/manifest.json` & `public/sw.js` — PWA installation manifest and offline Service Worker.
- `.github/workflows/deploy.yml` — Automated GitHub Actions workflow to build and deploy straight to GitHub Pages on every push to `main`.

## Quick Start (Local)
```bash
npm install
npm run dev
```

## Deploying to GitHub Pages
1. Create a new repository on GitHub and push all files in this folder to the `main` branch.
2. In your GitHub repo, go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
3. The included `.github/workflows/deploy.yml` action will automatically build and publish your live PWA URL.
4. Open the live URL in **Safari on iPhone** → tap **Share** → **Add to Home Screen**.
