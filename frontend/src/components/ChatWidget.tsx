import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
// @ts-expect-error - JS module
import { useAuth } from "../context/AuthContext.jsx";
import { executeAgentTool, TOOL_LABELS } from "@/lib/agent-tools";
import { loadHistory, saveHistory, clearHistory } from "@/lib/chat-history";

// Only shown on authenticated, in-app pages — never on the public/auth
// pages (landing, login, register, set-password). This is an allowlist
// rather than a blacklist on purpose: relying on `!user` alone isn't
// enough, since `user` can still be truthy for a moment on /login (e.g.
// mid-redirect after a token expiry, before logout() fully clears state).
// Matches App.jsx's actual route table.
const VISIBLE_PATH_PREFIXES = [
  "/dashboard",
  "/workspaces",
  "/projects",
  "/tasks",
  "/team",
  "/notifications",
  "/settings",
];

function isAppRoute(pathname: string) {
  return VISIBLE_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function stripIdColumns(text: string): string {
  const lines = text.split("\n");
  const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);

  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    // Look for a header row followed by a separator row (start of a table)
    if (
      isTableRow(lines[i]) &&
      lines[i + 1] &&
      /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])
    ) {
      const headerCells = lines[i].split("|").slice(1, -1).map((c) => c.trim());
      const dropIndexes = headerCells
        .map((cell, idx) => (/\bid\b/i.test(cell) ? idx : -1))
        .filter((idx) => idx !== -1);

      if (dropIndexes.length === 0) {
        // No ID column in this table -- copy it through untouched.
        result.push(lines[i], lines[i + 1]);
        i += 2;
        while (i < lines.length && isTableRow(lines[i])) {
          result.push(lines[i]);
          i++;
        }
        continue;
      }

      const rebuildRow = (line: string) => {
        const cells = line.split("|").slice(1, -1);
        const kept = cells.filter((_, idx) => !dropIndexes.includes(idx));
        return `|${kept.join("|")}|`;
      };

      result.push(rebuildRow(lines[i]), rebuildRow(lines[i + 1]));
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) {
        result.push(rebuildRow(lines[i]));
        i++;
      }
      continue;
    }

    result.push(lines[i]);
    i++;
  }

  return result.join("\n");
}

function stripIdMentions(text: string): string {
  let out = text.replace(/(?:\b[A-Za-z][\w-]*\s+)?\bid\b\s*[:#]?\s*\d+/gi, "");
  out = out.replace(/\(\s*\)/g, "");
  out = out.replace(/[ \t]{2,}/g, " ");
  out = out.replace(/[ \t]+([,.;:])/g, "$1");
  out = out.replace(/\n[ \t]+/g, "\n");
  return out.trim();
}

function stripSensitiveIds(text: string): string {
  return stripIdMentions(stripIdColumns(text));
}

function renderText(text: string) {
  // Lightweight markdown: **bold** + "- " bullets + line breaks.
  return text.split("\n").map((line, i) => {
    const bullet = /^\s*[-*]\s+/.test(line);
    const content = line.replace(/^\s*[-*]\s+/, "");
    const parts = content.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
      seg.startsWith("**") && seg.endsWith("**") ? (
        <strong key={j} className="font-semibold text-ink">
          {seg.slice(2, -2)}
        </strong>
      ) : (
        <span key={j}>{seg}</span>
      ),
    );
    return (
      <div key={i} className={bullet ? "flex gap-2" : undefined}>
        {bullet && <span className="text-flow">•</span>}
        <span>{parts}</span>
      </div>
    );
  });
}

function ToolPill({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-line bg-paper-soft px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
      <span
        className={`h-1.5 w-1.5 rounded-full ${done ? "bg-status-done" : "animate-pulse bg-flow"}`}
      />
      {label}
      {done ? " · done" : "…"}
    </div>
  );
}

export default function ChatWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  // `open` is the logical state (drives focus/history/route effects below).
  // `shouldRender` stays true slightly longer so the panel can play its
  // fade-out transition before actually leaving the DOM; without this,
  // closing would just be an instant cut instead of a fade.
  const [shouldRender, setShouldRender] = useState(false);
  const [input, setInput] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const { messages, sendMessage, status, addToolResult, setMessages, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: async ({ toolCall }) => {
      const output = await executeAgentTool(
        toolCall.toolName,
        (toolCall.input ?? {}) as Record<string, unknown>,
        navigate,
      );
      addToolResult({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output,
      });
    },
  });

  // Reset chat state whenever the logged-in account changes, so one
  // account's messages can never bleed into another's mid-session.
  useEffect(() => {
    setHydrated(false);
    setMessages([]);
  }, [user?.id, setMessages]);

  // Restore this account's history once when the widget first opens.
  useEffect(() => {
    if (!open || hydrated || !user) return;
    setHydrated(true);
    loadHistory(user.id).then((saved) => {
      if (Array.isArray(saved) && saved.length) setMessages(saved as UIMessage[]);
    });
  }, [open, hydrated, setMessages, user]);

  // Persist when a turn settles.
  useEffect(() => {
    if (status === "ready" && messages.length && user) saveHistory(messages, user.id);
  }, [status, messages, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  // Mount immediately on open; on close, keep rendering for the duration
  // of the fade-out transition (200ms, matching the CSS below) and only
  // then unmount. Opening again mid-fade cancels the pending unmount.
  useEffect(() => {
    if (open) {
      setShouldRender(true);
      return;
    }
    const timeout = setTimeout(() => setShouldRender(false), 200);
    return () => clearTimeout(timeout);
  }, [open]);

  // Close the widget automatically the moment we leave an app route
  // (e.g. navigating to /login, or back to the landing page).
  useEffect(() => {
    if (!isAppRoute(location.pathname)) setOpen(false);
  }, [location.pathname]);

  // Close the widget when a click/tap lands outside the panel and the
  // launcher button. Using `mousedown` (rather than `click`) means this
  // fires before any in-panel click handler, so there's no flicker or
  // fight between "close" and whatever was clicked. The launcher is
  // excluded from the "outside" check so toggling it doesn't both close
  // (via this handler) and reopen (via its own onClick) in the same tap.
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (launcherRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const busy = status === "submitted" || status === "streaming";

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    sendMessage({ text });
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const suggestions = useMemo(
    () => [
      "What tasks are assigned to me?",
      "Summarise my workspaces",
      "Create a high priority task",
      "Take me to my team",
    ],
    [],
  );

  if (!user || !isAppRoute(location.pathname)) return null;

  return (
    <>
      {/* Launcher */}
      <button
        ref={launcherRef}
        onClick={() => setOpen((o) => !o)}
        aria-label="Open AI assistant"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-paper shadow-lifted transition hover:bg-flow-deep hover:scale-105 active:scale-95"
      >
        {open ? (
          <span className="text-xl leading-none">×</span>
        ) : (
          <span className="font-display text-lg font-semibold">✦</span>
        )}
      </button>

      {shouldRender && (
        <div
          ref={panelRef}
          className={`fixed bottom-24 right-6 z-50 flex h-[min(620px,80vh)] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-lifted transition-all duration-200 ease-out ${
            open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line bg-paper-soft px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-flow font-display text-sm font-semibold text-white">
                ✦
              </span>
              <div className="leading-tight">
                <p className="font-display text-sm font-semibold text-ink">Flow Assistant</p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                  AI agent · groq
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (user) clearHistory(user.id);
                setMessages([]);
              }}
              className="rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint transition hover:bg-line/60 hover:text-ink"
            >
              Clear
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="chat-scroll flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="mt-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-flow-tint font-display text-xl text-flow-deep">
                  ✦
                </div>
                <p className="text-sm font-medium text-ink">How can I help?</p>
                <p className="mt-1 text-xs text-ink-soft">
                  I can read, create and update your tasks, manage members, and guide you around.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setInput("");
                        sendMessage({ text: s });
                      }}
                      className="rounded-lg border border-line bg-paper-soft px-3 py-2 text-left text-xs text-ink-soft transition hover:border-ink hover:text-ink"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, msgIndex) => {
              const isUser = m.role === "user";
              const isLastMessage = msgIndex === messages.length - 1;
  const isStillStreaming = isLastMessage && !isUser && (status === "streaming" || status === "submitted");
              return (
                <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={
                      isUser
                        ? "max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-3.5 py-2.5 text-sm text-paper"
                        : "max-w-[90%] text-sm leading-relaxed text-ink"
                    }
                  >
                    {m.parts.map((part, i) => {
          if (part.type === "text") {
            const displayText = isStillStreaming ? part.text : stripSensitiveIds(part.text);
            return <div key={i}>{renderText(displayText)}</div>;
          }
                      if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
                        const name =
                          part.type === "dynamic-tool"
                            ? (part as any).toolName
                            : part.type.replace("tool-", "");
                        const state = (part as any).state as string;
                        const done = state === "output-available" || state === "output-error";
                        return (
                          <ToolPill
                            key={i}
                            label={TOOL_LABELS[name] || name}
                            done={done}
                          />
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              );
            })}

            {status === "submitted" && (
              <div className="flex items-center gap-2 text-ink-faint">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-flow" />
                <span className="font-mono text-[11px] uppercase tracking-wider">Thinking…</span>
              </div>
            )}
            {status === "error" && (
              <p className="rounded-lg bg-flow-tint px-3 py-2 text-xs text-flow-deep">
                Something went wrong. Please try again.
              </p>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-line bg-paper-soft p-3">
            <div className="flex items-end gap-2 rounded-xl border border-line bg-paper px-3 py-2 focus-within:border-flow">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="Ask or tell Flow to do something…"
                className="max-h-28 flex-1 resize-none bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
              />
              {busy ? (
                <button
                  onClick={() => stop()}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-line text-ink transition hover:bg-ink hover:text-paper"
                  aria-label="Stop"
                >
                  ■
                </button>
              ) : (
                <button
                  onClick={submit}
                  disabled={!input.trim()}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink text-paper transition hover:bg-flow-deep disabled:opacity-40"
                  aria-label="Send"
                >
                  ↑
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
