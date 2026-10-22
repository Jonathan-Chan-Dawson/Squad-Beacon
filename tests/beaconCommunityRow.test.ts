import test from "node:test";
import assert from "node:assert/strict";
import { compactCommunityMembershipPresentation } from "../src/features/discovery/communityRowPresentation";
import type { SocialDirectorySummary } from "../src/features/social/types";

function summary(
  action: SocialDirectorySummary["action"],
  entity_type: SocialDirectorySummary["entity_type"] = "squad",
): SocialDirectorySummary {
  return {
    entity_type,
    entity_id: "community-1",
    name: "Community",
    description: "",
    discoverability: "public",
    join_mode: "open",
    member_count: 1,
    child_count: 0,
    membership_status: null,
    action,
    parent_type: null,
    parent_id: null,
    parent_name: null,
  };
}

test("compact community actions identify each open community type", () => {
  assert.equal(
    compactCommunityMembershipPresentation(summary("join", "squad"))
      .actionTitle,
    "Join Squad",
  );
  assert.equal(
    compactCommunityMembershipPresentation(summary("join", "space"))
      .actionTitle,
    "Join Organization",
  );
  assert.equal(
    compactCommunityMembershipPresentation(summary("join", "organization"))
      .actionTitle,
    "Join Network",
  );
});

test("compact request and invitation actions are shown only for canonical eligible summaries", () => {
  assert.deepEqual(compactCommunityMembershipPresentation(summary("request")), {
    actionTitle: "Request to Join Squad",
    status: null,
  });
  assert.deepEqual(compactCommunityMembershipPresentation(summary("invited")), {
    actionTitle: "Accept Invite",
    status: null,
  });
  assert.deepEqual(
    compactCommunityMembershipPresentation(summary("invite_required")),
    { actionTitle: null, status: null },
  );
});

test("joined and requested compact rows show status without another membership action", () => {
  assert.deepEqual(compactCommunityMembershipPresentation(summary("joined")), {
    actionTitle: null,
    status: "joined",
  });
  assert.deepEqual(
    compactCommunityMembershipPresentation(summary("requested")),
    { actionTitle: null, status: "requested" },
  );
});
