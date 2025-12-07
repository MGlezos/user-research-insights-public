// Simple encryption utility for storing API keys
// Uses browser's built-in crypto API for basic encryption

const STORAGE_KEY = "supersoniq_api_key"
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
