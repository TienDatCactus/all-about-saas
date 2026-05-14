"use client"

import {
  Field,
  FieldError,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field"
import type { DeepKeys } from "@tanstack/react-form"
import type { ReactNode } from "react"

type FormFieldProps<TFormData> = {
  form: any
  name: DeepKeys<TFormData>

  label?: string
  description?: string

  children: (props: {
    field: any

    inputProps: {
      name: string
      value: any
      onBlur: () => void
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
      "aria-invalid": boolean
    }

    isInvalid: boolean
  }) => ReactNode
}

export function FormField<TFormData>({
  form,
  name,
  label,
  description,
  children,
}: FormFieldProps<TFormData>) {
  return (
    <form.Field
      name={name}
      children={(field: any) => {
        const isInvalid =
          field.state.meta.isTouched && !field.state.meta.isValid

        return (
          <Field data-invalid={isInvalid}>
            {label && <FieldLabel>{label}</FieldLabel>}

            {children({
              field,

              isInvalid,

              inputProps: {
                name: field.name,
                value: field.state.value,
                onBlur: field.handleBlur,

                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                  field.handleChange(e.target.value),

                "aria-invalid": isInvalid,
              },
            })}

            {description && <FieldDescription>{description}</FieldDescription>}

            {isInvalid && <FieldError errors={field.state.meta.errors} />}
          </Field>
        )
      }}
    />
  )
}
