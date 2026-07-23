import { getGameOverrides } from "@/lib/shop/store";

// Public, read-only — every visitor needs this to render the correct game
// list/copy (see hooks/useGameOverrides.ts), not just admins. Nothing
// sensitive in it: just which games are shown/hidden and their edited copy.
export async function GET() {
  const overrides = await getGameOverrides();
  return Response.json({ overrides });
}
