import type { PaymentGateway } from './types.js'
import { StripeAdapter } from './adapters/stripe.js'

/**
 * Gateway registry — maps gateway IDs to their adapter factories.
 * To add a new gateway, import it here and add it to the registry.
 */
const GATEWAY_REGISTRY: Record<string, (credentials: Record<string, string>) => PaymentGateway> = {
  stripe: (creds) => new StripeAdapter(creds.secretKey, creds.webhookSecret),
  // paypal: (creds) => new PayPalAdapter(creds.clientId, creds.clientSecret),
  // square: (creds) => new SquareAdapter(creds.accessToken, creds.webhookSignatureKey),
  // razorpay: (creds) => new RazorpayAdapter(creds.keyId, creds.keySecret, creds.webhookSecret),
  // flutterwave: (creds) => new FlutterwaveAdapter(creds.secretKey, creds.webhookHash),
  // paystack: (creds) => new PaystackAdapter(creds.secretKey),
}

export function createGateway(
  gatewayId: string,
  credentials: Record<string, string>
): PaymentGateway {
  const factory = GATEWAY_REGISTRY[gatewayId]
  if (!factory) {
    throw new Error(`Unknown payment gateway: "${gatewayId}". Supported: ${Object.keys(GATEWAY_REGISTRY).join(', ')}`)
  }
  return factory(credentials)
}

export function listSupportedGateways(): string[] {
  return Object.keys(GATEWAY_REGISTRY)
}
