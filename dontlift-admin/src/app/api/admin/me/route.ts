import { requireAdmin } from "@/server/auth/require-admin";
import {
  adminErrorResponse,
  adminJsonResponse,
  invalidAdminRequestResponse,
  methodNotAllowedResponse,
} from "@/server/http/admin-response";

export async function GET(request: Request): Promise<Response> {
  try {
    const identity = await requireAdmin(request);
    const url = new URL(request.url);
    if (url.search.length > 0 || request.body !== null) {
      return invalidAdminRequestResponse();
    }
    return adminJsonResponse({
      version: 1,
      data: {
        uid: identity.uid,
        admin: true,
        email: identity.email,
        displayName: identity.displayName,
      },
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export const POST = methodNotAllowedResponse;
export const PUT = methodNotAllowedResponse;
export const PATCH = methodNotAllowedResponse;
export const DELETE = methodNotAllowedResponse;
export const OPTIONS = methodNotAllowedResponse;
export const HEAD = methodNotAllowedResponse;
