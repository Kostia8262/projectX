import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { requireAdminRole } from "@/lib/admin/session";
import { canEditGames } from "@/lib/admin/roles";

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 5 * 1024 * 1024;

// Saves straight to public/ so Next's own static file serving hands it back
// out — no separate streaming route needed (unlike api/rewards/asset, this
// isn't gated content). Written at request time, same runtime-write pattern
// already used for .data/*.json (see lib/shop/store.ts) — this project has
// no build step that would need to know about it in advance.
export async function POST(request: Request) {
  const admin = await requireAdminRole(canEditGames);
  if (!admin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file" }, { status: 400 });
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return Response.json({ error: "Unsupported image type" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `${randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "chapters");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), bytes);

  return Response.json({ url: `/uploads/chapters/${filename}` });
}
