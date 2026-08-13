export const oauthProviderStatus = {
  google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  github: Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
} as const;

export const authConfigured = Boolean(process.env.AUTH_SECRET && (oauthProviderStatus.google || oauthProviderStatus.github));
