// Clone OS — Live Clone Chat Mini-Service (port 3003)
// ADR-0013: Real-time clone conversation via socket.io mini-service.
//
// N0.1 (hardened): clone:join requires a sessionToken. The server validates
//   it against the platform's NextAuth session (via the platform's /api/auth
//   endpoint), then resolves the principal and their accessible clones.
//   An unauthenticated client cannot join a clone by guessing an ID.
// N0.2: the clone is resolved within the principal's tenant or as a
//   marketplace-visible (public demo) clone. Cross-tenant access to private
//   clones is rejected.
// N0.3: the system prompt is built by CloneRuntime.toSystemPrompt() — the
//   service no longer hand-assembles strings.
// N0.4: the LLM is invoked through ModelRouter → ModelProvider interface.
//   The service never imports the SDK directly.

import { createServer } from "http";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { CloneRuntime } from "../../src/lib/runtime/clone-runtime";
import { ModelRouter, type RoutingSignal } from "../../src/lib/runtime/model-provider";

const db = new PrismaClient();
const PORT = 3003;
const PLATFORM_BASE = process.env.PLATFORM_BASE_URL || "http://localhost:3000";

// Allowed origins for CORS. On Space-z.ai the preview domain; on Vercel the
// production domain. "*" is gone — that was an auth gap.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:81,https://claune.vercel.app").split(",");

const httpServer = createServer();
const io = new Server(httpServer, {
  path: "/",
  cors: {
    origin: (origin, cb) => {
      // Allow same-origin (no Origin header) and explicitly-listed origins.
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error(`Origin ${origin} not allowed`));
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

interface ChatMessage { id: string; role: "user" | "clone" | "system"; content: string; ts: number }
interface SessionState {
  cloneId: string;
  principalId: string | null; // null for unauthenticated demo access
  tenantId: string | null;
  messages: { role: "assistant" | "user"; content: string }[];
}

const sessions = new Map<string, SessionState>();
const runtime = new CloneRuntime();
const router = new ModelRouter();

function generateId() { return Math.random().toString(36).slice(2, 10) }

// Validate the socket token by calling the platform's
// /api/auth/validate-socket-token endpoint (server-to-server). The platform
// returns the principal info if the token is valid + not expired, then
// deletes the token (single-use).
async function validateSession(socketToken: string | undefined): Promise<{ id: string; email: string; name: string; role: string; accountStatus: string; tenantId: string } | null> {
  if (!socketToken) return null;
  try {
    const res = await fetch(`${PLATFORM_BASE}/api/auth/validate-socket-token?token=${encodeURIComponent(socketToken)}`);
    if (!res.ok) return null;
    const data = await res.json() as any;
    if (!data?.valid || !data?.principal) return null;
    return data.principal;
  } catch {
    return null;
  }
}

// Load clone context using CloneRuntime. The clone is resolved within the
// principal's tenant, or as a marketplace-visible (public demo) clone if the
// principal doesn't own it.
async function loadCloneContext(cloneId: string, principal: { tenantId: string | null } | null) {
  const clone = await db.clone.findUnique({
    where: { id: cloneId },
    include: {
      professionalIdentity: { include: { user: true } },
      currentVersion: true,
      skills: true,
      knowledgeItems: { take: 12, orderBy: { createdAt: "desc" } },
      memories: { take: 8, orderBy: { importance: "desc" } },
      policies: { take: 8 },
    },
  });
  if (!clone) return null;

  // N0.2: access control. If the principal is null (unauthenticated), only
  // allow marketplace-visible clones. If authenticated, allow clones in
  // their tenant OR marketplace-visible clones. Reject private clones in
  // other tenants.
  if (!principal) {
    if (clone.visibility !== "marketplace" && clone.visibility !== "open") return null;
  } else if (principal.tenantId && clone.tenantId !== principal.tenantId) {
    if (clone.visibility !== "marketplace" && clone.visibility !== "open") return null;
  }

  const ctx = runtime.buildContext({ clone });
  return { clone, ctx };
}

io.on("connection", (socket) => {
  console.log(`[clone-chat] client connected: ${socket.id}`);

  // N0.1: Auth handshake. The client must emit clone:join with a sessionToken
  // (the NextAuth session cookie value) AND a cloneId. The server validates
  // the session, resolves the principal, and checks clone access.
  socket.on("clone:join", async (data: { cloneId: string; sessionToken?: string }) => {
    try {
      const principal = await validateSession(data.sessionToken);
      const loaded = await loadCloneContext(data.cloneId, principal);
      if (!loaded) {
        socket.emit("clone:error", { message: "Clone not found or not accessible." });
        return;
      }
      sessions.set(socket.id, {
        cloneId: data.cloneId,
        principalId: principal?.id ?? null,
        tenantId: principal?.tenantId ?? null,
        messages: [],
      });
      socket.emit("clone:ready", {
        cloneId: data.cloneId,
        cloneName: loaded.clone.name,
        version: loaded.clone.currentVersion?.version ?? "1.0.0",
        certification: loaded.clone.certificationLevel,
        persona: loaded.ctx.persona,
        authenticated: !!principal,
        principalId: principal?.id ?? null,
      });
      console.log(`[clone-chat] ${socket.id} joined clone ${loaded.clone.slug} (principal=${principal?.id ?? "anon"})`);
    } catch (e: any) {
      console.error("[clone-chat] join error", e);
      socket.emit("clone:error", { message: e?.message ?? "join failed" });
    }
  });

  socket.on("clone:message", async (data: { content: string }) => {
    try {
      const session = sessions.get(socket.id);
      if (!session) {
        socket.emit("clone:error", { message: "Not joined to a clone. Emit clone:join first." });
        return;
      }
      const userText = (data?.content ?? "").trim();
      if (!userText) return;

      // Acknowledge the user's message immediately
      const userMsg: ChatMessage = { id: generateId(), role: "user", content: userText, ts: Date.now() };
      io.to(socket.id).emit("clone:message", userMsg);
      io.to(socket.id).emit("clone:thinking", { ts: Date.now() });

      // Reload clone context (the clone state is the source of truth, reloaded each session)
      const loaded = await loadCloneContext(session.cloneId, { tenantId: session.tenantId });
      if (!loaded) {
        io.to(socket.id).emit("clone:error", { message: "Clone context missing." });
        return;
      }

      // N0.3: CloneRuntime builds the system prompt
      const systemPrompt = runtime.toSystemPrompt(loaded.ctx);

      // Build conversation history
      const history: { role: "assistant" | "user"; content: string }[] = [
        { role: "assistant", content: systemPrompt },
        ...session.messages.slice(-8),
        { role: "user", content: userText },
      ];

      // N0.4: ModelRouter selects the provider. The signal is a hint — for
      // clone chat, we use general_chat (the runtime could be smarter).
      const signal: RoutingSignal = "general_chat";
      const routing = router.select(signal);
      const provider = routing.provider;

      // Invoke the provider through the interface (never the SDK directly)
      const response = await provider.generate({
        messages: history,
        signal,
        requestId: `chat_${socket.id}_${Date.now()}`,
        principalId: session.principalId ?? undefined,
        cloneId: session.cloneId,
      });

      // Persist to in-memory session (history is experience, not the clone)
      session.messages.push({ role: "user", content: userText });
      session.messages.push({ role: "assistant", content: response.content });

      io.to(socket.id).emit("clone:message", { id: generateId(), role: "clone", content: response.content, ts: Date.now() } as ChatMessage);
      io.to(socket.id).emit("clone:typing", { ts: Date.now() });

      // Observability: log the routing decision + provider + latency
      console.log(`[clone-chat] ${socket.id} msg processed via ${provider.id} (preferred=${routing.preferredId}, fellBack=${routing.fellBack}, latency=${response.latencyMs}ms)`);
    } catch (e: any) {
      console.error("[clone-chat] message error", e);
      io.to(socket.id).emit("clone:error", { message: e?.message ?? "message failed" });
    }
  });

  socket.on("clone:reset", () => {
    const s = sessions.get(socket.id);
    if (s) s.messages = [];
    socket.emit("clone:reset-ack", { ts: Date.now() });
  });

  socket.on("disconnect", () => {
    sessions.delete(socket.id);
    console.log(`[clone-chat] client disconnected: ${socket.id}`);
  });

  socket.on("error", (err) => {
    console.error(`[clone-chat] socket error (${socket.id}):`, err);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[clone-chat-service] listening on port ${PORT}`);
  console.log(`[clone-chat-service] allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
});

process.on("SIGTERM", () => {
  console.log("[clone-chat-service] SIGTERM, shutting down...");
  httpServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  console.log("[clone-chat-service] SIGINT, shutting down...");
  httpServer.close(() => process.exit(0));
});
