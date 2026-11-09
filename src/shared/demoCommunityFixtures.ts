import type { Data, SquadIconKey } from "./types";

type DemoCommunity = {
  id: string;
  joined?: boolean;
  owner: string;
  member: string;
  icon: SquadIconKey;
  request?: boolean;
  network: readonly [string, string];
  organization: readonly [string, string];
  squad: readonly [string, string];
};

const communities: readonly DemoCommunity[] = [
  {
    id: "printmakers",
    joined: true,
    owner: "maya",
    member: "jordan",
    icon: "sparkles",
    network: [
      "Southside Makers Network",
      "Independent workshops sharing tools, teaching skills, and hosting open studio days.",
    ],
    organization: [
      "Riverbend Print Studio",
      "A neighborhood printmaking studio for screen printing, zines, and small editions.",
    ],
    squad: [
      "Sunday Print Club",
      "An easygoing Sunday session for swapping ink, carving blocks, and making prints together.",
    ],
  },
  {
    id: "music",
    joined: true,
    owner: "jordan",
    member: "sam",
    icon: "music",
    network: [
      "West Side Music Exchange",
      "Community music groups sharing rehearsal space, instruments, and local shows.",
    ],
    organization: [
      "West Loop Rehearsal Co-op",
      "A shared practice space for singers, instrumentalists, and anyone finding their sound.",
    ],
    squad: [
      "Thursday Jam Crew",
      "Low-pressure jam sessions. Bring an instrument, a song idea, or just your ears.",
    ],
  },
  {
    id: "food",
    owner: "sam",
    member: "maya",
    icon: "coffee",
    network: [
      "South Loop Food Collective",
      "Home cooks, community kitchens, and food clubs trading skills and recipes.",
    ],
    organization: [
      "Roosevelt Community Kitchen",
      "A shared kitchen for cooking classes, potlucks, and neighborhood recipe swaps.",
    ],
    squad: [
      "Sunday Supper Club",
      "Cook one dish, bring it to the table, and leave with a recipe from someone new.",
    ],
  },
  {
    id: "outdoors",
    owner: "maya",
    member: "sam",
    icon: "fitness",
    request: true,
    network: [
      "Trailhead Chicago",
      "Local groups making it easier to get outdoors without a car or a lot of gear.",
    ],
    organization: [
      "River Trail Stewards",
      "Neighbors who care for trailheads and lead beginner-friendly walks.",
    ],
    squad: [
      "Sunrise Trail Walkers",
      "Short walks before the city wakes up, with plenty of time to stop and take pictures.",
    ],
  },
  {
    id: "books",
    owner: "jordan",
    member: "maya",
    icon: "study",
    network: [
      "West Branch Reading Network",
      "Book clubs and neighborhood libraries connecting readers across the city.",
    ],
    organization: [
      "West Branch Reading Room",
      "A welcoming space for shared reading, author talks, and a free book shelf.",
    ],
    squad: [
      "Quiet Chapter Club",
      "Read whatever you like together for an hour, then trade recommendations.",
    ],
  },
  {
    id: "games",
    owner: "sam",
    member: "jordan",
    icon: "gaming",
    request: true,
    network: [
      "Tabletop Commons",
      "Local game groups sharing tables, lending games, and welcoming first-time players.",
    ],
    organization: [
      "West Town Game Library",
      "A lending library and play space for board games, card games, and short campaigns.",
    ],
    squad: [
      "Wednesday One-Shots",
      "Short tabletop adventures that wrap up in one evening. New players are welcome.",
    ],
  },
];

export function addDemoCommunityFixtures(
  data: Data,
  viewer: string,
  now: number,
) {
  if (!data.is_demo || data.viewer_id !== viewer) return;
  const created_at = new Date(now - 30 * 86400000).toISOString();
  for (const community of communities) {
    const { id, owner: owner_id, member, joined } = community;
    const join_mode = community.request ? "request" : "open";
    const shared = {
      owner_id,
      discoverability: "public",
      join_mode,
      invite_policy: "admins",
    } as const;
    const organization_id = `demo-network-${id}`;
    const space_id = `demo-organization-${id}`;
    const squad_id = `demo-squad-${id}`;
    const [networkName, networkDescription] = community.network;
    const [organizationName, organizationDescription] = community.organization;
    const [squadName, squadDescription] = community.squad;
    data.organizations.push({
      ...shared,
      id: organization_id,
      name: networkName,
      description: networkDescription,
      created_at,
    });
    data.spaces.push({
      ...shared,
      id: space_id,
      name: organizationName,
      description: organizationDescription,
      space_type: "interest",
      created_at,
    });
    data.squads.push({
      ...shared,
      id: squad_id,
      name: squadName,
      description: squadDescription,
      icon_key: community.icon,
    });

    const people = [
      { user_id: owner_id, role: "owner" as const },
      { user_id: member, role: "member" as const },
      ...(joined ? [{ user_id: viewer, role: "member" as const }] : []),
    ];
    for (const person of people) {
      const active = {
        ...person,
        status: "active" as const,
        invited_by: person.user_id === owner_id ? null : owner_id,
        created_at,
      };
      if (person.role !== "owner")
        data.organization_members.push({
          organization_id,
          ...active,
          role: person.role,
        });
      data.space_members.push({ space_id, ...active });
      data.squad_members.push({ squad_id, ...person });
    }
    const link = { added_by: owner_id, created_at };
    data.organization_spaces.push({ organization_id, space_id, ...link });
    data.space_squads.push({ space_id, squad_id, ...link });
  }
}
