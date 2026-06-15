# dev deploy

## Job

Deploy the configured branch to Vercel Preview and keep the stable dev URL pointing at the latest deployment.

## Executable

Run the `dev-deploy` executable.

`VERCEL_ACCESS_TOKEN` comes from `.kody/secrets.enc`. Non-secret deploy config comes from `.kody/variables.json`.

## Allowed Commands

- Run the `dev-deploy` executable.

## Restrictions

- Manual only.
- Do not edit `.github/workflows/*.yml`.
- Do not run raw `vercel deploy` for this duty.
- Report the deployment URL and `https://a-guy-dev-aguy.vercel.app`.
