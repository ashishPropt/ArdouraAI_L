'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Send, Sparkles } from 'lucide-react'

interface Message {
  id: string
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  content: string
  createdAt: string
  metadata?: any
}

interface Props {
  messages: Message[]
  onSend: (text: string) => Promise<void>
  disabled: boolean
  projectName: string
}

export function ChatPanel({ messages, onSend, disabled, projectName }: Props) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = messagesRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || sending || disabled) return
    setInput('')
    setSending(true)
    await onSend(text)
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-white">{projectName}</h2>
        <p className="text-xs text-slate-500">Chat to build your app</p>
      </div>

      {/* Messages */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center pb-8">
            <div className="w-12 h-12 bg-ardoura-800 rounded-2xl flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-ardoura-400" />
            </div>
            <h3 className="text-white font-semibold mb-2">Describe your idea</h3>
            <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
              Tell me what you want to build — I'll ask a few questions, then generate your complete app.
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === 'USER'
          const isSystem = msg.role === 'SYSTEM'
          const isStreaming = !isUser && i === messages.length - 1 && !msg.content.endsWith('\n') && !isSystem

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center">
                <span className="text-xs text-ardoura-400 bg-ardoura-900/30 px-3 py-1.5 rounded-full border border-ardoura-800/50 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-ardoura-400 rounded-full animate-pulse" />
                  {msg.content}
                </span>
              </div>
            )
          }

          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className="w-7 h-7 bg-ardoura-700 rounded-lg flex items-center justify-center mr-2 mt-0.5 flex-shrink-0 text-xs font-bold text-white">
                  A
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-ardoura-600 text-white rounded-br-sm'
                    : 'bg-slate-800 text-slate-100 rounded-bl-sm'
                } ${isStreaming ? 'streaming' : ''}`}
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <ReactMarkdown
                    components={{
                      code: ({ children, className }) => {
                        const isBlock = className?.includes('language-')
                        return isBlock ? (
                          <pre className="bg-slate-900 rounded-lg p-3 overflow-x-auto my-2 text-xs">
                            <code>{children}</code>
                          </pre>
                        ) : (
                          <code className="bg-slate-900 px-1.5 py-0.5 rounded text-ardoura-300 text-xs">{children}</code>
                        )
                      },
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                      strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-end gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 focus-within:border-ardoura-500 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending || disabled}
            placeholder="Describe your app idea..."
            rows={1}
            className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm resize-none outline-none max-h-32 min-h-[24px]"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement
              t.style.height = 'auto'
              t.style.height = `${Math.min(t.scrollHeight, 128)}px`
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending || disabled}
            className="bg-ardoura-500 hover:bg-ardoura-400 disabled:opacity-30 disabled:cursor-not-allowed text-white p-1.5 rounded-lg transition-colors flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-1.5 text-center">Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  )
}
