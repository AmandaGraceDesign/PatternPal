export const GA_ADS_ID = 'AW-11155883885'

export const CONVERSION_IDS = {
  freeSignup: 'AW-11155883885/0P5rCP-UspEcEO2Oxccp',
  proTrialMonthly: 'AW-11155883885/a8vJCKu1spEcEO2Oxccp',
  proTrialAnnual: 'AW-11155883885/uNvTCIzTq5EcEO2Oxccp',
}

export function fireConversion(
  type: 'freeSignup' | 'proTrialMonthly' | 'proTrialAnnual',
) {
  if (typeof window === 'undefined' || !window.gtag) return

  const conversionMap = {
    freeSignup:      { value: 0,     currency: 'USD' },
    proTrialMonthly: { value: 7.99,  currency: 'USD' },
    proTrialAnnual:  { value: 79.92, currency: 'USD' },
  }

  window.gtag('event', 'conversion', {
    send_to: CONVERSION_IDS[type],
    ...conversionMap[type],
  })
}
