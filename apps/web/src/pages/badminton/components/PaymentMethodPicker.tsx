import { useState } from "react"
import { PlusIcon, TrashIcon, WalletIcon } from "@phosphor-icons/react"
import DataDialog from "@/components/custom/data/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "@/components/custom/toast"
import {
  useCreatePaymentMethodMutation,
  useDeletePaymentMethodMutation,
  usePaymentMethodsQuery,
} from "@/services/payment-methods/queries"
import { useUpdateSessionMutation } from "@/services/badminton/queries"

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

  /**
   * While the list is still loading there is no way to resolve `value` to a
   * label, and falling back to the "nothing selected" prompt actively lied: a
   * session that HAS a method flashed "Chọn phương thức nhận tiền" and then
   * swapped to the real label. A session id we already know is set gets a
   * neutral placeholder instead, and only a settled empty list says "none".
   */
  const triggerLabel = current
    ? current.label
    : methodsQuery.isPending && value
      ? "Đang tải…"
      : "Chọn phương thức nhận tiền"

  return (
    <>
      <Button
        // Defensive: this picker is not inside a <form> today, but every other
        // button in this feature declares its type, and a stray submit here
        // would save the session as a side effect of opening a dialog.
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
        title="Phương thức nhận tiền"
        description="Chọn hoặc thêm QR/SĐT MoMo để hiện trên trang chia sẻ."
        content={
          <div className="flex flex-col gap-4">
            <RadioGroup
              value={value ?? undefined}
              onValueChange={(id) => {
                updateSession.mutate(
                  { paymentMethodId: id },
                  {
                    onError: () =>
                      toast.error("Không đổi được phương thức nhận tiền"),
                  }
                )
              }}
            >
              {methods.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value={m.id} id={m.id} />
                    <Label htmlFor={m.id}>
                      {m.label}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({m.type === "image" ? "QR ảnh" : m.phoneNumber})
                      </span>
                    </Label>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Xoá ${m.label}`}
                    onClick={() => {
                      deleteMethod.mutate(m.id, {
                        onSuccess: () => {
                          if (value === m.id) {
                            updateSession.mutate({ paymentMethodId: null })
                          }
                        },
                        onError: () => toast.error("Xoá thất bại"),
                      })
                    }}
                  >
                    <TrashIcon />
                  </Button>
                </div>
              ))}
              {methods.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Chưa có phương thức nào.
                </p>
              )}
            </RadioGroup>
            <AddMethodForm />
          </div>
        }
      />
    </>
  )
}

function AddMethodForm() {
  const [type, setType] = useState<"image" | "phone">("phone")
  const [label, setLabel] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [file, setFile] = useState<File | undefined>(undefined)
  const createMethod = useCreatePaymentMethodMutation()

  const canSubmit =
    label.trim().length > 0 &&
    (type === "phone" ? phoneNumber.trim().length > 0 : !!file)

  /**
   * Switching branches drops the abandoned branch's value. Its input is
   * unmounted, so whatever is left in state is invisible but still submitted —
   * a picked file would be uploaded with a `type: "phone"` method the API then
   * ignores, and a half-typed number would linger behind the file picker.
   */
  const switchType = (next: "image" | "phone") => {
    setType(next)
    if (next === "phone") setFile(undefined)
    else setPhoneNumber("")
  }

  return (
    <div className="border-t pt-4">
      <div className="mb-2 flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={type === "phone" ? "default" : "outline"}
          onClick={() => switchType("phone")}
        >
          SĐT MoMo
        </Button>
        <Button
          type="button"
          size="sm"
          variant={type === "image" ? "default" : "outline"}
          onClick={() => switchType("image")}
        >
          Upload ảnh QR
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        <Input
          placeholder="Tên gợi nhớ (vd: MoMo cá nhân)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        {type === "phone" ? (
          <Input
            placeholder="Số điện thoại MoMo"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
        ) : (
          <Input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setFile(e.target.files?.[0])}
          />
        )}
        <Button
          type="button"
          disabled={!canSubmit || createMethod.isPending}
          onClick={() => {
            createMethod.mutate(
              {
                type,
                label,
                phoneNumber: type === "phone" ? phoneNumber : undefined,
                file,
              },
              {
                onSuccess: () => {
                  setLabel("")
                  setPhoneNumber("")
                  setFile(undefined)
                  toast.success("Đã thêm phương thức nhận tiền")
                },
                onError: () => toast.error("Thêm thất bại"),
              }
            )
          }}
        >
          <PlusIcon data-icon="inline-start" />
          Thêm
        </Button>
      </div>
    </div>
  )
}
