import React from "react";
import DateField from "@/components/DateField";
import type { DateTimeFieldProps } from "@/src/shared/dateTime";

/** Compatibility name for the shared instant/timezone field. */
export function CreationDateField(props: DateTimeFieldProps) { return <DateField {...props} />; }
