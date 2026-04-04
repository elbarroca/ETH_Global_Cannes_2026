import { NextResponse } from "next/server";
import { updateSpecialistReputation } from "@/src/marketplace/reputation";

/**
 * POST /api/marketplace/rate
 * Body: { agentName: string, positive: boolean }
 *
 * User thumbs-up/down on a specialist after seeing their analysis in a hunt
 * card. Feeds into the existing ELO reputation system.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      agentName?: string;
      positive?: boolean;
    };

    if (!body.agentName || typeof body.positive !== "boolean") {
      return NextResponse.json(
        { error: "agentName (string) and positive (boolean) required" },
        { status: 400 },
      );
    }

    const newReputation = await updateSpecialistReputation(
      body.agentName,
      body.positive,
    );

    return NextResponse.json({ agentName: body.agentName, reputation: newReputation });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
