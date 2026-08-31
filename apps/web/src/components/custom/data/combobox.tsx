import { SpinnerIcon } from "@phosphor-icons/react"
import { useDebounce } from "ahooks"
import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox"

export interface DataComboboxOption {
  /** Text written into the input when this option is picked. */
  value: string
  /** Secondary line — an email, a hint, a count. */
  description?: string
}

export interface DataComboboxGroup {
  label: string
  options: Array<DataComboboxOption>
}

interface DataComboboxProps {
  /** The input text. This is free-form: it need not match any option. */
  value: string
  onValueChange: (value: string) => void
  /** Flat suggestions. Ignored when `groups` is passed. */
  options?: Array<DataComboboxOption>
  groups?: Array<DataComboboxGroup>
  /** Called with the trimmed query after `debounceMs` of no typing. */
  onSearch?: (query: string) => void
  /** Fires only when a suggestion is picked — not while typing. */
  onSelect?: (option: DataComboboxOption) => void
  loading?: boolean
  placeholder?: string
  emptyMessage?: string
  /** @default 250 */
  debounceMs?: number
  id?: string
  name?: string
  onBlur?: () => void
  "aria-invalid"?: boolean
  disabled?: boolean
  className?: string
}

/*
An autocomplete text input: suggestions assist, they don't constrain. The typed
value is always kept, so a name that matches nothing is still valid input.

    <DataCombobox
      value={name}
      onValueChange={setName}
      groups={[{ label: "Players", options: [{ value: "An", description: "an@x.com" }] }]}
      onSearch={setQuery}
      onSelect={(o) => ...}
    />
*/

export default function DataCombobox({
  value,
  onValueChange,
  options,
  groups,
  onSearch,
  onSelect,
  loading,
  placeholder,
  emptyMessage = "No matches",
  debounceMs = 250,
  id,
  name,
  onBlur,
  "aria-invalid": ariaInvalid,
  disabled,
  className,
}: DataComboboxProps) {
  // Debounced so typing a name costs one request, not one per keystroke.
  // Keyed on the latest callback via a ref so a new `onSearch` identity each
  // render doesn't restart the timer.
  const searchRef = React.useRef(onSearch)
  // Synced in an effect, not during render — React Compiler flags reading or
  // writing ref.current in the render body (refs are for effects/handlers).
  React.useEffect(() => {
    searchRef.current = onSearch
  })

  const debouncedSearchValue = useDebounce(value.trim(), {
    wait: debounceMs,
  })

  React.useEffect(() => {
    if (debouncedSearchValue.length > 0) {
      searchRef.current?.(debouncedSearchValue)
    }
  }, [debouncedSearchValue])
  // Base UI groups carry their own `items`; `label` rides along as an extra key.
  const items = React.useMemo(
    () =>
      groups
        ? groups.map((g) => ({ label: g.label, items: g.options }))
        : (options ?? []),
    [groups, options]
  )

  const renderItem = (option: DataComboboxOption) => (
    <ComboboxItem key={option.value} value={option}>
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{option.value}</span>
        {option.description && (
          <span className="truncate text-xs text-muted-foreground">
            {option.description}
          </span>
        )}
      </span>
    </ComboboxItem>
  )

  return (
    <Combobox
      items={items}
      // The server already filtered; re-filtering locally would hide results
      // whose match was on a field the input text doesn't literally contain.
      filter={null}
      inputValue={value}
      onInputValueChange={(text) => onValueChange(text)}
      onValueChange={(selected: DataComboboxOption | null) => {
        if (!selected) return
        onValueChange(selected.value)
        onSelect?.(selected)
      }}
      itemToStringLabel={(option: DataComboboxOption) => option.value}
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        name={name}
        onBlur={onBlur}
        aria-invalid={ariaInvalid}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        showTrigger={false}
        className={cn("w-full", className)}
      />
      <ComboboxContent>
        <ComboboxEmpty>
          {loading ? (
            <span className="flex items-center gap-2">
              <SpinnerIcon className="size-4 animate-spin" />
              Searching…
            </span>
          ) : (
            emptyMessage
          )}
        </ComboboxEmpty>
        <ComboboxList>
          {groups
            ? (group: { label: string; items: Array<DataComboboxOption> }) => (
                <ComboboxGroup key={group.label} items={group.items}>
                  <ComboboxLabel>{group.label}</ComboboxLabel>
                  <ComboboxCollection>{renderItem}</ComboboxCollection>
                </ComboboxGroup>
              )
            : renderItem}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
