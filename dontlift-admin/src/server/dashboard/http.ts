import "server-only";

import { requireAdmin } from "@/server/auth/require-admin";
import { adminErrorResponse, adminJsonResponse } from "@/server/http/admin-response";
import { DashboardDataError } from "./data";

export async function withAdminData<T>(request: Request, operation: () => Promise<T>): Promise<Response> {
  try {
    await requireAdmin(request);
    const data = await operation();
    return adminJsonResponse({ version: 1, data });
  } catch (error) {
    if (error instanceof DashboardDataError) {
      return adminJsonResponse({ version: 1, code: error.code }, error.status);
    }
    const identityResponse = adminErrorResponse(error);
    if (identityResponse.status !== 500) return identityResponse;
    return adminJsonResponse({ version: 1, code: "data-unavailable" }, 503);
  }
}
