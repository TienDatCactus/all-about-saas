import DataDialog from "@/components/custom/data/dialog"
import DataItem from "@/components/custom/data/item"
import { toast } from "@/components/custom/toast"
import { Button } from "@/components/ui/button"
import { ItemGroup } from "@/components/ui/item"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useUpdateSessionMutation } from "@/services/badminton/queries"
import {
  useDeletePaymentMethodMutation,
  usePaymentMethodsQuery,
} from "@/services/payment-methods/queries"
import { TrashIcon, WalletIcon } from "@phosphor-icons/react"
import { useState } from "react"
import AddMethodForm from "./AddMethodForm"

export function PaymentMethodPicker({
  sessionId,
  value,
}: {
  sessionId: string
  value: string | null | undefined
}) {
  const [open, setOpen] = useState(false)
  const methodsQuery = usePaymentMethodsQuery()
  const updateSession = useUpdateSessionMutation(sessionId)
  const deleteMethod = useDeletePaymentMethodMutation()

  const methods = methodsQuery.data ?? []
  const current = methods.find((m) => m.id === value)

  const triggerLabel = current
    ? current.label
    : methodsQuery.isPending && value
      ? "Loading…"
      : "Choose a payment method"

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <WalletIcon data-icon="inline-start" />
        {triggerLabel}
      </Button>
      <DataDialog
        open={open}
        onOpenChange={setOpen}
        title="Payment method"
        description="Choose or add a MoMo QR/phone number to show on the share page."
        content={
          <div className="flex flex-col gap-4">
            <RadioGroup
              value={value ?? undefined}
              onValueChange={(id) => {
                updateSession.mutate(
                  { paymentMethodId: id },
                  {
                    onError: () =>
                      toast.error("Couldn't change the payment method"),
                  }
                )
              }}
            >
              <ItemGroup>
                {methods.map((m) => (
                  <DataItem
                    variant="outline"
                    key={m.id}
                    media={{
                      variant: "icon",
                      icon: <RadioGroupItem value={m.id} id={m.id} />,
                    }}
                    title={m.label}
                    description={
                      m.type === "image"
                        ? "QR image"
                        : (m.phoneNumber ?? undefined)
                    }
                    action={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${m.label}`}
                        onClick={() => {
                          deleteMethod.mutate(m.id, {
                            onSuccess: () => {
                              if (value === m.id) {
                                updateSession.mutate({
                                  paymentMethodId: null,
                                })
                              }
                            },
                            onError: () => toast.error("Delete failed"),
                          })
                        }}
                      >
                        <TrashIcon />
                      </Button>
                    }
                  />
                ))}
                {methods.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No payment methods yet.
                  </p>
                )}
              </ItemGroup>
            </RadioGroup>
            <AddMethodForm />
          </div>
        }
      />
    </>
  )
}
