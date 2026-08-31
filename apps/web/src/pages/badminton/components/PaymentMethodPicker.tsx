import { useEffect, useState } from "react"
import {
  PlusIcon,
  QrCodeIcon,
  TrashIcon,
  WalletIcon,
} from "@phosphor-icons/react"
import { useForm } from "@tanstack/react-form"
import DataDialog from "@/components/custom/data/dialog"
import { FormField } from "@/components/custom/form-field"
import { QrPreviewDialog } from "@/pages/badminton/components/QrPreviewDialog"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Image } from "@/components/custom/image"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

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
                        ({m.type === "image" ? "QR image" : m.phoneNumber})
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-center gap-1">
                    {m.type === "image" && m.imageUrl && (
                      <QrPreviewDialog
                        label={m.label}
                        imageUrl={m.imageUrl}
                        trigger={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Preview ${m.label}`}
                          >
                            <QrCodeIcon />
                          </Button>
                        }
                      />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${m.label}`}
                      onClick={() => {
                        deleteMethod.mutate(m.id, {
                          onSuccess: () => {
                            if (value === m.id) {
                              updateSession.mutate({ paymentMethodId: null })
                            }
                          },
                          onError: () => toast.error("Delete failed"),
                        })
                      }}
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                </div>
              ))}
              {methods.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No payment methods yet.
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
  const createMethod = useCreatePaymentMethodMutation()

  const form = useForm({
    defaultValues: {
      type: "phone" as "image" | "phone",
      label: "",
      phoneNumber: "",
      file: undefined as File | undefined,
    },
    onSubmit: ({ value }) => {
      createMethod.mutate(
        {
          type: value.type,
          label: value.label,
          phoneNumber: value.type === "phone" ? value.phoneNumber : undefined,
          file: value.file,
        },
        {
          onSuccess: () => {
            // Not form.reset() — that would also snap `type` back to "phone",
            // dropping the host onto the wrong tab if they just added an
            // image method and want to add another one right after.
            form.setFieldValue("label", "")
            form.setFieldValue("phoneNumber", "")
            form.setFieldValue("file", undefined)
            toast.success("Payment method added")
          },
          onError: () => toast.error("Add failed"),
        }
      )
    },
  })

  const switchType = (field: any, next: "image" | "phone") => {
    field.handleChange(next)
    if (next === "phone") form.setFieldValue("file", undefined)
    else form.setFieldValue("phoneNumber", "")
  }

  return (
    <div className="border-t pt-4">
      <Tabs defaultValue="phone">
        <FormField form={form} name="type">
          {({ field }) => (
            <TabsList>
              <TabsTrigger
                onClick={() => switchType(field, "phone")}
                value="phone"
              >
                MoMo phone number
              </TabsTrigger>
              <TabsTrigger
                onClick={() => switchType(field, "image")}
                value="image"
              >
                Upload QR image
              </TabsTrigger>
            </TabsList>
          )}
        </FormField>
        <div className="flex flex-col gap-2">
          <FormField form={form} name="label">
            {({ inputProps }) => (
              <Input placeholder="Label (e.g. Personal MoMo)" {...inputProps} />
            )}
          </FormField>
          <form.Subscribe
            selector={(s: { values: { type: "image" | "phone" } }) =>
              s.values.type
            }
          >
            <TabsContent value="phone">
              <FormField form={form} name="phoneNumber">
                {({ inputProps }) => (
                  <Input placeholder="MoMo phone number" {...inputProps} />
                )}
              </FormField>
            </TabsContent>
            <TabsContent value="image" className="flex items-center gap-2">
              <FormField form={form} name="file">
                {({ field }) => (
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => field.handleChange(e.target.files?.[0])}
                  />
                )}
              </FormField>
              <form.Subscribe
                selector={(s: { values: { file: File | undefined } }) =>
                  s.values.file
                }
              >
                {(file: File | undefined) => <ImagePreview file={file} />}
              </form.Subscribe>
            </TabsContent>
          </form.Subscribe>
          <form.Subscribe
            selector={(s: {
              values: {
                type: "image" | "phone"
                label: string
                phoneNumber: string
                file: File | undefined
              }
            }) =>
              s.values.label.trim().length > 0 &&
              (s.values.type === "phone"
                ? s.values.phoneNumber.trim().length > 0
                : !!s.values.file)
            }
          >
            {(canSubmit: boolean) => (
              <Button
                type="button"
                disabled={!canSubmit || createMethod.isPending}
                onClick={() => {
                  form.handleSubmit().catch(() => undefined)
                }}
              >
                <PlusIcon data-icon="inline-start" />
                Add
              </Button>
            )}
          </form.Subscribe>
        </div>
      </Tabs>
    </div>
  )
}

function ImagePreview({ file }: { file: File | undefined }) {
  const [url, setUrl] = useState<string>()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!file) {
      setUrl(undefined)
      return
    }
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={!url}>
          Preview
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR code preview</DialogTitle>
        </DialogHeader>
        {url && (
          <Image
            src={url}
            alt="QR code preview"
            aspectRatio="square"
            objectFit="contain"
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
