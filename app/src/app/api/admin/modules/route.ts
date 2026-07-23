import { requireAdminSession, requireAdminRole } from "@/lib/admin/session";
import { canEditGames } from "@/lib/admin/roles";
import { isModuleId } from "@/lib/modules";
import { getDisabledModules, setModuleEnabled } from "@/lib/shop/store";

export async function GET() {
  const admin = await requireAdminSession();
  if (!admin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const disabled = await getDisabledModules();
  return Response.json({ disabled });
}

export async function POST(request: Request) {
  const admin = await requireAdminRole(canEditGames);
  if (!admin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const moduleId = (body as { moduleId?: unknown })?.moduleId;
  const enabled = (body as { enabled?: unknown })?.enabled;
  if (!isModuleId(moduleId) || typeof enabled !== "boolean") {
    return Response.json({ error: "Invalid moduleId or enabled" }, { status: 400 });
  }

  await setModuleEnabled(admin.address, moduleId, enabled);
  return Response.json({ ok: true });
}
