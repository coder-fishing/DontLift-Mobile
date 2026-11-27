import { getOrdersPage } from "@/server/dashboard/data";
import { withAdminData } from "@/server/dashboard/http";

export function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  return withAdminData(request, () => getOrdersPage(url));
}

export const POST = unsupported;
export const PUT = unsupported;
export const PATCH = unsupported;
export const DELETE = unsupported;

function unsupported(): Response {
  return Response.json({ version: 1, code: "method-not-allowed" }, { status: 405, headers: { Allow: "GET", "Cache-Control": "private, no-store" } });
}
