// Clone OS — Live Clone Chat Mini-Service (port 3003)
// ADR-0013: Real-time clone conversation via socket.io mini-service.
//
// The LLM is an inference engine. The Clone is the source of truth.
// The clone's persisted persona / expertise / skills / policies are loaded
// from the platform's data layer and used to build the system prompt.
// Chat history is *experience* — never the clone itself.

import { createServer } from "http";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import ZAI from "z-ai-web-dev-sdk";

const db = new PrismaClient();
const PORT = 3003;

const httpServer = createServer();
const io = new Server(httpServer, {
  // DO NOT change the path — Caddy uses it to route.
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

interface ChatMessage {
  id: string;
  role: "user" | "clone" | "system";
  content: string;
  ts: number;
}

interface SessionState {
  cloneId: string;
  messages: { role: "assistant" | "user"; content: string }[];
}

// In-memory conversation state per socket (the clone's persistent state lives in the DB)
const sessions = new Map<string, SessionState>();

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Load clone context from the platform data layer.
// The LLM never persists this — it is re-loaded each session from the source of truth.
async function loadCloneContext(cloneId: string) {
  const clone = await db.clone.findUnique({
    where: { id: cloneId },
    include: {
      professionalIdentity: { include: { user: true } },
      skills: true,
      knowledgeItems: { take: 12, orderBy: { createdAt: "desc" } },
      memories: { take: 8, orderBy: { importance: "desc" } },
      policies: { take: 8 },
      currentVersion: true,
    },
  });
  if (!clone) return null;

  const persona = safeParse(clone.personaJson);
  const personality = safeParse(clone.personalityJson);
  const preferences = safeParse(clone.preferencesJson);
  const behavior = safeParse(clone.behaviorJson);
  const pi = clone.professionalIdentity;
  const values = pi ? safeParse(pi.valuesJson) : [];
  const culture = pi ? safeParse(pi.cultureJson) : {};

  return {
    clone,
    persona,
    personality,
    preferences,
    behavior,
    pi,
    values,
    culture,
    skills: clone.skills,
    knowledge: clone.knowledgeItems,
    memories: clone.memories,
    policies: clone.policies,
    version: clone.currentVersion,
  };
}

function safeParse(s: string | null | undefined): any {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

// Build the system prompt from the clone's persisted state.
// This is the bridge between the platform data layer and the inference engine.
function buildSystemPrompt(ctx: NonNullable<Awaited<ReturnType<typeof loadCloneContext>>>): string {
  const { clone, persona, personality, preferences, behavior, pi, values, culture, skills, knowledge, memories, policies, version } = ctx;
  const parts: string[] = [];

  parts.push(
    `You are ${clone.name}, the digital professional clone of ${pi?.user?.name ?? "the user"} (${pi?.title ?? clone.domain}).`,
  );
  parts.push(`Domain: ${clone.domain}.`);
  parts.push(`Active clone version: ${version?.version ?? "1.0.0"} (certification: ${clone.certificationLevel}).`);
  parts.push("");

  if (pi?.bio) {
    parts.push(`# Professional bio`);
    parts.push(pi.bio);
    parts.push("");
  }

  if (values && Array.isArray(values) && values.length) {
    parts.push(`# Professional values (do not violate)`);
    parts.push(values.map((v: string) => `- ${v}`).join("\n"));
    parts.push("");
  }

  if (culture && typeof culture === "object") {
    parts.push(`# Cultural context`);
    parts.push(
      Object.entries(culture)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n"),
    );
    parts.push("");
  }

  if (persona && typeof persona === "object") {
    parts.push(`# Communication style (MUST follow)`);
    parts.push(`- Style: ${persona.communicationStyle ?? "direct, evidence-first"}`);
    parts.push(`- Tone: ${persona.tone ?? "professional, calm, low-ego"}`);
    if (persona.structure) parts.push(`- Structure: ${persona.structure}`);
    if (persona.vocabulary && Array.isArray(persona.vocabulary))
      parts.push(`- Vocabulary: ${persona.vocabulary.join(", ")}`);
    if (typeof persona.directness === "number")
      parts.push(`- Directness: ${persona.directness} (0..1)`);
    parts.push("");
  }

  if (personality && typeof personality === "object") {
    parts.push(`# Personality`);
    parts.push(
      Object.entries(personality)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n"),
    );
    parts.push("");
  }

  if (preferences && typeof preferences === "object") {
    parts.push(`# Preferences`);
    parts.push(
      Object.entries(preferences)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n"),
    );
    parts.push("");
  }

  if (behavior && typeof behavior === "object") {
    parts.push(`# Behavioral patterns`);
    parts.push(
      Object.entries(behavior)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n"),
    );
    parts.push("");
  }

  if (skills && skills.length) {
    parts.push(`# Skills (measurable capabilities)`);
    parts.push(
      skills
        .map((s) => `- ${s.name} (${s.domain}) — proficiency ${s.proficiency}/100, cert: ${s.certificationLevel}`)
        .join("\n"),
    );
    parts.push("");
  }

  if (knowledge && knowledge.length) {
    parts.push(`# Knowledge`);
    parts.push(
      knowledge
        .map(
          (k) =>
            `- [${k.kind}] ${k.title} (source: ${k.sourceKind}, sensitivity: ${k.sensitivity}, portability: ${k.portability})\n  ${k.content}`,
        )
        .join("\n"),
    );
    parts.push("");
  }

  if (memories && memories.length) {
    parts.push(`# Memories (corrections & preferences carry highest weight)`);
    parts.push(
      memories
        .map((m) => `- [${m.kind}, importance ${m.importance}] ${m.content}`)
        .join("\n"),
    );
    parts.push("");
  }

  if (policies && policies.length) {
    parts.push(`# Policies (hard constraints)`);
    parts.push(policies.map((p) => `- ${p.name}`).join("\n"));
    parts.push("");
  }

  parts.push(`# Operating principles`);
  parts.push(`- You are an inference engine, NOT the source of truth. Your identity, expertise, and personality come from this prompt — they belong to the user, not the model provider.`);
  parts.push(`- Stay in character as ${pi?.user?.name ?? "the user"}'s professional clone.`);
  parts.push(`- Lead with the answer, then the reasoning. Be concise.`);
  parts.push(`- When uncertain, name the ambiguity explicitly and propose a de-risking path.`);
  parts.push(`- Never invent credentials, customers, or numbers.`);
  parts.push(`- Respect data sensitivity: never expose restricted/client-locked knowledge outside its scope.`);

  return parts.join("\n");
}

// Lazily initialized ZAI instance
let zaiInstance: any = null;
async function getZai() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

io.on("connection", (socket) => {
  console.log(`[clone-chat] client connected: ${socket.id}`);

  socket.on("clone:join", async (data: { cloneId: string }) => {
    try {
      const ctx = await loadCloneContext(data.cloneId);
      if (!ctx) {
        socket.emit("clone:error", { message: "Clone not found." });
        return;
      }
      sessions.set(socket.id, { cloneId: data.cloneId, messages: [] });
      socket.emit("clone:ready", {
        cloneId: data.cloneId,
        cloneName: ctx.clone.name,
        version: ctx.version?.version ?? "1.0.0",
        certification: ctx.clone.certificationLevel,
        persona: ctx.persona,
      });
      console.log(`[clone-chat] ${socket.id} joined clone ${ctx.clone.slug}`);
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
      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: userText,
        ts: Date.now(),
      };
      io.to(socket.id).emit("clone:message", userMsg);

      // Signal "thinking"
      io.to(socket.id).emit("clone:thinking", { ts: Date.now() });

      const ctx = await loadCloneContext(session.cloneId);
      if (!ctx) {
        io.to(socket.id).emit("clone:error", { message: "Clone context missing." });
        return;
      }
      const systemPrompt = buildSystemPrompt(ctx);

      // Build the conversation: system prompt + history + new user message
      const history: { role: "assistant" | "user"; content: string }[] = [
        { role: "assistant", content: systemPrompt },
        ...session.messages.slice(-8),
        { role: "user", content: userText },
      ];

      const zai = await getZai();
      const completion = await zai.chat.completions.create({
        messages: history,
        thinking: { type: "disabled" },
      });
      const cloneText: string = completion?.choices?.[0]?.message?.content ?? "(no response)";

      // Persist to in-memory session (history is experience, not the clone)
      session.messages.push({ role: "user", content: userText });
      session.messages.push({ role: "assistant", content: cloneText });

      const cloneMsg: ChatMessage = {
        id: generateId(),
        role: "clone",
        content: cloneText,
        ts: Date.now(),
      };
      io.to(socket.id).emit("clone:message", cloneMsg);
      io.to(socket.id).emit("clone:typing", { ts: Date.now() });
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
});

process.on("SIGTERM", () => {
  console.log("[clone-chat-service] SIGTERM, shutting down...");
  httpServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  console.log("[clone-chat-service] SIGINT, shutting down...");
  httpServer.close(() => process.exit(0));
});
