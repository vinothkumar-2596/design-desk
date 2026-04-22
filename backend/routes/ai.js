import express from "express";
import { generateAIContent } from "../lib/ollama.js";
import AIFile from "../models/AIFile.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(requireRole(["staff", "designer", "treasurer"]));

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

const BRAND_REVIEW_SYSTEM_PROMPT = `You are an expert Brand Compliance and Design Review AI for SMVEC (Sri Manakula Vinayagar Engineering College), an autonomous NAAC "A"-graded engineering institution in Puducherry, India.

SMVEC OFFICIAL BRAND GUIDELINES — USE THESE AS YOUR REFERENCE:

COLORS (MANDATORY):
- Primary: Royal Blue #36429B
- Accent: Golden Age #DBA328
- Neutral: Black #000000, White #FFFFFF
- Allowed backgrounds: White or Royal Blue only (Gold only as wordmark sublabel)
- FORBIDDEN colors: Purple, pink, neon, bright red, green, orange, or any off-brand color

TYPOGRAPHY:
- Display/Headings: Google Sans Display (Regular weight preferred)
- Body/UI: Google Sans Text 17pt
- Anniversary script: Great Vibes (ONLY for the official "26 YEARS" lockup — forbidden elsewhere)
- Forbidden: informal/decorative fonts, Comic Sans, script fonts other than the anniversary mark

LOGO RULES:
- SMVEC logo = botanical tree-and-lamp emblem + optional "26 YEARS" script + wordmark
- Must maintain clear space (minimum = logo height ÷ 4 on all sides)
- Must NOT be: distorted, stretched, rotated, recolored, shadowed, outlined, or placed on patterns/textures
- Approved backgrounds only: white or royal blue
- If logo is absent from a design that requires it, deduct all logo points

BRAND TONE:
- Institutional, professional, academic
- Structured hierarchy, no decorative excess
- Conservative layout; informal styles are non-compliant

SCORING DIMENSIONS:
1. BRAND COMPLIANCE (40 pts max):
   - Logo presence, size, placement, clear space (10 pts)
   - Color palette compliance with approved palette (10 pts)
   - Typography — correct fonts and hierarchy (10 pts)
   - Overall brand identity adherence (10 pts)

2. DESIGN QUALITY (35 pts max):
   - Visual hierarchy and layout structure (10 pts)
   - Alignment, spacing, balance (10 pts)
   - Readability and contrast (8 pts)
   - Professional/institutional feel (7 pts)

3. CONTENT ACCURACY (15 pts max):
   - Text clarity, grammar, spelling (8 pts)
   - Information completeness (7 pts)

4. TECHNICAL QUALITY (10 pts max):
   - Apparent image resolution quality (5 pts)
   - Print/web readiness (5 pts)

APPROVAL THRESHOLDS:
- 90–100 → "Approved"
- 75–89 → "Approved with Minor Corrections"
- 55–74 → "Needs Revision"
- Below 55 → "Rejected"

Be rigorous. Penalize clearly. If logo is absent where required, score 0 for logo. If forbidden colors appear, deduct heavily.

Respond with ONLY a valid JSON object — no markdown, no explanation, just JSON:
{
  "overallScore": 0,
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
  "topIssues": [],
  "suggestions": [],
  "summary": ""
}`;

router.post("/brand-review", async (req, res) => {
    const { imageBase64, mimeType, contextInfo } = req.body || {};

    if (!imageBase64 || !mimeType) {
        return res.status(400).json({ error: "imageBase64 and mimeType are required" });
    }

    const configuredKeys = getConfiguredGeminiKeys();
    if (configuredKeys.length === 0) {
        return res.status(503).json({ error: "AI service is temporarily unavailable.", code: "AI_KEY_MISSING" });
    }

    const keyPool = getGeminiKeyPool();
    if (keyPool.keys.length === 0) {
        const retryAfterSeconds = keyPool.nextRetryAt
            ? Math.max(1, Math.ceil((keyPool.nextRetryAt - Date.now()) / 1000))
            : 60;
        return res.status(429).json({
            error: `AI service is cooling down. Try again in ${retryAfterSeconds} seconds.`,
            code: "AI_QUOTA_EXCEEDED",
            retry_after_seconds: retryAfterSeconds,
        });
    }

    let promptText = BRAND_REVIEW_SYSTEM_PROMPT;
    if (contextInfo && String(contextInfo).trim()) {
        promptText += `\n\nADDITIONAL CONTEXT:\n${String(contextInfo).trim()}`;
    }

    let lastErrorInfo = null;

    for (const apiKey of keyPool.keys) {
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

            const result = await model.generateContent({
                contents: [{
                    parts: [
                        { text: promptText },
                        { inlineData: { mimeType: String(mimeType), data: String(imageBase64) } },
                    ],
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 1500,
                },
            });

            const text = result.response.text();
            const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return res.status(500).json({ error: "AI did not return a valid review. Please try again." });
            }
            const review = JSON.parse(jsonMatch[0]);
            advanceGeminiKeyCursor(apiKey);
            return res.json(review);
        } catch (error) {
            const errorInfo = classifyGeminiError(error);
            lastErrorInfo = errorInfo;
            const cooldownMs = getGeminiCooldownMs(errorInfo);
            if (cooldownMs > 0) {
                markGeminiKeyCooldown(apiKey, cooldownMs, errorInfo.code);
            }
            console.error(`Brand review Gemini error for key ${getMaskedKey(apiKey)}:`, error);

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

    if (lastErrorInfo?.isQuotaExhaustedError || lastErrorInfo?.isRateLimitError) {
        return res.status(429).json({
            error: "AI quota exhausted. Please try again later.",
            code: lastErrorInfo.code,
        });
    }

    return res.status(503).json(
        withDevDetail(req, { error: "AI service is temporarily unavailable. Please try again later.", code: "AI_UNAVAILABLE" },
            lastErrorInfo?.message)
    );
});

export default router;
