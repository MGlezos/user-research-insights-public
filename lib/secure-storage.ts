// Simple encryption utility for storing API keys
// Uses browser's built-in crypto API for basic encryption

const STORAGE_KEY = "supersoniq_api_key"
const GEMINI_STORAGE_KEY = "supersoniq_gemini_key"
const OPENAI_STORAGE_KEY = "supersoniq_openai_key"
const CLAUDE_STORAGE_KEY = "supersoniq_claude_key"
const AI_PROVIDER_KEY = "supersoniq_ai_provider"
const ENCRYPTION_KEY = "supersoniq-insights-v1"

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

// Gemini API Key functions
export function storeGeminiKey(apiKey: string): void {
  if (typeof window !== "undefined") {
    const encrypted = encrypt(apiKey)
    localStorage.setItem(GEMINI_STORAGE_KEY, encrypted)
  }
}

export function retrieveGeminiKey(): string {
  if (typeof window !== "undefined") {
    const encrypted = localStorage.getItem(GEMINI_STORAGE_KEY)
    if (encrypted) {
      return decrypt(encrypted)
    }
  }
  return ""
}

export function clearGeminiKey(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(GEMINI_STORAGE_KEY)
  }
}

// OpenAI API Key functions
export function storeOpenAIKey(apiKey: string): void {
  if (typeof window !== "undefined") {
    const encrypted = encrypt(apiKey)
    localStorage.setItem(OPENAI_STORAGE_KEY, encrypted)
  }
}

export function retrieveOpenAIKey(): string {
  if (typeof window !== "undefined") {
    const encrypted = localStorage.getItem(OPENAI_STORAGE_KEY)
    if (encrypted) {
      return decrypt(encrypted)
    }
  }
  return ""
}

export function clearOpenAIKey(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(OPENAI_STORAGE_KEY)
  }
}

// Claude API Key functions
export function storeClaudeKey(apiKey: string): void {
  if (typeof window !== "undefined") {
    const encrypted = encrypt(apiKey)
    localStorage.setItem(CLAUDE_STORAGE_KEY, encrypted)
  }
}

export function retrieveClaudeKey(): string {
  if (typeof window !== "undefined") {
    const encrypted = localStorage.getItem(CLAUDE_STORAGE_KEY)
    if (encrypted) {
      return decrypt(encrypted)
    }
  }
  return ""
}

export function clearClaudeKey(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(CLAUDE_STORAGE_KEY)
  }
}

// AI Provider selection functions
export function storeAIProvider(provider: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(AI_PROVIDER_KEY, provider)
  }
}

export function retrieveAIProvider(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem(AI_PROVIDER_KEY) || "gemini"
  }
  return "gemini"
}
