# Second app — shared login example

The smallest possible app that reuses A-Guy-Web's login. No dependencies, no build step, ~125 lines.

It exists to be read as much as run: the entire integration is _forward the cookie you were given, and ask A-Guy-Web who the user is_. This app never reads the cookie, never verifies a token, and holds no secret.

## Run it

A-Guy-Web must be running on the same parent domain — `localhost` cannot be one, since two ports on `localhost` are the same host. In A-Guy-Web's `.env`:

```bash
ROOT_DOMAIN=lvh.me
AUTH_ALLOWED_RETURN_ORIGINS=http://app2.lvh.me:3001
API_ALLOWED_ORIGINS=http://app2.lvh.me:3001
```

Then:

```bash
pnpm dev                              # A-Guy-Web, browse it at app.lvh.me:3000
node examples/second-app/server.mjs   # this app, at app2.lvh.me:3001
```

`lvh.me` is a public domain that resolves to `127.0.0.1`, so nothing needs adding to your hosts file.

Sign in at `app.lvh.me:3000`, then reload `app2.lvh.me:3001` — it should greet you by name without a second login. The "log out everywhere" button tests the reverse.

Point it elsewhere with `AGUY_URL=https://www.aguy.co.il node server.mjs`, though a production cookie will not reach a `localhost` app.

## What to copy

The `whoIs` function, and nothing else. Everything above it is presentation.

The full contract — including what never to do — is in [SHARED-LOGIN-APP-GUIDE.md](../../docs/architecture/SHARED-LOGIN-APP-GUIDE.md).
