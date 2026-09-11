import { DataAttachment } from "@/components/custom/data/attachment"
import { FormField } from "@/components/custom/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCreatePaymentMethodMutation } from "@/services/payment-methods/queries"
import { PlusIcon } from "@phosphor-icons/react"
import { useForm } from "@tanstack/react-form"
import { useTranslation } from "react-i18next"
import * as z from "zod"

// Mirrors the backend's CreatePaymentMethodDto: phoneNumber's shape
// (9-11 digits) and whether it's required depend on `type`, which
// CreatePaymentMethodSchema alone doesn't express.
//
// Built from `t` rather than a module-level constant so the messages
// FieldError renders follow the active locale.
function addMethodSchema(t: (key: string) => string) {
  return z
    .object({
      type: z.enum(["image", "phone"]),
      label: z
        .string()
        .trim()
        .min(1, t("badminton.paymentMethod.form.labelRequired"))
        .max(120),
      phoneNumber: z.string(),
      file: z.instanceof(File).or(z.undefined()),
    })
    .superRefine((value, ctx) => {
      if (value.type === "phone" && !/^\d{9,11}$/.test(value.phoneNumber)) {
        ctx.addIssue({
          code: "custom",
          path: ["phoneNumber"],
          message: t("badminton.paymentMethod.form.phoneInvalid"),
        })
      }
      if (value.type === "image" && !value.file) {
        ctx.addIssue({
          code: "custom",
          path: ["file"],
          message: t("badminton.paymentMethod.form.fileRequired"),
        })
      }
    })
}

export default function AddMethodForm() {
  const { t } = useTranslation()
  const createMethod = useCreatePaymentMethodMutation()

  const form = useForm({
    defaultValues: {
      type: "phone" as "image" | "phone",
      label: "",
      phoneNumber: "",
      file: undefined as File | undefined,
    },
    validators: {
      onSubmit: addMethodSchema(t),
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
          },
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
                {t("badminton.paymentMethod.form.phoneTab")}
              </TabsTrigger>
              <TabsTrigger
                onClick={() => switchType(field, "image")}
                value="image"
              >
                {t("badminton.paymentMethod.form.imageTab")}
              </TabsTrigger>
            </TabsList>
          )}
        </FormField>
        <div className="flex flex-col gap-2">
          <FormField form={form} name="label">
            {({ inputProps }) => (
              <Input
                placeholder={t("badminton.paymentMethod.form.labelPlaceholder")}
                {...inputProps}
              />
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
                  <Input
                    type="tel"
                    placeholder={t("badminton.paymentMethod.form.phoneTab")}
                    {...inputProps}
                  />
                )}
              </FormField>
            </TabsContent>
            <TabsContent value="image">
              <FormField form={form} name="file">
                {({ field }) => (
                  <DataAttachment
                    accept="image/png,image/jpeg,image/webp"
                    file={field.state.value}
                    onFileChange={field.handleChange}
                    placeholder={t("badminton.paymentMethod.form.imageTab")}
                    state={createMethod.isPending ? "uploading" : undefined}
                  />
                )}
              </FormField>
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
                {t("badminton.paymentMethod.form.add")}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </Tabs>
    </div>
  )
}
