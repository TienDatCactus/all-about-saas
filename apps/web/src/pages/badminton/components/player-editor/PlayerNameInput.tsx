import DataCombobox, {
  type DataComboboxGroup,
} from "@/components/custom/data/combobox";
import { useParticipantSuggestions } from "@/services/badminton/queries";
import * as React from "react";
/** Below this the server match is too broad to be useful. */
const MIN_QUERY = 2;

interface PlayerNameInputProps {
  value: string;
  /** Free-text edit — clears any linked account, since the name no longer matches it. */
  onValueChange: (name: string) => void;
  /** A registered user was picked: link the participant to that account. */
  onPickUser: (userId: string, name: string) => void;
  id?: string;
  name?: string;
  onBlur?: () => void;
  "aria-invalid"?: boolean;
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
  const [query, setQuery] = React.useState("");
  const enabled = query.length >= MIN_QUERY;
  const { data, isFetching } = useParticipantSuggestions(query, enabled);

  // Registered accounts are keyed by userId so picking one can link it; guests
  // are plain names this organizer has used before.
  const userIds = React.useRef(new Map<string, string>());
  const groups = React.useMemo<DataComboboxGroup[]>(() => {
    userIds.current = new Map();
    if (!data) return [];

    const out: DataComboboxGroup[] = [];
    if (data.users.length > 0) {
      for (const u of data.users) userIds.current.set(u.name, u.userId);
      out.push({
        label: "Registered players",
        options: data.users.map((u) => ({ value: u.name })),
      });
    }
    if (data.guests.length > 0) {
      out.push({
        label: "Previous guests",
        options: data.guests.map((g) => ({ value: g })),
      });
    }
    return out;
  }, [data]);

  return (
    <DataCombobox
      id={id}
      name={name}
      value={value}
      onValueChange={onValueChange}
      onSelect={(option) => {
        const userId = userIds.current.get(option.value);
        if (userId) onPickUser(userId, option.value);
      }}
      onSearch={setQuery}
      groups={groups.length > 0 ? groups : undefined}
      loading={isFetching}
      placeholder="Name"
      emptyMessage={
        enabled ? "No matches — keep typing to add a guest" : "Type to search"
      }
      onBlur={onBlur}
      aria-invalid={ariaInvalid}
    />
  );
}
