"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Drawer, DrawerClose, DrawerHeader, DrawerTitle, DrawerContent } from "@/components/ui/drawer"
import { Loader2, Upload, FileAudio, Download, X, Check, Info, Settings } from "lucide-react"
import {
  storeApiKey,
  retrieveApiKey,
  clearApiKey,
  storeGeminiKey,
  retrieveGeminiKey,
  clearGeminiKey,
} from "@/lib/secure-storage"

type Utterance = {
  speaker: string
  text: string
  start: number
  end: number
  sentiment?: string
}

type Theme = {
  text: string
  timestamp?: number
  count?: number
}

type SentimentSegment = {
  start: number
  end: number
  sentiment: string
  text: string
}

type SpeakerSentiment = {
  speaker: string
  predominantSentiment: string
  description: string
}

type SentimentQuote = {
  text: string
  sentiment: string
  confidence: number
}

type TranscriptionResult = {
  summaryParagraph: string
  summaryBullets: string[]
  takeaways: string[]
  quotes: string[]
  fullTranscript: string
  utterances?: Utterance[]
  themes?: Theme[]
  overallSentiment?: string
  sentimentSegments?: SentimentSegment[]
  speakerSentiments?: SpeakerSentiment[]
  positiveQuotes?: SentimentQuote[]
  negativeQuotes?: SentimentQuote[]
}

export default function Home() {
  const [apiKey, setApiKey] = useState("")
  const [storedApiKey, setStoredApiKey] = useState("")
  const [isApiKeyStored, setIsApiKeyStored] = useState(false)
  const [geminiKey, setGeminiKey] = useState("")
  const [storedGeminiKey, setStoredGeminiKey] = useState("")
  const [isGeminiKeyStored, setIsGeminiKeyStored] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<TranscriptionResult | null>(null)
  const [error, setError] = useState("")
  const [errorType, setErrorType] = useState<"general" | "quota" | "auth" | null>(null)
  const [errorSource, setErrorSource] = useState<"assemblyai" | "gemini" | null>(null)
  const [copied, setCopied] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [summaryMode, setSummaryMode] = useState<"paragraph" | "bullets">("paragraph")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const savedKey = retrieveApiKey()
    if (savedKey) {
      setStoredApiKey(savedKey)
      setIsApiKeyStored(true)
    }
    const savedGeminiKey = retrieveGeminiKey()
    if (savedGeminiKey) {
      setStoredGeminiKey(savedGeminiKey)
      setIsGeminiKeyStored(true)
    }
  }, [])

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.dataTransfer?.types.includes("Files")) {
        setIsDragging(true)
      }
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      // Only hide overlay when leaving the window entirely
      if (e.target === document.body || e.relatedTarget === null) {
        setIsDragging(false)
      }
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = e.dataTransfer?.files
      if (files && files.length > 0) {
        const audioFile = files[0]
        if (audioFile.type.startsWith("audio/")) {
          setFile(audioFile)
          setError("")
          setErrorType(null)
          setErrorSource(null)
        } else {
          setError("Please upload an audio file")
          setErrorType("general")
          setErrorSource(null)
        }
      }
    }

    window.addEventListener("dragenter", handleDragEnter)
    window.addEventListener("dragover", handleDragOver)
    window.addEventListener("dragleave", handleDragLeave)
    window.addEventListener("drop", handleDrop)

    return () => {
      window.removeEventListener("dragenter", handleDragEnter)
      window.removeEventListener("dragover", handleDragOver)
      window.removeEventListener("dragleave", handleDragLeave)
      window.removeEventListener("drop", handleDrop)
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setError("")
      setErrorType(null)
      setErrorSource(null)
    }
  }

  const handleStoreApiKey = () => {
    if (apiKey.trim()) {
      storeApiKey(apiKey)
      setStoredApiKey(apiKey)
      setIsApiKeyStored(true)
      setApiKey("")
    }
  }

  const handleRemoveApiKey = () => {
    clearApiKey()
    setStoredApiKey("")
    setIsApiKeyStored(false)
    setApiKey("")
  }

  const handleStoreGeminiKey = () => {
    if (geminiKey.trim()) {
      storeGeminiKey(geminiKey)
      setStoredGeminiKey(geminiKey)
      setIsGeminiKeyStored(true)
      setGeminiKey("")
    }
  }

  const handleRemoveGeminiKey = () => {
    clearGeminiKey()
    setStoredGeminiKey("")
    setIsGeminiKeyStored(false)
    setGeminiKey("")
  }

  const handleRemoveFile = () => {
    setFile(null)
    setError("")
    setErrorType(null)
    setErrorSource(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleTranscribe = async () => {
    if (!file || !storedApiKey) return

    setIsProcessing(true)
    setError("")
    setErrorType(null)
    setErrorSource(null)

    // Helper function to detect error types
    const detectErrorType = (status: number, errorText: string): "quota" | "auth" | "general" => {
      const lowerError = errorText.toLowerCase()
      if (status === 401 || lowerError.includes("unauthorized") || lowerError.includes("invalid api key")) {
        return "auth"
      }
      if (
        status === 429 ||
        status === 402 ||
        lowerError.includes("quota") ||
        lowerError.includes("limit") ||
        lowerError.includes("exceeded") ||
        lowerError.includes("rate limit") ||
        lowerError.includes("too many requests") ||
        lowerError.includes("insufficient") ||
        lowerError.includes("billing") ||
        lowerError.includes("credits")
      ) {
        return "quota"
      }
      return "general"
    }

    try {
      // Upload file to Assembly AI
      let uploadResponse
      try {
        uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
          method: "POST",
          headers: {
            authorization: storedApiKey,
          },
          body: file,
        })
      } catch (uploadError) {
        throw new Error("Network error uploading file. Please check your connection.")
      }

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        const errType = detectErrorType(uploadResponse.status, errorText)
        setErrorType(errType)
        setErrorSource("assemblyai")
        if (errType === "quota") {
          throw new Error(
            "AssemblyAI free tier limit reached. Please upgrade your plan or wait for your quota to reset.",
          )
        } else if (errType === "auth") {
          throw new Error("Invalid AssemblyAI API key. Please check your key and try again.")
        }
        throw new Error(`Failed to upload file: ${uploadResponse.status} - ${errorText}`)
      }

      const { upload_url } = await uploadResponse.json()

      const requestBody: any = {
        audio_url: upload_url,
        // Core transcription features
        speaker_labels: true,
        sentiment_analysis: true,
        entity_detection: true,
      }

      // Start transcription with auto chapters for summary and key phrases, and speaker diarization enabled
      let transcriptResponse
      try {
        transcriptResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
          method: "POST",
          headers: {
            authorization: storedApiKey,
            "content-type": "application/json",
          },
          body: JSON.stringify(requestBody),
        })
      } catch (transcriptError) {
        throw new Error("Network error starting transcription. Please check your connection.")
      }

      if (!transcriptResponse.ok) {
        const errorText = await transcriptResponse.text()
        const errType = detectErrorType(transcriptResponse.status, errorText)
        setErrorType(errType)
        setErrorSource("assemblyai")
        if (errType === "quota") {
          throw new Error(
            "AssemblyAI free tier limit reached. Please upgrade your plan or wait for your quota to reset.",
          )
        } else if (errType === "auth") {
          throw new Error("Invalid AssemblyAI API key. Please check your key and try again.")
        }
        throw new Error(`Failed to start transcription: ${transcriptResponse.status} - ${errorText}`)
      }

      const { id } = await transcriptResponse.json()

      // Poll for completion
      let transcript = null
      while (!transcript || transcript.status !== "completed") {
        await new Promise((resolve) => setTimeout(resolve, 3000))

        let pollResponse
        try {
          pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
            headers: {
              authorization: storedApiKey,
            },
          })
        } catch (pollError) {
          throw new Error("Network error while checking transcription status. Please try again.")
        }

        transcript = await pollResponse.json()

        if (transcript.status === "error") {
          throw new Error(transcript.error || "Transcription failed")
        }
      }

      // Initialize result variables
      let summaryParagraph = ""
      let summaryBullets: string[] = []
      let takeaways: string[] = []
      let quotes: string[] = []
      let geminiPositiveQuotes: SentimentQuote[] = []
      let geminiNegativeQuotes: SentimentQuote[] = []

      // Use Gemini API for high-quality AI-generated insights (if key is available)
      if (storedGeminiKey) {
        try {
          const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${storedGeminiKey}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: `You are an expert user research analyst specializing in extracting actionable insights from interview transcripts. Your job is to help product teams understand what users said and what it means for their product.

TRANSCRIPT TO ANALYZE:
${transcript.text}

Analyze this transcript thoroughly and return ONLY a JSON object (no markdown, no code blocks, no explanations) with this exact structure:

{
  "summary": "Your summary here",
  "bullets": ["bullet 1", "bullet 2", "bullet 3", "bullet 4", "bullet 5"],
  "keyInsights": ["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"],
  "positiveQuotes": ["quote 1", "quote 2", "quote 3"],
  "negativeQuotes": ["quote 1", "quote 2", "quote 3"],
  "keyQuotes": ["quote 1", "quote 2", "quote 3"]
}

STRICT REQUIREMENTS FOR EACH FIELD:

1. SUMMARY (4-6 sentences, 80-150 words):
   Write a comprehensive paragraph that a product manager could read to understand the entire conversation. Include:
   - Who participated and the context of the discussion
   - The main topics and themes covered
   - Key problems, needs, or pain points mentioned
   - Any decisions, conclusions, or next steps discussed
   - The overall tone and sentiment of the conversation

2. BULLETS (5 items, each 15-25 words):
   Five distinct bullet points that each summarize a different key topic or theme from the conversation. Each bullet should be a complete thought that stands alone.

3. KEY INSIGHTS (5 items, each 20-40 words):
   Five actionable insights that a product team could act on. Each MUST be a complete sentence that:
   - Identifies a specific user need, problem, or opportunity
   - Explains WHY it matters or what it implies
   - Example format: "Users expressed significant frustration with [specific issue], suggesting that [implication or recommendation]."
   DO NOT write single words or short phrases. Each insight must be a full, actionable sentence.

4. POSITIVE QUOTES (3 items):
   Three EXACT verbatim quotes from the transcript that express satisfaction, praise, excitement, or positive feedback. Copy the exact words spoken. If fewer than 3 positive quotes exist, include what you can find.

5. NEGATIVE QUOTES (3 items):
   Three EXACT verbatim quotes from the transcript that express frustration, criticism, concerns, or negative feedback. Copy the exact words spoken. If fewer than 3 negative quotes exist, include what you can find.

6. KEY QUOTES (3 items):
   Three EXACT verbatim quotes that are the most memorable, insightful, or impactful statements from the transcript. These should capture the essence of the conversation.

Return ONLY the JSON object. No other text.`,
                      },
                    ],
                  },
                ],
                generationConfig: {
                  temperature: 0.2,
                  maxOutputTokens: 4096,
                },
              }),
            },
          )

          if (geminiResponse.ok) {
            const geminiResult = await geminiResponse.json()
            const responseText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || ""

            try {
              // Clean the response - remove markdown code blocks if present
              const cleanedResponse = responseText
                .replace(/```json\n?/g, "")
                .replace(/```\n?/g, "")
                .trim()

              const insights = JSON.parse(cleanedResponse)

              summaryParagraph = insights.summary || ""
              summaryBullets = insights.bullets || []
              takeaways = insights.keyInsights || []
              quotes = insights.keyQuotes || []

              // Convert positive quotes to SentimentQuote format
              if (insights.positiveQuotes) {
                geminiPositiveQuotes = insights.positiveQuotes.map((q: string) => ({
                  text: q,
                  sentiment: "POSITIVE",
                  confidence: 0.9,
                }))
              }

              // Convert negative quotes to SentimentQuote format
              if (insights.negativeQuotes) {
                geminiNegativeQuotes = insights.negativeQuotes.map((q: string) => ({
                  text: q,
                  sentiment: "NEGATIVE",
                  confidence: 0.9,
                }))
              }
            } catch (parseError) {
              console.error("Failed to parse Gemini response:", parseError, responseText)
              throw new Error("Failed to analyze transcript. Gemini returned an invalid response. Please try again.")
            }
          } else {
            // Check for quota errors from Gemini
            const errorText = await geminiResponse.text()
            const errType = detectErrorType(geminiResponse.status, errorText)
            setErrorType(errType)
            setErrorSource("gemini")
            if (errType === "quota") {
              throw new Error(
                "Gemini API free tier limit reached. Please check your Gemini quota or upgrade your plan.",
              )
            } else if (errType === "auth") {
              throw new Error("Invalid Gemini API key. Please check your key and try again.")
            } else {
              throw new Error(`Gemini API error: ${geminiResponse.status} - ${errorText}`)
            }
          }
        } catch (geminiError) {
          // Re-throw if it's already a handled error
          if (geminiError instanceof Error && geminiError.message.includes("Gemini")) {
            throw geminiError
          }
          console.error("Gemini API error:", geminiError)
          throw new Error("Failed to connect to Gemini API. Please check your internet connection and try again.")
        }
      }

      // Verify Gemini provided all required data
      if (!summaryParagraph || summaryBullets.length === 0 || takeaways.length === 0) {
        throw new Error("Gemini did not return complete analysis. Please try again.")
      }

      const utterances: Utterance[] = transcript.utterances || []

      const themes: Theme[] = []

      // Add entities as themes
      if (transcript.entities) {
        const entityMap = new Map<string, Theme>()
        transcript.entities.forEach((entity: any) => {
          const key = entity.text.toLowerCase()
          if (entityMap.has(key)) {
            const existing = entityMap.get(key)!
            existing.count = (existing.count || 1) + 1
          } else {
            entityMap.set(key, {
              text: entity.text,
              timestamp: entity.start,
              count: 1,
            })
          }
        })
        themes.push(...Array.from(entityMap.values()))
      }

      // Add highlights as themes if no entities
      if (themes.length === 0 && transcript.auto_highlights_result?.results) {
        transcript.auto_highlights_result.results.slice(0, 8).forEach((highlight: any) => {
          themes.push({
            text: highlight.text,
            timestamp: highlight.timestamps?.[0]?.start,
            count: highlight.count,
          })
        })
      }

      let overallSentiment = "NEUTRAL"
      const sentimentSegments: SentimentSegment[] = []
      const speakerSentiments: SpeakerSentiment[] = []

      if (transcript.sentiment_analysis_results) {
        // Calculate overall sentiment from all segments
        const sentimentCounts: Record<string, number> = {}
        transcript.sentiment_analysis_results.forEach((result: any) => {
          const sentiment = result.sentiment.toUpperCase()
          sentimentCounts[sentiment] = (sentimentCounts[sentiment] || 0) + 1

          sentimentSegments.push({
            start: result.start,
            end: result.end,
            sentiment: sentiment,
            text: result.text,
          })
        })

        // Determine overall sentiment
        const sentiments = Object.keys(sentimentCounts)
        if (sentiments.length === 1) {
          overallSentiment = sentiments[0]
        } else if (sentiments.length > 1) {
          const maxCount = Math.max(...Object.values(sentimentCounts))
          const dominantSentiments = sentiments.filter((s) => sentimentCounts[s] === maxCount)
          overallSentiment = dominantSentiments.length > 1 ? "MIXED" : dominantSentiments[0]
        }

        // Calculate speaker-level sentiments if speaker labels are available
        if (transcript.utterances) {
          const speakerSentimentMap: Record<string, string[]> = {}

          transcript.utterances.forEach((utterance: any) => {
            const speaker = utterance.speaker
            if (!speakerSentimentMap[speaker]) {
              speakerSentimentMap[speaker] = []
            }

            // Find sentiment for this utterance based on timestamp overlap
            const sentimentForUtterance = transcript.sentiment_analysis_results.find(
              (s: any) => s.start >= utterance.start && s.end <= utterance.end,
            )

            if (sentimentForUtterance) {
              speakerSentimentMap[speaker].push(sentimentForUtterance.sentiment.toUpperCase())
            }
          })

          // Calculate predominant sentiment for each speaker
          Object.keys(speakerSentimentMap).forEach((speaker) => {
            const sentiments = speakerSentimentMap[speaker]
            const counts: Record<string, number> = {}
            sentiments.forEach((s) => (counts[s] = (counts[s] || 0) + 1))

            const predominant = Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b))
            const total = sentiments.length
            const predominantCount = counts[predominant]
            const percentage = Math.round((predominantCount / total) * 100)

            let description = ""
            if (percentage > 80) {
              description = `Mostly ${predominant.toLowerCase()}`
            } else if (percentage > 60) {
              description = `Predominantly ${predominant.toLowerCase()}`
            } else {
              const others = Object.keys(counts).filter((s) => s !== predominant)
              description = `Mixed (${percentage}% ${predominant.toLowerCase()})`
            }

            speakerSentiments.push({
              speaker,
              predominantSentiment: predominant,
              description,
            })
          })
        }
      }

      // Use Gemini-generated quotes if available, otherwise fall back to sentiment analysis
      const positiveQuotes: SentimentQuote[] = geminiPositiveQuotes
      const negativeQuotes: SentimentQuote[] = geminiNegativeQuotes

      // Fallback to sentiment analysis if Gemini didn't provide quotes
      if (positiveQuotes.length === 0 || negativeQuotes.length === 0) {
        if (transcript.sentiment_analysis_results) {
          const sortedResults = [...transcript.sentiment_analysis_results].sort(
            (a: any, b: any) => b.confidence - a.confidence,
          )

          sortedResults.forEach((result: any) => {
            const sentiment = result.sentiment.toUpperCase()
            const text = result.text

            // Only include substantial quotes (more than 10 words)
            if (text.split(" ").length > 10) {
              if (sentiment === "POSITIVE" && positiveQuotes.length < 3) {
                positiveQuotes.push({
                  text,
                  sentiment,
                  confidence: result.confidence,
                })
              } else if (sentiment === "NEGATIVE" && negativeQuotes.length < 3) {
                negativeQuotes.push({
                  text,
                  sentiment,
                  confidence: result.confidence,
                })
              }
            }
          })
        }
      }

      setResult({
        summaryParagraph,
        summaryBullets,
        takeaways,
        quotes,
        fullTranscript: transcript.text,
        utterances,
        themes,
        overallSentiment,
        sentimentSegments,
        speakerSentiments,
        positiveQuotes,
        negativeQuotes,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred"
      setError(errorMessage)
      // Set error type if not already set
      if (!errorType) {
        const lowerError = errorMessage.toLowerCase()
        if (lowerError.includes("quota") || lowerError.includes("limit") || lowerError.includes("exceeded")) {
          setErrorType("quota")
        } else if (
          lowerError.includes("unauthorized") ||
          (lowerError.includes("invalid") && lowerError.includes("key"))
        ) {
          setErrorType("auth")
        } else {
          setErrorType("general")
        }
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownloadInsights = () => {
    if (!result) return

    // Build comprehensive content with all sections
    let content = `SUPERSONIQ INSIGHTS
${"=".repeat(50)}

SUMMARY
${"-".repeat(30)}
${result.summaryParagraph}

BULLET POINTS
${"-".repeat(30)}
${result.summaryBullets.map((b) => `• ${b}`).join("\n")}

KEY INSIGHTS
${"-".repeat(30)}
${result.takeaways.map((t, i) => `${i + 1}. ${t}`).join("\n")}
`

    // Add Themes if available
    if (result.themes && result.themes.length > 0) {
      content += `
THEMES & TOPICS
${"-".repeat(30)}
${result.themes
  .slice(0, 10)
  .map((theme) => `• ${theme.text}${theme.count && theme.count > 1 ? ` (mentioned ${theme.count}x)` : ""}`)
  .join("\n")}
`
    }

    // Add Sentiment Analysis if available
    if (result.overallSentiment) {
      content += `
SENTIMENT ANALYSIS
${"-".repeat(30)}
Overall Sentiment: ${result.overallSentiment}
`
      if (result.speakerSentiments && result.speakerSentiments.length > 0) {
        content += `\nSpeaker Sentiments:\n`
        content += result.speakerSentiments.map((s) => `• ${s.speaker}: ${s.description}`).join("\n")
      }
    }

    // Add Positive Quotes if available
    if (result.positiveQuotes && result.positiveQuotes.length > 0) {
      content += `

POSITIVE QUOTES
${"-".repeat(30)}
${result.positiveQuotes.map((q) => `"${q.text}"`).join("\n\n")}
`
    }

    // Add Negative Quotes if available
    if (result.negativeQuotes && result.negativeQuotes.length > 0) {
      content += `

NEGATIVE QUOTES
${"-".repeat(30)}
${result.negativeQuotes.map((q) => `"${q.text}"`).join("\n\n")}
`
    }

    // Add Key Quotes
    content += `

KEY QUOTES
${"-".repeat(30)}
${result.quotes.map((q) => `"${q}"`).join("\n\n")}
`

    // Add Full Transcript with speaker labels if available
    content += `

FULL TRANSCRIPT
${"-".repeat(30)}
`
    if (result.utterances && result.utterances.length > 0) {
      content += result.utterances.map((u) => `[${u.speaker}]: ${u.text}`).join("\n\n")
    } else {
      content += result.fullTranscript
    }

    content += `

${"=".repeat(50)}
Generated by Supersoniq Insights
`

    // Create and download the file
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `supersoniq-insights-${new Date().toISOString().split("T")[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleCopyTranscript = async () => {
    if (!result?.fullTranscript) return

    try {
      await navigator.clipboard.writeText(result.fullTranscript)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const handleReset = () => {
    setResult(null)
    setFile(null)
    setError("")
    setErrorType(null)
    setErrorSource(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    // Added className for the main container
    <div className="min-h-screen flex flex-col bg-white">
      {/* Drag and Drop Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-[#B9D6D9]/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Upload className="w-12 h-12 text-[#01A0A9] mx-auto mb-3" />
            <p className="text-base font-medium text-[#1B1823]">Upload</p>
          </div>
        </div>
      )}

      <div className="border-b border-[#E5E7EB] bg-[#F7F9F8]">
        <div className="px-8 py-4 flex items-center gap-8">
          {/* Logo */}
          <img src="/images/supersoniq-20insights-20logo.png" alt="Supersoniq Insights" className="h-[50px] w-auto" />

          {/* Audio File Section */}
          <div className="flex flex-col gap-1 ml-auto">
            <Label className="text-[#1B1823] text-sm font-medium">Audio File</Label>
            <div className="relative">
              <input
                ref={fileInputRef}
                id="audio"
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="h-9 px-4 border-2 border-dashed border-[#E5E7EB] rounded-[8px] hover:border-[#01A0A9] hover:bg-[#FFFFFF] transition-colors text-[#39939E] text-sm min-w-[180px]"
              >
                {file ? (
                  <div className="flex items-center gap-2">
                    <FileAudio className="w-4 h-4 text-[#01A0A9]" />
                    <span className="text-xs text-[#1B1823] font-medium max-w-[120px] truncate">{file.name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">Click to upload</span>
                  </div>
                )}
              </Button>
              {file && (
                <button
                  onClick={handleRemoveFile}
                  className="absolute -top-2 -right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors border border-[#E5E7EB]"
                  aria-label="Remove file"
                >
                  <X className="w-3 h-3 text-[#1B1823]" />
                </button>
              )}
            </div>
          </div>

          {/* Transcribe Button */}
          <div className="flex flex-col gap-1 mx-[-17px]">
            <div className="h-[20px]"></div>
            <Button
              onClick={handleTranscribe}
              disabled={!file || !storedApiKey || !storedGeminiKey || isProcessing}
              className="h-9 px-8 bg-[#01A0A9] hover:bg-[#39939E] text-white font-medium rounded-[8px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm whitespace-nowrap"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Transcribe"
              )}
            </Button>
          </div>

          <div className="flex flex-col gap-1">
            <div className="h-[20px]"></div>
            <Button
              onClick={() => setIsSettingsOpen(true)}
              variant="outline"
              className="h-9 px-4 border-[#E5E7EB] rounded-[8px] hover:border-[#01A0A9] hover:bg-[#F7F9F8] transition-colors"
            >
              <Settings className="w-4 h-4 text-[#1B1823]" />
            </Button>
          </div>
        </div>
      </div>

      <Drawer direction="right" open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DrawerContent className="bg-[#B9D6D9] border-l-2 border-[#01A0A9]">
          <DrawerHeader>
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-2xl font-semibold text-[#1B1823]">Settings</DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="hover:bg-[#01A0A9]/10">
                  <X className="w-5 h-5 text-[#1B1823]" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-auto p-6 space-y-8">
            {/* Voice to Text Section */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-[#1B1823]">Voice to Text</h3>
              <p className="text-sm text-[#1B1823]/70">Configure your AssemblyAI API key for transcription</p>

              {!isApiKeyStored ? (
                <div className="space-y-3">
                  <Label htmlFor="apiKey" className="text-[#1B1823] text-sm font-medium">
                    API Key
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="apiKey"
                      type="password"
                      placeholder="Enter API Key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="flex-1 h-10 px-3 border-[#E5E7EB] rounded-[8px] focus:border-[#01A0A9] focus:ring-[#01A0A9] text-[#1B1823] bg-white"
                    />
                    <Button
                      onClick={handleStoreApiKey}
                      disabled={!apiKey.trim()}
                      className="h-10 px-6 bg-[#01A0A9] hover:bg-[#019FA8] text-white rounded-[8px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save
                    </Button>
                  </div>
                  <a
                    href="https://www.assemblyai.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-[#01A0A9] hover:underline font-medium"
                  >
                    Get Free API Key
                    <Info className="w-4 h-4" />
                  </a>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 border border-[#E5E7EB] rounded-[8px] bg-white">
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-[#7AE241]" />
                      <div>
                        <p className="text-sm font-medium text-[#1B1823]">API Key Connected</p>
                        <p className="text-xs text-[#39939E]">...{storedApiKey.slice(-4)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href="https://www.assemblyai.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#01A0A9] hover:opacity-80"
                        title="Get AssemblyAI API Key"
                      >
                        <Info className="w-5 h-5" />
                      </a>
                      <Button
                        onClick={handleRemoveApiKey}
                        variant="outline"
                        size="sm"
                        className="text-[#01A0A9] border-[#01A0A9] hover:bg-[#01A0A9] hover:text-white bg-transparent"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* AI Summary Section */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-[#1B1823]">AI Summary</h3>
              <p className="text-sm text-[#1B1823]/70">Configure your Google Gemini API key for AI-powered insights</p>

              {!isGeminiKeyStored ? (
                <div className="space-y-3">
                  <Label htmlFor="geminiKey" className="text-[#1B1823] text-sm font-medium">
                    API Key
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="geminiKey"
                      type="password"
                      placeholder="Enter API Key"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      className="flex-1 h-10 px-3 border-[#E5E7EB] rounded-[8px] focus:border-[#01A0A9] focus:ring-[#01A0A9] text-[#1B1823] bg-white"
                    />
                    <Button
                      onClick={handleStoreGeminiKey}
                      disabled={!geminiKey.trim()}
                      className="h-10 px-6 bg-[#01A0A9] hover:bg-[#019FA8] text-white rounded-[8px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save
                    </Button>
                  </div>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-[#01A0A9] hover:underline font-medium"
                  >
                    Get Free API Key
                    <Info className="w-4 h-4" />
                  </a>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 border border-[#E5E7EB] rounded-[8px] bg-white">
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-[#7AE241]" />
                      <div>
                        <p className="text-sm font-medium text-[#1B1823]">API Key Connected</p>
                        <p className="text-xs text-[#39939E]">...{storedGeminiKey.slice(-4)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#01A0A9] hover:opacity-80"
                        title="Get Gemini API Key"
                      >
                        <Info className="w-5 h-5" />
                      </a>
                      <Button
                        onClick={handleRemoveGeminiKey}
                        variant="outline"
                        size="sm"
                        className="text-[#01A0A9] border-[#01A0A9] hover:bg-[#01A0A9] hover:text-white bg-transparent"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Bottom Row - Results */}
      <div className="flex-1 bg-white overflow-auto">
        {!isApiKeyStored || !isGeminiKeyStored ? (
          <div className="h-full flex items-center justify-center p-12">
            <div className="max-w-2xl text-center space-y-8">
              <div>
                <h2 className="text-3xl font-semibold text-[#1B1823] mb-4">
                  Turn user research audio into actionable insights.
                </h2>
                <p className="text-lg text-[#39939E] leading-relaxed">
                  Get started by adding your API keys above. Both are free to use and easy to set up.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 text-left">
                <Card className="p-6 bg-[#F7F9F8] border-[#E5E7EB] rounded-[12px]">
                  <h3 className="text-lg font-semibold text-[#1B1823] mb-3">AssemblyAI API Key</h3>
                  <p className="text-sm text-[#39939E] mb-4">
                    Powers transcription with speaker labels and sentiment analysis.
                  </p>
                  <a
                    href="https://www.assemblyai.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-[#01A0A9] hover:underline font-medium text-sm"
                  >
                    Get your free key →
                  </a>
                </Card>

                <Card className="p-6 bg-[#F7F9F8] border-[#E5E7EB] rounded-[12px]">
                  <h3 className="text-lg font-semibold text-[#1B1823] mb-3">Gemini API Key</h3>
                  <p className="text-sm text-[#39939E] mb-4">
                    Generates high-quality summaries, insights, and key quotes using AI.
                  </p>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-[#01A0A9] hover:underline font-medium text-sm"
                  >
                    Get your free key →
                  </a>
                </Card>
              </div>

              <div className="pt-4">
                <p className="text-sm text-[#39939E]">
                  Your API keys are stored securely in your browser and never sent to our servers.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Error Message */}
            {error && !result && !isProcessing && (
              <div className="h-full flex items-center justify-center p-8">
                <div
                  className={`p-8 rounded-[12px] max-w-lg text-center ${
                    errorType === "quota"
                      ? "bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] border-2 border-[#F59E0B]"
                      : errorType === "auth"
                        ? "bg-gradient-to-br from-[#FEE2E2] to-[#FECACA] border-2 border-[#EF4444]"
                        : "bg-[#FEF2F2] border border-[#E73F36]"
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                      errorType === "quota"
                        ? "bg-[#F59E0B]/20"
                        : errorType === "auth"
                          ? "bg-[#EF4444]/20"
                          : "bg-[#E73F36]/10"
                    }`}
                  >
                    {errorType === "quota" ? (
                      <svg className="w-8 h-8 text-[#D97706]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    ) : errorType === "auth" ? (
                      <svg className="w-8 h-8 text-[#EF4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    ) : (
                      <svg className="w-8 h-8 text-[#E73F36]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    )}
                  </div>

                  {/* Title */}
                  <h3
                    className={`text-xl font-semibold mb-2 ${
                      errorType === "quota"
                        ? "text-[#92400E]"
                        : errorType === "auth"
                          ? "text-[#991B1B]"
                          : "text-[#E73F36]"
                    }`}
                  >
                    {errorType === "quota"
                      ? "Free Tier Limit Reached"
                      : errorType === "auth"
                        ? "Invalid API Key"
                        : "Something Went Wrong"}
                  </h3>

                  {/* Message */}
                  <p
                    className={`text-sm leading-relaxed mb-4 ${
                      errorType === "quota"
                        ? "text-[#A16207]"
                        : errorType === "auth"
                          ? "text-[#B91C1C]"
                          : "text-[#E73F36]"
                    }`}
                  >
                    {error}
                  </p>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-2">
                    {errorType === "quota" && (
                      <>
                        <a
                          href={
                            errorSource === "gemini"
                              ? "https://aistudio.google.com/app/apikey"
                              : "https://www.assemblyai.com/dashboard"
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-white rounded-[8px] font-medium text-sm transition-colors"
                        >
                          {errorSource === "gemini" ? "Manage Gemini API" : "Upgrade AssemblyAI Plan"}
                        </a>
                        <p className="text-xs text-[#A16207] mt-2">Or wait for your quota to reset</p>
                      </>
                    )}
                    {errorType === "auth" && (
                      <button
                        onClick={() => {
                          setError("")
                          setErrorType(null)
                          setErrorSource(null)
                        }}
                        className="inline-flex items-center justify-center px-4 py-2 bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-[8px] font-medium text-sm transition-colors"
                      >
                        Check {errorSource === "gemini" ? "Gemini" : "AssemblyAI"} Key
                      </button>
                    )}
                    {errorType === "general" && (
                      <button
                        onClick={() => {
                          setError("")
                          setErrorType(null)
                          setErrorSource(null)
                        }}
                        className="inline-flex items-center justify-center px-4 py-2 bg-[#E73F36] hover:bg-[#C53030] text-white rounded-[8px] font-medium text-sm transition-colors"
                      >
                        Try Again
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!result && !isProcessing && !error && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-[#39939E] max-w-md my-[65px]">
                  <FileAudio className="w-16 h-16 mx-auto mb-4 opacity-40" />
                  <p className="text-lg">Upload an audio file to start.</p>
                  <p className="text-sm mt-2 opacity-70">Drag and drop anywhere or use the upload button above.</p>
                </div>
              </div>
            )}

            {/* Processing State */}
            {isProcessing && (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center space-y-6 my-[60px]">
                  <Loader2 className="w-12 h-12 text-[#01A0A9] animate-spin" />
                  <div className="text-center">
                    <h3 className="text-xl font-medium text-[#1B1823] mb-2">Processing audio</h3>
                    <p className="text-sm text-[#39939E]">
                      This may take a few moments. A 5 minute file is usually ready in less than 20 seconds.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Results Display - remains the same */}
            {result && !isProcessing && (
              <div className="space-y-6 animate-in fade-in duration-500 mx-8 my-8">
                <div className="flex justify-start">
                  <Button
                    onClick={handleDownloadInsights}
                    className="bg-black hover:bg-gray-800 text-white rounded-[8px] font-medium transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)] text-center h-[30px] px-4"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Insights (.txt)
                  </Button>
                </div>

                {/* Summary with Toggle */}
                <Card className="p-8 bg-[#F7F9F8] border-[#E5E7EB] rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-medium text-[#1B1823]">Summary</h2>
                    <div className="flex items-center gap-2 bg-white rounded-[8px] p-1 border border-[#E5E7EB]">
                      <button
                        onClick={() => setSummaryMode("paragraph")}
                        className={`px-4 py-2 rounded-[6px] text-sm font-medium transition-all ${
                          summaryMode === "paragraph"
                            ? "bg-[#01A0A9] text-white"
                            : "text-[#39939E] hover:text-[#1B1823]"
                        }`}
                      >
                        Overview
                      </button>
                      <button
                        onClick={() => setSummaryMode("bullets")}
                        className={`px-4 py-2 rounded-[6px] text-sm font-medium transition-all ${
                          summaryMode === "bullets" ? "bg-[#01A0A9] text-white" : "text-[#39939E] hover:text-[#1B1823]"
                        }`}
                      >
                        Bullets
                      </button>
                    </div>
                  </div>

                  {summaryMode === "paragraph" ? (
                    <p className="text-[#1B1823] leading-relaxed">{result.summaryParagraph}</p>
                  ) : (
                    <ul className="space-y-3">
                      {result.summaryBullets.map((bullet, index) => (
                        <li key={index} className="flex gap-3">
                          <span className="flex-shrink-0 w-2 h-2 bg-[#01A0A9] rounded-full mt-2"></span>
                          <span className="text-[#1B1823] leading-relaxed">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                {/* Key Insights */}
                <Card className="p-8 bg-[#F7F9F8] border-[#E5E7EB] rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
                  <h2 className="text-2xl font-medium text-[#1B1823] mb-4">Key Insights</h2>
                  <ul className="space-y-3">
                    {result.takeaways.map((takeaway, index) => (
                      <li key={index} className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-[#01A0A9] text-white rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </span>
                        <span className="text-[#1B1823] leading-relaxed pt-0.5">{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </Card>

                {result.themes && result.themes.length > 0 && (
                  <Card className="p-8 bg-[#F7F9F8] border-[#E5E7EB] rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
                    <h2 className="text-2xl font-medium text-[#1B1823] mb-4">Themes</h2>
                    <div className="space-y-4">
                      {(() => {
                        // Sort themes by count (strongest first)
                        const sortedThemes = [...result.themes!].sort((a, b) => (b.count || 1) - (a.count || 1))

                        // Divide into three tiers
                        const totalThemes = sortedThemes.length
                        const tier1Count = Math.ceil(totalThemes * 0.3) // Top 30% - strongest
                        const tier2Count = Math.ceil(totalThemes * 0.4) // Middle 40%

                        const tier1 = sortedThemes.slice(0, tier1Count)
                        const tier2 = sortedThemes.slice(tier1Count, tier1Count + tier2Count)
                        const tier3 = sortedThemes.slice(tier1Count + tier2Count)

                        return (
                          <>
                            {/* Row 1: Strongest themes - Large pills */}
                            {tier1.length > 0 && (
                              <div className="flex flex-wrap gap-3">
                                {tier1.map((theme, index) => (
                                  <span
                                    key={index}
                                    className="inline-block px-5 py-2.5 border-2 text-[#01A0A9] text-base font-medium rounded-full bg-card-foreground border-0"
                                  >
                                    {theme.text}
                                    {theme.count && theme.count > 1 && (
                                      <span className="ml-2 text-sm opacity-70">×{theme.count}</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Row 2: Medium strength themes - Medium pills */}
                            {tier2.length > 0 && (
                              <div className="flex flex-wrap gap-2.5">
                                {tier2.map((theme, index) => (
                                  <span
                                    key={index}
                                    className="inline-block px-4 py-2 border border-[#39939E] text-[#39939E] text-sm font-medium rounded-full bg-sidebar-primary-foreground"
                                  >
                                    {theme.text}
                                    {theme.count && theme.count > 1 && (
                                      <span className="ml-1.5 text-xs opacity-60">×{theme.count}</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Row 3: Weakest themes - Small pills */}
                            {tier3.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {tier3.map((theme, index) => (
                                  <span
                                    key={index}
                                    className="inline-block px-3 py-1.5 border border-[#E5E7EB] text-[#1B1823]/60 text-xs rounded-full bg-card"
                                  >
                                    {theme.text}
                                    {theme.count && theme.count > 1 && (
                                      <span className="ml-1 text-[10px] opacity-50">×{theme.count}</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </Card>
                )}

                {result.sentimentSegments && result.sentimentSegments.length > 0 && (
                  <Card className="p-8 bg-[#F7F9F8] border-[#E5E7EB] rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
                    <h2 className="text-2xl font-medium text-[#1B1823] mb-0">Sentiment</h2>

                    {/* Overall Sentiment Pill */}
                    <div className="mb-0">
                      <span className="text-[#1B1823]/60 mr-3 text-foreground text-sm">Overall:</span>
                      <span
                        className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${
                          result.overallSentiment === "POSITIVE"
                            ? "bg-green-100 text-green-700 border border-green-300"
                            : result.overallSentiment === "NEGATIVE"
                              ? "bg-red-100 text-red-700 border border-red-300"
                              : result.overallSentiment === "MIXED"
                                ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
                                : "bg-gray-100 text-gray-700 border border-gray-300"
                        }`}
                      >
                        {result.overallSentiment}
                      </span>
                    </div>

                    {/* Sentiment Timeline */}
                    <div className="mb-6">
                      <h3 className="font-medium text-[#1B1823] mb-[13px] text-sm">Timeline</h3>
                      <div className="relative">
                        <div className="relative h-8 bg-[#E5E7EB] rounded-full overflow-hidden flex">
                          {result.sentimentSegments.map((segment, index) => {
                            const totalDuration = result.sentimentSegments![result.sentimentSegments!.length - 1].end
                            const width = ((segment.end - segment.start) / totalDuration) * 100

                            return (
                              <div
                                key={index}
                                className={`relative group cursor-pointer transition-opacity hover:opacity-80 ${
                                  segment.sentiment === "POSITIVE"
                                    ? "bg-green-400"
                                    : segment.sentiment === "NEGATIVE"
                                      ? "bg-red-400"
                                      : segment.sentiment === "NEUTRAL"
                                        ? "bg-gray-300"
                                        : "bg-yellow-400"
                                }`}
                                style={{ width: `${width}%` }}
                              >
                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                                  <div className="bg-[#1B1823] text-white text-xs rounded px-3 py-2 whitespace-nowrap shadow-lg">
                                    <div className="font-medium mb-1">{segment.sentiment}</div>
                                    <div className="opacity-80">
                                      {Math.floor(segment.start / 60000)}:
                                      {String(Math.floor((segment.start % 60000) / 1000)).padStart(2, "0")} -
                                      {Math.floor(segment.end / 60000)}:
                                      {String(Math.floor((segment.end % 60000) / 1000)).padStart(2, "0")}
                                    </div>
                                  </div>
                                  <div className="w-2 h-2 bg-[#1B1823] rotate-45 absolute top-full left-1/2 -translate-x-1/2 -mt-1" />
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <div className="relative flex justify-between mt-1">
                          {(() => {
                            const totalDuration = result.sentimentSegments![result.sentimentSegments!.length - 1].end
                            const markers = []
                            // Generate markers every 15 seconds
                            for (let time = 0; time <= totalDuration; time += 15000) {
                              const minutes = Math.floor(time / 60000)
                              const seconds = Math.floor((time % 60000) / 1000)
                              const label =
                                minutes === 0 && seconds === 0 ? "0" : `${minutes}:${String(seconds).padStart(2, "0")}`
                              markers.push(
                                <span key={time} className="text-[10px] text-[#1B1823]/50">
                                  {label}
                                </span>,
                              )
                            }
                            return markers
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Speaker Sentiment Table */}
                    {result.speakerSentiments && result.speakerSentiments.length > 0 && (
                      <div>
                        <h3 className="font-medium text-[#1B1823] mb-3 text-sm">By Speaker</h3>
                        <div className="space-y-2">
                          {result.speakerSentiments.map((speaker, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-3 bg-white border border-[#E5E7EB] rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-medium text-[#1B1823]">{speaker.speaker}</span>
                                <span
                                  className={`px-2 py-1 rounded text-xs font-medium ${
                                    speaker.predominantSentiment === "POSITIVE"
                                      ? "bg-green-100 text-green-700"
                                      : speaker.predominantSentiment === "NEGATIVE"
                                        ? "bg-red-100 text-red-700"
                                        : "bg-gray-100 text-gray-700"
                                  }`}
                                >
                                  {speaker.predominantSentiment}
                                </span>
                              </div>
                              <span className="text-sm text-[#1B1823]/60">{speaker.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                )}

                {/* Quotes */}
                <Card className="p-8 bg-[#F7F9F8] border-[#E5E7EB] rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
                  <h2 className="text-2xl font-medium text-[#1B1823] mb-0">Quotes</h2>
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Positive Quotes Column */}
                    <div>
                      <h3 className="font-medium text-[#1B1823] mb-4 text-sm">Top Positive Quotes</h3>
                      <div className="space-y-3">
                        {result.positiveQuotes && result.positiveQuotes.length > 0 ? (
                          result.positiveQuotes.map((quote, index) => (
                            <div
                              key={`positive-${index}`}
                              className="pl-4 border-l-4 border-[#7AE241] bg-white rounded-r-md p-3"
                            >
                              <p className="text-[#39939E] italic leading-relaxed">"{quote.text}"</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-[#6B7280] text-sm italic">No positive quotes detected</p>
                        )}
                      </div>
                    </div>

                    {/* Negative Quotes Column */}
                    <div>
                      <h3 className="font-medium text-[#1B1823] mb-4 text-sm">Top Negative Quotes</h3>
                      <div className="space-y-3">
                        {result.negativeQuotes && result.negativeQuotes.length > 0 ? (
                          result.negativeQuotes.map((quote, index) => (
                            <div
                              key={`negative-${index}`}
                              className="pl-4 border-l-4 border-[#EF4444] bg-white rounded-r-md p-3"
                            >
                              <p className="text-[#39939E] italic leading-relaxed">"{quote.text}"</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-[#6B7280] text-sm italic">No negative quotes detected</p>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Full Transcript */}
                <Card className="p-8 bg-[#F7F9F8] border-[#E5E7EB] rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-medium text-[#1B1823]">Full Transcript</h2>
                    <Button
                      onClick={handleCopyTranscript}
                      variant="outline"
                      size="sm"
                      className="text-[#01A0A9] border-[#01A0A9] hover:bg-[#01A0A9] hover:text-white transition-colors bg-transparent"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        "Full Text (Raw)"
                      )}
                    </Button>
                  </div>

                  <div className="max-h-[500px] overflow-y-auto space-y-3 pr-2">
                    {result.utterances && result.utterances.length > 0 ? (
                      result.utterances.map((utterance, index) => (
                        <div
                          key={index}
                          className={`p-4 rounded-[8px] border border-[#E5E7EB] transition-all hover:shadow-sm ${
                            utterance.speaker === "B" ? "bg-[#ebf4f5]" : "bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-[#01A0A9] bg-[#E5F5F6] px-2 py-1 rounded-[6px]">
                              Speaker {utterance.speaker === "A" ? "1" : "2"}
                            </span>
                          </div>
                          <p className="text-[#1B1823] leading-relaxed text-sm">{utterance.text}</p>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 bg-white rounded-[8px] border border-[#E5E7EB]">
                        <p className="text-[#1B1823] leading-relaxed whitespace-pre-wrap">{result.fullTranscript}</p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
