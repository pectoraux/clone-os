'use client'

import * as React from 'react'
import { io, type Socket } from 'socket.io-client'
import { toast } from 'sonner'
import {
  MessageSquare,
  Send,
  RotateCcw,
  Bot,
  User,
  Loader2,
  Sparkles,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CloneOSData } from '../types'
import {
  Callout,
  CertBadge,
  SectionHeading,
} from '../shared'

interface ChatMessage {
  id: string
  role: 'user' | 'clone' | 'system'
  content: string
  ts: number
}

const INTRO_MESSAGE: ChatMessage = {
  id: 'intro',
  role: 'clone',
  content:
    "Hi, I'm Sarah's Revenue Operations Clone. Ask me about pipeline hygiene, ICP, forecasting, or how I'd triage an inbound lead.",
  ts: Date.now(),
}

interface CloneReady {
  cloneId: string
  cloneName: string
  version: string
  certification: string
  persona: Record<string, unknown>
}

export function LiveChatSection({ data }: { data: CloneOSData }) {
  const { clone } = data
  const socketRef = React.useRef<Socket | null>(null)
  const [connected, setConnected] = React.useState(false)
  const [ready, setReady] = React.useState<CloneReady | null>(null)
  const [messages, setMessages] = React.useState<ChatMessage[]>([INTRO_MESSAGE])
  const [input, setInput] = React.useState('')
  const [thinking, setThinking] = React.useState(false)
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null)

  // Persona summary
  const persona = clone.persona as {
    communicationStyle?: string
    tone?: string
    structure?: string
    vocabulary?: string[]
    directness?: number
  }

  // Connect to clone-chat mini-service on port 3003 via the gateway.
  // Path is always "/" so Caddy can route; XTransformPort picks the backend.
  React.useEffect(() => {
    if (!clone.id) return
    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('clone:join', { cloneId: clone.id })
    })

    socket.on('disconnect', () => setConnected(false))

    socket.on('clone:ready', (payload: CloneReady) => {
      setReady(payload)
    })

    socket.on('clone:message', (msg: ChatMessage) => {
      setMessages((prev) => {
        // Avoid dup if the server also broadcasts to sender
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      setThinking(false)
    })

    socket.on('clone:thinking', () => setThinking(true))
    socket.on('clone:typing', () => setThinking(false))

    socket.on('clone:error', (payload: { message: string }) => {
      setThinking(false)
      toast.error('Clone chat error', { description: payload.message })
    })

    socket.on('clone:reset-ack', () => {
      setMessages([INTRO_MESSAGE])
      setThinking(false)
      toast.success('Conversation reset', {
        description: 'In-memory chat history cleared. The clone state is unchanged.',
      })
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [clone.id])

  // Auto-scroll
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, thinking])

  const sendMessage = () => {
    const text = input.trim()
    if (!text || !socketRef.current) return
    socketRef.current.emit('clone:message', { content: text })
    setInput('')
    setThinking(true)
  }

  const resetConversation = () => {
    socketRef.current?.emit('clone:reset')
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Live Chat"
        description="Real-time clone conversation via socket.io mini-service (ADR-0013). The clone's persistent state is loaded from the platform data layer each session."
        icon={MessageSquare}
      />

      <Callout tone="info" title="The LLM is an inference engine. This clone's persona, expertise, skills, and policies are loaded from the platform data layer each session.">
        Chat history is <strong>experience</strong> — it lives in the mini-service
        session, never in the clone itself. The clone is the source of truth; the
        LLM is replaceable infrastructure.
      </Callout>

      {/* Persona summary */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">{clone.name}</CardTitle>
              <CardDescription>
                {clone.professionalIdentity?.title} · {clone.domain}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="font-mono text-xs">
                v{ready?.version ?? clone.currentVersion?.version ?? '0.0.0'}
              </Badge>
              <CertBadge level={ready?.certification ?? clone.certificationLevel} />
              <Badge
                variant="outline"
                className={
                  connected
                    ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs'
                    : 'text-xs'
                }
              >
                {connected ? 'connected' : 'disconnected'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            {persona.communicationStyle && (
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
                  Style
                </span>
                <span className="text-sm">{persona.communicationStyle}</span>
              </div>
            )}
            {persona.tone && (
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
                  Tone
                </span>
                <span className="text-sm">{persona.tone}</span>
              </div>
            )}
            {persona.structure && (
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
                  Structure
                </span>
                <span className="text-sm">{persona.structure}</span>
              </div>
            )}
            {persona.vocabulary && persona.vocabulary.length > 0 && (
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
                  Vocabulary
                </span>
                <div className="flex flex-wrap gap-1">
                  {persona.vocabulary.slice(0, 6).map((v) => (
                    <Badge key={v} variant="secondary" className="text-[10px]">
                      {v}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chat window */}
      <Card className="flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="size-4" />
              Conversation
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={resetConversation}
              disabled={!connected}
            >
              <RotateCcw className="size-3.5" />
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="bg-muted/30 max-h-[28rem] min-h-[18rem] overflow-y-auto rounded-lg border border-border/60 p-3 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
            <div className="flex flex-col gap-2.5">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} cloneName={clone.name} />
              ))}
              {thinking && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span className="italic">Clone is thinking…</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Composer */}
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about pipeline hygiene, ICP, forecasting…"
              rows={2}
              className="min-h-[3rem] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              disabled={!connected}
            />
            <Button
              onClick={sendMessage}
              disabled={!connected || !input.trim()}
              size="default"
              className="h-[3rem] shrink-0"
              aria-label="Send message"
            >
              <Send className="size-4" />
            </Button>
          </div>
          <div className="text-muted-foreground flex items-center justify-between text-[10px]">
            <span>Press Enter to send · Shift+Enter for newline</span>
            <span className="flex items-center gap-1">
              <Sparkles className="size-3" />
              Port 3003 · socket.io · ADR-0013
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MessageBubble({
  message,
  cloneName,
}: {
  message: ChatMessage
  cloneName: string
}) {
  if (message.role === 'system') {
    return (
      <div className="text-muted-foreground rounded-md bg-muted/50 px-3 py-1.5 text-center text-[10px] italic">
        {message.content}
      </div>
    )
  }
  const isUser = message.role === 'user'
  return (
    <div
      className={cn(
        'flex items-start gap-2',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <div
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full',
          isUser
            ? 'bg-primary/10 text-primary'
            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>
      <div
        className={cn(
          'flex max-w-[85%] flex-col gap-0.5 rounded-lg border px-3 py-2',
          isUser
            ? 'border-primary/30 bg-primary/5'
            : 'border-border/60 bg-background',
        )}
      >
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="font-medium">
            {isUser ? 'You' : cloneName}
          </span>
          <span>{new Date(message.ts).toLocaleTimeString()}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
        </p>
      </div>
    </div>
  )
}
