import React from "react";
import { Field } from "@/src/ui";
export default function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field
      label={label + " · ISO date/time with offset"}
      value={value}
      onChangeText={onChange}
      placeholder="2026-09-07T18:00:00-05:00"
    />
  );
}
