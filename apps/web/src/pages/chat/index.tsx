import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useState } from "react"
import { AppConstants } from "@/lib/utils/constants"
import { aiChatApi } from "@/services/ai/api"
import { AI } from "@/services/url"
import { Button } from "@/components/ui/button"

export default function ChatPage() {
  const [input, setInput] = useState("")
  const [threadId, setThreadId] = useState<string | null>(null)
  const [pending, setPending] = useState<{ pending: boolean; summary?: string }>({
    pending: false,
  })

  const refreshPendingAction = async () => {
    if (!threadId) return
    const result = await aiChatApi.getPendingAction(threadId)
    setPending(result)
  }

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `${AppConstants.apiBaseUrl}${AI.chat}`,
      credentials: "include",
    }),
    onFinish: () => {
      void refreshPendingAction()
    },
  })

  const handleSend = () => {
    if (!input.trim()) return
    const nextThreadId = threadId ?? crypto.randomUUID()
    setThreadId(nextThreadId)
    void sendMessage({ text: input })
    setInput("")
  }

  const handleConfirm = async (approve: boolean) => {
    if (!threadId) return
    await aiChatApi.confirm(threadId, approve)
    setPending({ pending: false })
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.map((message) => (
          <div key={message.id}>
            <span className="font-medium">
              {message.role === "user" ? "You: " : "AI: "}
            </span>
            {message.parts.map((part, index) =>
              part.type === "text" ? <span key={index}>{part.text}</span> : null
            )}
          </div>
        ))}
      </div>

      {pending.pending ? (
        <div className="flex items-center gap-2 rounded-md border p-3">
          <span className="flex-1 text-sm">{pending.summary}</span>
          <Button
            size="sm"
            onClick={() => {
              void handleConfirm(true)
            }}
          >
            Confirm
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void handleConfirm(false)
            }}
          >
            Cancel
          </Button>
        </div>
      ) : null}

      <div className="flex gap-2">
        <input
          className="flex-1 rounded-md border px-3 py-2"
          value={input}
          disabled={status !== "ready"}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask about your badminton sessions..."
        />
        <Button onClick={handleSend} disabled={status !== "ready"}>
          Send
        </Button>
      </div>
    </div>
  )
}
