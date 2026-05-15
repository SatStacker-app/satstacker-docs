# SatStacker Engine Docs

Public documentation site for the SatStacker Engine Partner API.

Live at: https://docs.satstacker.app

Built with [Docusaurus](https://docusaurus.io/), hosted on Railway, deployed automatically on push to `main`.

## Local development

Requires Node.js 18+ and npm.

```bash
npm install
npm run gen-api-docs        # generates docs/api/* from openapi/partner-api.json
npm start                   # serves at http://localhost:3000
```

Edits to any `.md` file in `docs/` hot-reload in the browser.

## Updating the API reference

The API reference pages are auto-generated from `openapi/partner-api.json`. That file is a *filtered* copy of the live `openapi.json` at `api.satstacker.app/openapi.json`, containing only the `/partner/v1/*` endpoints.

To refresh it after changing the partner API:

```bash
node scripts/fetch-openapi.js   # pulls live spec, filters to partner-only
npm run clean-api-docs          # remove old generated pages
npm run gen-api-docs            # regenerate from the new spec
git commit -am "update API reference"
git push
```

Railway redeploys automatically on push.

## Deploying

This repo is configured to deploy to Railway via Nixpacks. The build runs `npm install && npm run build`, then `npm run serve` serves the static `build/` directory.

To deploy a new instance:

1. Create a new Railway project pointing at this repo.
2. Set the start command: `npm run serve` (already in `railway.toml`).
3. Add a custom domain (e.g. `docs.satstacker.app`) in Railway settings.
4. Point a CNAME at the Railway-provided hostname in your DNS provider.

## File structure

```
satstacker-docs/
├── docs/                      # markdown content
│   ├── index.md               # / (landing page)
│   ├── getting-started.md
│   ├── authentication.md
│   ├── concepts.md
│   ├── smart-timing.md
│   ├── environments.md
│   ├── errors.md
│   ├── rate-limits.md
│   ├── changelog.md
│   └── api/                   # AUTO-GENERATED from openapi/partner-api.json
├── openapi/
│   └── partner-api.json       # filtered OpenAPI spec (commit this)
├── scripts/
│   └── fetch-openapi.js       # regenerates partner-api.json from live API
├── src/css/custom.css         # theme colors (Bitcoin orange)
├── static/img/                # logo, favicon, screenshots
├── docusaurus.config.js
├── sidebars.js
└── package.json
```

## Notes

- `docs/api/` is gitignored. It's regenerated from `openapi/partner-api.json` on every build.
- The OpenAPI spec at `openapi/partner-api.json` IS committed — it's the source of truth for what's published. The fetch script is a convenience to update it.
- Railway free hobby tier ($5/mo credit) easily covers a Docusaurus static site (~$1-3/mo of compute).
