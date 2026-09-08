import * as React from "react"
import DataAutocomplete from "@/components/custom/data/autocomplete"
import { useStudentSuggestQuery } from "@/services/teacher-room/queries"
import type { DataAutocompleteOption } from "@/components/custom/data/autocomplete"

interface StudentComboboxProps {
  value: string
  onChange: (name: string) => void
  placeholder?: string
}

/**
 * Free-text student name field with suggestions drawn from existing
 * students, built on the same `DataAutocomplete` primitive as badminton's
 * `PlayerNameInput` — same "type a name, see suggestions, pick or keep
 * typing to create" interaction. Simpler than `PlayerNameInput`: a student
 * has no separate "registered account" to link, so there's a single flat
 * suggestion list and no `onSelect` — picking a suggestion is just another
 * way to set the same free-text value.
 */
export function StudentCombobox({
  value,
  onChange,
  placeholder = "Tên học sinh",
}: StudentComboboxProps) {
  const [query, setQuery] = React.useState("")
  // `useStudentSuggestQuery` already gates on a 2-char minimum, so no need to
  // replicate that check here.
  const suggestQuery = useStudentSuggestQuery(query)

  const options = React.useMemo<Array<DataAutocompleteOption>>(
    () => (suggestQuery.data ?? []).map((s) => ({ value: s.name })),
    [suggestQuery.data]
  )

  return (
    <DataAutocomplete
      value={value}
      onValueChange={onChange}
      onSearch={setQuery}
      options={options}
      creatable
      createLabel={(q) => `Thêm học sinh mới "${q}"`}
      loading={suggestQuery.isFetching}
      placeholder={placeholder}
      emptyMessage="Không tìm thấy học sinh"
    />
  )
}
