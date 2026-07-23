import { requireAdminSession } from "@/lib/admin/session";
import { getAdminLog } from "@/lib/shop/store";

export async function GET() {
  const admin = await requireAdminSession();
  if (!admin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const log = await getAdminLog(100);
  return Response.json({ log });
}
