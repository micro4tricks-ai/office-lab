# The web app, built for the server version (API on the same site), served by Caddy.
FROM node:24-trixie-slim@sha256:173f125896c3b47ddf056734c7ea789d04595a6a08769a8f78e0df642781fb66 AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
# 'self': the API is at /api on this same site.
ENV PUBLIC_API_URL=self
# https://your-domain, for the sitemap, canonical links and link previews (from SITE_ORIGIN in .env).
ARG PUBLIC_SITE_ORIGIN=
ENV PUBLIC_SITE_ORIGIN=$PUBLIC_SITE_ORIGIN
RUN npm run build

FROM caddy:2.11.7@sha256:f2a1290d0463aad60660d4ec134943f183ee2a5f6c3eb7bf32dd984f2f020772
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=web /src/web/build /srv
