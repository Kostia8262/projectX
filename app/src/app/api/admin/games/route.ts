import { requireAdminSession } from "@/lib/admin/session";
import { GAMES, type GameOverride, type GameStatus } from "@/lib/games/registry";
import { clearGameOverride, getGameOverrides, setGameOverride } from "@/lib/shop/store";

const STATUS_VALUES: GameStatus[] = ["available", "coming-soon"];

// Only the fields games/registry.ts's GameOverride allows — everything else
// (id, implementIds, mechanic) is structural and stays code-only, see the
// comment on GameOverride itself for why.
function parsePatch(body: unknown): GameOverride | null {
  if (typeof body !== "object" || body === null) return null;
  const raw = body as Record<string, unknown>;
  const patch: GameOverride = {};

  if ("status" in raw) {
    if (typeof raw.status !== "string" || !STATUS_VALUES.includes(raw.status as GameStatus)) return null;
    patch.status = raw.status as GameStatus;
  }
  if ("title" in raw) {
    if (typeof raw.title !== "string" || !raw.title.trim()) return null;
    patch.title = raw.title;
  }
  if ("tagline" in raw) {
    if (typeof raw.tagline !== "string" || !raw.tagline.trim()) return null;
    patch.tagline = raw.tagline;
  }
  if ("description" in raw) {
    if (typeof raw.description !== "string" || !raw.description.trim()) return null;
    patch.description = raw.description;
  }
  if ("maxHeat" in raw) {
    if (typeof raw.maxHeat !== "number" || !Number.isFinite(raw.maxHeat) || raw.maxHeat <= 0) return null;
    patch.maxHeat = raw.maxHeat;
  }

  return patch;
}

export async function GET() {
  const admin = await requireAdminSession();
  if (!admin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const overrides = await getGameOverrides();
  return Response.json({ games: GAMES, overrides });
}

export async function POST(request: Request) {
  const admin = await requireAdminSession();
  if (!admin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const gameId = typeof (body as { gameId?: unknown })?.gameId === "string" ? (body as { gameId: string }).gameId : null;
  if (!gameId || !GAMES.some((g) => g.id === gameId)) {
    return Response.json({ error: "Unknown gameId" }, { status: 404 });
  }

  const patch = parsePatch((body as { patch?: unknown })?.patch);
  if (!patch || Object.keys(patch).length === 0) {
    return Response.json({ error: "Invalid or empty patch" }, { status: 400 });
  }

  const override = await setGameOverride(admin.address, gameId, patch);
  return Response.json({ override });
}

export async function DELETE(request: Request) {
  const admin = await requireAdminSession();
  if (!admin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("gameId");
  if (!gameId || !GAMES.some((g) => g.id === gameId)) {
    return Response.json({ error: "Unknown gameId" }, { status: 404 });
  }

  await clearGameOverride(admin.address, gameId);
  return Response.json({ ok: true });
}
