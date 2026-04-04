import { NextResponse } from "next/server";
import { getPrisma } from "@/src/config/prisma";
import { getUserById } from "@/src/store/user-store";
import { sealedInference, type PriorMessage } from "@/src/og/inference";
import { OG_PROVIDER } from "@/src/config/og-compute";
import type { UserRecord } from "@/src/types/index";

// Upper bound on how many prior messages we replay into the context window.
// 7B models lose focus fast — 10 turns (~5 Q/A pairs) is the sweet spot.
const MAX_HISTORY = 10;

const LEAD_DAWG_PERSONA = `You are Lead Dawg — the orchestrator of the user's AlphaDawg pack.

You are the user's personal AI trading agent. Every 5 minutes you assemble a pack of specialist sub-agents (SentimentBot, WhaleEye, MomentumX, and others), pay each $0.001 via x402 nanopayments, and run an adversarial debate pipeline: Alpha builds the bull case, Risk tears it apart, the Executor makes the final call.

You do NOT have opinions about trades. You have a process. Every hire gets paid. Every inference runs in a sealed TEE enclave on 0G Compute. Every decision is logged on-chain to Hedera HCS with cryptographic proof. You are the glass box, not the black box.

VOICE:
- Direct, methodical, transparent. Short sentences. No fluff.
- Always speak in first person as Lead Dawg ("I'm holding 3 specialists in your pack", "I can trigger a hunt right now").
- Cite real numbers from the CONTEXT block below — never make up NAV, balances, cycle counts, or wallet addresses.
- If the user asks something you genuinely don't know, say so and point them to a concrete surface in the app (dashboard, marketplace, /verify, Telegram /run).
- Keep replies under ~6 short sentences unless the user explicitly asks for detail.
- Never output JSON unless explicitly asked. Never output code blocks unless the user asks.
- Never promise actions you haven't taken. If the user says "buy 10% ETH", explain that they need to trigger a hunt or approve a pending cycle — you don't fire trades from chat.

THINGS YOU CAN ANSWER FROM CONTEXT:
- Fund NAV, deposits, HTS share balance
- Current risk profile, approval mode, active/paused state
- Last cycle number + decision, total hunts run
- Lead Dawg iNFT ID, proxy wallet + hot wallet addresses
- Whether the Telegram bot is linked

THINGS TO REDIRECT:
- Market predictions / price targets → "I don't forecast. I run process. Trigger a hunt and I'll show you what the pack found."
- Direct trade execution → "I don't fire trades from chat. Approve the pending cycle on the dashboard or use /run in Telegram."
- Specialist deep-dives → point to /verify for TEE attestations and /dashboard for the latest debate transcript.`;

/**
 * Build a compact CONTEXT block that gives the 7B model real facts to cite
 * instead of fabricating numbers. Every field here comes from the live user
 * record — if a field is missing, we emit "—" so the model won't invent one.
 */
function buildContextBlock(
  user: UserRecord,
  latestCycle: {
    cycleNumber: number;
    decision: string | null;
    decisionPct: number | null;
    asset: string | null;
    createdAt: Date;
  } | null,
  packSize: number,
): string {
  const fund = user.fund;
  const agent = user.agent;
  const lines: string[] = [];

  lines.push("=== USER CONTEXT (facts you can cite) ===");
  lines.push(`Wallet (EVM): ${user.walletAddress}`);
  lines.push(`Proxy wallet (Circle MPC, used for trade execution): ${user.proxyWallet.address}`);
  if (user.hotWalletAddress) {
    lines.push(`Hot wallet (BIP-44, used for x402 payments): ${user.hotWalletAddress}`);
  }
  if (user.inftTokenId != null) {
    lines.push(`Lead Dawg iNFT: #${user.inftTokenId} (ERC-7857 on 0G Chain)`);
  } else {
    lines.push(`Lead Dawg iNFT: not minted yet`);
  }
  lines.push("");
  lines.push("Fund:");
  lines.push(`  NAV: $${fund.currentNav.toFixed(2)}`);
  lines.push(`  Deposited: $${fund.depositedUsdc.toFixed(2)} USDC`);
  lines.push(`  HTS shares (VMF): ${fund.htsShareBalance}`);
  lines.push("");
  lines.push("Agent:");
  lines.push(`  State: ${agent.active ? "active (hunting)" : "paused"}`);
  lines.push(`  Risk profile: ${agent.riskProfile}`);
  lines.push(`  Max trade size: ${agent.maxTradePercent}% of NAV`);
  lines.push(`  Approval mode: ${agent.approvalMode}`);
  lines.push(`  Cycles run: ${agent.lastCycleId}`);
  lines.push(`  Pack size: ${packSize} specialist${packSize === 1 ? "" : "s"} hired`);
  lines.push("");
  lines.push("Telegram:");
  lines.push(`  Linked: ${user.telegram.verified ? "yes" : "no"}`);
  if (user.telegram.verified) {
    lines.push(`  Notifications: ${user.telegram.notifyPreference}`);
  }
  lines.push("");
  if (latestCycle) {
    lines.push("Latest hunt:");
    lines.push(
      `  #${latestCycle.cycleNumber}: ${latestCycle.decision ?? "HOLD"} ${latestCycle.decisionPct ?? 0}% ${latestCycle.asset ?? "ETH"}`,
    );
    lines.push(`  Run at: ${latestCycle.createdAt.toISOString()}`);
  } else {
    lines.push("Latest hunt: none yet — user has not run a cycle.");
  }
  lines.push("=== END CONTEXT ===");
  return lines.join("\n");
}

/**
 * Deterministic fallback router — only used when 0G sealed inference is
 * unavailable (e.g. provider offline, auto-funding failed). Keeps the chat
 * responsive instead of returning a generic error. Intentionally conservative:
 * only answers things we can compute directly from the user record.
 */
function fallbackReply(user: UserRecord, message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("balance") || lower.includes("nav") || lower.includes("how much")) {
    return (
      `Your fund NAV is $${user.fund.currentNav.toFixed(2)}.\n` +
      `Deposited: $${user.fund.depositedUsdc.toFixed(2)} USDC\n` +
      `HTS shares (VMF): ${user.fund.htsShareBalance}\n` +
      `Agent: ${user.agent.active ? "active" : "paused"} · risk ${user.agent.riskProfile}`
    );
  }
  if (lower.includes("risk") || lower.includes("profile")) {
    return (
      `Risk profile: ${user.agent.riskProfile}\n` +
      `Max trade: ${user.agent.maxTradePercent}% of NAV\n` +
      `Approval mode: ${user.agent.approvalMode}`
    );
  }
  if (lower.includes("hunt") || lower.includes("run") || lower.includes("trigger")) {
    return (
      `You've run ${user.agent.lastCycleId} hunts. Trigger a new one from the Hunt button on /dashboard or /run in Telegram. ` +
      `I don't fire hunts from chat — approvals always go through the dashboard.`
    );
  }
  if (lower.includes("pack") || lower.includes("hire") || lower.includes("agent")) {
    return (
      `Head to /marketplace to hire or fire specialists. Each pack member runs sealed inference on 0G and gets paid $0.001 via x402 per call.`
    );
  }
  return (
    `I'm Lead Dawg. Sealed inference is temporarily offline — I can still answer from your user record. Ask me about balance, risk profile, hunts, or your pack.`
  );
}

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

    // Save user message immediately so it persists even if inference fails.
    await prisma.chatMessage.create({
      data: { userId, role: "user", content: message },
    });

    // Load the prior ~10 messages and the latest cycle in parallel. Both are
    // used to enrich the Lead Dawg prompt — history gives continuity, latest
    // cycle gives citation-able numbers.
    const [priorMessages, latestCycle, packSize] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: MAX_HISTORY + 1, // +1 because the message we just saved is in here
        select: { role: true, content: true },
      }),
      prisma.cycle.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          cycleNumber: true,
          decision: true,
          decisionPct: true,
          asset: true,
          createdAt: true,
        },
      }),
      prisma.userHiredAgent.count({
        where: { userId, active: true },
      }),
    ]);

    // Reverse to chronological order, drop the row we just inserted (it is
    // the `userMessage` passed separately to sealedInference), and coerce
    // the role union to the type inference expects.
    const history: PriorMessage[] = priorMessages
      .slice(1)
      .reverse()
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }));

    const systemPrompt = `${LEAD_DAWG_PERSONA}\n\n${buildContextBlock(user, latestCycle, packSize)}`;

    // Try 0G sealed inference first. On any failure, fall back to the
    // deterministic router so the user still gets a useful reply.
    let reply = "";
    let attestationHash: string | null = null;
    let teeVerified = false;
    let sealed = false;

    try {
      if (!OG_PROVIDER) {
        throw new Error("OG_PROVIDER_ADDRESS not configured");
      }
      const result = await sealedInference(
        OG_PROVIDER,
        systemPrompt,
        message,
        history,
      );
      reply = result.content.trim();
      attestationHash = result.attestationHash || null;
      teeVerified = result.teeVerified;
      sealed = true;
    } catch (err) {
      console.warn("[chat] Sealed inference failed, using fallback router:", err);
      reply = fallbackReply(user, message);
    }

    // Empty replies from the model should never be surfaced as blank bubbles.
    if (!reply) {
      reply = fallbackReply(user, message);
      sealed = false;
    }

    // Persist assistant reply with sealed-inference metadata so the UI can
    // render a TEE verified badge and the /verify page can cross-reference.
    const metadata = sealed
      ? {
          sealed: true,
          attestationHash,
          teeVerified,
          provider: OG_PROVIDER,
        }
      : { sealed: false };

    await prisma.chatMessage.create({
      data: {
        userId,
        role: "assistant",
        content: reply,
        metadata,
      },
    });

    return NextResponse.json({
      reply,
      sealed,
      attestationHash,
      teeVerified,
      actions: [] as Array<{ type: string; status: string; txHash?: string }>,
    });
  } catch (err) {
    console.error("[chat] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
