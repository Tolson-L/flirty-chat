# One‑Click Launch

1) **Create a GitHub repo** and copy this project (frontend + backend).

2) **Render (Backend)**
- New → Blueprint → repo with `render.yaml`.
- Set env vars: `STRIPE_SECRET`, `WEBHOOK_SECRET`, `ADMIN_TOKEN`, `MONGODB_URI` (Atlas) and the 8 Stripe price IDs (or paste them later via the Setup Wizard).

3) **Stripe**
- Products: Premium ($5/mo) and Ultra ($15/mo)
- Prices: 1/3/6/12 month intervals, 3/6/12 at 5% discount
- Webhook: `https://YOUR_API/api/stripe/webhook` (event: `checkout.session.completed`)

4) **Netlify (Frontend)**
- New site from Git → `/frontend`
- `netlify.toml` proxies `/api/*` → your Render API

5) **In‑site Setup Wizard**
- Open the site → **Help / Setup**
- Enter `ADMIN_TOKEN`
- Paste **AdSense Publisher ID** + **Stripe Price IDs** → Save
- Ads load and checkout works immediately

6) **Done** — Click Upgrade, choose plan/period, pay, return as Premium/Ultra.
