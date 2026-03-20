---
allowed-tools: Bash
description: Build and deploy the landing page to Cloudflare Pages
---

Build and deploy the site to Cloudflare Pages:

```bash
cd site && npm run build && CLOUDFLARE_ACCOUNT_ID=972f8c0c21865ac5fa34b14cfb73479e npx wrangler pages deploy dist --project-name kolshek --commit-dirty=true
