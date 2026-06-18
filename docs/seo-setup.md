# SkillMake SEO setup

SkillMake has three SEO/measurement pieces wired in:

- `src/app/sitemap.ts` generates `https://skillmake.xyz/sitemap.xml`.
- `src/app/robots.ts` generates `https://skillmake.xyz/robots.txt`.
- `src/app/layout.tsx` can emit GA4 and Google Search Console verification tags when env vars are set.

## 1. Ship sitemap and robots

Deploy the current app. After deploy, verify:

```bash
curl -fsSL https://skillmake.xyz/robots.txt
curl -fsSL https://skillmake.xyz/sitemap.xml | head
```

Expected `robots.txt`:

```txt
User-Agent: *
Allow: /
Disallow: /admin
Disallow: /api
Sitemap: https://skillmake.xyz/sitemap.xml
```

The sitemap includes the main public pages and every approved marketplace entry at
`/marketplace/<entry-id>`. It revalidates hourly.

## 2. Verify Google Search Console

Preferred path: use domain verification in Search Console.

1. Open Google Search Console.
2. Add a Domain property for `skillmake.xyz`.
3. Copy the TXT record Google gives you.
4. Add that TXT record in Cloudflare DNS for `skillmake.xyz`.
5. Click Verify in Search Console.
6. Submit `https://skillmake.xyz/sitemap.xml`.

Fallback path: use the HTML meta tag token.

Set this env var to the token value from Google:

```bash
GOOGLE_SITE_VERIFICATION=google-token-here
```

Then rebuild and deploy. The root layout will render:

```html
<meta name="google-site-verification" content="google-token-here">
```

## 3. Enable Google Analytics 4

Create a GA4 Web data stream for `https://skillmake.xyz`, then set:

```bash
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
```

This must be present when the app is built, because `NEXT_PUBLIC_*` values are exposed to browser code by Next.js at build time.

To mirror server-side product analytics events into GA4 too, create a
Measurement Protocol API secret in Google Analytics under Admin -> Data streams
-> your web stream -> Measurement Protocol API secrets, then set:

```bash
GOOGLE_ANALYTICS_MEASUREMENT_ID=G-XXXXXXXXXX
GOOGLE_ANALYTICS_API_SECRET=your-secret
```

Browser events (`github_click`, `page_dwell`, and `scroll_depth`) are sent by
`gtag` directly when `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` is set. Server events use
Measurement Protocol only when both server env vars above are set.

After deploy, verify the page source contains:

```txt
googletagmanager.com/gtag/js?id=G-XXXXXXXXXX
```

GA4 pageviews are handled by the root layout's `gtag` loader.

## Cloudflare notes

For local testing, put the env vars in `.env.local`.

For Cloudflare deploys, set the env vars in the build environment used by the deploy pipeline. If deploying manually from this machine, export them before building:

```bash
export NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
export GOOGLE_SITE_VERIFICATION=google-token-here
export GOOGLE_ANALYTICS_MEASUREMENT_ID=G-XXXXXXXXXX
npm run deploy
```

If using Cloudflare Workers Builds or CI, set them in that build system instead of only setting Worker runtime secrets.
