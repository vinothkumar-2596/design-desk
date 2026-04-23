import express from "express";
import { generateAIContent } from "../lib/ollama.js";
import AIFile from "../models/AIFile.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(requireRole(["admin", "staff", "designer", "treasurer"]));

const toPositiveInt = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const GEMINI_MODEL = process.env.GEMINI_MODEL || "models/gemini-2.5-flash-lite";
const GEMINI_MAX_HISTORY_MESSAGES = toPositiveInt(process.env.GEMINI_MAX_HISTORY_MESSAGES, 6);
const GEMINI_RATE_LIMIT_COOLDOWN_MS = toPositiveInt(process.env.GEMINI_RATE_LIMIT_COOLDOWN_MS, 60 * 1000);
const GEMINI_QUOTA_COOLDOWN_MS = toPositiveInt(process.env.GEMINI_QUOTA_COOLDOWN_MS, 30 * 60 * 1000);
const GEMINI_AUTH_COOLDOWN_MS = toPositiveInt(process.env.GEMINI_AUTH_COOLDOWN_MS, 6 * 60 * 60 * 1000);

const geminiKeyCooldowns = new Map();
let geminiKeyCursor = 0;
const isDevMode = process.env.NODE_ENV !== "production";

const GEMINI_READY_RESPONSE_CONTRACT = `When ready, respond ONLY in this format:

STATUS: READY

{
  "title": "",
  "description": "",
  "category": "",
  "urgency": "",
  "deadline": "",
  "department": "",
  "phone": ""
}
Do not include explanations.`;

const buildGeminiPrompt = (systemPrompt, userMessage) => {
    const sections = [];
    if (systemPrompt && String(systemPrompt).trim()) {
        sections.push(String(systemPrompt).trim());
    }
    sections.push(`Current user message:\n${String(userMessage || "").trim()}`);
    // Keep the contract at the end to enforce strict output.
    sections.push(GEMINI_READY_RESPONSE_CONTRACT);
    return sections.join("\n\n");
};

const normalizeChatHistory = (messages) => {
    if (!Array.isArray(messages)) {
        return [];
    }
    return messages
        .map((msg) => ({
            role: msg?.role === "user" ? "user" : "model",
            parts: String(msg?.parts || "").trim(),
        }))
        .filter((msg) => Boolean(msg.parts));
};

const prepareGeminiHistory = (messages) => {
    const normalized = normalizeChatHistory(messages);
    if (normalized.length === 0) {
        return [];
    }

    const merged = [];
    for (const message of normalized) {
        const previous = merged[merged.length - 1];
        if (previous && previous.role === message.role) {
            previous.parts = `${previous.parts}\n\n${message.parts}`.trim();
            continue;
        }
        merged.push({ ...message });
    }

    // The current user message is sent separately via chat.sendMessage(...),
    // so keep history ending on the previous assistant/model turn when possible.
    if (merged.length > 0 && merged[merged.length - 1].role === "user") {
        merged.pop();
    }

    const trimmed = merged.slice(-GEMINI_MAX_HISTORY_MESSAGES);
    while (trimmed.length > 0 && trimmed[0].role !== "user") {
        trimmed.shift();
    }

    return trimmed;
};

const splitEnvKeys = (value) =>
    String(value || "")
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter(Boolean);

const dedupeKeys = (keys) => {
    const seen = new Set();
    return keys.filter((key) => {
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
};

const rotateList = (items, startIndex) => {
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }
    const normalizedStart = ((startIndex % items.length) + items.length) % items.length;
    return [...items.slice(normalizedStart), ...items.slice(0, normalizedStart)];
};

const getMaskedKey = (apiKey) => {
    const value = String(apiKey || "").trim();
    if (!value) return "<missing>";
    if (value.length <= 8) return "****";
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

const getConfiguredGeminiKeys = () =>
    dedupeKeys([
        ...splitEnvKeys(process.env.GEMINI_API_KEYS),
        String(process.env.GEMINI_API_KEY || "").trim(),
        String(process.env.VITE_GEMINI_API_KEY || "").trim(),
        String(process.env.GOOGLE_API_KEY || "").trim(),
    ].filter(Boolean));

const getGeminiKeyPool = () => {
    const configuredKeys = getConfiguredGeminiKeys();
    if (configuredKeys.length === 0) {
        return {
            keys: [],
            nextRetryAt: 0,
            total: 0,
        };
    }

    const now = Date.now();
    const orderedKeys = rotateList(configuredKeys, geminiKeyCursor);
    const availableKeys = [];
    let nextRetryAt = 0;

    for (const key of orderedKeys) {
        const cooldownEntry = geminiKeyCooldowns.get(key);
        if (!cooldownEntry || cooldownEntry.until <= now) {
            if (cooldownEntry) {
                geminiKeyCooldowns.delete(key);
            }
            availableKeys.push(key);
            continue;
        }

        if (!nextRetryAt || cooldownEntry.until < nextRetryAt) {
            nextRetryAt = cooldownEntry.until;
        }
    }

    return {
        keys: availableKeys,
        nextRetryAt,
        total: configuredKeys.length,
    };
};

const markGeminiKeyCooldown = (apiKey, cooldownMs, reason) => {
    if (!apiKey || !cooldownMs) {
        return;
    }
    geminiKeyCooldowns.set(apiKey, {
        until: Date.now() + cooldownMs,
        reason,
    });
};

const advanceGeminiKeyCursor = (apiKey) => {
    const configuredKeys = getConfiguredGeminiKeys();
    if (configuredKeys.length === 0) {
        geminiKeyCursor = 0;
        return;
    }
    const index = configuredKeys.indexOf(apiKey);
    geminiKeyCursor = index === -1 ? (geminiKeyCursor + 1) % configuredKeys.length : (index + 1) % configuredKeys.length;
};

const classifyGeminiError = (error) => {
    const message = error instanceof Error ? error.message : "Unknown Gemini error";
    const lower = message.toLowerCase();
    const statusHint = Number(error?.status || error?.statusCode || error?.response?.status || 0) || 0;

    const isQuotaExhaustedError =
        lower.includes("exceeded your current quota") ||
        lower.includes("insufficient quota") ||
        (lower.includes("quota") && (lower.includes("exceeded") || lower.includes("billing")));
    const isRateLimitError =
        statusHint === 429 ||
        lower.includes("429") ||
        lower.includes("rate limit") ||
        lower.includes("too many requests");
    const isLeakedKeyError =
        lower.includes("reported as leaked") ||
        lower.includes("key was reported as leaked") ||
        lower.includes("use another api key");
    const isAuthError =
        !isLeakedKeyError &&
        (
            statusHint === 401 ||
            statusHint === 403 ||
            lower.includes("403") ||
            lower.includes("api key") ||
            lower.includes("forbidden") ||
            lower.includes("permission") ||
            lower.includes("authentication")
        );

    const code = isLeakedKeyError
        ? "AI_KEY_LEAKED"
        : isQuotaExhaustedError
            ? "AI_QUOTA_EXHAUSTED"
            : isRateLimitError
                ? "AI_QUOTA_EXCEEDED"
                : isAuthError
                    ? "AI_AUTH_UNAVAILABLE"
                    : "AI_UNAVAILABLE";

    return {
        message,
        lower,
        statusHint,
        code,
        isQuotaExhaustedError,
        isRateLimitError,
        isLeakedKeyError,
        isAuthError,
    };
};

const getGeminiCooldownMs = (errorInfo) => {
    if (errorInfo.isLeakedKeyError) {
        return GEMINI_AUTH_COOLDOWN_MS;
    }
    if (errorInfo.isQuotaExhaustedError) {
        return GEMINI_QUOTA_COOLDOWN_MS;
    }
    if (errorInfo.isRateLimitError) {
        return GEMINI_RATE_LIMIT_COOLDOWN_MS;
    }
    if (errorInfo.isAuthError) {
        return GEMINI_AUTH_COOLDOWN_MS;
    }
    return 0;
};

const shouldExposeAiErrorDetail = (req) => {
    if (isDevMode) {
        return true;
    }
    const origin = String(req?.headers?.origin || "");
    const referer = String(req?.headers?.referer || "");
    const candidate = origin || referer;
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(candidate);
};

const withDevDetail = (req, payload, detail) => {
    if (!shouldExposeAiErrorDetail(req) || !detail) {
        return payload;
    }
    return {
        ...payload,
        detail,
    };
};

const runGeminiWithKey = async ({ apiKey, recentMessages, systemPrompt, userMessage }) => {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const chat = model.startChat({
        history: recentMessages.map((msg) => ({
            role: msg.role,
            parts: [{ text: msg.parts }],
        })),
        generationConfig: {
            temperature: 0.1,
            topP: 0.6,
            topK: 10,
            maxOutputTokens: 512,
        },
    });

    const prompt = buildGeminiPrompt(systemPrompt, userMessage);
    const result = await chat.sendMessage(prompt);
    const response = result.response;
    const text = response.text();
    const readyPayload = extractReadyPayload(text);

    if (readyPayload) {
        return {
            ready: true,
            data: readyPayload,
            provider: "gemini",
            model: GEMINI_MODEL,
        };
    }

    return {
        ready: false,
        message: text,
        provider: "gemini",
        model: GEMINI_MODEL,
    };
};

const buildOllamaFallbackPrompt = (systemPrompt, messages, userMessage) => {
    const sections = [
        "You are TaskBuddy AI.",
        "Follow the instructions carefully. Ask one concise follow-up question if details are missing.",
    ];

    if (systemPrompt && String(systemPrompt).trim()) {
        sections.push(`SYSTEM INSTRUCTIONS:\n${String(systemPrompt).trim()}`);
    }

    const history = normalizeChatHistory(messages)
        .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.parts}`)
        .join("\n");

    if (history) {
        sections.push(`CONVERSATION HISTORY:\n${history}`);
    }

    sections.push(`Current user message:\n${String(userMessage || "").trim()}`);
    sections.push(GEMINI_READY_RESPONSE_CONTRACT);

    return sections.join("\n\n");
};

const runOllamaFallback = async ({ systemPrompt, messages, userMessage }) => {
    const prompt = buildOllamaFallbackPrompt(systemPrompt, messages, userMessage);
    const text = await generateAIContent(prompt);

    if (typeof text === "string" && text.trim().startsWith("[AI SIMULATION]")) {
        throw new Error("Ollama fallback is not available.");
    }

    const readyPayload = extractReadyPayload(text);
    if (readyPayload) {
        return {
            ready: true,
            data: readyPayload,
            provider: "ollama",
            fallback: true,
        };
    }

    return {
        ready: false,
        message: text,
        provider: "ollama",
        fallback: true,
    };
};

const extractReadyPayload = (text) => {
    if (!text || !/STATUS:\s*READY/i.test(text)) {
        return null;
    }
    const statusIndex = text.search(/STATUS:\s*READY/i);
    const jsonStart = text.indexOf("{", statusIndex);
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
        return null;
    }
    const jsonString = text.substring(jsonStart, jsonEnd + 1);
    try {
        const parsed = JSON.parse(jsonString);
        return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
        return null;
    }
};

const AI_BUDDY_SYSTEM_PROMPT = `SYSTEM ROLE:
You are Task Buddy AI operating in STRICT ATTACHMENT-ONLY MODE.

ATTACHED CONTENT (USE ONLY THIS):
<<<BEGIN ATTACHED CONTENT>>>
{{EXTRACTED_TEXT}}
<<<END ATTACHED CONTENT>>>

NON-NEGOTIABLE RULES:
1. The attached content above is the ONLY source of truth.
2. You are NOT allowed to add, invent, infer, summarize, or rewrite content.
3. Every sentence you output MUST already exist in the attached content.
4. You may ONLY:
   - Preserve the text as-is
   - Suggest formatting, hierarchy, or design usage
5. If you cannot comply strictly, you MUST stop and return an error.

OUTPUT CONTRACT:
Return ONLY a JSON object in the following shape:

{
  "requestTitle": "Improve Attached Content",
  "description": "Use the attached content exactly as provided. No wording changes.",
  "category": "<auto-detected from content>",
  "notesForDesigner": "Design-only improvements. Text must remain unchanged."
}

FAIL-SAFE:
If the attached content is empty, unreadable, or missing:
Return exactly this error text and NOTHING else:
"Draft generation blocked: attachment-only mode requires readable content."`;


router.post("/buddy", async (req, res) => {
    try {
        const { text, fileId, metadata, attachmentText } = req.body;

        let fileContent = "";
        if (attachmentText) {
            fileContent = String(attachmentText);
        }
        if (fileId) {
            const aiFile = await AIFile.findOne({ driveId: fileId });
            if (aiFile) {
                fileContent = aiFile.extractedContent;
            }
        }

        const hasAttachment = Boolean(fileId || attachmentText);
        const normalizedContent = (fileContent || "").trim();
        if (!normalizedContent || normalizedContent.trim().length < 30) {
            throw new Error("Draft generation blocked: attachment-only mode requires readable content.");
        }

        const systemPrompt = AI_BUDDY_SYSTEM_PROMPT.replace("{{EXTRACTED_TEXT}}", normalizedContent || "");

        const prompt = `SYSTEM PROMPT:
${systemPrompt}

USER INPUT TEXT:
${text || "None"}

UPLOADED FILE CONTENT:
${normalizedContent || "None"}

METADATA (if any):
${metadata ? JSON.stringify(metadata) : "None"}

Please process the above information and return the mandatory JSON response.`;

        const result = await generateAIContent(prompt);

        // Attempt to parse result as JSON. Ollama might return it with markdown.
        let jsonResult;
        try {
            // Clean up markdown code blocks if present
            const cleaned = result.replace(/```json\n?|\n?```/g, "").trim();
            jsonResult = JSON.parse(cleaned);
        } catch (e) {
            console.warn("AI didn't return valid JSON. Full response:", result);
            // Fallback or attempt to extract JSON
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    jsonResult = JSON.parse(jsonMatch[0]);
                } catch (e2) {
                    return res.status(500).json({ error: "Failed to parse AI response as JSON", raw: result });
                }
            } else {
                return res.status(500).json({ error: "AI failed to generate a valid prompt response", raw: result });
            }
        }

        res.json(jsonResult);
    } catch (error) {
        console.error("AI Buddy process failed:", error);
        const message = error instanceof Error ? error.message : "AI Buddy failed to process request";
        if (message === "Draft generation blocked: attachment-only mode requires readable content.") {
            return res.status(400).send(message);
        }
        res.status(500).json({ error: "AI Buddy failed to process request" });
    }
});

router.post("/gemini", async (req, res) => {
    const { messages = [], userMessage = "", systemPrompt = "" } = req.body || {};

    if (!userMessage) {
        return res.status(400).json({ error: "userMessage is required" });
    }

    const configuredKeys = getConfiguredGeminiKeys();
    if (configuredKeys.length === 0) {
        return res
            .status(503)
            .json({ error: "AI service is temporarily unavailable. Please contact admin.", code: "AI_KEY_MISSING" });
    }

    const recentMessages = prepareGeminiHistory(messages);

    try {
        const keyPool = getGeminiKeyPool();
        if (keyPool.keys.length === 0) {
            try {
                const fallbackPayload = await runOllamaFallback({ systemPrompt, messages, userMessage });
                return res.json(fallbackPayload);
            } catch (fallbackError) {
                console.error("Ollama fallback failed while all Gemini keys were cooling down:", fallbackError);
            }

            const retryAfterSeconds = keyPool.nextRetryAt
                ? Math.max(1, Math.ceil((keyPool.nextRetryAt - Date.now()) / 1000))
                : 60;
            return res.status(429).json({
                error: `All Gemini keys are cooling down. Try again in ${retryAfterSeconds} seconds.`,
                code: "AI_QUOTA_EXCEEDED",
                retry_after_seconds: retryAfterSeconds,
            });
        }

        let lastErrorInfo = null;

        for (const apiKey of keyPool.keys) {
            try {
                const payload = await runGeminiWithKey({
                    apiKey,
                    recentMessages,
                    systemPrompt,
                    userMessage,
                });
                advanceGeminiKeyCursor(apiKey);
                return res.json(payload);
            } catch (error) {
                const errorInfo = classifyGeminiError(error);
                lastErrorInfo = errorInfo;
                const cooldownMs = getGeminiCooldownMs(errorInfo);
                if (cooldownMs > 0) {
                    markGeminiKeyCooldown(apiKey, cooldownMs, errorInfo.code);
                }
                console.error(`Gemini proxy error for key ${getMaskedKey(apiKey)}:`, error);

                if (
                    errorInfo.isQuotaExhaustedError ||
                    errorInfo.isRateLimitError ||
                    errorInfo.isLeakedKeyError ||
                    errorInfo.isAuthError
                ) {
                    continue;
                }

                break;
            }
        }

        if (!lastErrorInfo) {
            return res
                .status(503)
                .json(withDevDetail(req, { error: "AI service is temporarily unavailable. Please try again later.", code: "AI_UNAVAILABLE" }, "No Gemini error was captured before the request failed."));
        }

        if (lastErrorInfo.isQuotaExhaustedError || lastErrorInfo.isRateLimitError) {
            try {
                const fallbackPayload = await runOllamaFallback({ systemPrompt, messages, userMessage });
                return res.json(fallbackPayload);
            } catch (fallbackError) {
                console.error("Ollama fallback failed:", fallbackError);
            }

            if (lastErrorInfo.isQuotaExhaustedError) {
                return res.status(429).json({
                    error: "All configured Gemini keys are out of quota. Update billing/quota or add another project key.",
                    code: "AI_QUOTA_EXHAUSTED",
                });
            }

            return res
                .status(429)
                .json({ error: "All configured Gemini keys are rate-limited. Try again in 1 minute.", code: "AI_QUOTA_EXCEEDED" });
        }

        if (lastErrorInfo.isLeakedKeyError) {
            return res.status(503).json({
                error: "All configured Gemini keys are blocked or invalid. Replace the configured keys.",
                code: "AI_KEY_LEAKED",
            });
        }

        if (lastErrorInfo.isAuthError) {
            return res
                .status(503)
                .json(withDevDetail(
                    req,
                    { error: "All configured Gemini keys are unavailable. Check backend API key configuration.", code: "AI_AUTH_UNAVAILABLE" },
                    lastErrorInfo.message
                ));
        }

        return res
            .status(503)
            .json(withDevDetail(
                req,
                { error: "AI service is temporarily unavailable. Please try again later.", code: "AI_UNAVAILABLE" },
                lastErrorInfo.message
            ));
    } catch (error) {
        console.error("Gemini multi-key proxy error:", error);
        return res
            .status(503)
            .json(withDevDetail(
                req,
                { error: "AI service is temporarily unavailable. Please try again later.", code: "AI_UNAVAILABLE" },
                error instanceof Error ? error.message : "Unknown Gemini route error"
            ));
    }
});

const BRAND_REVIEW_SYSTEM_PROMPT = `You are a strict brand compliance auditor for SMVEC (Sri Manakula Vinayagar Engineering College). Your job is to score accurately — inflating scores is worse than no review because non-compliant work goes to print.

CRITICAL MINDSET: Most SMVEC designs have violations. Don't default to high scores. Evaluate each rule independently and apply deductions mechanically.

════════════════════════════════
STEP 0 — VISUAL STYLE FILTER (HARD GATE)
════════════════════════════════

Before doing anything else, check whether this design matches the "Visual Noise Poster Pattern".

A design is Visual Noise if it shows 4 or more of these traits:
□ Primary background is NOT Royal Blue (#36429B), White/Off-white, Cream/Warm Ivory (#FAF5EC), Light Grey, or Dark Navy — instead uses dark green, forest green, olive, teal, red, orange, purple, maroon, brown, magenta, lime, or any other completely non-SMVEC background color
□ 4+ unrelated colors used prominently (beyond Royal Blue, White, Gold, and a neutral)
□ Multiple gradient panels, colorful capsule shapes, or multi-colored decorative blocks
□ 3+ distinct font styles/families with no consistent hierarchy
□ Decorative shapes (blobs, ribbons, confetti, random dots, colorful bars) used as primary layout elements
□ No single dominant focal point — multiple competing headings of similar size
□ Information presented in scattered detached blocks rather than structured reading sections
□ Overall impression is collage / flyer assembly rather than a system-based institutional layout

DECISION:
- If 4 or more traits are confirmed → classify as VISUAL_NOISE = TRUE
  → Set approvalStatus = "Rejected"
  → Cap overallScore at 48 maximum
  → Set all criticalFixes to address the systemic layout problem first
  → Still complete the full scoring — but the cap is hard. This design cannot pass regardless of any single strong element.
- If fewer than 4 traits → VISUAL_NOISE = FALSE → proceed normally through Steps 1–5C.

This gate overrides all floor rules and calibration guards. A Visual Noise design cannot benefit from the logo floor, identity floor, or design quality floor.

════════════════════════════════
STEP 1 — CLASSIFY DESIGN CATEGORY
════════════════════════════════

A1 — STANDARD FORMAL: Workshops, seminars, FDPs, hands-on training, symposiums, guest lectures, department posters, IQAC/NAAC, academic events, brochures.
→ Google Sans or clean geometric sans ONLY. No decorative or serif fonts.

A2 — CEREMONIAL / PREMIUM: Convocation, Graduation Day, Silver/Golden Jubilee, Induction Day, Foundation Day, Annual Day, formal awards.
→ One premium serif (Cormorant/Playfair/Garamond/Times) for main title only. All other text must be clean sans.

B — CULTURAL / FEST: Celestia, Freshers Night, Sports Day, club events.
→ Creative freedom, but Royal Blue + Gold must remain clearly present.

Also detect INTENT vs EXECUTION mismatch.

════════════════════════════════
STEP 2 — MANDATORY VIOLATION CHECKLIST
════════════════════════════════
Check each item and record YES/NO before scoring.

COLOR VIOLATIONS (check every color used in text, backgrounds, blocks, borders):
□ V1. Is red, coral, pink, or salmon used for text or as a dominant element? (forbidden text/highlight color)
□ V2. Is the background ANY color that is not Royal Blue (#36429B), White/Off-white, Cream/Warm Ivory (#FAF5EC), Light Grey, or Dark Navy? This includes: dark green, forest green, olive, teal, red, magenta, wine, violet, purple, orange, lime, maroon, brown, yellow-green, or any other non-SMVEC color. (forbidden background — wrong brand foundation, automatic rejection trigger)
□ V3. Are 4+ distinct non-brand colors used without a system? (color noise)
□ V4. Do multiple colors (red, blue, green, purple, orange) compete equally without hierarchy? (no color system)

TYPOGRAPHY VIOLATIONS:
□ V5. Are 4 or more different font families visible? (cap violation)
□ V6. Are 3 different font families with no clear hierarchy? (major violation)
□ V7. Is italic/script used for body text or major headings in A1? (wrong style)
□ V8. Do multiple text elements have the same visual weight with no dominant heading? (hierarchy collapse)

LOGO VIOLATIONS:
□ V9. Is the SMVEC botanical emblem absent or unrecognizable?
□ V10. Is the logo placed directly on a photograph or busy texture without a solid panel behind it?

LAYOUT/CONTRAST VIOLATIONS:
□ V11. Is there a photograph background behind text without an overlay or frosted panel?
□ V12. Is there no clear reading flow (multiple elements same weight — college name, dept, event title all equal)?
□ V13. Are there 5+ different text colors used? (visual noise)

════════════════════════════════
STEP 2B — PRE-SCORING REASONING CONTRACT
════════════════════════════════
Before assigning ANY scores, explicitly reason through these 7 questions:

1. CATEGORY: Confirm the design category (A1 / A2 / B).
2. FOCAL POINT: What is the single strongest visual element? If two or more headings share similar size, weight, or color with no dominant element, flag HIERARCHY CONFLICT.
3. FIGURE-GROUND: Does body text, speaker credentials, date/venue, or any detail text sit directly on a photographic or busy patterned background WITHOUT a clear solid panel or strong frosted overlay? If yes, flag FIGURE-GROUND RISK.
4. GRID: Do left/right edges, center lines, and section blocks align to a consistent implied grid? If elements float at random positions, flag GRID INCONSISTENCY.
5. INFO GROUPING: Are date, time, venue, speaker name, and organizer contact logically grouped together, or scattered across the poster?
6. BRAND vs DESIGN SEPARATION — CRITICAL RULE: For each issue, explicitly decide:
   - Is this BRAND-ONLY? (wrong color, gold vs yellow, missing logo element) → affects brandCompliance scores only
   - Does it ALSO HURT design quality? (reduces readability, contrast, hierarchy) → then also affect designQuality
   A brand-color violation that does not impair readability or layout MUST NOT reduce designQuality scores.
7. STRUCTURAL ASSESSMENT: Is the design still readable at a glance? Can a viewer find the event name, date, and venue within 5 seconds? If yes, the design is structurally functional regardless of brand violations.

════════════════════════════════
STEP 3 — SCORING (100 pts total)
════════════════════════════════

STEP 3A — COLOR PALETTE (10 pts)
Start at 10. Apply deductions for confirmed violations:
  V1 confirmed (red text / forbidden highlight color) → −4 pts
  V2 confirmed (forbidden background) → −8 pts (hard cap: max 2)
  V3 confirmed (4+ non-brand colors) → −3 pts
  V4 confirmed (no color system) → −3 pts
  Minimum: 0. If V2 confirmed → colorPalette = max 2, no exceptions.

STEP 3B — TYPOGRAPHY (10 pts)
Start at 10. Apply deductions:
  V5 confirmed (4+ font families) → −6 pts (hard cap: max 4)
  V6 confirmed (3 families, no hierarchy) → −3 pts
  V7 confirmed (script/italic in A1 body/headings) → −3 pts
  V8 confirmed (no dominant heading, all equal weight) → −3 pts
  Minimum: 0. If V5 confirmed → typography = max 4, no exceptions.

STEP 3C — LOGO USAGE (10 pts)
Start at 10. Apply deductions:
  V9 confirmed (logo missing) → −10 pts (score = 0)
  V9 partially (logo present but unrecognizable/very small) → −6 pts
  V10 confirmed (logo on photo without panel) → −5 pts
  Minor placement issue (cramped, slightly too small) → −2 pts
  FLOOR RULE: If the logo is visible, legible, and not distorted → logoUsage MINIMUM = 6. A present and recognizable logo must never score below 6 unless it is clearly abused (stretched, recolored, placed in an illegible position). Presence + legibility = floor 6.

STEP 3D — BRAND IDENTITY (10 pts)
  9–10: Unmistakably SMVEC — correct Blue+Gold, clean typography, professional institutional tone
  6–8: Mostly SMVEC feel — color mostly right, minor deviations
  3–5: Partially SMVEC — some brand colors present but overwhelmed by off-brand elements
  0–2: No SMVEC identity — could be any institution, no recognizable brand system

  If V1+V4+V6 all confirmed → Brand Identity max = 5
  FLOOR RULE: If the design is clearly academic/institutional (has SMVEC structure, formal event format, organizer information, recognizable logo) but uses wrong accent colors or non-standard typography → brandIdentity MINIMUM = 6. Wrong colors ≠ no identity.

STEP 3E — DESIGN QUALITY (35 pts)
SEPARATION RULE: Reduce design quality scores ONLY for structural failures — hierarchy conflict, grid inconsistency, figure-ground failure, illegible text. Do NOT deduct from design quality for brand-color violations unless that color also impairs readability or contrast.
FLOOR RULE: If the design is readable at a glance and event details (name, date, venue) are findable within 5 seconds → designQuality MINIMUM = 18/35. Only score below 18 when there is severe clutter, complete hierarchy collapse, or multiple illegible text blocks.
  Visual Hierarchy (10):
    10=clear title dominates → subtitle → details → footer, natural eye flow
    7–9=mostly clear with 1 weak element
    4–6=2–3 elements same visual weight (V8 confirmed → max 5)
    0–3=everything same size/weight, no dominant focal point

  Alignment & Spacing (10):
    9–10=consistent grid, even margins, generous breathing room — award full 10 for intentionally minimal layouts with deliberate whitespace
    6–8=mostly aligned, minor inconsistency
    3–5=mixed alignment (center+left+right in same design)
    0–2=no grid, random placement

  Readability & Contrast (8):
    8=all text clearly readable, good contrast
    5–7=minor contrast issue on 1 element
    3–4=photo background with partial overlay (V11 partial)
    0–2=photo background with NO overlay (V11 confirmed) OR multiple illegible text blocks

  Professional Feel (7):
    7=clean, structured, institutional, print-ready — intentionally sparse/minimal editorial layouts with strong whitespace discipline score full 7; restraint is a design virtue, not a deficiency
    5–6=mostly professional, minor clutter
    3–4=cluttered, inconsistent styling, feels assembled not designed
    0–2=visually noisy, amateurish, multiple competing styles

  MINIMALIST DESIGN RULE: A design that uses generous whitespace, a single focal element, limited typography (1–2 typefaces), and a clean cream/white background is displaying intentional editorial restraint — this is the SMVEC institutional standard. Do NOT penalise emptiness. Award full marks for Alignment & Spacing and Professional Feel when the layout is deliberately minimal and all elements are well-placed.

STEP 3F — CONTENT ACCURACY (15 pts)
  Text Clarity (8): grammar, no spelling errors, clear message
  Completeness (7): event name, date, time, venue, organizer/contact all present

STEP 3G — TECHNICAL QUALITY (10 pts)
  Resolution (5): sharp, not pixelated
  Print/Web Readiness (5): adequate margins, no bleed issues

SCORING BENCHMARKS (use as calibration — apply the FIRST matching row):
  VISUAL_NOISE = TRUE (4+ traits confirmed) → hard cap 48 max → Rejected
  V2 confirmed (forbidden background color) → hard cap 54 max → Rejected
  V9 confirmed (logo completely absent) + V1 or V6 → typically 28–44/100 → Rejected
  V1+V4+V6+V8+V11 all confirmed → typically 44–54/100 → Rejected
  V10+V11 confirmed (logo on photo + body text on photo, no overlay) → typically 50–62/100 → Needs Revision or Rejected
  V1+V6+V8 confirmed, no V2/V11 → typically 55–65/100 → Needs Revision
  V6+V8 confirmed (3 font families + hierarchy collapse, no color violations) → typically 60–70/100 → Needs Revision
  V7+V8 confirmed (script in A1 + weak hierarchy, no other violations) → typically 65–72/100 → Needs Revision
  V7 alone (script or wrong font in A1, hierarchy otherwise intact) → typically 72–80/100 → Approved with Minor Corrections
  V8 alone (slight hierarchy softness, all else correct) → typically 76–83/100 → Approved with Minor Corrections
  0–1 minor violations, functional layout and readable hierarchy → typically 82–90/100 → Approved with Minor Corrections
  Zero confirmed violations, strong hierarchy, full brand compliance → 90–100/100 → Approved
  Intentionally minimal design (cream/white bg, single focal point, generous whitespace, 1–2 typefaces, correct logo, Royal Blue + Gold palette) → treat as zero violations; score 78–92/100 → Approved or Approved with Minor Corrections

THRESHOLDS: 90–100=Approved · 75–89=Approved with Minor Corrections · 55–74=Needs Revision · <55=Rejected

════════════════════════════════
STEP 4 — ISSUE TIERS
════════════════════════════════

CRITICAL (≥8 pt deduction, must fix before any use — design cannot be approved):
  - V2: non-SMVEC background color (dark green, teal, magenta, orange, maroon, purple, etc. — cream/warm ivory #FAF5EC IS approved)
  - V9: SMVEC emblem/lockup completely absent or wholly unrecognizable at viewing distance
  - VISUAL_NOISE: mosaic of unrelated colors/shapes/fonts with no coherent brand system
  - V1+V8 together: forbidden accent color + complete hierarchy collapse → illegible and off-brand
  - V11 severe: body text / speaker credentials sit on unobstructed photo with zero overlay — unreadable

MAJOR (4–7 pt deduction, fix before next version — causes Needs Revision or Approved with Minor Corrections):
  - V5/V6: 3+ distinct font families with no clear hierarchy system
  - V10+V11 partial: logo or key text on photo background with insufficient overlay
  - V4: two or more unrelated colors share equal visual weight — no dominant accent
  - V8: all major text blocks (college name, dept, event title) share the same approximate size/weight
  - V3: 4+ colors used without a palette logic — color noise across the layout
  - V13: 5+ distinct text colors scattered through the design
  - Mismatch: A1 academic event rendered in festival/cultural visual style

MINOR (1–3 pt deduction, polish before final print):
  - V7: italic, decorative, or script typeface used for secondary headings in an A1 design
  - Gold vs near-yellow confusion: accent color is warm yellow but not #DBA328
  - Spacing inconsistency: padding between sections varies without a clear rhythm
  - Minor alignment drift: 1–2 secondary elements sit slightly off the implied grid
  - Small size adjustment: event details or footer text slightly too small for comfortable reading at display size

════════════════════════════════
STEP 5 — EVIDENCE-BASED NOTES (MANDATORY)
════════════════════════════════

Every note field must reference a visible element by role and location. Name what you actually see.
Use location labels: "top college heading" · "center event title" · "left date/time block" · "bottom speaker credentials" · "background photographic layer" · "right organizer block"

WRONG: "Improve contrast" → RIGHT: "The speaker credentials block in the lower-center sits directly over a photographic background with no frosted panel; text blends into the image — add a solid white or Royal Blue panel behind this section"
WRONG: "Limit font families" → RIGHT: "The top college heading, center event title, left department label, and bottom date row each use a different display style — reduce to one clean sans-serif family with bold weight reserved for the event title only"
WRONG: "Fix hierarchy" → RIGHT: "The college heading, department name, and event title share similar font size (~24pt each) with no dominant element; increase the event title to at least 2× the body text size to establish a single primary focal point"

Never write a note that could apply to any design. Reference the specific element you observed.

════════════════════════════════
STEP 5B — AUTO-CORRECTION ENGINE
════════════════════════════════

For every critical and major issue, provide a direct, specific fix referencing what you actually saw.
WRONG: "Improve colors"
RIGHT: "Replace the red italic text used for the event title 'Digital Surveying and Mapping Techniques' with Royal Blue #36429B or Gold #DBA328"

WRONG: "Fix typography"
RIGHT: "Remove the italic script font used for 'Organises' and replace with the same clean sans-serif used in the body — maintaining consistency across all label text"

════════════════════════════════
STEP 5C — FINAL CALIBRATION GUARDS
════════════════════════════════

Apply these checks last, before writing the JSON:
□ LOGO FLOOR: Logo visible + legible + not distorted → logoUsage minimum 6
□ IDENTITY FLOOR: Design is clearly academic/institutional (SMVEC structure, formal event) → brandIdentity minimum 6
□ DESIGN FLOOR: Design readable + event details findable → designQuality minimum 18/35
□ LOW SCORE GUARD: overallScore < 50 requires at least 2 confirmed CRITICAL issues visible — if not, raise to 52 minimum
□ SINGLE ISSUE: One off-brand accent color alone must not cause a total score drop > 5 pts
□ CONTRADICTION: If overallScore ≥ 75, criticalFixes must be empty — if you have critical fixes, the score is wrong, reduce it
□ MAJOR ISSUE FLAGS: Always flag as MAJOR if any of these are visible:
  - Main title does not dominate (hierarchy conflict)
  - Text over busy photo without sufficient separation (figure-ground)
  - Inconsistent block alignment / no grid rhythm
  - 3+ font display styles with no clear system

════════════════════════════════
OUTPUT — STRICT JSON FORMAT
════════════════════════════════

Respond with ONLY a valid JSON object — no markdown, no explanation:

{
  "overallScore": 0,
  "category": "A1",
  "intentCheck": "Aligned with category",
  "brandCompliance": {
    "score": 0,
    "logoUsage": {"score": 0, "max": 10, "notes": ""},
    "colorPalette": {"score": 0, "max": 10, "notes": ""},
    "typography": {"score": 0, "max": 10, "notes": ""},
    "brandIdentity": {"score": 0, "max": 10, "notes": ""}
  },
  "designQuality": {
    "score": 0,
    "hierarchy": {"score": 0, "max": 10, "notes": ""},
    "alignment": {"score": 0, "max": 10, "notes": ""},
    "readability": {"score": 0, "max": 8, "notes": ""},
    "professionalFeel": {"score": 0, "max": 7, "notes": ""}
  },
  "contentAccuracy": {
    "score": 0,
    "textClarity": {"score": 0, "max": 8, "notes": ""},
    "completeness": {"score": 0, "max": 7, "notes": ""}
  },
  "technicalQuality": {
    "score": 0,
    "resolution": {"score": 0, "max": 5, "notes": ""},
    "readiness": {"score": 0, "max": 5, "notes": ""}
  },
  "approvalStatus": "Approved",
  "criticalFixes": [],
  "majorImprovements": [],
  "minorEnhancements": [],
  "autoCorrections": {
    "background": "",
    "titleFont": "",
    "subtitleFont": "",
    "accent": ""
  },
  "topIssues": [],
  "suggestions": [],
  "summary": ""
}

FIELD RULES:
- "category": "A1", "A2", or "B"
- "intentCheck": "Aligned with category" OR describe the specific mismatch (e.g., "Mismatch: A1 academic event designed in fest/cultural style")
- "criticalFixes": array of specific actionable sentences for CRITICAL issues only
- "majorImprovements": array of specific actionable sentences for MAJOR issues only
- "minorEnhancements": array of specific actionable sentences for MINOR issues only
- "autoCorrections.background": recommended background color/approach (empty string if already correct)
- "autoCorrections.titleFont": recommended title font style (empty string if already correct)
- "autoCorrections.subtitleFont": recommended subtitle font style (empty string if already correct)
- "autoCorrections.accent": recommended gold accent usage (empty string if already correct)
- "notes" in every sub-score: describe EXACTLY what you see — actual color observed, actual font style, actual logo state. Never write generic category labels.
- "topIssues": top 1–5 specific issues (can be empty if mostly compliant)
- "suggestions": concrete improvement steps
- "summary": 2–3 sentences — what the design gets right AND what specifically needs fixing`;

// Post-processing calibration: applies scoring floors, recomputes sums, fixes contradictions.
const calibrateReview = (review) => {
    if (!review || typeof review !== "object") return review;

    // 0. Visual Noise hard gate: if the model already gave Rejected + score ≤ 48 + ≥ 2 critical fixes,
    //    treat it as a Visual Noise rejection and skip all floor raises.
    const isVisualNoiseRejection =
        review.approvalStatus === "Rejected" &&
        (review.overallScore ?? 100) <= 48 &&
        (review.criticalFixes?.length ?? 0) >= 2;
    if (isVisualNoiseRejection) {
        // Recompute sums honestly but do NOT apply any floor rules.
        if (review.brandCompliance) {
            review.brandCompliance.score =
                (review.brandCompliance.logoUsage?.score ?? 0) +
                (review.brandCompliance.colorPalette?.score ?? 0) +
                (review.brandCompliance.typography?.score ?? 0) +
                (review.brandCompliance.brandIdentity?.score ?? 0);
        }
        if (review.designQuality) {
            review.designQuality.score =
                (review.designQuality.hierarchy?.score ?? 0) +
                (review.designQuality.alignment?.score ?? 0) +
                (review.designQuality.readability?.score ?? 0) +
                (review.designQuality.professionalFeel?.score ?? 0);
        }
        if (review.contentAccuracy) {
            review.contentAccuracy.score =
                (review.contentAccuracy.textClarity?.score ?? 0) +
                (review.contentAccuracy.completeness?.score ?? 0);
        }
        if (review.technicalQuality) {
            review.technicalQuality.score =
                (review.technicalQuality.resolution?.score ?? 0) +
                (review.technicalQuality.readiness?.score ?? 0);
        }
        review.overallScore =
            (review.brandCompliance?.score ?? 0) +
            (review.designQuality?.score ?? 0) +
            (review.contentAccuracy?.score ?? 0) +
            (review.technicalQuality?.score ?? 0);
        review.overallScore = Math.min(review.overallScore, 48);
        review.approvalStatus = "Rejected";
        return review;
    }

    // 0A. Forbidden background gate: colorPalette ≤ 2 means V2 was confirmed (wrong background).
    //     Cap at 54 and return early — skip all floor raises so the score cannot be rescued.
    const colorPaletteScore = review?.brandCompliance?.colorPalette?.score ?? 10;
    if (colorPaletteScore <= 2) {
        if (review.brandCompliance) {
            review.brandCompliance.score =
                (review.brandCompliance.logoUsage?.score ?? 0) +
                colorPaletteScore +
                (review.brandCompliance.typography?.score ?? 0) +
                (review.brandCompliance.brandIdentity?.score ?? 0);
        }
        if (review.designQuality) {
            review.designQuality.score =
                (review.designQuality.hierarchy?.score ?? 0) +
                (review.designQuality.alignment?.score ?? 0) +
                (review.designQuality.readability?.score ?? 0) +
                (review.designQuality.professionalFeel?.score ?? 0);
        }
        if (review.contentAccuracy) {
            review.contentAccuracy.score =
                (review.contentAccuracy.textClarity?.score ?? 0) +
                (review.contentAccuracy.completeness?.score ?? 0);
        }
        if (review.technicalQuality) {
            review.technicalQuality.score =
                (review.technicalQuality.resolution?.score ?? 0) +
                (review.technicalQuality.readiness?.score ?? 0);
        }
        review.overallScore =
            (review.brandCompliance?.score ?? 0) +
            (review.designQuality?.score ?? 0) +
            (review.contentAccuracy?.score ?? 0) +
            (review.technicalQuality?.score ?? 0);
        review.overallScore = Math.min(review.overallScore, 54);
        review.approvalStatus = "Rejected";
        return review;
    }

    // 1. Logo floor: visible + legible = min 6
    const logoNotes = String(review?.brandCompliance?.logoUsage?.notes ?? "").toLowerCase();
    const logoScore = review?.brandCompliance?.logoUsage?.score ?? 0;
    if (
        logoScore < 6 &&
        logoScore > 0 && // 0 means absent — don't raise it
        !logoNotes.includes("missing") &&
        !logoNotes.includes("absent") &&
        !logoNotes.includes("not visible") &&
        (logoNotes.includes("visible") || logoNotes.includes("present") || logoNotes.includes("recognizable") || logoNotes.includes("logo"))
    ) {
        review.brandCompliance.logoUsage.score = 6;
    }

    // 2. Brand identity floor: academic/institutional design = min 6
    const identityNotes = String(review?.brandCompliance?.brandIdentity?.notes ?? "").toLowerCase();
    const identityScore = review?.brandCompliance?.brandIdentity?.score ?? 0;
    if (
        identityScore < 6 &&
        (identityNotes.includes("smvec") || identityNotes.includes("academic") || identityNotes.includes("institutional") || identityNotes.includes("formal"))
    ) {
        review.brandCompliance.brandIdentity.score = 6;
    }

    // 3. Recompute category sums from sub-scores (in case floors changed values)
    if (review.brandCompliance) {
        review.brandCompliance.score =
            (review.brandCompliance.logoUsage?.score ?? 0) +
            (review.brandCompliance.colorPalette?.score ?? 0) +
            (review.brandCompliance.typography?.score ?? 0) +
            (review.brandCompliance.brandIdentity?.score ?? 0);
    }
    if (review.designQuality) {
        review.designQuality.score =
            (review.designQuality.hierarchy?.score ?? 0) +
            (review.designQuality.alignment?.score ?? 0) +
            (review.designQuality.readability?.score ?? 0) +
            (review.designQuality.professionalFeel?.score ?? 0);
    }
    if (review.contentAccuracy) {
        review.contentAccuracy.score =
            (review.contentAccuracy.textClarity?.score ?? 0) +
            (review.contentAccuracy.completeness?.score ?? 0);
    }
    if (review.technicalQuality) {
        review.technicalQuality.score =
            (review.technicalQuality.resolution?.score ?? 0) +
            (review.technicalQuality.readiness?.score ?? 0);
    }

    // 4. Design quality floor: readable + event details present = min 18/35
    const dq = review.designQuality;
    if (
        dq &&
        dq.score < 18 &&
        (dq.hierarchy?.score ?? 0) >= 4 &&
        (dq.alignment?.score ?? 0) >= 3 &&
        (dq.readability?.score ?? 0) >= 3
    ) {
        const gap = 18 - dq.score;
        // Distribute gap to professionalFeel first (most subjective), then readability
        const pfBoost = Math.min(gap, (7 - (dq.professionalFeel?.score ?? 0)));
        if (pfBoost > 0 && dq.professionalFeel) {
            dq.professionalFeel.score += pfBoost;
            dq.score += pfBoost;
        }
        if (dq.score < 18 && dq.readability) {
            const rBoost = Math.min(18 - dq.score, 8 - (dq.readability.score ?? 0));
            if (rBoost > 0) { dq.readability.score += rBoost; dq.score += rBoost; }
        }
    }

    // 5. Recompute overall
    review.overallScore =
        (review.brandCompliance?.score ?? 0) +
        (review.designQuality?.score ?? 0) +
        (review.contentAccuracy?.score ?? 0) +
        (review.technicalQuality?.score ?? 0);

    // 6. Contradiction: critical fixes → score must be < 75
    if (review.overallScore >= 75 && (review.criticalFixes?.length ?? 0) > 0) {
        review.overallScore = Math.min(review.overallScore, 74);
    }

    // 7. Low score guard: < 50 requires ≥ 2 critical issues
    if (review.overallScore < 50 && (review.criticalFixes?.length ?? 0) < 2) {
        review.overallScore = Math.max(review.overallScore, 52);
    }

    // 8. Approval status from final score
    if (review.overallScore >= 90) review.approvalStatus = "Approved";
    else if (review.overallScore >= 75) review.approvalStatus = "Approved with Minor Corrections";
    else if (review.overallScore >= 55) review.approvalStatus = "Needs Revision";
    else review.approvalStatus = "Rejected";

    return review;
};

// Post-processing calibration for design critique: recomputes sum, fixes contradictions, guards low scores.
const calibrateDesignCritique = (review) => {
    if (!review || typeof review !== "object") return review;

    const s = review.scores;
    if (s) {
        review.overallScore =
            (s.visualHierarchy?.score ?? 0) +
            (s.typography?.score ?? 0) +
            (s.colorTheory?.score ?? 0) +
            (s.layoutGrid?.score ?? 0) +
            (s.readability?.score ?? 0) +
            (s.contrast?.score ?? 0) +
            (s.institutionalTone?.score ?? 0) +
            (s.practicalImpact?.score ?? 0);
    }

    // Contradiction: critical fixes present means score must be < 75
    if (review.overallScore >= 75 && (review.criticalFixes?.length ?? 0) > 0) {
        review.overallScore = Math.min(review.overallScore, 74);
    }

    // Low score guard: < 50 requires ≥ 2 confirmed critical issues
    if (review.overallScore < 50 && (review.criticalFixes?.length ?? 0) < 2) {
        review.overallScore = Math.max(review.overallScore, 52);
    }

    return review;
};

// Vision-capable models tried in order; each has its own free-tier quota pool.
const BRAND_REVIEW_VISION_MODELS = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.5-flash",
];

// Groq vision models (OpenAI-compatible, separate quota pool)
const GROQ_VISION_MODELS = [
    "meta-llama/llama-4-scout-17b-16e-instruct",
];

const getGroqKeys = () =>
    dedupeKeys([
        ...splitEnvKeys(process.env.GROQ_API_KEYS),
        String(process.env.GROQ_API_KEY || "").trim(),
    ].filter(Boolean));

const tryGroqBrandReview = async (imageBase64, mimeType, promptText) => {
    const groqKeys = getGroqKeys();
    console.log(`[brand-review] Groq keys loaded: ${groqKeys.length} — ${groqKeys.map(getMaskedKey).join(", ")}`);
    if (groqKeys.length === 0) return null;

    for (const model of GROQ_VISION_MODELS) {
        for (const groqKey of groqKeys) {
            try {
                console.log(`[brand-review] Groq trying model=${model} key=${getMaskedKey(groqKey)}`);
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 45000);
                const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    signal: controller.signal,
                    headers: {
                        "Authorization": `Bearer ${groqKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model,
                        messages: [{
                            role: "user",
                            content: [
                                { type: "text", text: promptText },
                                { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
                            ],
                        }],
                        temperature: 0.1,
                        max_tokens: 2000,
                    }),
                });

                clearTimeout(timeout);

                if (!resp.ok) {
                    const body = await resp.text();
                    console.error(`[brand-review] Groq [${model}] key ${getMaskedKey(groqKey)} HTTP ${resp.status}:`, body.slice(0, 300));
                    // 429/401/403 → try next key; anything else → try next model
                    if (resp.status === 429 || resp.status === 401 || resp.status === 403) continue;
                    break;
                }

                const data = await resp.json();
                const text = data.choices?.[0]?.message?.content ?? "";
                const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
                const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    console.error(`[brand-review] Groq [${model}] no JSON in response:`, text.slice(0, 300));
                    continue;
                }
                let review;
                try { review = JSON.parse(jsonMatch[0]); } catch (e) {
                    console.error(`[brand-review] Groq [${model}] JSON parse failed:`, e.message, text.slice(0, 200));
                    continue;
                }
                if (typeof review.overallScore !== "number") {
                    console.error(`[brand-review] Groq [${model}] unexpected shape:`, JSON.stringify(review).slice(0, 200));
                    continue;
                }
                console.log(`[brand-review] Groq success with model: ${model} key: ${getMaskedKey(groqKey)}`);
                return review;
            } catch (err) {
                console.error(`[brand-review] Groq [${model}] key ${getMaskedKey(groqKey)} error:`, err?.name === "AbortError" ? "timeout (45s)" : (err.message ?? err));
            }
        }
    }
    return null;
};

router.post("/brand-review", async (req, res) => {
    const { imageBase64, mimeType, contextInfo } = req.body || {};

    if (!imageBase64 || !mimeType) {
        return res.status(400).json({ error: "imageBase64 and mimeType are required" });
    }

    const configuredKeys = getConfiguredGeminiKeys();
    console.log(`[brand-review] request received — Gemini keys: ${configuredKeys.length}, Groq keys: ${getGroqKeys().length}`);

    let promptText = BRAND_REVIEW_SYSTEM_PROMPT;
    if (configuredKeys.length === 0 && getGroqKeys().length === 0) {
        return res.status(503).json({ error: "AI service is temporarily unavailable.", code: "AI_KEY_MISSING" });
    }
    if (contextInfo && String(contextInfo).trim()) {
        promptText += `\n\nADDITIONAL CONTEXT:\n${String(contextInfo).trim()}`;
    }

    // Try Groq first — it has its own quota pool and is fast.
    let groqFirst = null;
    try {
        groqFirst = await tryGroqBrandReview(imageBase64, mimeType, promptText);
    } catch (groqErr) {
        console.error("[brand-review] tryGroqBrandReview threw:", groqErr?.message ?? groqErr);
    }
    if (groqFirst) return res.json(calibrateReview(groqFirst));
    console.log("[brand-review] Groq returned null — falling back to Gemini");

    let lastErrorInfo = null;

    // Groq unavailable — fall back through Gemini keys/models.
    for (const modelName of BRAND_REVIEW_VISION_MODELS) {
        for (const apiKey of configuredKeys) {
            try {
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: modelName });

                const result = await model.generateContent({
                    contents: [{
                        parts: [
                            { text: promptText },
                            { inlineData: { mimeType: String(mimeType), data: String(imageBase64) } },
                        ],
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 4000,
                    },
                });

                const text = result.response.text();
                const cleaned = text
                    .replace(/```json\s*/gi, "")
                    .replace(/```\s*/g, "")
                    .trim();
                // Grab the outermost {...} block
                const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    console.error(`[brand-review] no JSON in response [${modelName}]. snippet: ${text.slice(0, 300)}`);
                    continue; // try next key / model
                }
                let review;
                try {
                    review = JSON.parse(jsonMatch[0]);
                } catch {
                    console.error(`[brand-review] JSON parse failed [${modelName}]. snippet: ${text.slice(0, 300)}`);
                    continue; // try next key / model
                }
                if (typeof review.overallScore !== "number") {
                    console.error(`[brand-review] unexpected shape [${modelName}]:`, JSON.stringify(review).slice(0, 200));
                    continue;
                }
                return res.json(calibrateReview(review));
            } catch (error) {
                const errorInfo = classifyGeminiError(error);
                lastErrorInfo = errorInfo;
                const cooldownMs = getGeminiCooldownMs(errorInfo);
                if (cooldownMs > 0) {
                    markGeminiKeyCooldown(apiKey, cooldownMs, errorInfo.code);
                }
                console.error(`Brand review error [${modelName}] key ${getMaskedKey(apiKey)}:`, error.message ?? error);

                if (
                    errorInfo.isQuotaExhaustedError ||
                    errorInfo.isRateLimitError ||
                    errorInfo.isLeakedKeyError ||
                    errorInfo.isAuthError
                ) {
                    continue;
                }
                // Non-quota error (bad request, network, etc.) — stop inner loop, try next model.
                break;
            }
        }
    }

    if (lastErrorInfo?.isQuotaExhaustedError || lastErrorInfo?.isRateLimitError) {
        return res.status(429).json({
            error: "All AI keys have hit their free-tier quota. Quotas reset daily — please try again in a few minutes or after midnight.",
            code: lastErrorInfo.code,
        });
    }

    return res.status(503).json(
        withDevDetail(req, { error: "AI service is temporarily unavailable. Please try again later.", code: "AI_UNAVAILABLE" },
            lastErrorInfo?.message)
    );
});

const DESIGN_CRITIQUE_SYSTEM_PROMPT = `You are a senior graphic designer and design educator. Evaluate the given design against 8 professional design frameworks. Do NOT apply brand-specific rules — this is a universal design critique.

════════════════════════════════
STEP 1 — CONTEXT
════════════════════════════════
Identify:
- Type: Poster / Flyer / Social Media / Banner / Other
- Purpose: Event announcement / Promotion / Informational / Other
- Target audience (infer from content)

════════════════════════════════
STEP 2 — 8-FRAMEWORK EVALUATION (100 pts total)
════════════════════════════════

FRAMEWORK 1 — VISUAL HIERARCHY (15 pts) · Gestalt Theory + Information Hierarchy
Ask: What should the viewer see first, second, third?
Validate:
  - Size hierarchy: bigger = more important
  - Color emphasis: accent draws the right eye
  - Placement priority: top / center has strongest read weight
  - Do multiple elements share similar visual weight? → hierarchy conflict
Score deductions: similar-weight elements (−3 each), no clear primary focal point (−5), reading order undefined (−4)

FRAMEWORK 2 — TYPOGRAPHY STANDARDS (15 pts) · Design Systems Approach
Industry expectations:
  - Max 2 font families (heading + body)
  - Clear font scale (H1 > H2 > body)
  - Consistent casing and tracking
  - No decorative misuse (script for body text, all-caps body, etc.)
Score deductions: 3+ font families (−4), no clear scale (−4), inconsistent casing (−3), decorative overuse (−4)

FRAMEWORK 3 — COLOR THEORY & CONSISTENCY (12 pts) · Color Harmony + Semantic Usage
Validate:
  - 2–3 color limit (excluding white/black)
  - Colors have hierarchy: base → accent → highlight
  - Semantic use: one color for emphasis, not scattered randomly
  - Adequate contrast between adjacent colors
Score deductions: 4+ colors without system (−4), no color hierarchy (−3), colors competing for attention (−3), muddy combinations (−2)

FRAMEWORK 4 — LAYOUT & GRID SYSTEM (12 pts) · Grid-based layout principles
Validate:
  - Consistent alignment (implied grid / column structure)
  - Section grouping: related elements clustered
  - Margins and padding are consistent
  - Elements don't float randomly — they sit on a grid
Score deductions: no alignment consistency (−4), random placement (−4), inconsistent margins (−2), no visual sections (−2)

FRAMEWORK 5 — READABILITY & COGNITIVE LOAD (15 pts) · UX + Visual Scanning (F/Z-pattern)
Validate:
  - Key message understood in ≤5 seconds
  - Scanning flow: viewer's eye moves naturally (top→bottom, left→right)
  - Text density: no excessive text blocks
  - Key info (title, date, venue) easy to find without searching
Score deductions: message not clear in 5s (−5), no scanning flow (−4), text-heavy without breaks (−3), key info buried (−3)

FRAMEWORK 6 — BACKGROUND vs FOREGROUND CONTRAST (13 pts) · Figure-Ground Principle (Gestalt)
Validate:
  - Text is readable against its background (check every text block)
  - Background imagery does not compete with foreground text
  - Overlay/scrim applied where needed
  - No camouflage (light text on light bg, dark text on dark bg)
Score deductions: text on busy image without overlay (−5), low contrast text (−4 per instance), background competes with subject (−4)

FRAMEWORK 7 — INSTITUTIONAL DESIGN STANDARDS (10 pts) · Academic/Corporate Poster Conventions
Validate:
  - Formal / professional tone appropriate for the context
  - Structured sections: Title → Organizer → Speaker/Subject → Details → Contact
  - No clip-art, low-quality stock imagery, or visual clichés
  - Clean, minimal, trustworthy presentation
Score deductions: informal tone for formal context (−3), missing structure (−3), low-quality visuals (−2), visual clichés (−2)

FRAMEWORK 8 — PRACTICAL IMPACT (8 pts) · Real-world benchmarking vs university / conference / LinkedIn posters
Ask: How does this compare to well-designed institutional creatives?
  - Would this look credible in a LinkedIn post?
  - Would a conference accept this poster as-is?
  - Does it represent the organization at its best?
Score deductions: would look amateur in a professional context (−4), missing polish (−2), unclear institutional identity (−2)

════════════════════════════════
STEP 3 — ISSUE TIERS
════════════════════════════════
CRITICAL: hierarchy conflict · unreadable text · no structure · figure-ground failure
MAJOR: too many fonts · poor alignment · no color system · scattered layout
MINOR: spacing tweaks · slight color inconsistency · visual polish refinements

════════════════════════════════
STEP 4 — ACTIONABLE FEEDBACK
════════════════════════════════
Be specific. Reference actual elements, colors, font styles, placements.
WRONG: "Improve hierarchy"
RIGHT: "The college name, department name, and event title all use the same font size (approx 24pt) — make the event title 2× larger to establish a clear primary focal point"

WRONG: "Improve contrast"
RIGHT: "The white subtitle text placed over the light blue gradient band has insufficient contrast — switch subtitle text to dark navy #1A1F33 or add a semi-transparent overlay behind the text"

════════════════════════════════
OUTPUT — STRICT JSON
════════════════════════════════

Respond with ONLY a valid JSON object — no markdown, no explanation:

{
  "overallScore": 0,
  "designType": "",
  "purpose": "",
  "targetAudience": "",
  "scores": {
    "visualHierarchy":      {"score": 0, "max": 15, "notes": ""},
    "typography":           {"score": 0, "max": 15, "notes": ""},
    "colorTheory":          {"score": 0, "max": 12, "notes": ""},
    "layoutGrid":           {"score": 0, "max": 12, "notes": ""},
    "readability":          {"score": 0, "max": 15, "notes": ""},
    "contrast":             {"score": 0, "max": 13, "notes": ""},
    "institutionalTone":    {"score": 0, "max": 10, "notes": ""},
    "practicalImpact":      {"score": 0, "max": 8,  "notes": ""}
  },
  "topIssues": [],
  "criticalFixes": [],
  "majorImprovements": [],
  "minorEnhancements": [],
  "designSuggestions": {
    "typography": "",
    "colors": "",
    "layout": ""
  },
  "suggestedLayoutFlow": "",
  "summary": ""
}

FIELD RULES:
- "overallScore": sum of all 8 dimension scores (max 100)
- "designType": specific type observed (e.g., "Event Poster", "Corporate Flyer", "Academic Banner")
- "notes" per score: cite exact observed evidence — actual font style, actual colors, actual placement. Never generic labels.
- "topIssues": top 1–5 specific problems
- "criticalFixes": actionable sentences for CRITICAL issues only
- "majorImprovements": actionable sentences for MAJOR issues
- "minorEnhancements": actionable sentences for MINOR polish
- "designSuggestions.typography": specific recommended font approach
- "designSuggestions.colors": specific palette improvement
- "designSuggestions.layout": structural layout recommendation
- "suggestedLayoutFlow": recommended reading order (e.g., "College identity → Event title → Speaker → Date/Venue → Contact/Footer")
- "summary": 2–3 sharp sentences — what is informationally strong, and what specifically holds it back`;

router.post("/design-critique", async (req, res) => {
    const { imageBase64, mimeType, contextInfo } = req.body || {};
    if (!imageBase64 || !mimeType) {
        return res.status(400).json({ error: "imageBase64 and mimeType are required" });
    }
    const configuredKeys = getConfiguredGeminiKeys();
    if (configuredKeys.length === 0) {
        return res.status(503).json({ error: "AI service is temporarily unavailable.", code: "AI_KEY_MISSING" });
    }
    let promptText = DESIGN_CRITIQUE_SYSTEM_PROMPT;
    if (contextInfo && String(contextInfo).trim()) {
        promptText += `\n\nADDITIONAL CONTEXT:\n${String(contextInfo).trim()}`;
    }

    // Try Groq first
    const groqFirst = await tryGroqBrandReview(imageBase64, mimeType, promptText);
    if (groqFirst && typeof groqFirst.overallScore === "number") return res.json(calibrateDesignCritique(groqFirst));

    let lastErrorInfo = null;
    for (const modelName of BRAND_REVIEW_VISION_MODELS) {
        for (const apiKey of configuredKeys) {
            try {
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent({
                    contents: [{ parts: [{ text: promptText }, { inlineData: { mimeType: String(mimeType), data: String(imageBase64) } }] }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 2500 },
                });
                const text = result.response.text();
                const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
                const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
                if (!jsonMatch) { continue; }
                let review;
                try { review = JSON.parse(jsonMatch[0]); } catch { continue; }
                if (typeof review.overallScore !== "number") { continue; }
                return res.json(calibrateDesignCritique(review));
            } catch (error) {
                const errorInfo = classifyGeminiError(error);
                lastErrorInfo = errorInfo;
                const cooldownMs = getGeminiCooldownMs(errorInfo);
                if (cooldownMs > 0) markGeminiKeyCooldown(apiKey, cooldownMs, errorInfo.code);
                if (errorInfo.isQuotaExhaustedError || errorInfo.isRateLimitError || errorInfo.isLeakedKeyError || errorInfo.isAuthError) continue;
                break;
            }
        }
    }
    return res.status(503).json(withDevDetail(req, { error: "AI service temporarily unavailable.", code: "AI_UNAVAILABLE" }, lastErrorInfo?.message));
});

// Proxy an external image URL server-side to avoid browser CORS restrictions.
router.get("/proxy-image", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "url query param required" });
    }
    try { new URL(url); } catch { return res.status(400).json({ error: "Invalid URL format." }); }
    try {
        const remote = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; SMVEC-DesignDesk/1.0)" },
            redirect: "follow",
        });
        if (!remote.ok) {
            return res.status(400).json({ error: `Remote server returned ${remote.status}` });
        }
        const contentType = remote.headers.get("content-type") ?? "";
        if (!contentType.startsWith("image/")) {
            return res.status(400).json({ error: "URL does not point to an image." });
        }
        const buffer = await remote.arrayBuffer();
        res.set("Content-Type", contentType);
        res.set("Cache-Control", "private, max-age=300");
        res.send(Buffer.from(buffer));
    } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Failed to fetch image" });
    }
});

export default router;
