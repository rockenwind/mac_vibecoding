import { readScanHistory } from "@/lib/scanHistory/store";
import { runRepositoryScan, scanErrorResponse } from "@/lib/scans/runRepositoryScan";

export async function GET(): Promise<Response> {
  try {
    const history = await readScanHistory();
    return Response.json({ history });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read scan history.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { repositoryUrl?: unknown; installationId?: unknown };

    if (typeof body.repositoryUrl !== "string") {
      return Response.json({ error: "repositoryUrl must be a string." }, { status: 400 });
    }

    const { scan, history, comparison } = await runRepositoryScan({
      repositoryUrl: body.repositoryUrl,
      installationId: body.installationId
    });

    return Response.json({ scan, history, comparison });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed.";
    const { status, action } = scanErrorResponse(message);
    return Response.json({ error: message, ...(action ? { action } : {}) }, { status });
  }
}
