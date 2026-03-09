import { API_URL, authFetch } from './api';

const AI_ENDPOINT = API_URL ? `${API_URL}/api/ai/gemini` : undefined;

export const TASK_BUDDY_SYSTEM_PROMPT = `You are TaskBuddy AI.

GOAL
- Fill the New Request form with the minimum required details.
- Be crisp and practical.
- Ask only ONE short follow-up question at a time.
- Return READY as soon as the draft is usable.
- Use the user's existing answers instead of re-checking them.

FORM FIELDS YOU MUST PREPARE
- title
- description
- category
- urgency
- deadline
- phone (optional)

VALID CATEGORY VALUES
- banner
- campaign_or_others
- social_media_creative
- website_assets
- ui_ux
- led_backdrop
- brochure
- flyer

VALID URGENCY VALUES
- low
- intermediate
- normal
- urgent

MINIMUM DETAIL REQUIRED BEFORE READY
- what should be designed
- purpose / usage
- category or clear design type
- deadline
- enough detail for a short designer brief

DEFAULTS AND INFERENCE
- Infer category from the user's request when obvious.
- Default urgency to "normal" unless the user clearly wants fast delivery.
- Never ask for phone unless the user asks for WhatsApp updates or gives it.
- If title is missing, create a short professional title yourself.

DESCRIPTION RULES
- Build the description only from the user's information.
- Keep it to 2-3 short sentences.
- Include objective, deliverable/context, and important style/content notes if available.

DEADLINE RULES
- Minimum 3 working days is preferred.
- If the user asks for a shorter deadline, still continue and set urgency to "urgent".

ATTACHMENT RULES
- Before READY, ask once whether the user has any references, assets, logos, screenshots, final text, or brand files.
- If files may help, explicitly tell the user to use the Upload Attachments button.
- If the user says "No attachments" or equivalent, continue without blocking READY.
- Do not skip this attachment check unless files are already uploaded or the user already said they have no attachments.

QUESTION RULES
- Ask ONE question only.
- Keep it very short.
- Maximum 8 words for any follow-up question.
- Prefer options when possible.
- Do not repeat known information.
- Do not ask the same slot twice in different wording.
- Treat these as the same slot: event / purpose / usage / brand / app / school / campaign context.
- If enough info is already available, do not ask extra questions.
- If the user already gave a rough answer, use it and continue.
- Do not ask optional style, color, tone, tagline, copy, or size questions before READY.
- Once deliverable, context/purpose, deadline, and attachment status are known, return READY immediately.

READY RESPONSE
Only when the draft is fully ready, respond ONLY in this format:

STATUS: READY

{
  "title": "",
  "description": "",
  "category": "",
  "urgency": "",
  "deadline": "",
  "phone": ""
}

RULES
- The JSON must be valid.
- category must be one of the allowed category values exactly.
- urgency must be one of the allowed urgency values exactly.
- deadline should be a date that can be parsed into YYYY-MM-DD.
- Do NOT add any extra text outside the required format.
- Do NOT return SAVE_DRAFT or SUBMIT_REQUEST text. The UI will handle the draft action after READY.`;

export interface TaskDraft {
    title: string;
    description: string;
    category: 'banner' | 'campaign_or_others' | 'social_media_creative' | 'website_assets' | 'ui_ux' | 'led_backdrop' | 'brochure' | 'flyer';
    urgency: 'low' | 'intermediate' | 'normal' | 'urgent';
    deadline: string;
    whatsappNumbers?: string[];
    notes?: string;
    phone?: string;
    attachmentsNote?: string;
}

export interface TaskBuddyActionPayload {
    request_title: string;
    description: string;
    category: string;
    urgency: string;
    deadline: string;
    phone?: string;
    attachments_note?: string;
}

export interface TaskBuddyReadyPayload {
    title: string;
    description: string;
    category: string;
    urgency: string;
    deadline: string;
    phone?: string;
}

export interface AIResponse {
    type: 'message' | 'task_draft' | 'action';
    content?: string;
    data?: TaskDraft | TaskBuddyActionPayload;
    action?: 'SAVE_DRAFT' | 'SUBMIT_REQUEST';
    ready?: boolean;
}

const DRAFT_LABELS = [
    'Request Title',
    'Objective',
    'Description',
    'Design Type',
    'Size / Format',
    'Content Copy (Final Tuned)',
    'Design Style Notes',
    'Deadline',
    'Priority',
    'Additional Notes for Designer'
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extractDraftSections = (text: string) => {
    const labelPattern = DRAFT_LABELS.map(escapeRegExp).join('|');
    const regex = new RegExp(`^(${labelPattern})\\s*:\\s*([\\s\\S]*?)(?=^(${labelPattern})\\s*:|\\s*$)`, 'gmi');
    const sections: Record<string, string> = {};
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        const label = match[1].trim();
        const value = match[2].trim();
        sections[label] = value;
    }

    return sections;
};

const mapDesignTypeToCategory = (value: string): TaskDraft['category'] | null => {
    const normalized = value.toLowerCase();
    if (normalized.includes('banner')) return 'banner';
    if (normalized.includes('social')) return 'social_media_creative';
    if (normalized.includes('website')) return 'website_assets';
    if (normalized.includes('ui') || normalized.includes('ux')) return 'ui_ux';
    if (normalized.includes('led')) return 'led_backdrop';
    if (normalized.includes('brochure')) return 'brochure';
    if (normalized.includes('flyer')) return 'flyer';
    if (normalized.includes('campaign')) return 'campaign_or_others';
    return null;
};

const mapPriorityToUrgency = (value: string): TaskDraft['urgency'] | null => {
    const normalized = value.toLowerCase();
    if (normalized.includes('vip') || normalized.includes('urgent') || normalized.includes('high')) {
        return 'urgent';
    }
    if (normalized.includes('medium') || normalized.includes('intermediate')) {
        return 'intermediate';
    }
    if (normalized.includes('low')) {
        return 'low';
    }
    if (normalized.includes('normal') || normalized.includes('standard')) {
        return 'normal';
    }
    return null;
};

const mapActionCategoryToTaskDraft = (value: string): TaskDraft['category'] => {
    const normalized = value.toLowerCase().trim();
    if (normalized === 'banner') return 'banner';
    if (normalized === 'campaign_or_others') return 'campaign_or_others';
    if (normalized === 'social_media_creative') return 'social_media_creative';
    if (normalized === 'website_assets') return 'website_assets';
    if (normalized === 'ui_ux') return 'ui_ux';
    if (normalized === 'led_backdrop') return 'led_backdrop';
    if (normalized === 'brochure') return 'brochure';
    if (normalized === 'flyer') return 'flyer';
    return mapDesignTypeToCategory(normalized) || 'campaign_or_others';
};

const mapActionUrgencyToTaskDraft = (value: string): TaskDraft['urgency'] => {
    const normalized = value.toLowerCase();
    if (normalized.includes('urgent')) return 'urgent';
    if (normalized.includes('intermediate') || normalized.includes('medium')) return 'intermediate';
    if (normalized.includes('low')) return 'low';
    return 'normal';
};

export const mapActionPayloadToDraft = (payload: TaskBuddyActionPayload): TaskDraft => {
    const description = payload.attachments_note
        ? `${payload.description}\n\nAttachments/Notes: ${payload.attachments_note}`.trim()
        : payload.description;
    return {
        title: payload.request_title || 'Design Request',
        description: description || 'Design request details',
        category: mapActionCategoryToTaskDraft(payload.category || ''),
        urgency: mapActionUrgencyToTaskDraft(payload.urgency || ''),
        deadline: payload.deadline || '',
        whatsappNumbers: payload.phone ? [payload.phone] : undefined,
        notes: payload.attachments_note || '',
        phone: payload.phone,
        attachmentsNote: payload.attachments_note
    };
};

export const mapReadyPayloadToDraft = (payload: TaskBuddyReadyPayload): TaskDraft => {
    const normalizedPhone = payload.phone?.trim();
    return {
        title: payload.title || 'Design Request',
        description: payload.description || 'Design request details',
        category: mapActionCategoryToTaskDraft(payload.category || ''),
        urgency: mapActionUrgencyToTaskDraft(payload.urgency || ''),
        deadline: payload.deadline ? toIsoDate(payload.deadline) : '',
        whatsappNumbers: normalizedPhone ? [normalizedPhone] : undefined,
        phone: normalizedPhone
    };
};

const extractReadyPayload = (text: string): TaskBuddyReadyPayload | null => {
    if (!/STATUS:\s*READY/i.test(text)) return null;
    const statusIndex = text.search(/STATUS:\s*READY/i);
    const startIndex = text.indexOf('{', statusIndex);
    const endIndex = text.lastIndexOf('}');
    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) return null;
    const jsonText = text.slice(startIndex, endIndex + 1);
    try {
        const parsed = JSON.parse(jsonText);
        if (parsed && typeof parsed === 'object') {
            return parsed as TaskBuddyReadyPayload;
        }
    } catch {
        return null;
    }
    return null;
};

const toIsoDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseTaskDraftFromText = (text: string): TaskDraft | null => {
    const sections = extractDraftSections(text);
    if (!sections['Request Title'] && !sections['Description'] && !sections['Design Type']) {
        return null;
    }

    const descriptionParts = [
        sections['Description'],
        sections['Content Copy (Final Tuned)'] ? `Content Copy: ${sections['Content Copy (Final Tuned)']}` : '',
        sections['Design Style Notes'] ? `Design Style Notes: ${sections['Design Style Notes']}` : ''
    ].filter(Boolean);

    const category = mapDesignTypeToCategory(sections['Design Type'] || '');
    const urgency = mapPriorityToUrgency(sections['Priority'] || '');

    const draft: TaskDraft = {
        title: sections['Request Title'] || 'Design Request',
        description: descriptionParts.join('\n\n') || sections['Objective'] || 'Design request details',
        category: category || 'campaign_or_others',
        urgency: urgency || 'normal',
        deadline: sections['Deadline'] ? toIsoDate(sections['Deadline']) : '',
        notes: sections['Additional Notes for Designer'] || ''
    };

    return draft;
};

export async function sendMessageToAI(
    messages: { role: 'user' | 'model'; parts: string }[],
    userMessage: string
): Promise<AIResponse> {
    if (!AI_ENDPOINT) {
        throw new Error('AI endpoint is not configured. Please set VITE_API_URL or run the backend locally.');
    }

    try {
        const response = await authFetch(AI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages,
                userMessage,
                systemPrompt: TASK_BUDDY_SYSTEM_PROMPT
            })
        });

        if (!response.ok) {
            let errorMessage = response.statusText;
            let errorCode = '';
            try {
                const errorBody = await response.json();
                if (errorBody?.error) {
                    errorMessage = errorBody.error;
                }
                if (errorBody?.detail && typeof errorBody.detail === 'string' && errorBody.detail.trim()) {
                    errorMessage = `${errorMessage} (${errorBody.detail.trim()})`;
                }
                if (errorBody?.code) {
                    errorCode = String(errorBody.code);
                }
            } catch {
                // Ignore JSON parse failures
            }

            const loweredError = String(errorMessage || '').toLowerCase();
            const isQuotaExhausted =
                errorCode === 'AI_QUOTA_EXHAUSTED' ||
                loweredError.includes('exceeded your current quota') ||
                loweredError.includes('insufficient quota') ||
                (loweredError.includes('quota') && loweredError.includes('billing'));

            if (isQuotaExhausted) {
                throw new Error('AI quota exceeded. Update Gemini billing/quota or use a different project key.');
            }

            if (response.status === 429 || errorCode === 'AI_QUOTA_EXCEEDED') {
                throw new Error('Rate limit. Try again in 1 minute.');
            }

            if (
                errorCode === 'AI_KEY_LEAKED'
            ) {
                throw new Error('Gemini API key is blocked because it was reported as leaked. Replace the configured key.');
            }

            if (
                errorCode === 'AI_KEY_MISSING' ||
                errorCode === 'AI_AUTH_UNAVAILABLE' ||
                errorCode === 'AI_UNAVAILABLE' ||
                response.status >= 500
            ) {
                throw new Error(errorMessage || 'AI service is temporarily unavailable. Please contact admin.');
            }

            throw new Error(errorMessage || 'Unable to process AI request right now.');
        }

        const data = await response.json();
        if (data?.ready === true && data?.data && typeof data.data === 'object') {
            const draft = mapReadyPayloadToDraft(data.data as TaskBuddyReadyPayload);
            return {
                type: 'task_draft',
                data: draft,
                ready: true
            };
        }

        const text = String(data?.message ?? data?.text ?? '');

        // Try to parse as JSON first
        try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed === 'object') {
                if (parsed.action === 'SAVE_DRAFT' || parsed.action === 'SUBMIT_REQUEST') {
                    return {
                        type: 'action',
                        action: parsed.action,
                        data: parsed.data as TaskBuddyActionPayload
                    };
                }
                if (parsed.type === 'message' || parsed.type === 'task_draft') {
                    return parsed as AIResponse;
                }
            }
        } catch {
            const readyPayload = extractReadyPayload(text);
            if (readyPayload) {
                const draft = mapReadyPayloadToDraft(readyPayload);
                const validation = validateTaskDraft(draft);
                if (validation.valid) {
                    return {
                        type: 'task_draft',
                        data: draft,
                        ready: true
                    };
                }
            }
            const draft = parseTaskDraftFromText(text);
            if (draft) {
                const validation = validateTaskDraft(draft);
                if (validation.valid) {
                    return {
                        type: 'task_draft',
                        data: draft
                    };
                }
            }

            // If not JSON or draft, return as regular message
            return {
                type: 'message',
                content: text
            };
        }

        // If JSON parsed but did not match known shapes, treat as message
        return {
            type: 'message',
            content: text
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown AI error';
        const lowerMessage = errorMessage.toLowerCase();

        const isQuotaExhausted =
            lowerMessage.includes('exceeded your current quota') ||
            lowerMessage.includes('insufficient quota') ||
            (lowerMessage.includes('quota') && lowerMessage.includes('billing'));
        if (isQuotaExhausted) {
            throw new Error('AI quota exceeded. Update Gemini billing/quota or use a different project key.');
        }

        if (
            errorMessage.includes('429') ||
            lowerMessage.includes('rate limit') ||
            lowerMessage.includes('too many requests')
        ) {
            throw new Error('Rate limit. Try again in 1 minute.');
        }

        throw new Error(errorMessage || 'Unable to process AI request right now.');
    }
}

export function validateTaskDraft(draft: Partial<TaskDraft>): { valid: boolean; missing: string[] } {
    const required = ['title', 'description', 'category', 'urgency', 'deadline'];
    const missing = required.filter(field => !draft[field as keyof TaskDraft]);

    return {
        valid: missing.length === 0,
        missing
    };
}


