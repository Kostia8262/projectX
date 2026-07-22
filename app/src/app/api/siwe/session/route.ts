import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return Response.json({ session: null });
  }
  const session = await verifySessionToken(token);
  return Response.json({ session });
}
