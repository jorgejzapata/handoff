// Which Firebase project this is running in, and its public web address.
export function projectId() {
  return process.env.GCLOUD_PROJECT ?? JSON.parse(process.env.FIREBASE_CONFIG ?? '{}').projectId ?? ''
}

export function isProd() {
  return projectId().startsWith('handoff-prod')
}

export function appUrl() {
  return isProd() ? 'https://handoffsublease.com' : `https://${projectId()}.web.app`
}
