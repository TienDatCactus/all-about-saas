import * as z from "zod"
import { AI } from "../url"
import { parseResponse } from "@/lib/utils/parse-response"
import { http } from "@/lib/utils/http"

const PendingActionSchema = z.object({
  pending: z.boolean(),
  summary: z.string().optional(),
})

const ConfirmResultSchema = z.object({
  message: z.string(),
  toolCallState: z.string(),
})

export const aiChatApi = {
  getPendingAction: (threadId: string) =>
    parseResponse(
      "ai.getPendingAction",
      PendingActionSchema,
      http.get(AI.pendingAction(threadId))
    ),
  confirm: (threadId: string, approve: boolean) =>
    parseResponse(
      "ai.confirm",
      ConfirmResultSchema,
      http.post(AI.confirm, { threadId, approve })
    ),
}
