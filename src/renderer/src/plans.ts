/**
 * Display catalog for the Billing page. The PRICES here are for display only —
 * the authoritative amount lives server-side in the create-payment-link Edge
 * Function (keep the credits/amounts in sync with it).
 */
export interface PlanCard {
  id: string
  name: string
  price: string // display, e.g. "₹799"
  cadence?: string // e.g. "/ 30 days"
  credits: number
  tagline: string
  highlight?: boolean
}

export const PLANS: PlanCard[] = [
  {
    id: 'pro',
    name: 'Pro',
    price: '₹799',
    cadence: '/ 30 days',
    credits: 2000,
    tagline: '2,000 credits — ~2,000 fast or ~250 premium replies'
  },
  {
    id: 'pro_plus',
    name: 'Pro+',
    price: '₹1,599',
    cadence: '/ 30 days',
    credits: 5000,
    tagline: '5,000 credits — best value per credit',
    highlight: true
  }
]

export const TOPUPS: PlanCard[] = [
  { id: 'topup_1000', name: '1,000 credits', price: '₹399', credits: 1000, tagline: 'Quick refill' },
  { id: 'topup_2500', name: '2,500 credits', price: '₹799', credits: 2500, tagline: 'Most popular' },
  { id: 'topup_6000', name: '6,000 credits', price: '₹1,599', credits: 6000, tagline: 'Best value' }
]
