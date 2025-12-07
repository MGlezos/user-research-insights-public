"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Upload, FileAudio, Download, X, Check } from "lucide-react"

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
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<TranscriptionResult | null>(null)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [summaryMode, setSummaryMode] = useState<"paragraph" | "bullets">("paragraph")
  const [includeSpeakerLabels, setIncludeSpeakerLabels] = useState(true)
  const [includeHighlights, setIncludeHighlights] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        } else {
          setError("Please upload an audio file")
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
    }
  }

  const handleStoreApiKey = () => {
    if (apiKey.trim()) {
      setStoredApiKey(apiKey)
      setIsApiKeyStored(true)
      setApiKey("")
    }
  }

  const handleRemoveApiKey = () => {
    setStoredApiKey("")
    setIsApiKeyStored(false)
    setApiKey("")
  }

  const handleRemoveFile = () => {
    setFile(null)
    setError("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleTranscribe = async () => {
    if (!file || !storedApiKey) return

    setIsProcessing(true)
    setError("")

    try {
      // Upload file to Assembly AI
      const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
        method: "POST",
        headers: {
          authorization: storedApiKey,
        },
        body: file,
      })

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file")
      }

      const { upload_url } = await uploadResponse.json()

      const requestBody: any = {
        audio_url: upload_url,
        auto_chapters: true,
        auto_highlights: includeHighlights,
        speaker_labels: includeSpeakerLabels,
        entity_detection: includeHighlights,
        sentiment_analysis: true,
      }

      // Start transcription with auto chapters for summary and key phrases, and speaker diarization enabled
      const transcriptResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
        method: "POST",
        headers: {
          authorization: storedApiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      if (!transcriptResponse.ok) {
        throw new Error("Failed to start transcription")
      }

      const { id } = await transcriptResponse.json()

      // Poll for completion
      let transcript = null
      while (!transcript || transcript.status !== "completed") {
        await new Promise((resolve) => setTimeout(resolve, 3000))

        const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
          headers: {
            authorization: storedApiKey,
          },
        })

        transcript = await pollResponse.json()

        if (transcript.status === "error") {
          throw new Error(transcript.error || "Transcription failed")
        }
      }

      const summaryParagraph = transcript.chapters?.[0]?.summary || transcript.text.substring(0, 200) + "..."

      // Generate bullet points from chapters or create from text
      const summaryBullets = transcript.chapters
        ?.slice(0, 5)
        .map((ch: any) => ch.summary)
        .filter(Boolean) || [transcript.text.substring(0, 100) + "..."]

      const takeaways = transcript.chapters?.slice(0, 5).map((ch: any) => ch.headline) || [
        "Key point extracted from transcription",
      ]

      const quotes = transcript.auto_highlights_result?.results?.slice(0, 3).map((h: any) => h.text) || [
        transcript.text.split(".")[0] + ".",
      ]

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
        if (includeSpeakerLabels && transcript.utterances) {
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

      const positiveQuotes: SentimentQuote[] = []
      const negativeQuotes: SentimentQuote[] = []

      if (transcript.sentiment_analysis_results) {
        // Sort by confidence and filter by sentiment
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
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExportToGoogleDocs = () => {
    if (!result) return

    const summaryContent =
      summaryMode === "paragraph"
        ? result.summaryParagraph
        : result.summaryBullets.map((b, i) => `${i + 1}. ${b}`).join("\n")

    const content = `Supersoniq Insights

Summary:
${summaryContent}

Top Takeaways:
${result.takeaways.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Key Quotes:
${result.quotes.map((q) => `"${q}"`).join("\n\n")}

Full Transcript:
${result.fullTranscript}
`

    const encodedContent = encodeURIComponent(content)
    const googleDocsUrl = `https://docs.google.com/document/create?title=Supersoniq%20Insights&body=${encodedContent}`
    window.open(googleDocsUrl, "_blank")
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
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex flex-col relative">
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#B9D6D9]/80 backdrop-blur-sm">
          <div className="text-center">
            <Upload className="w-6 h-6 mx-auto text-[#01A0A9] mb-1" />
            <p className="text-base font-medium text-[#1B1823]">Upload</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-[#E5E7EB] bg-[#F7F9F8]">
        <div className="px-8 py-6 flex items-center justify-between">
          <img src="/images/supersoniq-20insights-20logo.png" alt="Supersoniq Insights" className="h-[50px] w-auto" />
          <p className="text-[#39939E] text-sm font-normal italic text-muted-foreground">
            Turn user research audio into actionable insights.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Left Panel - Controls */}
        <div className="w-[30%] border-r border-[#E5E7EB] p-8 space-y-6 bg-[#F7F9F8]">
          {/* API Key Input or Display */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="apiKey" className="text-[#1B1823] text-sm font-medium">
                Assembly AI API Key
              </Label>
              <a
                href="https://www.assemblyai.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#01A0A9] hover:underline font-medium text-xs"
              >
                Get Free
              </a>
            </div>

            {!isApiKeyStored ? (
              <div className="flex gap-2">
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1 h-11 px-4 border-[#E5E7EB] rounded-[8px] focus:border-[#01A0A9] focus:ring-[#01A0A9] text-[#1B1823]"
                />
                <Button
                  onClick={handleStoreApiKey}
                  disabled={!apiKey.trim()}
                  className="h-11 px-6 bg-[#01A0A9] hover:bg-[#019FA8] text-white rounded-[8px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Go
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between h-11 px-4 border border-[#E5E7EB] rounded-[8px] bg-[#FFFFFF]">
                <span className="text-[#1B1823] text-sm">...{storedApiKey.slice(-4)}</span>
                <button onClick={handleRemoveApiKey} className="text-[#01A0A9] hover:underline font-medium text-xs">
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* File Upload */}
          <div className="space-y-3">
            <Label htmlFor="audio" className="text-[#1B1823] text-sm font-medium">
              Audio File
            </Label>
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
                className="w-full h-24 border-2 border-dashed border-[#E5E7EB] rounded-[8px] hover:border-[#01A0A9] hover:bg-[#FFFFFF] transition-colors text-[#39939E]"
              >
                <div className="flex flex-col items-center gap-2">
                  {file ? (
                    <>
                      <FileAudio className="w-8 h-8 text-[#01A0A9]" />
                      <span className="text-xs text-[#1B1823] font-medium text-center px-2 break-all">{file.name}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8" />
                      <span className="text-sm">Click to upload audio file</span>
                    </>
                  )}
                </div>
              </Button>
              {file && (
                <button
                  onClick={handleRemoveFile}
                  className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
                  aria-label="Remove file"
                >
                  <X className="w-4 h-4 text-[#1B1823]" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-[#E5E7EB]">
            {/* Include speaker labels toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="speakerLabels" className="text-[#1B1823] cursor-pointer text-xs">
                Include speaker labels
              </Label>
              <button
                id="speakerLabels"
                role="switch"
                aria-checked={includeSpeakerLabels}
                onClick={() => setIncludeSpeakerLabels(!includeSpeakerLabels)}
                className={`relative inline-flex items-center rounded-full transition-colors w-9 h-3.5 ${
                  includeSpeakerLabels ? "bg-[#01A0A9]" : "bg-[#E5E7EB]"
                }`}
              >
                <span
                  className={`inline-block transform rounded-full bg-white transition-transform w-2.5 h-2.5 ${
                    includeSpeakerLabels ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Include highlights toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="highlights" className="text-[#1B1823] cursor-pointer text-xs">
                Include highlights
              </Label>
              <button
                id="highlights"
                role="switch"
                aria-checked={includeHighlights}
                onClick={() => setIncludeHighlights(!includeHighlights)}
                className={`relative inline-flex items-center rounded-full transition-colors h-3.5 w-9 ${
                  includeHighlights ? "bg-[#01A0A9]" : "bg-[#E5E7EB]"
                }`}
              >
                <span
                  className={`inline-block transform rounded-full bg-white transition-transform w-2.5 h-2.5 ${
                    includeHighlights ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Transcribe Button */}
          <Button
            onClick={handleTranscribe}
            disabled={!file || !storedApiKey || isProcessing}
            className="w-full h-12 bg-[#01A0A9] hover:bg-[#39939E] text-white font-medium rounded-[10px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

        {/* Right Panel - Results */}
        <div className="flex-1 bg-white overflow-auto">
          {/* Error Message */}
          {error && !result && !isProcessing && (
            <div className="h-full flex items-center justify-center p-8">
              <div className="p-6 bg-[#FEF2F2] border border-[#E73F36] rounded-[8px] max-w-md">
                <p className="text-[#E73F36] text-sm leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {!result && !isProcessing && !error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-[#39939E] max-w-md">
                <FileAudio className="w-16 h-16 mx-auto mb-4 opacity-40" />
                <p className="text-lg">Upload an audio file to get started</p>
                <p className="text-sm mt-2 opacity-70">Transcription results appear here.</p>
              </div>
            </div>
          )}

          {/* Processing State */}
          {isProcessing && (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center space-y-6">
                <Loader2 className="w-12 h-12 text-[#01A0A9] animate-spin" />
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-medium text-[#1B1823]">Processing audio</h3>
                  <p className="text-[#39939E] text-center mx-32">
                    {"This takes a few moments, a 5 minute file is usually ready in less than 20 seconds."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {result && !isProcessing && (
            <div className="space-y-6 animate-in fade-in duration-500 mx-8 my-8">
              <div className="flex justify-end">
                <Button
                  onClick={handleExportToGoogleDocs}
                  className="bg-[#01A0A9] hover:bg-[#019FA8] text-white rounded-[8px] font-medium transition-all hover:shadow-[0_4px_12px_rgba(1,160,169,0.3)] text-center h-[30px] w-48"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export to Google Docs
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
                        summaryMode === "paragraph" ? "bg-[#01A0A9] text-white" : "text-[#39939E] hover:text-[#1B1823]"
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

              {includeHighlights && result.themes && result.themes.length > 0 && (
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
                  {result.utterances && includeSpeakerLabels ? (
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
        </div>
      </div>
    </div>
  )
}
