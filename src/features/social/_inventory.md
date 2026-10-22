# Shared social-community contracts

- `types.ts`: common Organization, Space, and Squad discoverability, membership, roles, links, and directory summary contracts.
- `domain.ts`: shared role ranking, invite-policy eligibility, directory action/status derivation, and discoverability eligibility.
- `directory.ts`: bounded authenticated directory query normalization, safe summary projection, membership eligibility, and parent-context filtering.
- `SocialPolicyControls.tsx`: accessible create-time and settings controls for discoverability, joining, and invitation policy.
- Community membership and discovery are independently authorized by the backend; a parent/child link never implies membership or private child access.

- Prompt 2: CommunityProfileAccess provides exact-ID safe summaries and authorized relationship disclosures; directory.ts shares safe summary projection across Demo search and direct retrieval. community_profile_summary is an additive read-only RPC.

- communityPresentation.ts centralizes legacy entity display names; communityNavigation.ts opens canonical profile routes. CommunityProfileAccess refreshes exact summaries on focus and retains independent member authorization.
