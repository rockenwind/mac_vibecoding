import { Pool } from "pg";
import { getMarketSignalsDatabaseUrl } from "@/lib/marketSignals/config";
import { buildMarketSignals, type MarketJob } from "@/lib/marketSignals/signals";

export const dynamic = "force-dynamic";

type JobRow = {
  company: string | null;
  title: string;
  description: string;
  matched_keywords: unknown;
  first_seen_at: Date | string | null;
};

export async function GET() {
  const databaseUrl = getMarketSignalsDatabaseUrl();
  if (!databaseUrl) {
    return Response.json(buildMarketSignals([], new Date()));
  }

  const pool = new Pool({
    connectionString: databaseUrl
  });

  try {
    const result = await pool.query<JobRow>(
      `SELECT company, title, description, matched_keywords, first_seen_at
       FROM jobs
       WHERE first_seen_at >= NOW() - INTERVAL '30 days'
       ORDER BY first_seen_at DESC
       LIMIT 500`
    );

    return Response.json(buildMarketSignals(result.rows.map(toMarketJob), new Date()));
  } finally {
    await pool.end();
  }
}

function toMarketJob(row: JobRow): MarketJob {
  return {
    company: row.company,
    title: row.title,
    description: row.description,
    matchedKeywords: Array.isArray(row.matched_keywords)
      ? row.matched_keywords.filter((keyword): keyword is string => typeof keyword === "string")
      : [],
    firstSeenAt: row.first_seen_at
  };
}
