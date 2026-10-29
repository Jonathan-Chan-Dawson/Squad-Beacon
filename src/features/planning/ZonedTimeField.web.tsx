import React from "react";
import DateField from "@/components/DateField";
import type { DateTimeFieldProps } from "@/src/shared/dateTime";

/** Convert wall time once, inside the shared field; callers retain ISO instants. */
export default function ZonedTimeField(props: DateTimeFieldProps) { return <DateField {...props} />; }
