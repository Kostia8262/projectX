import { listChapters } from "@/lib/content/store";

// Public, read-only — every visitor needs this to render story mode (see
// hooks/useChapters.ts), not just admins. Same reasoning as
// /api/games/overrides: nothing sensitive, just narrative content.
export async function GET() {
  const chapters = await listChapters();
  return Response.json({ chapters });
}
