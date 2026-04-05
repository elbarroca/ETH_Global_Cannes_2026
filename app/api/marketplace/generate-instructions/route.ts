import { NextResponse } from "next/server";
import { sealedInference } from "@/src/og/inference";
import { OG_PROVIDER } from "@/src/config/og-compute";
import { PROMPTS } from "@/src/agents/prompts";

export const runtime = "nodejs";

interface GenerateRequestBody {
  name?: string;
  description?: string;
}

interface GenerateResponseBody {
  markdown: string;
  reasoning: string;
  attestationHash: string | null;
  teeVerified: boolean;
  fallback: boolean;
}

/**
 * Extract a fenced ```markdown ... ``` block from a 7B model's response.
 * If no fence is found, returns the whole trimmed string as a best-effort
 * fallback so the UI always has something to display.
 */
function extractMarkdownBlock(raw: string): { markdown: string; reasoning: string } {
  const trimmed = raw.trim();
  const fenced = /```(?:markdown)?\s*\n([\s\S]*?)```/i.exec(trimmed);
  if (fenced && fenced[1]) {
    const markdown = fenced[1].trim();
    const reasoning = trimmed.slice(0, fenced.index).trim();
    return { markdown, reasoning };
  }
  return { markdown: trimmed, reasoning: "" };
}

/**
 * Deterministic fallback used when the 0G provider is unreachable or the
 * model's response is empty. Keeps the UX unblocked — the user can still
 * deploy a spec crafted from their own input.
 */
function fallbackMarkdown(name: string, description: string): string {
  const cleanName = name.trim() || "Specialist";
  const cleanDesc = description.trim() || "an on-chain crypto analyst";
  return `# ${cleanName}

## Soul
I am ${cleanName}. ${cleanDesc} — that's my single focus. I read the signal, I cite the numbers, I state my conviction. When the data is thin I say HOLD; when it converges I call it with confidence. No hype, no hedging.

## Identity
- **Name:** ${cleanName}
- **Role:** ${cleanDesc}
- **Specialty:** on-chain analysis, market intelligence
- **Hired via:** x402 nanopayment ($0.001 per query)

## Output Format
First 2-4 sentences of reasoning, then a JSON object:
\`{"signal":"BUY|SELL|HOLD","confidence":0-100,"reasoning":"one sentence"}\`

## Data Sources
- Real-time CoinGecko price + sentiment feeds
- Etherscan gas + top-volume tracking
- AlphaDawg universe table
`;
}

export async function POST(req: Request) {
  let body: GenerateRequestBody;
  try {
    body = (await req.json()) as GenerateRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const description = (body.description ?? "").trim();

  if (!name || name.length < 2 || name.length > 40) {
    return NextResponse.json({ error: "Name must be 2-40 characters" }, { status: 400 });
  }
  if (!description || description.length < 10 || description.length > 800) {
    return NextResponse.json(
      { error: "Description must be 10-800 characters" },
      { status: 400 },
    );
  }

  const userMessage = `NAME: ${name}\n\nDESCRIPTION: ${description}`;

  if (!OG_PROVIDER) {
    const md = fallbackMarkdown(name, description);
    const payload: GenerateResponseBody = {
      markdown: md,
      reasoning: "",
      attestationHash: null,
      teeVerified: false,
      fallback: true,
    };
    return NextResponse.json(payload);
  }

  try {
    const result = await sealedInference(OG_PROVIDER, PROMPTS.agentBuilder.content, userMessage);
    const { markdown, reasoning } = extractMarkdownBlock(result.content);

    // If the model returned nothing usable, fall back to the deterministic
    // template so the UI still has something to show.
    if (!markdown || markdown.length < 20) {
      const payload: GenerateResponseBody = {
        markdown: fallbackMarkdown(name, description),
        reasoning: reasoning || "",
        attestationHash: result.attestationHash || null,
        teeVerified: result.teeVerified,
        fallback: true,
      };
      return NextResponse.json(payload);
    }

    const payload: GenerateResponseBody = {
      markdown,
      reasoning,
      attestationHash: result.attestationHash || null,
      teeVerified: result.teeVerified,
      fallback: false,
    };
    return NextResponse.json(payload);
  } catch (err) {
    console.warn("[generate-instructions] Sealed inference failed:", err);
    const payload: GenerateResponseBody = {
      markdown: fallbackMarkdown(name, description),
      reasoning: "",
      attestationHash: null,
      teeVerified: false,
      fallback: true,
    };
    return NextResponse.json(payload);
  }
}
