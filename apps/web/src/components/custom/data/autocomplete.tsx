import { PlusIcon, SpinnerIcon } from "@phosphor-icons/react"
import { useDebounce } from "ahooks"
import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from "@/components/ui/autocomplete"

/**
 * A suggestion. `value` is the text committed to the input; `meta` rides along
 * untouched so callers can recover identity (a user id, a record) without
 * looking it up by display name — two different records can share a name.
 */
export interface DataAutocompleteOption<TMeta = unknown> {
  value: string
  /** Secondary line — an email, a hint, a count. */
  description?: string
  meta?: TMeta
}

export interface DataAutocompleteGroup<TMeta = unknown> {
  label: string
  options: Array<DataAutocompleteOption<TMeta>>
}

interface DataAutocompleteProps<TMeta = unknown> {
  /** The input text, and the value of the field. Free-form by design. */
  value: string
  /** Fires for typed edits only — never for picking a suggestion. */
  onValueChange: (value: string) => void
  /** Fires only when a suggestion is picked, with its `meta` intact. */
  onSelect?: (option: DataAutocompleteOption<TMeta>) => void
  /** Flat suggestions. Ignored when `groups` is passed. */
  options?: Array<DataAutocompleteOption<TMeta>>
  groups?: Array<DataAutocompleteGroup<TMeta>>
  /** Called with the trimmed query after `debounceMs` of no typing, "" included. */
  onSearch?: (query: string) => void
  /**
   * Surface the typed text as its own entry when it matches no suggestion.
   *
   * When there ARE other suggestions it renders as a pickable row, so choosing
   * your own text over a near-match is a deliberate click. When there are
   * none, it renders as a hint instead of a row — the input value already *is*
   * the field value here, so a lone "Add X" row would be a button that commits
   * what is already committed, and it would sit in the list forever because
   * nothing distinguishes "still typing" from "settled".
   */
  creatable?: boolean
  createLabel?: (query: string) => React.ReactNode
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

const CREATE_META = Symbol("create")

/*
Free-text field with suggestions. Unlike a combobox, the input value *is* the
value — nothing forces it to be one of the options.

    <DataAutocomplete
      value={name}
      onValueChange={setName}
      onSelect={(o) => link(o.meta)}
      groups={groups}
      onSearch={setQuery}
      creatable
    />
*/

export default function DataAutocomplete<TMeta = unknown>({
  value,
  onValueChange,
  onSelect,
  options,
  groups,
  onSearch,
  creatable,
  createLabel: createLabelProp,
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
}: DataAutocompleteProps<TMeta>) {
  // Resolved here rather than as a destructuring default: React Compiler
  // cannot safely reorder an ArrowFunctionExpression used as a default value
  // in a destructuring pattern (BuildHIR::node.lowerReorderableExpression).
  // `=== undefined` (not `??`), to match a destructuring default's actual
  // semantics — a default fires only on undefined, not on null too.
  const createLabel =
    createLabelProp === undefined
      ? (q: string) => `Add “${q}”`
      : createLabelProp

  const searchRef = React.useRef(onSearch)
  searchRef.current = onSearch

  const debounced = useDebounce(value.trim(), { wait: debounceMs })

  // Fires for the empty string too, so clearing the field resets the caller's
  // query instead of leaving stale suggestions from the previous term.
  React.useEffect(() => {
    searchRef.current?.(debounced)
  }, [debounced])

  const flat = React.useMemo(
    () => (groups ? groups.flatMap((g) => g.options) : (options ?? [])),
    [groups, options]
  )

  const query = value.trim()
  const isNovel =
    Boolean(creatable) &&
    query.length > 0 &&
    !flat.some((o) => o.value === query)
  // As a row only when it competes with real suggestions; otherwise as a hint.
  const showCreate = isNovel && flat.length > 0
  const showCreateHint = isNovel && flat.length === 0

  const createOption = React.useMemo(
    () =>
      ({
        value: query,
        meta: CREATE_META,
      }) as unknown as DataAutocompleteOption<TMeta>,
    [query]
  )

  type ItemGroup = {
    label: string
    items: Array<DataAutocompleteOption<TMeta>>
  }

  // `readonly any[]` is the precision the primitive itself declares: it accepts
  // a flat array OR an array of groups and discriminates at runtime, which a
  // single generic parameter can't express. The typed surface is the `options`
  // / `groups` props and renderItem — this is only the handoff.
  const items = React.useMemo<ReadonlyArray<any>>(() => {
    const createGroup: ItemGroup = { label: "", items: [createOption] }
    if (groups) {
      const mapped: Array<ItemGroup> = groups.map((g) => ({
        label: g.label,
        items: g.options,
      }))
      return showCreate ? [...mapped, createGroup] : mapped
    }
    const base = options ?? []
    if (!showCreate) return base
    // A flat list plus a create row still has to be grouped, because Base UI
    // reads grouped and ungrouped item arrays differently.
    return [{ label: "", items: base }, createGroup]
  }, [groups, options, showCreate, createOption])

  const grouped = Boolean(groups) || showCreate

  const renderItem = (option: DataAutocompleteOption<TMeta>) => {
    const isCreate = (option.meta as unknown) === CREATE_META
    return (
      <AutocompleteItem key={option.value} value={option}>
        {isCreate ? (
          <span className="flex items-center gap-2">
            <PlusIcon />
            {createLabel(option.value)}
          </span>
        ) : (
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{option.value}</span>
            {option.description && (
              <span className="truncate text-xs text-muted-foreground">
                {option.description}
              </span>
            )}
          </span>
        )}
      </AutocompleteItem>
    )
  }

  return (
    <Autocomplete
      items={items}
      // Suggestions arrive pre-filtered from the server; re-filtering here
      // would drop matches made on a field the typed text doesn't contain.
      filter={null}
      mode="none"
      value={value}
      onValueChange={(next, details) => {
        // `reason` makes the two paths unambiguous, so no caller has to undo a
        // typed-edit side effect after a selection lands.
        if (details.reason === "item-press") {
          const picked = flat.find((o) => o.value === next)
          onValueChange(next)
          if (picked) onSelect?.(picked)
          return
        }
        onValueChange(next)
      }}
      disabled={disabled}
    >
      <AutocompleteInput
        id={id}
        name={name}
        onBlur={onBlur}
        aria-invalid={ariaInvalid}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        size="lg"
        className={cn("w-full", className)}
      />
      <AutocompleteContent>
        <AutocompleteEmpty>
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <SpinnerIcon className="size-4 animate-spin" />
              Searching…
            </span>
          ) : showCreateHint ? (
            createLabel(query)
          ) : (
            emptyMessage
          )}
        </AutocompleteEmpty>
        <AutocompleteList>
          {grouped
            ? (group: {
                label: string
                items: Array<DataAutocompleteOption<TMeta>>
              }) => (
                <AutocompleteGroup key={group.label} items={group.items}>
                  {group.label && (
                    <AutocompleteGroupLabel>
                      {group.label}
                    </AutocompleteGroupLabel>
                  )}
                  <AutocompleteCollection>{renderItem}</AutocompleteCollection>
                </AutocompleteGroup>
              )
            : renderItem}
        </AutocompleteList>
      </AutocompleteContent>
    </Autocomplete>
  )
}
