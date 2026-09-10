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
import { useTranslation } from "react-i18next"
import AddMethodForm from "./AddMethodForm"

export function PaymentMethodPicker({
  sessionId,
  value,
}: {
  sessionId: string
  value: string | null | undefined
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const methodsQuery = usePaymentMethodsQuery()
  const updateSession = useUpdateSessionMutation(sessionId)
  const deleteMethod = useDeletePaymentMethodMutation()

  const methods = methodsQuery.data ?? []
  const current = methods.find((m) => m.id === value)

  const triggerLabel = current
    ? current.label
    : methodsQuery.isPending && value
      ? t("badminton.paymentMethod.loading")
      : t("badminton.paymentMethod.choosePlaceholder")

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
        title={t("badminton.paymentMethod.title")}
        description={t("badminton.paymentMethod.description")}
        content={
          <div className="flex flex-col gap-4">
            <RadioGroup
              value={value ?? undefined}
              onValueChange={(id) => {
                updateSession.mutate(
                  { paymentMethodId: id },
                  {
                    onError: () =>
                      toast.error(t("badminton.paymentMethod.updateError")),
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
                        ? t("badminton.paymentMethod.qrImageLabel")
                        : (m.phoneNumber ?? undefined)
                    }
                    action={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("badminton.paymentMethod.deleteAria", {
                          label: m.label,
                        })}
                        onClick={() => {
                          deleteMethod.mutate(m.id, {
                            onSuccess: () => {
                              if (value === m.id) {
                                updateSession.mutate({
                                  paymentMethodId: null,
                                })
                              }
                            },
                            onError: () =>
                              toast.error(
                                t("badminton.paymentMethod.deleteError")
                              ),
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
                    {t("badminton.paymentMethod.empty")}
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
