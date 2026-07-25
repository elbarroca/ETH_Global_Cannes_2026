import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface GitHubTopic {
  name: string;
  display_name: string | null;
  short_description: string | null;
  featured: boolean;
  curated: boolean;
}

interface GitHubTopicSearchResponse {
  total_count: number;
  items: GitHubTopic[];
}

// GET /api/marketplace/skills?q={keywords}
// Returns top GitHub topic slugs matching the query, suitable for use as
// agent capability tags. Public GitHub Search Topics API — no auth required.
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";

  if (!q || q.length < 2) {
    return NextResponse.json({ skills: [] });
  }

  // Sanitize: keep only words, strip special chars
  const sanitized = q
    .slice(0, 120)
    .replace(/[^a-zA-Z0-9 \-_]/g, " ")
    .trim();

  if (!sanitized) {
    return NextResponse.json({ skills: [] });
  }

  try {
    const ghUrl = `https://api.github.com/search/topics?q=${encodeURIComponent(sanitized)}&per_page=10`;
    const response = await fetch(ghUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "AlphaDawg-Marketplace/1.0",
      },
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      // Rate-limited or unavailable — return empty gracefully
      return NextResponse.json({ skills: [], rateLimited: response.status === 403 });
    }

    const data = (await response.json()) as GitHubTopicSearchResponse;

    const skills = (data.items ?? [])
      .slice(0, 5)
      .map((item) => ({
        slug: item.name,
        label: item.display_name ?? item.name,
        description: item.short_description ?? null,
        featured: item.featured,
      }));

    return NextResponse.json({ skills, total: data.total_count });
  } catch {
    return NextResponse.json({ skills: [] });
  }
}
