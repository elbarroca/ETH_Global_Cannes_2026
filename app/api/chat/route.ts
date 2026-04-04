import { NextResponse } from "next/server";
import { getPrisma } from "@/src/config/prisma";
import { getUserById } from "@/src/store/user-store";

export async function POST(request: Request) {
  try {
    const { userId, message } = (await request.json()) as {
      userId: string;
      message: string;
    };

    if (!userId || !message) {
      return NextResponse.json(
        { error: "userId and message are required" },
        { status: 400 },
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: "Message too long (max 2000 characters)" },
        { status: 400 },
      );
    }

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const prisma = getPrisma();

    // Save user message
    await prisma.chatMessage.create({
      data: { userId, role: "user", content: message },
    });

    // Build context-aware reply based on keyword matching
    // (Hackathon: simple intent router rather than full LLM integration)
    const lowerMsg = message.toLowerCase();
    let reply = "";
    const actions: Array<{ type: string; status: string; txHash?: string }> = [];

    if (lowerMsg.includes("balance") || lowerMsg.includes("nav") || lowerMsg.includes("how much")) {
      reply = `Your current fund NAV is $${user.fund.currentNav.toFixed(2)}.\n`
        + `Deposited: $${user.fund.depositedUsdc.toFixed(2)} USDC\n`
        + `HTS Shares: ${user.fund.htsShareBalance}\n`
        + `Agent: ${user.agent.active ? "Active" : "Paused"} · Risk: ${user.agent.riskProfile}`;
    } else if (lowerMsg.includes("hunt") || lowerMsg.includes("run") || lowerMsg.includes("compute") || lowerMsg.includes("trigger")) {
      reply = "To trigger a hunt, use the Hunt button on the dashboard or type /run in Telegram. "
        + `Your agent has run ${user.agent.lastCycleId} hunts so far.`;
    } else if (lowerMsg.includes("last") || lowerMsg.includes("why") || lowerMsg.includes("latest")) {
      const latest = await prisma.cycle.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      if (latest) {
        reply = `Your latest hunt (#${latest.cycleNumber}) decided: **${latest.decision ?? "HOLD"} ${latest.decisionPct ?? 0}% ${latest.asset ?? "ETH"}**\n\n`
          + `Alpha: ${latest.alphaAction ?? "?"} ${latest.alphaPct ?? 0}%\n`
          + `Risk: max ${latest.riskMaxPct ?? 0}%\n`
          + `Executor: ${latest.execAction ?? "?"} ${latest.execPct ?? 0}%`;
      } else {
        reply = "No hunts found yet. Trigger your first hunt to see results.";
      }
    } else if (lowerMsg.includes("history")) {
      const history = await prisma.cycle.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      if (history.length > 0) {
        reply = `Last ${history.length} hunts:\n` + history.map((h) =>
          `#${h.cycleNumber}: ${h.decision ?? "HOLD"} ${h.decisionPct ?? 0}% ${h.asset ?? "ETH"}`
        ).join("\n");
      } else {
        reply = "No hunt history found.";
      }
    } else if (lowerMsg.includes("risk") || lowerMsg.includes("profile")) {
      reply = `Current risk profile: **${user.agent.riskProfile}**\n`
        + `Max trade: ${user.agent.maxTradePercent}%\n`
        + `Approval: ${user.agent.approvalMode}\n`
        + `You can change this in settings or tell me: "set risk to aggressive"`;
    } else if (lowerMsg.includes("hire") || lowerMsg.includes("pack") || lowerMsg.includes("agent")) {
      reply = "Visit the Marketplace page to hire or fire specialists. "
        + "Your pack runs adversarial debate each hunt — more specialists = better signals.";
    } else if (lowerMsg.includes("stop") || lowerMsg.includes("pause")) {
      reply = `Your agent is currently ${user.agent.active ? "active" : "paused"}. `
        + "Use /stop in Telegram or the dashboard to pause hunts.";
    } else {
      reply = "I'm Lead Dawg, your AI trading agent. I can help with:\n\n"
        + "- **\"What's my balance?\"** — check your fund\n"
        + "- **\"Show last hunt\"** — see latest debate results\n"
        + "- **\"History\"** — see past hunts\n"
        + "- **\"What's my risk?\"** — check risk profile\n"
        + "- **\"Trigger a hunt\"** — start a new cycle\n\n"
        + "What would you like to know?";
    }

    // Save assistant reply
    await prisma.chatMessage.create({
      data: {
        userId,
        role: "assistant",
        content: reply,
        metadata: actions.length > 0 ? actions : undefined,
      },
    });

    return NextResponse.json({ reply, actions });
  } catch (err) {
    console.error("[chat] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
