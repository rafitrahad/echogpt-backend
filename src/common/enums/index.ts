// Who is allowed to do what
export enum RoleName {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

// The life of a user's subscription
export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

// Which AI company a provider belongs to
export enum ProviderType {
  OPENAI = 'OPENAI',
  ANTHROPIC = 'ANTHROPIC',
  GEMINI = 'GEMINI',
}

// Result of the provider health check
export enum ProviderHealth {
  UNKNOWN = 'UNKNOWN',
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  DOWN = 'DOWN',
}

// Who wrote a chat message
export enum MessageRole {
  SYSTEM = 'SYSTEM',
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
}

// What kind of request counts against the daily limit
export enum UsageType {
  CHAT = 'CHAT',
  SEARCH = 'SEARCH',
}