import { getUserDetails } from "@/server/dashboard/data";
import { withAdminData } from "@/server/dashboard/http";

export async function GET(request: Request, context: RouteContext<"/api/admin/users/[uid]">): Promise<Response> {
  const { uid } = await context.params;
  return withAdminData(request, () => getUserDetails(uid));
}

export const POST = unsupported;
export const PUT = unsupported;
export const PATCH = unsupported;
export const DELETE = unsupported;

function unsupported(): Response {
  return Response.json({ version: 1, code: "method-not-allowed" }, { status: 405, headers: { Allow: "GET", "Cache-Control": "private, no-store" } });
}
