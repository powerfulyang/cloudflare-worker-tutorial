const publicPathPrefixes = [
  '/api/auth/',
  '/api/test/',
  '/api/records/',
] as const

export function isPublicPath(path: string) {
  return publicPathPrefixes.some(prefix => path.startsWith(prefix))
}
