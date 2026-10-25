import React from "react";
import DateField from "./PlanningTimeField";
import { instantToWallField, wallTimeToInstant } from "./connected";
export default function ZonedTimeField({
  label,
  value,
  timezone,
  onChange,
}: {
  label: string;
  value: string;
  timezone: string;
  onChange: (value: string) => void;
}) {
  return (
    <DateField
      label={`${label} · ${timezone}`}
      value={instantToWallField(value, timezone)}
      onChange={(v) => onChange(wallTimeToInstant(v, timezone))}
    />
  );
}
