import type { PaymentGateway, CheckoutParams, CheckoutSession, WebhookEvent, Refund } from '../types.js'

/**
 * Stripe Payment Gateway Adapter
 * 
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 */
export class StripeAdapter implements PaymentGateway {
  readonly id = 'stripe'
  readonly name = 'Stripe'

  private readonly secretKey: string
  private readonly webhookSecret: string
  private stripe: any // Will be the Stripe SDK instance

  constructor(secretKey: string, webhookSecret: string) {
    this.secretKey = secretKey
    this.webhookSecret = webhookSecret
  }

  private async getStripe() {
    if (!this.stripe) {
      // Dynamic import so Stripe SDK is only loaded when this adapter is used
      const stripeModule = await import('stripe')
      const Stripe = (stripeModule as any).default || stripeModule.Stripe || stripeModule
      this.stripe = new Stripe(this.secretKey, { apiVersion: '2024-12-18.acacia' })
    }
    return this.stripe
  }

  async createCheckout(params: CheckoutParams): Promise<CheckoutSession> {
    const stripe = await this.getStripe()

    const requestOptions = params.connectedAccountId
      ? { stripeAccount: params.connectedAccountId }
      : {}

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: params.currency.toLowerCase(),
            product_data: { name: params.description },
            unit_amount: params.amount,
          },
          quantity: 1,
        },
      ],
      customer_email: params.customerEmail || undefined,
      metadata: { bookingId: params.bookingId },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 min
    }, requestOptions)

    return {
      id: session.id,
      url: session.url!,
      expiresAt: new Date(session.expires_at * 1000),
    }
  }

  async verifyWebhook(payload: Buffer, signature: string): Promise<WebhookEvent> {
    const stripe = await this.getStripe()
    const event = stripe.webhooks.constructEvent(payload, signature, this.webhookSecret)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        return {
          type: 'payment.completed',
          chargeId: session.payment_intent as string,
          amount: session.amount_total ?? 0,
          currency: session.currency ?? 'usd',
          metadata: session.metadata as Record<string, string>,
        }
      }
      case 'checkout.session.expired':
      case 'payment_intent.payment_failed': {
        const obj = event.data.object as any
        return {
          type: 'payment.failed',
          chargeId: obj.id,
          amount: obj.amount ?? 0,
          currency: obj.currency ?? 'usd',
          metadata: obj.metadata,
        }
      }
      case 'charge.refunded': {
        const charge = event.data.object as any
        return {
          type: 'refund.completed',
          chargeId: charge.id,
          amount: charge.amount_refunded,
          currency: charge.currency,
          metadata: charge.metadata,
        }
      }
      default:
        throw new Error(`Unhandled Stripe event: ${event.type}`)
    }
  }

  async refund(chargeId: string, amount?: number): Promise<Refund> {
    const stripe = await this.getStripe()

    const refund = await stripe.refunds.create({
      payment_intent: chargeId,
      ...(amount !== undefined ? { amount } : {}),
    })

    return {
      id: refund.id,
      chargeId,
      amount: refund.amount,
      currency: refund.currency,
      status: refund.status === 'succeeded' ? 'succeeded' : 'pending',
    }
  }
}
