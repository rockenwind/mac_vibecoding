export function requireAdminToken(request: Request): Response | null {
  const configuredToken = process.env.SCAN_ADMIN_TOKEN?.trim();

  if (!configuredToken) {
    return null;
  }

  const providedToken = readBearerToken(request);
  if (providedToken !== configuredToken) {
    return Response.json({ error: "Admin token is required." }, { status: 401 });
  }

  return null;
}

function readBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization")?.trim();
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}
