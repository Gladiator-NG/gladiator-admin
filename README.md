# Gladiator Admin

Operations application for the Gladiator customer website. The two
applications share Supabase catalogue, availability, customer, and booking
data.

## Documentation

- [Developer guide](docs/DEVELOPER_GUIDE.md) — architecture, data model,
  booking/payment flows, deployment, verification, and takeover notes.
- [Application behaviour audit](docs/APP_AUDIT.md) — audited scope,
  documentation corrections, and current risk summary.
- In-app Help Center (`/help`) — plain-language operating guidance for Admin
  and Staff users.

## Environment

Set these Vite environment variables in each deployment:

```bash
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_APP_URL=https://gladiator-admin-lemon.vercel.app
```

`VITE_APP_URL` is used for password reset email redirects and metadata canonical URLs. For staging, set it to `https://gladiator-admin-lemon.vercel.app`. For production, change it to the live production domain in that environment.

If `VITE_APP_URL` is not set, the app currently falls back to the staging domain above instead of `localhost`.
