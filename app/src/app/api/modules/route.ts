import { getDisabledModules } from "@/lib/shop/store";

// Public, read-only — every visitor needs this to know which top-level
// pages (see lib/modules.ts) to hide, not just admins. Mirrors
// api/games/overrides's reasoning exactly.
export async function GET() {
  const disabled = await getDisabledModules();
  return Response.json({ disabled });
}
