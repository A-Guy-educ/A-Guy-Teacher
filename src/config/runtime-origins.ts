type RuntimeEnvironment = Readonly<Record<string, string | undefined>>

interface RuntimeOriginOptions {
  development: string
  environment?: RuntimeEnvironment
  name: string
  production: string
  value?: string
}

export function resolveRuntimeOrigin({
  development,
  environment = process.env,
  name,
  production,
  value,
}: RuntimeOriginOptions): URL {
  const configuredValue = value?.trim() || environment[name]?.trim()

  if (
    !configuredValue &&
    environment.NODE_ENV === 'production' &&
    environment.VERCEL_ENV === 'preview'
  ) {
    throw new Error(`${name} must be configured for preview and QA deployments`)
  }

  const fallback = environment.NODE_ENV === 'production' ? production : development
  const url = new URL(configuredValue || fallback)

  if (environment.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS in production`)
  }

  return url
}
