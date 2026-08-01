import * as React from "react"
import type { DataAutocompleteGroup } from "@/components/custom/data/autocomplete"
import DataAutocomplete from "@/components/custom/data/autocomplete"
import { useDebounced } from "@/lib/hooks/use-debounced"
import { useParticipantSuggestions } from "@/services/badminton/queries"

/** Below this the server match is too broad to be useful. */
const MIN_QUERY = 2

/** Identity carried on each suggestion — a guest has no account behind it. */
type Suggestion = { userId?: string }

interface PlayerNameInputProps {
  value: string
  /** Free-text edit — clears any linked account, since the name no longer matches it. */
  onValueChange: (name: string) => void
  /** A registered user was picked: link the participant to that account. */
  onPickUser: (userId: string, name: string) => void
  id?: string
  name?: string
  onBlur?: () => void
  "aria-invalid"?: boolean
}

/**
 * Name field for a player row: free text, with suggestions drawn from the
 * organizer's own past guests plus registered accounts. Picking an account
 * links the participant to it; typing anything else stays a guest.
 */
export function PlayerNameInput({
  value,
  onValueChange,
  onPickUser,
  id,
  name,
  onBlur,
  "aria-invalid": ariaInvalid,
}: PlayerNameInputProps) {
  const [query, setQuery] = React.useState("")
  // Debounced, so a request is sent per typing pause rather than per keystroke.
  // Undebounced, "Nguyen" keyed six separate queries — each one a real round
  // trip counted against the API's per-IP rate limit, which two players' worth
  // of typing was enough to exhaust.
  const debouncedQuery = useDebounced(query, 300)
  const enabled = debouncedQuery.length >= MIN_QUERY
  const { data, isFetching } = useParticipantSuggestions(debouncedQuery, enabled)

  const groups = React.useMemo<Array<DataAutocompleteGroup<Suggestion>>>(() => {
    if (!data) return []
    const out: Array<DataAutocompleteGroup<Suggestion>> = []

    // The account id travels on the option itself. Keying it by display name
    // would mislink whenever a guest happens to share a name with an account.
    //
    // flatMap, not map: a suggestion with no label is unpickable, so it is dropped
    // rather than rendered as a blank row. (The API used to produce these — see
    // ParticipantSuggestionSchema.)
    const userOptions = data.users.flatMap((u) =>
      u.name ? [{ value: u.name, meta: { userId: u.userId } }] : []
    )
    if (userOptions.length > 0) {
      out.push({ label: "Registered players", options: userOptions })
    }
    if (data.guests && data.guests.length > 0) {
      out.push({
        label: "Previous guests",
        options: data.guests.map((g) => ({ value: g, meta: {} })),
      })
    }
    return out
  }, [data])

  return (
    <DataAutocomplete<Suggestion>
      id={id}
      name={name}
      value={value}
      onValueChange={onValueChange}
      onSelect={(option) => {
        const userId = option.meta?.userId
        if (userId) onPickUser(userId, option.value)
        else onValueChange(option.value)
      }}
      onSearch={setQuery}
      groups={groups.length > 0 ? groups : undefined}
      creatable
      createLabel={(q) => `“${q}” will be saved as a guest`}
      loading={enabled && isFetching}
      placeholder="Name"
      emptyMessage={enabled ? "No matches" : "Type to search"}
      onBlur={onBlur}
      aria-invalid={ariaInvalid}
    />
  )
}
