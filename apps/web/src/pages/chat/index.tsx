import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useRef, useState } from "react"
import { AppConstants } from "@/lib/utils/constants"
import { getAccessToken } from "@/lib/utils/access-token"
import { aiChatApi } from "@/services/ai/api"
import { AI } from "@/services/url"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"

export default function ChatPage() {
  const [input, setInput] = useState("")
  // A ref, not state: `prepareSendMessagesRequest` below reads this inside the
  // transport's fetch, which can fire before React has committed a `setState`
  // from the same event handler — a ref is readable synchronously, a state
  // variable closed over at render time isn't guaranteed to be current yet.
  const threadIdRef = useRef<string | null>(null)
  const [pending, setPending] = useState<{
    pending: boolean
    summary?: string
  }>({
    pending: false,
  })

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `${AppConstants.apiBaseUrl}${AI.chat}`,
      credentials: "include",
      // `DefaultChatTransport` issues its own `fetch` — it never goes through
      // the axios `http` client, so the app's usual Authorization-header
      // interceptor (apps/web/src/lib/utils/http.ts) never runs. Attach the
      // same bearer token by hand, or every request 401s before it reaches
      // the controller.
      headers: () => {
        // Not `return token ? {...} : {}` — TypeScript infers
        // `{ Authorization: string } | { Authorization?: undefined }` for that
        // ternary, and the `undefined` branch fails the
        // `Resolvable<Record<string, string> | Headers>` index-signature
        // check. Build the object imperatively instead.
        const token = getAccessToken()
        const headers: Record<string, string> = {}
        if (token) headers.Authorization = `Bearer ${token}`
        return headers
      },
      // The AI SDK's default request body is `{ id, messages, trigger,
      // messageId }` (the UI-message-stream protocol) — the backend's
      // `SendChatMessageDto` expects `{ message, threadId? }` instead, and
      // the global `ValidationPipe({ whitelist: true, forbidNonWhitelisted:
      // true })` rejects anything else. Reshape the request to match.
      prepareSendMessagesRequest: ({ messages }) => {
        const last = messages[messages.length - 1]
        const text =
          last?.parts.find((part) => part.type === "text")?.text ?? ""
        return {
          body: {
            message: text,
            ...(threadIdRef.current ? { threadId: threadIdRef.current } : {}),
          },
        }
      },
    }),
    onFinish: () => {
      void (async () => {
        if (!threadIdRef.current) return
        const result = await aiChatApi.getPendingAction(threadIdRef.current)
        setPending(result)
      })()
    },
  })

  const handleSend = () => {
    if (!input.trim()) return
    if (!threadIdRef.current) threadIdRef.current = crypto.randomUUID()
    void sendMessage({ text: input })
    setInput("")
  }

  const handleConfirm = async (approve: boolean) => {
    if (!threadIdRef.current) return
    await aiChatApi.confirm(threadIdRef.current, approve)
    setPending({ pending: false })
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent>
              {messages.map((message) => (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={message.role === "user"}
                >
                  <Message align={message.role === "user" ? "end" : "start"}>
                    <MessageContent>
                      <Bubble
                        variant={message.role === "user" ? "default" : "ghost"}
                      >
                        <BubbleContent>
                          {message.parts.map((part, index) =>
                            part.type === "text" ? (
                              <span key={index}>{part.text}</span>
                            ) : null
                          )}
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      {pending.pending ? (
        <Alert>
          <AlertTitle>Confirm action</AlertTitle>
          <AlertDescription>{pending.summary}</AlertDescription>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => void handleConfirm(true)}>
              Confirm
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleConfirm(false)}
            >
              Cancel
            </Button>
          </div>
        </Alert>
      ) : null}

      <div className="flex gap-2">
        <Input
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
