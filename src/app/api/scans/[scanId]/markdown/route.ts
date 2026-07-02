import { buildScanMarkdown } from "@/lib/reports/markdown";
import { readScanHistory } from "@/lib/scanHistory/store";

type RouteContext = {
  params: Promise<{ scanId: string }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { scanId } = await context.params;
    const history = await readScanHistory();
    const entry = history.find((candidate) => candidate.scan.id === scanId);

    if (!entry) {
      return Response.json({ error: "Scan not found." }, { status: 404 });
    }

    return new Response(buildScanMarkdown(entry.scan), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${entry.scan.id}.md"`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not export scan report.";
    return Response.json({ error: message }, { status: 500 });
  }
}
