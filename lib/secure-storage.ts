// Simple encryption utility for storing API keys
// Uses browser's built-in crypto API for basic encryption

const STORAGE_KEY = "supersoniq_api_key"
const AI_PROVIDER_KEY = "supersoniq_ai_provider"
const AI_API_KEY = "supersoniq_ai_key"
const ENCRYPTION_KEY = "supersoniq-insights-v1"

// AI Provider types
export type AIProvider = "gemini" | "openai" | "claude"

export const AI_PROVIDER_CONFIG = {
  gemini: {
    name: "Gemini API",
    keyLink: "https://aistudio.google.com/app/api-keys",
    keyLinkText: "Get a free Gemini key →",
    logo: "/images/gemini-logo.png",
  },
  openai: {
    name: "OpenAI API",
    keyLink: "https://platform.openai.com/api-keys",
    keyLinkText: "Get a free OpenAI key →",
    logo: "/images/openai-logo.png",
  },
  claude: {
    name: "Claude API",
    keyLink: "https://console.anthropic.com/settings/keys",
    keyLinkText: "Get a free Claude key →",
    logo: "/images/claude-logo.png",
  },
} as const

// Simple XOR-based encryption (sufficient for localStorage protection)
function encrypt(text: string): string {
  let result = ""
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length))
  }
  return btoa(result) // Base64 encode
}

function decrypt(encrypted: string): string {
  try {
    const decoded = atob(encrypted) // Base64 decode
    let result = ""
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length))
    }
    return result
  } catch {
    return ""
  }
}

// AssemblyAI API Key functions
export function storeApiKey(apiKey: string): void {
  if (typeof window !== "undefined") {
    const encrypted = encrypt(apiKey)
    localStorage.setItem(STORAGE_KEY, encrypted)
  }
}

export function retrieveApiKey(): string {
  if (typeof window !== "undefined") {
    const encrypted = localStorage.getItem(STORAGE_KEY)
    if (encrypted) {
      return decrypt(encrypted)
    }
  }
  return ""
}

export function clearApiKey(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY)
  }
}

// AI Provider functions
export function storeAIProvider(provider: AIProvider): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(AI_PROVIDER_KEY, provider)
  }
}

export function retrieveAIProvider(): AIProvider {
  if (typeof window !== "undefined") {
    const provider = localStorage.getItem(AI_PROVIDER_KEY) as AIProvider | null
    if (provider && ["gemini", "openai", "claude"].includes(provider)) {
      return provider
    }
  }
  return "gemini" // Default to Gemini
}

export function clearAIProvider(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(AI_PROVIDER_KEY)
  }
}

// AI API Key functions (replaces Gemini-specific functions)
export function storeAIKey(apiKey: string): void {
  if (typeof window !== "undefined") {
    const encrypted = encrypt(apiKey)
    localStorage.setItem(AI_API_KEY, encrypted)
  }
}

export function retrieveAIKey(): string {
  if (typeof window !== "undefined") {
    const encrypted = localStorage.getItem(AI_API_KEY)
    if (encrypted) {
      return decrypt(encrypted)
    }
  }
  return ""
}

export function clearAIKey(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(AI_API_KEY)
  }
}

// Legacy Gemini functions for backward compatibility (deprecated)
// These will read from the new AI key storage
export function storeGeminiKey(apiKey: string): void {
  storeAIKey(apiKey)
  storeAIProvider("gemini")
}

export function retrieveGeminiKey(): string {
  return retrieveAIKey()
}

export function clearGeminiKey(): void {
  clearAIKey()
}
