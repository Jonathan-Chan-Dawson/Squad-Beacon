import type { Activity, Data, Profile } from "./types";
export type Period = "Active" | "Upcoming" | "Past";
export type SortOrder = "Soonest" | "Most momentum" | "Latest first" | "A to Z";
export function attendance(data: Data, a: Activity) {
  return (
    1 +
    data.rsvps.filter(
      (r) =>
        r.activity_id === a.id &&
        r.user_id !== a.owner_id &&
        r.status === "going",
    ).length
  );
}
export function browseBeacons(
  data: Data,
  userId: string,
  options: {
    period: Period;
    sort: SortOrder;
    query: string;
    category: string;
    audience: string;
    joined: boolean;
  },
  now: number,
) {
  return data.activities
    .filter((a) => {
      const ended = a.status !== "scheduled" || Date.parse(a.ends_at) <= now;
      if (
        options.period === "Past"
          ? !ended
          : ended ||
            (options.period === "Active"
              ? Date.parse(a.starts_at) > now
              : Date.parse(a.starts_at) <= now)
      )
        return false;
      if (
        options.category !== "All categories" &&
        a.category !== options.category
      )
        return false;
      if (
        options.audience !== "Everyone" &&
        a.audience !== options.audience.toLowerCase()
      )
        return false;
      if (
        options.joined &&
        a.owner_id !== userId &&
        !data.rsvps.some(
          (r) =>
            r.activity_id === a.id &&
            r.user_id === userId &&
            r.status === "going",
        )
      )
        return false;
      const owner = data.profiles.find((p) => p.id === a.owner_id);
      const place = data.places.find((p) => p.activity_id === a.id);
      return `${a.title} ${owner?.name ?? ""} ${place?.label ?? ""}`
        .toLowerCase()
        .includes(options.query.trim().toLowerCase());
    })
    .sort((a, b) => {
      if (options.sort === "Most momentum")
        return (
          attendance(data, b) - attendance(data, a) ||
          a.starts_at.localeCompare(b.starts_at) ||
          a.id.localeCompare(b.id)
        );
      if (options.sort === "A to Z")
        return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
      return (
        (options.sort === "Latest first" || options.period === "Past"
          ? -1
          : 1) * a.starts_at.localeCompare(b.starts_at) ||
        a.id.localeCompare(b.id)
      );
    });
}
export function crew(
  data: Data,
  a: Activity,
): { person: Profile; status: string }[] {
  return data.profiles.flatMap((person) => {
    if (person.id === a.owner_id)
      return [
        { person, status: a.mode === "solo" ? "Sharing a status" : "Hosting" },
      ];
    const r = data.rsvps.find(
      (r) => r.activity_id === a.id && r.user_id === person.id,
    );
    return r
      ? [
          {
            person,
            status:
              r.status === "interested"
                ? "Considering"
                : r.status === "requested"
                  ? "Pending approval"
                  : r.status === "going"
                    ? "Going"
                    : "Invited",
          },
        ]
      : [];
  });
}
export function canChat(data: Data, a: Activity, userId: string) {
  return (
    a.owner_id === userId ||
    data.rsvps.some(
      (r) =>
        r.activity_id === a.id &&
        r.user_id === userId &&
        r.status === "going" &&
        (!(a.approval_required || a.mode === "invite") || r.approved),
    )
  );
}
