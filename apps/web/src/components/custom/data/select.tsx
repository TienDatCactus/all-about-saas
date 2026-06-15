import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";

interface DataSelect {}

export function DataSelect({}: DataSelect) {
  return (
    <Select>
      <SelectTrigger>Open</SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>dat</SelectLabel>
          <SelectItem value="1">dat</SelectItem>
          <SelectItem value="1">dat</SelectItem>
          <SelectItem value="1">dat</SelectItem>
          <SelectItem value="1">dat</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
