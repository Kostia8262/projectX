import { requireAdminSession } from "@/lib/admin/session";
import { getAdminDiagnostics } from "@/lib/admin/diagnostics";

export async function GET() {
  const admin = await requireAdminSession();
  if (!admin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const diagnostics = await getAdminDiagnostics();
  return Response.json(diagnostics);
}
