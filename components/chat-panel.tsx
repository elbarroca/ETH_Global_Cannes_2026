"use client";

import { useState, useEffect, useRef } from "react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata?: { action?: string; txId?: string };
  createdAt: string;
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
      const data = (await res.json()) as {
        reply: string;
        actions?: Array<{ type: string; status: string; txHash?: string }>;
      };
      const assistantMsg: ChatMessage = {
        id: `resp-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        metadata: data.actions?.[0]
          ? { action: data.actions[0].type, txId: data.actions[0].txHash }
          : undefined,
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
    <div className="fixed inset-y-0 right-0 w-full sm:w-[400px] z-50 flex flex-col bg-void-900 border-l border-void-800 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-void-800">
        <div className="flex items-center gap-2">
          <span className="text-lg">🐺</span>
          <span className="text-sm font-bold text-void-200">Lead Dawg</span>
        </div>
        <button
          onClick={onClose}
          className="text-void-500 hover:text-void-300 text-lg transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <p className="text-2xl">🐺</p>
            <p className="text-sm text-void-400">
              Ask me anything about your portfolio, trigger a hunt, or execute a trade.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-3">
              {["Trigger a hunt", "What's my balance?", "Show last hunt"].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="px-3 py-1.5 bg-void-800 hover:bg-void-700 text-void-400 text-xs rounded-lg border border-void-700 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                msg.role === "user"
                  ? "bg-blood-900/50 text-void-200 border border-blood-800/30"
                  : "bg-void-800 text-void-300 border border-void-700/50"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.metadata?.txId && (
                <p className="mt-1 text-xs font-mono text-teal-400 break-all">
                  Tx: {msg.metadata.txId}
                </p>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-void-800 border border-void-700/50 px-3 py-2 rounded-xl">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gold-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-gold-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-gold-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-void-800">
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
            placeholder="Message Lead Dawg..."
            disabled={sending}
            className="flex-1 px-3 py-2.5 bg-void-950 border border-void-700 rounded-xl text-sm text-void-200 placeholder:text-void-600 focus:outline-none focus:border-gold-400/50 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="px-4 py-2.5 bg-dawg-500 hover:bg-dawg-400 disabled:opacity-40 text-void-950 text-sm font-bold rounded-xl transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
