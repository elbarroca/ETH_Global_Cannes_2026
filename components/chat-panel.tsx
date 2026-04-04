"use client";

import { useState, useEffect, useRef } from "react";
import { DawgSpinner } from "./dawg-spinner";

interface ChatMessageMetadata {
  action?: string;
  txId?: string;
  sealed?: boolean;
  attestationHash?: string | null;
  teeVerified?: boolean;
  provider?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata?: ChatMessageMetadata | null;
  createdAt: string;
}

interface ChatResponse {
  reply: string;
  sealed?: boolean;
  attestationHash?: string | null;
  teeVerified?: boolean;
  actions?: Array<{ type: string; status: string; txHash?: string }>;
}

interface ChatPanelProps {
  userId: string;
  onClose: () => void;
}

export function ChatPanel({ userId, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load chat history on mount
  useEffect(() => {
    fetch(`/api/chat/history/${userId}`)
      .then((r) => r.json())
      .then((data: { messages: ChatMessage[] }) => {
        if (data.messages) setMessages(data.messages);
      })
      .catch(() => {});
  }, [userId]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || sending) return;
    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: input.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, message: userMsg.content }),
      });
      const data = (await res.json()) as ChatResponse;
      const firstAction = data.actions?.[0];
      const assistantMsg: ChatMessage = {
        id: `resp-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        metadata: {
          sealed: data.sealed ?? false,
          attestationHash: data.attestationHash ?? null,
          teeVerified: data.teeVerified ?? false,
          ...(firstAction
            ? { action: firstAction.type, txId: firstAction.txHash }
            : {}),
        },
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Sorry, something went wrong. Try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    // The xl:right offset docks the panel flush with the LEFT edge of the
    // swarm activity ticker (320px aside + 16px gap + 20px container padding
    // = 356px), so the modal never covers the live activity feed. On wide
    // screens the aside + container are centered inside `max-w-screen-2xl`
    // (1536px) so we add the extra viewport-side margin with a clamped calc.
    <div
      className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-void-800 bg-void-900 shadow-2xl sm:w-[400px] xl:right-[max(356px,calc((100vw-1536px)/2+356px))]"
      role="dialog"
      aria-label="Lead Dawg chat"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-void-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🐺</span>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold text-void-100">Lead Dawg</span>
            <span className="font-mono text-[10px] text-void-500">
              sealed · 0G Compute TEE
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-lg text-void-500 transition-colors hover:text-void-200"
          aria-label="Close chat"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="space-y-2 py-8 text-center">
            <p className="text-2xl">🐺</p>
            <p className="text-sm text-void-400">
              Ask me anything about your portfolio, your pack, or your last hunt.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {[
                "What's my NAV?",
                "Show my last hunt",
                "How is my pack doing?",
                "What's my risk profile?",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="rounded-lg border border-void-700 bg-void-800 px-3 py-1.5 text-xs text-void-400 transition-colors hover:bg-void-700"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-xl border border-void-700/50 bg-void-800 px-3 py-2">
              <DawgSpinner size={16} />
              <span className="font-mono text-[11px] text-void-500">
                Running sealed inference…
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-void-800 px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message Lead Dawg…"
            disabled={sending}
            className="flex-1 rounded-xl border border-void-700 bg-void-950 px-3 py-2.5 text-sm text-void-200 placeholder:text-void-600 focus:border-gold-400/50 focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="rounded-xl bg-dawg-500 px-4 py-2.5 text-sm font-bold text-void-950 transition-colors hover:bg-dawg-400 disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const attest = msg.metadata?.attestationHash ?? null;
  const sealed = msg.metadata?.sealed === true;
  const teeOk = msg.metadata?.teeVerified === true;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
          isUser
            ? "border border-blood-800/30 bg-blood-900/40 text-void-100"
            : "border border-void-700/50 bg-void-800 text-void-200"
        }`}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

        {msg.metadata?.txId && (
          <p className="mt-1 break-all font-mono text-xs text-teal-400">
            Tx: {msg.metadata.txId}
          </p>
        )}

        {!isUser && sealed && (
          <div className="mt-2 flex items-center gap-1.5 border-t border-void-700/50 pt-1.5 font-mono text-[10px]">
            <span className="inline-flex items-center gap-1 rounded-md border border-gold-400/25 bg-gold-400/10 px-1.5 py-0.5 text-gold-400">
              <span className="h-1 w-1 rounded-full bg-gold-400 animate-pulse" />
              sealed
            </span>
            {teeOk && <span className="text-gold-400">TEE ✓</span>}
            {attest && (
              <span className="truncate text-void-600" title={attest}>
                {attest.slice(0, 14)}…
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
