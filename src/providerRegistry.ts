import type { CalendarProvider } from './types.js'
import { GoogleCalendarProvider } from './adapters/google.js'

/**
 * Provider registry — maps provider IDs to their adapter factories.
 * To add a new provider, import it here and add it to the registry.
 */
const PROVIDER_REGISTRY: Record<string, () => CalendarProvider> = {
  google: () => new GoogleCalendarProvider(),
  // outlook: () => new OutlookCalendarProvider(),
  // icloud: () => new ICloudCalendarProvider(),
  // caldav: () => new CalDAVCalendarProvider(),
}

export function createProvider(providerId: string): CalendarProvider {
  const factory = PROVIDER_REGISTRY[providerId]
  if (!factory) {
    throw new Error(
      `Unknown calendar provider: "${providerId}". Supported: ${Object.keys(PROVIDER_REGISTRY).join(', ')}`
    )
  }
  return factory()
}

export function listSupportedProviders(): string[] {
  return Object.keys(PROVIDER_REGISTRY)
}
