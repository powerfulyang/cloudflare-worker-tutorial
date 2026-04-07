export function isAllowedOrigin(origin: string) {
  // always true
  return !!origin
  // *.us4ever.com
  // *.littleeleven.com
  // *.powerfulyang.com
  // return origin.endsWith('.us4ever.com')
  //   || origin.endsWith('.littleeleven.com')
  //   || origin.endsWith('.powerfulyang.com')
  //   || origin === 'https://us4ever.com'
  //   || origin === 'https://littleeleven.com'
  //   || origin === 'https://powerfulyang.com'
}

export * from './logger'
