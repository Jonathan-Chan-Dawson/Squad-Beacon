import { useNow } from "@/src/shared/useNow";
import React, { useState } from "react";
import { View } from "react-native";
import DateField from "@/components/DateField";
import { Button, Sheet, Txt } from "@/src/shared/ui";
import { DurationControl } from "@/src/shared/DurationControl";
import { timingMinutes } from "@/src/shared/dateTime";
import { localDate } from "@/src/shared/domain";
import { addLocalDays } from "@/src/features/plans/routines";
import { planLocalDateTimeToISO } from "@/src/features/plans/domain";

type Props = {
  visible: boolean;
  starts: string;
  ends: string;
  timezone: string;
  when?: string;
  quickStarts?: boolean;
  onClose(): void;
  onDone(value: {
    starts: string;
    ends: string;
    when: string;
    minutes: number;
  }): void;
};

/** One staged session shared by new and existing Beacons. Dismissal never applies edits. */
export function BeaconTimingEditor(props: Props) {
  return props.visible ? <TimingSession {...props} /> : null;
}

function TimingSession({
  starts,
  ends,
  when = "Pick time",
  timezone,
  onClose,
  onDone,
  quickStarts = true,
}: Props) {
  const now = useNow();
  const [begin, setBegin] = useState(starts);
  const [choice, setChoice] = useState(when);
  const [minutes, setMinutes] = useState(() => timingMinutes(starts, ends));
  const [dateValid, setDateValid] = useState(
    Number.isFinite(Date.parse(starts)),
  );
  const valid =
    dateValid &&
    Number.isFinite(Date.parse(begin)) &&
    Number.isInteger(minutes) &&
    minutes > 0 &&
    Number.isFinite(new Date(Date.parse(begin) + minutes * 60000).getTime());
  const end = valid
    ? new Date(Date.parse(begin) + minutes * 60000).toISOString()
    : "";
  const choose = (value: string) => {
    setDateValid(true);
    setChoice(value === "Now" || value === "In 30 min" ? value : "Pick time");
    setBegin(
      value === "Tomorrow"
        ? planLocalDateTimeToISO(
            addLocalDays(localDate(new Date(now), timezone), 1),
            "17:00",
            timezone,
          )
        : new Date(
            now +
              (value === "In 30 min"
                ? 1800000
                : value === "Later today"
                  ? 3600000
                  : 0),
          ).toISOString(),
    );
  };
  return (
    <Sheet
      title="When shall we?"
      visible
      centered
      onClose={onClose}
      footer={
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button secondary title="Cancel" onPress={onClose} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Done"
              disabled={!valid}
              onPress={() => {
                if (valid)
                  onDone({ starts: begin, ends: end, when: choice, minutes });
              }}
            />
          </View>
        </View>
      }
    >
      <View style={{ gap: 14 }}>
        {quickStarts && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {["Now", "In 30 min", "Later today", "Tomorrow"].map((value) => (
              <Button
                key={value}
                compact
                secondary
                title={value}
                onPress={() => choose(value)}
              />
            ))}
          </View>
        )}
        <DateField
          label="Starts"
          value={begin}
          timezone={timezone}
          onValidityChange={setDateValid}
          onChange={(value) => {
            setBegin(value);
            setChoice("Pick time");
          }}
        />
        <DurationControl value={minutes} onChange={setMinutes} />
        {valid && (
          <Txt>
            {new Date(begin).toLocaleString(undefined, {
              timeZone: timezone,
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            –{" "}
            {new Date(end).toLocaleString(undefined, {
              timeZone: timezone,
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </Txt>
        )}
      </View>
    </Sheet>
  );
}
