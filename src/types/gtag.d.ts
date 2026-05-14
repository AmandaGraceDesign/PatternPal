interface Window {
  gtag: (...args: any[]) => void
  dataLayer: any[]
  pintrk?: (action: string, event: string, data?: object) => void
}
