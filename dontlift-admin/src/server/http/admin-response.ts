const commonHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Type": "application/json; charset=utf-8",
};

export function adminJsonResponse(data: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...commonHeaders, ...Object.fromEntries(new Headers(extraHeaders).entries()) },
  });
}

export function adminErrorResponse(error: unknown): Response {
  if (error && typeof error === "object" && "code" in error && "status" in error) {
    const status = error.status;
    const code = error.code;
    if (
      (status === 401 && code === "unauthenticated") ||
      (status === 403 && code === "forbidden") ||
      (status === 503 && code === "identity-unavailable")
    ) {
      return adminJsonResponse({ version: 1, code }, status);
    }
  }
  return adminJsonResponse({ version: 1, code: "internal-error" }, 500);
}

export function methodNotAllowedResponse(): Response {
  return adminErrorResponseWithAllow();
}

function adminErrorResponseWithAllow(): Response {
  return adminJsonResponse(
    { version: 1, code: "method-not-allowed" },
    405,
    { Allow: "GET" },
  );
}

export function invalidAdminRequestResponse(): Response {
  return adminJsonResponse({ version: 1, code: "invalid-request" }, 400);
}
