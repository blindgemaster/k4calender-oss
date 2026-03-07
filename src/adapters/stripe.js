"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeAdapter = void 0;
/**
 * Stripe Payment Gateway Adapter
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 */
class StripeAdapter {
    constructor(secretKey, webhookSecret) {
        this.id = 'stripe';
        this.name = 'Stripe';
        this.secretKey = secretKey;
        this.webhookSecret = webhookSecret;
    }
    getStripe() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.stripe) {
                // Dynamic import so Stripe SDK is only loaded when this adapter is used
                const Stripe = (yield Promise.resolve().then(() => __importStar(require('stripe')))).default;
                this.stripe = new Stripe(this.secretKey, { apiVersion: '2024-12-18.acacia' });
            }
            return this.stripe;
        });
    }
    createCheckout(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const stripe = yield this.getStripe();
            const session = yield stripe.checkout.sessions.create({
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
                customer_email: params.customerEmail,
                metadata: { bookingId: params.bookingId },
                success_url: params.successUrl,
                cancel_url: params.cancelUrl,
                expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 min
            });
            return {
                id: session.id,
                url: session.url,
                expiresAt: new Date(session.expires_at * 1000),
            };
        });
    }
    verifyWebhook(payload, signature) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const stripe = yield this.getStripe();
            const event = stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
            switch (event.type) {
                case 'checkout.session.completed': {
                    const session = event.data.object;
                    return {
                        type: 'payment.completed',
                        chargeId: session.payment_intent,
                        amount: (_a = session.amount_total) !== null && _a !== void 0 ? _a : 0,
                        currency: (_b = session.currency) !== null && _b !== void 0 ? _b : 'usd',
                        metadata: session.metadata,
                    };
                }
                case 'checkout.session.expired':
                case 'payment_intent.payment_failed': {
                    const obj = event.data.object;
                    return {
                        type: 'payment.failed',
                        chargeId: obj.id,
                        amount: (_c = obj.amount) !== null && _c !== void 0 ? _c : 0,
                        currency: (_d = obj.currency) !== null && _d !== void 0 ? _d : 'usd',
                        metadata: obj.metadata,
                    };
                }
                case 'charge.refunded': {
                    const charge = event.data.object;
                    return {
                        type: 'refund.completed',
                        chargeId: charge.id,
                        amount: charge.amount_refunded,
                        currency: charge.currency,
                        metadata: charge.metadata,
                    };
                }
                default:
                    throw new Error(`Unhandled Stripe event: ${event.type}`);
            }
        });
    }
    refund(chargeId, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            const stripe = yield this.getStripe();
            const refund = yield stripe.refunds.create(Object.assign({ payment_intent: chargeId }, (amount !== undefined ? { amount } : {})));
            return {
                id: refund.id,
                chargeId,
                amount: refund.amount,
                currency: refund.currency,
                status: refund.status === 'succeeded' ? 'succeeded' : 'pending',
            };
        });
    }
}
exports.StripeAdapter = StripeAdapter;
