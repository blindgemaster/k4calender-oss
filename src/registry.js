"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGateway = createGateway;
exports.listSupportedGateways = listSupportedGateways;
const stripe_1 = require("./adapters/stripe");
/**
 * Gateway registry — maps gateway IDs to their adapter factories.
 * To add a new gateway, import it here and add it to the registry.
 */
const GATEWAY_REGISTRY = {
    stripe: (creds) => new stripe_1.StripeAdapter(creds.secretKey, creds.webhookSecret),
    // paypal: (creds) => new PayPalAdapter(creds.clientId, creds.clientSecret),
    // square: (creds) => new SquareAdapter(creds.accessToken, creds.webhookSignatureKey),
    // razorpay: (creds) => new RazorpayAdapter(creds.keyId, creds.keySecret, creds.webhookSecret),
    // flutterwave: (creds) => new FlutterwaveAdapter(creds.secretKey, creds.webhookHash),
    // paystack: (creds) => new PaystackAdapter(creds.secretKey),
};
function createGateway(gatewayId, credentials) {
    const factory = GATEWAY_REGISTRY[gatewayId];
    if (!factory) {
        throw new Error(`Unknown payment gateway: "${gatewayId}". Supported: ${Object.keys(GATEWAY_REGISTRY).join(', ')}`);
    }
    return factory(credentials);
}
function listSupportedGateways() {
    return Object.keys(GATEWAY_REGISTRY);
}
