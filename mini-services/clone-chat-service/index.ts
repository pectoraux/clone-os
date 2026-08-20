// Clone OS — Live Clone Chat Mini-Service (port 3003)
// N1.3A.2: The live chat now uses the RETRIEVAL PIPELINE instead of
// dumping the entire clone into the prompt.
//
// Canonical execution path:
//   User message → TaskParser → RetrievalService → ContextCompiler →
//   CloneRuntime.execute() → ModelRouter → ModelProvider → Response
//
// The clone's persistent state is the source of truth. The LLM receives
// only the relevant subset required for the current task.

import { createServer } from "http";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { ModelRouter } from "../../src/lib/runtime/model-provider";
import { CloneRuntime } from "../../src/lib/runtime/clone-runtime";
import {
  RetrievalService, ContextCompiler, parseTask, estimateTokens,
  type TaskContext,
} from "../../src/lib/retrieval/retrieval";
import { loadCloneStateSnapshot, type CloneStateSnapshot } from "../../src/lib/fidelity/snapshot";

const db = new PrismaClient();
const PORT = 3003;
const PLATFORM_BASE = process.env.PLATFORM_BASE_URL || "http://localhost:3000";

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:81,https://claune.vercel.app").split(",");

const httpServer = createServer();
const io = new Server(httpServer, {
  path: "/",
  cors: {
    origin: (origin, cb) => {
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
  principalId: string | null;
  tenantId: string | null;
  cloneVersionId: string | null;
  messages: { role: "assistant" | "user"; content: string }[];
  // N1.3A.2: execution diagnostics (safe metadata, no sensitive content)
  lastRetrievalStats?: {
    retrievalCount: number;
    excludedCount: number;
    estimatedContextTokens: number;
    budget: number;
    retrievalMethods: string[];
    cloneVersion: string;
    contextHash: string;
    selectedArtifacts: string[];
  };
}

const sessions = new Map<string, SessionState>();
const router = new ModelRouter();
const runtime = new CloneRuntime();
const retrievalService = new RetrievalService();
const compiler = new ContextCompiler();

function generateId() { return Math.random().toString(36).slice(2, 10) }

// Validate the socket token by calling the platform's validate-socket-token endpoint
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

// N1.3A.2: Load the clone's identity (persona, behavior, values) from the DB.
// This is NOT the full clone — the identity is always included in the context
// (it's the clone's self, not knowledge). Knowledge/memory/workflows/policies
// are RETRIEVED, not dumped.
async function loadCloneIdentity(cloneId: string) {
  const clone = await db.clone.findUnique({
    where: { id: cloneId },
    include: {
      professionalIdentity: { include: { user: true } },
      currentVersion: { select: { id: true, version: true } },
    },
  });
  if (!clone) return null;
  return {
    clone,
    cloneVersionId: clone.currentVersion?.id || null,
    cloneVersion: clone.currentVersion?.version || "1.0.0",
    persona: JSON.parse(clone.personaJson || "{}"),
    behavior: JSON.parse(clone.behaviorJson || "{}"),
    values: JSON.parse(clone.professionalIdentity?.valuesJson || "[]"),
    bio: clone.professionalIdentity?.bio ?? null,
    title: clone.professionalIdentity?.title ?? null,
    domain: clone.domain,
    name: clone.name,
  };
}

io.on("connection", (socket) => {
  console.log(`[clone-chat] client connected: ${socket.id}`);

  socket.on("clone:join", async (data: { cloneId: string; sessionToken?: string }) => {
    try {
      const principal = await validateSession(data.sessionToken);
      const identity = await loadCloneIdentity(data.cloneId);
      if (!identity) {
        socket.emit("clone:error", { message: "Clone not found or not accessible." });
        return;
      }

      // Access control
      if (!principal) {
        if (identity.clone.visibility !== "marketplace" && identity.clone.visibility !== "open") return;
      } else if (principal.tenantId && identity.clone.tenantId !== principal.tenantId) {
        if (identity.clone.visibility !== "marketplace" && identity.clone.visibility !== "open") return;
      }

      sessions.set(socket.id, {
        cloneId: data.cloneId,
        principalId: principal?.id ?? null,
        tenantId: principal?.tenantId ?? null,
        cloneVersionId: identity.cloneVersionId,
        messages: [],
      });
      socket.emit("clone:ready", {
        cloneId: data.cloneId,
        cloneName: identity.name,
        version: identity.cloneVersion,
        certification: identity.clone.certificationLevel,
        persona: identity.persona,
        authenticated: !!principal,
        principalId: principal?.id ?? null,
      });
      console.log(`[clone-chat] ${socket.id} joined clone ${identity.clone.slug} (principal=${principal?.id ?? "anon"})`);
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

      // Load the clone identity
      const identity = await loadCloneIdentity(session.cloneId);
      if (!identity) {
        io.to(socket.id).emit("clone:error", { message: "Clone identity missing." });
        return;
      }

      // N1.3A.3: CANONICAL EXECUTION PATH — uses retrieval, not full-clone dump
      // Step 1: Parse the task (routing signal derived from the message)
      const task = parseTask(userText, identity.domain, session.cloneVersionId || undefined);

      // Step 2: Retrieve relevant artifacts (snapshot-aware if a version is specified)
      let snapshot: CloneStateSnapshot | undefined
      if (session.cloneVersionId) {
        snapshot = await loadCloneStateSnapshot(session.cloneVersionId) || undefined
      }
      const retrieval = await retrievalService.retrieve(
        task,
        session.cloneId,
        session.tenantId || identity.clone.tenantId,
        snapshot,
      )

      // Step 3: Compile the bounded context with the COMPLETE professional self
      // N1.3A.3: personality, preferences, culture are now included
      const budget = retrievalService.getBudget()
      const compiled = compiler.compile(
        {
          name: identity.name, domain: identity.domain,
          persona: identity.persona,
          personality: JSON.parse(identity.clone.personalityJson || '{}'),
          preferences: JSON.parse(identity.clone.preferencesJson || '{}'),
          behavior: identity.behavior,
          values: identity.values,
          culture: JSON.parse(identity.clone.professionalIdentity?.cultureJson || '{}') ||
                   JSON.parse(identity.clone.professionalIdentity?.cultureJson || '{}'),
          bio: identity.bio, title: identity.title,
        },
        retrieval,
        retrievalService.getSerializer(),
        budget,
        session.cloneVersionId || undefined,
      )

      // Step 4: Execute via CloneRuntime.execute() — N1.3A.3: strongly typed
      // ExecutionRequest carries the routing signal from the task
      const execResult = await runtime.execute(
        {
          systemPrompt: compiled.systemPrompt,
          userMessage: userText,
          routingSignal: task.routingSignal,
          requestId: `chat_${socket.id}_${Date.now()}`,
          principalId: session.principalId || undefined,
          cloneId: session.cloneId,
        },
        router,
      )

      // Persist to in-memory session (history is experience, not the clone)
      session.messages.push({ role: "user", content: userText })
      session.messages.push({ role: "assistant", content: execResult.content })

      // N1.3A.2: Store execution diagnostics (safe metadata, no sensitive content)
      session.lastRetrievalStats = {
        retrievalCount: compiled.selectedArtifacts.length,
        excludedCount: compiled.excludedArtifacts.length,
        estimatedContextTokens: compiled.estimatedTokens,
        budget: budget.maxTokens,
        retrievalMethods: ["keyword"],
        cloneVersion: identity.cloneVersion,
        contextHash: compiled.contextHash.slice(0, 16),
        selectedArtifacts: compiled.selectedArtifacts.map(a => `${a.type}:${a.name}`),
        // N1.3A.3: routing + provider info
        routingSignal: task.routingSignal,
        provider: execResult.providerId,
        preferredProvider: execResult.preferredProviderId,
        fellBack: execResult.fellBack,
      }

      io.to(socket.id).emit("clone:message", { id: generateId(), role: "clone", content: execResult.content, ts: Date.now() } as ChatMessage)
      io.to(socket.id).emit("clone:typing", { ts: Date.now() })

      console.log(`[clone-chat] ${socket.id} msg processed via ${provider.id} (retrieval: ${compiled.selectedArtifacts.length} included, ${compiled.excludedArtifacts.length} excluded, ${compiled.estimatedTokens} tokens, hash=${compiled.contextHash.slice(0, 8)})`)
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

  // N1.3A.2: expose execution diagnostics (safe metadata)
  socket.on("clone:diagnostics", () => {
    const s = sessions.get(socket.id);
    if (s?.lastRetrievalStats) {
      io.to(socket.id).emit("clone:diagnostics", s.lastRetrievalStats);
    }
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
  console.log(`[clone-chat-service] N1.3A.2: using retrieval pipeline (not full-clone dump)`);
});

process.on("SIGTERM", () => {
  console.log("[clone-chat-service] SIGTERM, shutting down...");
  httpServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  console.log("[clone-chat-service] SIGINT, shutting down...");
  httpServer.close(() => process.exit(0));
});
