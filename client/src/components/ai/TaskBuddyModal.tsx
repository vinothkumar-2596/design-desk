import { useState, useRef, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Loader2, CheckCircle2, X, Paperclip, User, Mic } from 'lucide-react';
import { sendMessageToAI, mapActionPayloadToDraft, type TaskDraft, type AIResponse, type TaskBuddyActionPayload } from '@/lib/ai';
import { toast } from 'sonner';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

type WizardSlot = 'deliverable' | 'context' | 'details' | 'category' | 'urgency' | 'deadline' | 'attachments' | 'unknown';
type AttachmentState = 'unknown' | 'provided' | 'skipped';

interface WizardState {
    deliverable: string;
    context: string;
    details: string;
    category: TaskDraft['category'] | '';
    urgency: TaskDraft['urgency'] | '';
    deadline: string;
    attachmentState: AttachmentState;
    askedCounts: Record<WizardSlot, number>;
}

const ATTACHMENT_SKIP_PATTERNS = [
    /\bno attachments?\b/i,
    /\bno references?\b/i,
    /\bno assets?\b/i,
    /\bno files?\b/i,
    /\bdon'?t have (?:any )?(?:attachments?|references?|assets?|files?|logos?|screenshots?|brand files?|final text)\b/i,
    /\bdo not have (?:any )?(?:attachments?|references?|assets?|files?|logos?|screenshots?|brand files?|final text)\b/i,
    /\bwithout (?:attachments?|references?|assets?|files?)\b/i,
];

const hasAttachmentOptOut = (messages: Message[]) =>
    messages.some((message) =>
        message.role === 'user' &&
        ATTACHMENT_SKIP_PATTERNS.some((pattern) => pattern.test(message.content))
    );

const buildAttachmentRequestMessage = () =>
    'Before I finish this draft, do you have any reference files, brand assets, logos, screenshots, or final content? Use Upload Attachments, or reply "No attachments".';

const READY_NUDGE_MESSAGE =
    'All required details are already collected. Return STATUS: READY now. Do not ask any more questions.';

const DELIVERABLE_HINTS = [
    { label: 'LED backdrop', patterns: [/\bled\b/i, /\bbackdrop\b/i, /\bstage\b/i] },
    { label: 'website asset', patterns: [/\bwebsite\b/i, /\bwebpage\b/i, /\bhomepage\b/i, /\blanding page\b/i, /\bhero\b/i] },
    { label: 'UI/UX screen', patterns: [/\bui\b/i, /\bux\b/i, /\bapp screen\b/i, /\bdashboard\b/i, /\bwireframe\b/i, /\bprototype\b/i] },
    { label: 'social media creative', patterns: [/\bsocial\b/i, /\bpost\b/i, /\bstory\b/i, /\breel\b/i, /\binstagram\b/i, /\bfacebook\b/i] },
    { label: 'brochure', patterns: [/\bbrochure\b/i, /\bcatalog\b/i] },
    { label: 'flyer', patterns: [/\bflyer\b/i, /\bleaflet\b/i, /\bhandbill\b/i] },
    { label: 'banner', patterns: [/\bbanner\b/i, /\bstandee\b/i, /\bflex\b/i] },
    { label: 'logo', patterns: [/\blogo\b/i] },
    { label: 'branding', patterns: [/\bbranding\b/i, /\bbrand identity\b/i] },
    { label: 'campaign creative', patterns: [/\bcampaign\b/i, /\bposter\b/i, /\binvite\b/i, /\binvitation\b/i] },
];

const CATEGORY_HINTS: Array<{ value: TaskDraft['category']; patterns: RegExp[] }> = [
    { value: 'banner', patterns: [/\bbanner\b/i, /\bstandee\b/i, /\bflex\b/i] },
    { value: 'social_media_creative', patterns: [/\bsocial\b/i, /\bpost\b/i, /\bstory\b/i, /\breel\b/i, /\binstagram\b/i, /\bfacebook\b/i] },
    { value: 'website_assets', patterns: [/\bwebsite\b/i, /\bweb\b/i, /\blanding\b/i, /\bhomepage\b/i, /\bhero\b/i] },
    { value: 'ui_ux', patterns: [/\bui\b/i, /\bux\b/i, /\bapp\b/i, /\bscreen\b/i, /\bdashboard\b/i, /\bwireframe\b/i, /\bprototype\b/i] },
    { value: 'led_backdrop', patterns: [/\bled\b/i, /\bbackdrop\b/i, /\bstage\b/i] },
    { value: 'brochure', patterns: [/\bbrochure\b/i, /\bcatalog\b/i] },
    { value: 'flyer', patterns: [/\bflyer\b/i, /\bleaflet\b/i, /\bhandbill\b/i] },
    { value: 'campaign_or_others', patterns: [/\bcampaign\b/i, /\blogo\b/i, /\bbranding\b/i, /\bposter\b/i, /\binvite\b/i, /\binvitation\b/i] },
];

const URGENCY_HINTS: Array<{ value: TaskDraft['urgency']; patterns: RegExp[] }> = [
    { value: 'urgent', patterns: [/\burgent\b/i, /\basap\b/i, /\bimmediate(?:ly)?\b/i, /\bhigh priority\b/i, /\btoday\b/i, /\btomorrow\b/i] },
    { value: 'intermediate', patterns: [/\bintermediate\b/i, /\bmedium\b/i] },
    { value: 'low', patterns: [/\blow\b/i] },
    { value: 'normal', patterns: [/\bnormal\b/i, /\bstandard\b/i, /\bregular\b/i] },
];

const DEADLINE_PATTERN =
    /\b(today|tomorrow|tonight|this\s+(?:morning|afternoon|evening|week|month)|(?:this|next)\s+(?:monday|mon|tuesday|tue|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun)|monday|mon|tuesday|tue|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun|next\s+\w+|\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\s+\d{1,2}(?:,?\s+\d{4})?)\b/i;

const ATTACHMENT_PROVIDED_PATTERNS = [
    /\bi uploaded\b/i,
    /\bi attached\b/i,
    /\buploaded\b/i,
    /\battached\b/i,
    /\bshared\b.*\b(file|logo|reference|asset|document|content)\b/i,
];

const normalizeSpace = (value: string) => String(value || '').replace(/\s+/g, ' ').trim();

const cleanSlotValue = (value: string) =>
    normalizeSpace(value)
        .replace(/^[,.\-:;]+/, '')
        .replace(/[,.\-:;]+$/, '')
        .trim();

const inferDeliverable = (text: string) => {
    const normalized = normalizeSpace(text);
    for (const hint of DELIVERABLE_HINTS) {
        if (hint.patterns.some((pattern) => pattern.test(normalized))) {
            return hint.label;
        }
    }
    return '';
};

const stripDeliverableWords = (text: string) => {
    let value = normalizeSpace(text);
    for (const hint of DELIVERABLE_HINTS) {
        for (const pattern of hint.patterns) {
            value = value.replace(pattern, ' ');
        }
    }
    return normalizeSpace(
        value.replace(/\b(?:need|create|make|design|request|for|the|a|an|just|please|modern|new|simple|only)\b/gi, ' ')
    );
};

const extractContextCandidate = (text: string) => {
    const normalized = normalizeSpace(text);
    const explicitMatch = normalized.match(/\b(?:for|about|regarding|for this|for the)\b\s+(.+)$/i);
    if (explicitMatch) {
        return cleanSlotValue(explicitMatch[1]);
    }
    const remainder = stripDeliverableWords(normalized);
    return remainder.split(' ').filter(Boolean).length >= 2 ? cleanSlotValue(remainder) : '';
};

const extractDetailsCandidate = (text: string) => {
    const normalized = cleanSlotValue(text);
    if (!normalized) return '';
    if (ATTACHMENT_SKIP_PATTERNS.some((pattern) => pattern.test(normalized))) return '';
    if (ATTACHMENT_PROVIDED_PATTERNS.some((pattern) => pattern.test(normalized))) return '';
    if (extractDeadlineCandidate(normalized)) return '';
    const stripped = normalizeSpace(
        stripDeliverableWords(normalized).replace(
            /\b(?:need|create|make|design|request|for|about|regarding|just|please|want|require|required|title)\b/gi,
            ' '
        )
    );
    const words = stripped.split(/\s+/).filter(Boolean);
    if (words.length < 3) return '';
    return stripped;
};

const extractCategoryCandidate = (text: string): TaskDraft['category'] | '' => {
    const normalized = normalizeSpace(text);
    for (const hint of CATEGORY_HINTS) {
        if (hint.patterns.some((pattern) => pattern.test(normalized))) {
            return hint.value;
        }
    }
    return '';
};

const extractUrgencyCandidate = (text: string): TaskDraft['urgency'] | '' => {
    const normalized = normalizeSpace(text);
    for (const hint of URGENCY_HINTS) {
        if (hint.patterns.some((pattern) => pattern.test(normalized))) {
            return hint.value;
        }
    }
    return '';
};

const extractDeadlineCandidate = (text: string) => {
    const normalized = normalizeSpace(text);
    const match = normalized.match(DEADLINE_PATTERN);
    return match ? cleanSlotValue(match[0]) : '';
};

const inferQuestionSlot = (content: string): WizardSlot => {
    const lower = normalizeSpace(content).toLowerCase();
    if (!lower) return 'unknown';
    if (
        lower.includes('attachment') ||
        lower.includes('reference') ||
        lower.includes('asset') ||
        lower.includes('logo file') ||
        lower.includes('screenshot') ||
        lower.includes('upload')
    ) {
        return 'attachments';
    }
    if (
        lower.includes('deadline') ||
        lower.includes('when do you need') ||
        lower.includes('by when') ||
        lower.includes('needed by')
    ) {
        return 'deadline';
    }
    if (
        lower.includes('what should be designed') ||
        lower.includes('what do you need designed') ||
        lower.includes('what specific elements') ||
        lower.includes('which elements') ||
        /\bwhat\b.*\bdesign(?:ed)?\b/.test(lower)
    ) {
        return 'deliverable';
    }
    if (
        lower.includes('purpose') ||
        lower.includes('what is it for') ||
        lower.includes('what is this for') ||
        lower.includes('what is the event about') ||
        lower.includes('what is it about') ||
        lower.includes('designed for') ||
        lower.includes('displayed on') ||
        lower.includes('display on') ||
        lower.includes('what should be displayed') ||
        lower.includes('who is it for') ||
        lower.includes('what is the name of') ||
        lower.includes('which brand') ||
        lower.includes('which app') ||
            lower.includes('which school') ||
            lower.includes('which company')
    ) {
        return 'context';
    }
    if (
        lower.includes('details') ||
        lower.includes('brief') ||
        lower.includes('requirements') ||
        lower.includes('special instruction') ||
        lower.includes('key detail')
    ) {
        return 'details';
    }
    if (lower.includes('category')) {
        return 'category';
    }
    if (
        lower.includes('urgency') ||
        lower.includes('priority') ||
        lower.includes('normal or urgent') ||
        lower.includes('how urgent')
    ) {
        return 'urgency';
    }
    return 'unknown';
};

const createEmptyAskedCounts = (): Record<WizardSlot, number> => ({
    deliverable: 0,
    context: 0,
    details: 0,
    category: 0,
    urgency: 0,
    deadline: 0,
    attachments: 0,
    unknown: 0,
});

const buildWizardState = (messages: Message[], attachmentsUploaded: boolean): WizardState => {
    const state: WizardState = {
        deliverable: '',
        context: '',
        details: '',
        category: '',
        urgency: '',
        deadline: '',
        attachmentState: attachmentsUploaded ? 'provided' : 'unknown',
        askedCounts: createEmptyAskedCounts(),
    };

    let pendingSlot: WizardSlot = 'unknown';

    for (const message of messages) {
        const content = cleanSlotValue(message.content);
        if (!content) continue;

        if (message.role === 'assistant') {
            pendingSlot = inferQuestionSlot(content);
            state.askedCounts[pendingSlot] += 1;
            continue;
        }

        if (ATTACHMENT_SKIP_PATTERNS.some((pattern) => pattern.test(content))) {
            state.attachmentState = 'skipped';
        } else if (ATTACHMENT_PROVIDED_PATTERNS.some((pattern) => pattern.test(content))) {
            state.attachmentState = 'provided';
        }

        if (pendingSlot === 'deliverable' && !state.deliverable) {
            state.deliverable = content;
        } else if (pendingSlot === 'context' && !state.context) {
            state.context = content;
        } else if (pendingSlot === 'details' && !state.details) {
            state.details = content;
        } else if (pendingSlot === 'category' && !state.category) {
            state.category = extractCategoryCandidate(content);
        } else if (pendingSlot === 'urgency' && !state.urgency) {
            state.urgency = extractUrgencyCandidate(content);
        } else if (pendingSlot === 'deadline' && !state.deadline) {
            state.deadline = content;
        } else if (pendingSlot === 'attachments' && state.attachmentState === 'unknown') {
            state.attachmentState = attachmentsUploaded ? 'provided' : 'skipped';
        }

        if (!state.deliverable) {
            state.deliverable = inferDeliverable(content);
        }
        if (!state.context) {
            state.context = extractContextCandidate(content);
        }
        if (!state.details) {
            state.details = extractDetailsCandidate(content);
        }
        if (!state.category) {
            state.category = extractCategoryCandidate(content);
        }
        if (!state.urgency) {
            state.urgency = extractUrgencyCandidate(content);
        }
        if (!state.deadline) {
            state.deadline = extractDeadlineCandidate(content);
        }

        pendingSlot = 'unknown';
    }

    return state;
};

const getContextQuestion = (state: WizardState) => {
    const lowerDeliverable = state.deliverable.toLowerCase();
    if (lowerDeliverable.includes('website')) return 'What is the website for?';
    if (lowerDeliverable.includes('logo') || lowerDeliverable.includes('branding')) return 'Which brand or app?';
    return 'What is it for?';
};

const getCanonicalQuestion = (slot: WizardSlot, state: WizardState) => {
    switch (slot) {
        case 'deliverable':
            return 'What should be designed?';
        case 'context':
            return getContextQuestion(state);
        case 'details':
            return 'Any key details?';
        case 'category':
            return 'Which category fits best?';
        case 'urgency':
            return 'Urgency normal or urgent?';
        case 'deadline':
            return 'When do you need it?';
        case 'attachments':
            return buildAttachmentRequestMessage();
        default:
            return '';
    }
};

const isSlotSatisfied = (slot: WizardSlot, state: WizardState, attachmentsUploaded: boolean) => {
    switch (slot) {
        case 'deliverable':
            return Boolean(state.deliverable);
        case 'context':
            return Boolean(state.context);
        case 'details':
            return Boolean(state.details);
        case 'category':
            return Boolean(state.category);
        case 'urgency':
            return Boolean(state.urgency);
        case 'deadline':
            return Boolean(state.deadline);
        case 'attachments':
            return attachmentsUploaded || state.attachmentState !== 'unknown';
        default:
            return false;
    }
};

const getNextMissingQuestion = (state: WizardState, attachmentsUploaded: boolean) => {
    if (!state.deliverable) return getCanonicalQuestion('deliverable', state);
    if (!state.context) return getCanonicalQuestion('context', state);
    if (!state.details) return getCanonicalQuestion('details', state);
    if (!state.category) return getCanonicalQuestion('category', state);
    if (!state.urgency) return getCanonicalQuestion('urgency', state);
    if (!state.deadline) return getCanonicalQuestion('deadline', state);
    if (!attachmentsUploaded && state.attachmentState === 'unknown') {
        return buildAttachmentRequestMessage();
    }
    return '';
};

const buildLiveTaskContext = (state: WizardState, attachmentsUploaded: boolean) => {
    const knownDetails = [
        state.deliverable ? `- deliverable: ${state.deliverable}` : '',
        state.context ? `- context: ${state.context}` : '',
        state.details ? `- details: ${state.details}` : '',
        state.category ? `- category: ${state.category}` : '',
        state.urgency ? `- urgency: ${state.urgency}` : '',
        state.deadline ? `- deadline: ${state.deadline}` : '',
        attachmentsUploaded
            ? '- attachments: already uploaded'
            : state.attachmentState === 'skipped'
                ? '- attachments: user said no attachments'
                : '',
    ].filter(Boolean);

    const nextMissing = getNextMissingQuestion(state, attachmentsUploaded);

    return [
        'LIVE TASK STATE:',
        ...(knownDetails.length > 0 ? knownDetails : ['- no confirmed details yet']),
        'STRICT REPLY RULES:',
        '- Do not ask again about known details.',
        '- Ask one short question only.',
        '- Maximum 8 words.',
        '- Never repeat or rephrase the same slot.',
        '- Do not ask optional style or copy questions before READY.',
        nextMissing
            ? `- Ask only for this missing item next: ${nextMissing}`
            : '- All minimum fields are already collected. Return STATUS: READY now.',
    ].join('\n');
};

const normalizeAssistantReply = (
    content: string,
    state: WizardState,
    attachmentsUploaded: boolean
) => {
    const normalized = normalizeSpace(content);
    const fallbackQuestion = getNextMissingQuestion(state, attachmentsUploaded);
    const slot = inferQuestionSlot(normalized);

    if (!normalized) {
        return fallbackQuestion;
    }

    if (slot !== 'unknown') {
        if (isSlotSatisfied(slot, state, attachmentsUploaded)) {
            return fallbackQuestion || normalized;
        }

        const slotWasAskedAlready = state.askedCounts[slot] > 0;
        if (slotWasAskedAlready && fallbackQuestion && fallbackQuestion !== getCanonicalQuestion(slot, state)) {
            return fallbackQuestion;
        }

        return getCanonicalQuestion(slot, state) || normalized;
    }

    const looksVerbose =
        normalized.length > 90 ||
        normalized.split(/[.?!]/).filter(Boolean).length > 1 ||
        normalized.toLowerCase().startsWith('i need') ||
        normalized.toLowerCase().startsWith('the purpose');

    if (looksVerbose && fallbackQuestion) {
        return fallbackQuestion;
    }

    return normalized;
};

const toIsoDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

const WEEKDAY_TO_INDEX: Record<string, number> = {
    sun: 0,
    sunday: 0,
    mon: 1,
    monday: 1,
    tue: 2,
    tuesday: 2,
    wed: 3,
    wednesday: 3,
    thu: 4,
    thur: 4,
    thurs: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6,
};

const parseWeekdayToIso = (value: string) => {
    const match = normalizeSpace(value).match(
        /\b(?:(this|next)\s+)?(monday|mon|tuesday|tue|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun)\b/i
    );
    if (!match) return '';

    const qualifier = String(match[1] || '').toLowerCase();
    const weekday = String(match[2] || '').toLowerCase();
    const targetDay = WEEKDAY_TO_INDEX[weekday];
    if (typeof targetDay !== 'number') return '';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let delta = targetDay - today.getDay();

    if (qualifier === 'next') {
        if (delta <= 0) delta += 7;
    } else if (delta < 0) {
        delta += 7;
    }

    return toIsoDateString(addDays(today, delta));
};

const parseDeadlineToIso = (value: string) => {
    const normalized = normalizeSpace(value).toLowerCase();
    if (!normalized) return '';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (normalized === 'today' || normalized.includes('today')) {
        return toIsoDateString(today);
    }

    if (normalized.includes('tomorrow') || normalized.includes('tmrw')) {
        return toIsoDateString(addDays(today, 1));
    }

    if (normalized.includes('next week')) {
        return toIsoDateString(addDays(today, 7));
    }

    const weekdayIso = parseWeekdayToIso(normalized);
    if (weekdayIso) {
        return weekdayIso;
    }

    const numericMatch = normalized.match(/(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/);
    if (numericMatch) {
        const day = Number(numericMatch[1]);
        const month = Number(numericMatch[2]);
        let year = numericMatch[3] ? Number(numericMatch[3]) : today.getFullYear();
        if (year < 100) year += 2000;
        const parsed = new Date(year, month - 1, day);
        if (!Number.isNaN(parsed.getTime())) {
            return toIsoDateString(parsed);
        }
    }

    const monthMatch = normalized.match(
        /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?,?\s*(\d{1,2})(?:,?\s*(\d{4}))?/i
    );
    if (monthMatch) {
        const monthMap: Record<string, number> = {
            jan: 0,
            january: 0,
            feb: 1,
            february: 1,
            mar: 2,
            march: 2,
            apr: 3,
            april: 3,
            may: 4,
            jun: 5,
            june: 5,
            jul: 6,
            july: 6,
            aug: 7,
            august: 7,
            sep: 8,
            sept: 8,
            september: 8,
            oct: 9,
            october: 9,
            nov: 10,
            november: 10,
            dec: 11,
            december: 11,
        };
        const monthIndex = monthMap[monthMatch[1].toLowerCase()];
        const day = Number(monthMatch[2]);
        const year = monthMatch[3] ? Number(monthMatch[3]) : today.getFullYear();
        const parsed = new Date(year, monthIndex, day);
        if (!Number.isNaN(parsed.getTime())) {
            return toIsoDateString(parsed);
        }
    }

    const nativeDate = new Date(value);
    if (!Number.isNaN(nativeDate.getTime())) {
        nativeDate.setHours(0, 0, 0, 0);
        return toIsoDateString(nativeDate);
    }

    return '';
};

const toTitleCase = (value: string) =>
    normalizeSpace(value)
        .replace(/\b\w/g, (char) => char.toUpperCase());

const mapDeliverableToCategory = (value: string): TaskDraft['category'] => {
    const lower = value.toLowerCase();
    if (lower.includes('led') || lower.includes('backdrop') || lower.includes('stage')) return 'led_backdrop';
    if (lower.includes('social') || lower.includes('post') || lower.includes('story') || lower.includes('reel')) return 'social_media_creative';
    if (lower.includes('website') || lower.includes('web') || lower.includes('landing') || lower.includes('hero')) return 'website_assets';
    if (lower.includes('ui') || lower.includes('ux') || lower.includes('screen') || lower.includes('dashboard')) return 'ui_ux';
    if (lower.includes('brochure') || lower.includes('catalog')) return 'brochure';
    if (lower.includes('flyer') || lower.includes('leaflet')) return 'flyer';
    if (lower.includes('banner') || lower.includes('standee') || lower.includes('flex')) return 'banner';
    return 'campaign_or_others';
};

const inferUrgencyFromDeadline = (isoDate: string): TaskDraft['urgency'] => {
    if (!isoDate) return 'normal';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(isoDate);
    deadlineDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((deadlineDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays <= 2) return 'urgent';
    if (diffDays <= 4) return 'intermediate';
    return 'normal';
};

const cleanContextForDraft = (context: string, deliverable: string) => {
    if (!context) return '';
    const deliverableWords = normalizeSpace(deliverable).split(' ').filter(Boolean);
    let cleaned = normalizeSpace(context);
    for (const word of deliverableWords) {
        if (word.length < 3) continue;
        const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'ig');
        cleaned = cleaned.replace(pattern, ' ');
    }
    cleaned = normalizeSpace(cleaned.replace(/\b(?:a|an|the|for|this)\b/gi, ' '));
    return cleaned;
};

const cleanDetailsForDraft = (details: string, deliverable: string, context: string) => {
    const normalized = normalizeSpace(details);
    if (!normalized) return '';
    const lowerDetails = normalized.toLowerCase();
    const lowerDeliverable = normalizeSpace(deliverable).toLowerCase();
    const lowerContext = normalizeSpace(context).toLowerCase();
    if (lowerDetails === lowerDeliverable || lowerDetails === lowerContext) {
        return '';
    }
    return normalized;
};

const buildLocalTaskDraft = (state: WizardState, attachmentsUploaded: boolean): TaskDraft | null => {
    const deliverable = cleanSlotValue(state.deliverable);
    const context = cleanContextForDraft(state.context, deliverable);
    const details = cleanDetailsForDraft(state.details, deliverable, context);
    const deadline = parseDeadlineToIso(state.deadline);

    if (!deliverable || !details || !deadline) {
        return null;
    }

    const category = state.category || mapDeliverableToCategory(`${deliverable} ${context}`.trim());
    const urgency = state.urgency || inferUrgencyFromDeadline(deadline);
    const deliverableTitle = toTitleCase(deliverable);
    const contextTitle = context ? toTitleCase(context) : '';
    const title = contextTitle
        ? `${contextTitle} ${deliverableTitle}`.replace(/\s+/g, ' ').trim()
        : `${deliverableTitle} Request`;

    const descriptionParts = [
        context
            ? `Create a ${deliverable} for ${context}.`
            : `Create a ${deliverable}.`,
        details.endsWith('.') ? details : `${details}.`,
        attachmentsUploaded
            ? 'Use the uploaded references or assets.'
            : state.attachmentState === 'skipped'
                ? 'No attachments were provided.'
                : '',
        `Needed by ${deadline}.`,
    ].filter(Boolean);

    return {
        title,
        description: descriptionParts.join(' '),
        category,
        urgency,
        deadline,
    };
};

const isGenericDraftTitle = (value: string) => {
    const normalized = normalizeSpace(value).toLowerCase();
    if (!normalized) return true;
    return (
        normalized === 'design request' ||
        normalized === 'request' ||
        normalized === 'task request' ||
        normalized === 'design task'
    );
};

const buildMergedDraftNotes = (draft: TaskDraft) => {
    const noteParts = [draft.notes, draft.attachmentsNote]
        .map((value) => normalizeSpace(value || ''))
        .filter(Boolean);

    if (noteParts.length === 0) {
        return undefined;
    }

    return Array.from(new Set(noteParts)).join('\n\n');
};

const mergeDraftWithWizardState = (
    draft: TaskDraft,
    state: WizardState,
    attachmentsUploaded: boolean
): TaskDraft => {
    const localDraft = buildLocalTaskDraft(state, attachmentsUploaded);
    if (!localDraft) {
        const explicitCategory = state.category || draft.category;
        const explicitUrgency = state.urgency || draft.urgency;
        const explicitDeadline = parseDeadlineToIso(state.deadline) || draft.deadline;

        return {
            ...draft,
            title: isGenericDraftTitle(draft.title) && state.deliverable
                ? toTitleCase(state.deliverable)
                : draft.title,
            category: explicitCategory,
            urgency: explicitUrgency,
            deadline: explicitDeadline,
            notes: buildMergedDraftNotes(draft),
        };
    }

    return {
        ...draft,
        ...localDraft,
        title: isGenericDraftTitle(draft.title) ? localDraft.title : draft.title || localDraft.title,
        category: state.category || draft.category || localDraft.category,
        urgency: state.urgency || draft.urgency || localDraft.urgency,
        deadline: parseDeadlineToIso(state.deadline) || draft.deadline || localDraft.deadline,
        notes: buildMergedDraftNotes(draft),
    };
};

const buildLocalWizardOutcome = (state: WizardState, attachmentsUploaded: boolean) => {
    const nextQuestion = getNextMissingQuestion(state, attachmentsUploaded);
    if (nextQuestion) {
        return {
            message: nextQuestion,
            draft: null as TaskDraft | null,
        };
    }

    const draft = buildLocalTaskDraft(state, attachmentsUploaded);
    if (!draft) {
        return {
            message: 'When do you need it?',
            draft: null as TaskDraft | null,
        };
    }

    return {
        message: 'I have everything needed. Click Submit to Draft to fill the New Request form.',
        draft,
    };
};

interface TaskBuddyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onTaskCreated?: (draft: TaskDraft) => void;
    initialMessage?: string;
    onOpenUploader?: () => void;
    hasAttachments?: boolean;
    attachmentContext?: string;
    freeDateSuggestions?: Date[];
}

export function TaskBuddyModal({ isOpen, onClose, onTaskCreated, initialMessage, onOpenUploader, hasAttachments, attachmentContext, freeDateSuggestions = [] }: TaskBuddyModalProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const shouldAutoScrollRef = useRef(true);
    const hasInitializedScrollRef = useRef(false);
    const [voiceState, setVoiceState] = useState<'idle' | 'wake' | 'capture'>('idle');
    const wakeRecognizerRef = useRef<any>(null);
    const captureRecognizerRef = useRef<any>(null);
    const captureBufferRef = useRef('');
    const captureSilenceTimerRef = useRef<number | null>(null);
    const autoDraftTriggeredRef = useRef(false);
    const readyNudgeTriggeredRef = useRef(false);
    const pendingAttachmentFollowUpRef = useRef(false);
    const lastAttachmentContextRef = useRef('');
    const [quotaBlocked, setQuotaBlocked] = useState(false);
    const [localFallbackMode, setLocalFallbackMode] = useState(false);

    const [showWelcome, setShowWelcome] = useState(true);
    const uploadFollowUpMessage =
        'I uploaded the attachments. Please review them and continue with the next missing question, or prepare the draft if everything is now available.';
    const MAX_ATTACHMENT_CONTEXT_CHARS = 2500;
    const formattedFreeDateSuggestions = useMemo(
        () =>
            freeDateSuggestions
                .map((date) => {
                    const normalized = new Date(date);
                    if (Number.isNaN(normalized.getTime())) return null;
                    return {
                        label: normalized.toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                        }),
                        value: normalized.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                        }),
                    };
                })
                .filter(Boolean) as Array<{ label: string; value: string }>,
        [freeDateSuggestions]
    );

    const getScrollViewport = () =>
        scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;

    useEffect(() => {
        if (isOpen && initialMessage) {
            setShowWelcome(false);
            setInput(initialMessage);
            setTimeout(() => inputRef.current?.focus(), 100);
        } else if (!isOpen) {
            setMessages([]);
            setInput('');
            setTaskDraft(null);
            setShowWelcome(true);
            autoDraftTriggeredRef.current = false;
            readyNudgeTriggeredRef.current = false;
            pendingAttachmentFollowUpRef.current = false;
            lastAttachmentContextRef.current = '';
            setQuotaBlocked(false);
            setLocalFallbackMode(false);
            shouldAutoScrollRef.current = true;
            hasInitializedScrollRef.current = false;
        }
    }, [isOpen, initialMessage]);

    useEffect(() => {
        if (messages.length > 0) {
            setShowWelcome(false);
        }
        if (!isOpen) return;
        const viewport = getScrollViewport();
        if (!viewport) return;
        const shouldScroll = !hasInitializedScrollRef.current || shouldAutoScrollRef.current;
        if (shouldScroll) {
            window.requestAnimationFrame(() => {
                viewport.scrollTop = viewport.scrollHeight;
            });
        }
        hasInitializedScrollRef.current = true;
    }, [messages, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const viewport = getScrollViewport();
        if (!viewport) return;
        const handleScroll = () => {
            const distance = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
            shouldAutoScrollRef.current = distance < 80;
        };
        handleScroll();
        viewport.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            viewport.removeEventListener('scroll', handleScroll);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        if (!hasAttachments) return;
        if (isLoading) return;
        if (quotaBlocked) return;
        if (autoDraftTriggeredRef.current) return;
        if (messages.length > 0) return;
        autoDraftTriggeredRef.current = true;
        handleSend();
    }, [hasAttachments, attachmentContext, isOpen, isLoading, messages.length, quotaBlocked]);

    useEffect(() => {
        if (!isOpen) return;
        const normalizedAttachmentContext = String(attachmentContext || '').trim();
        if (!hasAttachments || !normalizedAttachmentContext) return;
        if (lastAttachmentContextRef.current === normalizedAttachmentContext) return;

        if (!pendingAttachmentFollowUpRef.current) return;
        if (isLoading || quotaBlocked) return;

        lastAttachmentContextRef.current = normalizedAttachmentContext;
        pendingAttachmentFollowUpRef.current = false;
        setInput('');
        window.setTimeout(() => {
            handleSend(uploadFollowUpMessage);
        }, 0);
    }, [attachmentContext, hasAttachments, isLoading, isOpen, quotaBlocked, uploadFollowUpMessage]);

    useEffect(() => {
        return () => {
            wakeRecognizerRef.current?.stop();
            captureRecognizerRef.current?.stop();
            if (captureSilenceTimerRef.current) {
                window.clearTimeout(captureSilenceTimerRef.current);
            }
        };
    }, []);

    const handleSend = async (overrideInput?: string, options?: { hidden?: boolean }) => {
        const nextInput = typeof overrideInput === 'string' ? overrideInput : input;
        const trimmedInput = nextInput.trim();
        if ((!trimmedInput && !hasAttachments) || isLoading) return;
        const isHiddenMessage = Boolean(options?.hidden);

        const normalizedAttachmentContext = String(attachmentContext || '').trim();
        const attachmentSnippet = normalizedAttachmentContext.length > MAX_ATTACHMENT_CONTEXT_CHARS
            ? `${normalizedAttachmentContext.slice(0, MAX_ATTACHMENT_CONTEXT_CHARS).trim()}\n...[attachment content truncated]`
            : normalizedAttachmentContext;
        const systemEvent = hasAttachments
            ? 'SYSTEM CONTEXT: User has uploaded file(s). Treat attachments as supporting reference only. Prioritize the confirmed chat answers for the final brief, title, category, urgency, and deadline.'
            : '';
        const fileContext = attachmentSnippet ? `\n\nATTACHED FILE CONTENT:\n${attachmentSnippet}` : '';
        const provisionalUserMessage = trimmedInput && !isHiddenMessage ? {
            id: Date.now().toString(),
            role: 'user' as const,
            content: trimmedInput,
            timestamp: new Date()
        } : null;
        const nextConversation = provisionalUserMessage ? [...messages, provisionalUserMessage] : messages;
        const wizardState = buildWizardState(nextConversation, Boolean(hasAttachments));
        const freeDateContext =
            formattedFreeDateSuggestions.length > 0
                ? `\nAVAILABLE FREE DATES:\n- ${formattedFreeDateSuggestions.map((entry) => entry.value).join('\n- ')}`
                : '';
        const liveTaskContext = `${buildLiveTaskContext(wizardState, Boolean(hasAttachments))}${freeDateContext}`;
        const payloadText = trimmedInput || 'Continue with the next missing step.';
        const userTextBase = systemEvent
            ? `${systemEvent}\n\n${liveTaskContext}\n\n${payloadText}`
            : `${liveTaskContext}\n\n${payloadText}`;
        const userText = `${userTextBase}${fileContext}`;

        if (!isHiddenMessage) {
            readyNudgeTriggeredRef.current = false;
        }

        if (provisionalUserMessage) {
            setMessages(prev => [...prev, provisionalUserMessage]);
        }

        setTaskDraft(null);
        if (!isHiddenMessage) {
            setInput('');
        }
        setIsLoading(true);
        setShowWelcome(false);

        if (localFallbackMode) {
            const localOutcome = buildLocalWizardOutcome(wizardState, Boolean(hasAttachments));
            if (localOutcome.draft) {
                setTaskDraft(localOutcome.draft);
            }
            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: localOutcome.message,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, assistantMessage]);
            setIsLoading(false);
            return;
        }

        try {
            const chatHistory = nextConversation
                .map(msg => ({
                    role: msg.role === 'user' ? 'user' as const : 'model' as const,
                    parts: msg.content
                }));

            const response: AIResponse = await sendMessageToAI(chatHistory, userText);
            const shouldAskForAttachments =
                !hasAttachments &&
                !hasAttachmentOptOut(nextConversation);

            if (response.type === 'task_draft' && response.data) {
                setQuotaBlocked(false);
                readyNudgeTriggeredRef.current = false;
                if (response.ready && shouldAskForAttachments) {
                    const assistantMessage: Message = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: buildAttachmentRequestMessage(),
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, assistantMessage]);
                    return;
                }
                setTaskDraft(mergeDraftWithWizardState(response.data, wizardState, Boolean(hasAttachments)));
                const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: response.ready
                        ? "I have everything needed. Click Submit to Draft to fill the New Request form."
                        : "I've prepared a draft based on your request. Review it and submit it to the form when you're ready.",
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, assistantMessage]);
            } else if (response.type === 'action' && response.data) {
                setQuotaBlocked(false);
                readyNudgeTriggeredRef.current = false;
                const payload = response.data as TaskBuddyActionPayload;
                const draft = mergeDraftWithWizardState(
                    mapActionPayloadToDraft(payload),
                    wizardState,
                    Boolean(hasAttachments)
                );
                if (shouldAskForAttachments) {
                    const assistantMessage: Message = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: buildAttachmentRequestMessage(),
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, assistantMessage]);
                    return;
                }
                setTaskDraft(draft);
                const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: response.action === 'SUBMIT_REQUEST'
                        ? "I have everything needed. Click Submit to Draft to move it into the New Request form."
                        : "The draft is ready. Review it and click Submit to Draft when you want to continue.",
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, assistantMessage]);
            } else if (response.content) {
                setQuotaBlocked(false);
                const normalizedReply = normalizeAssistantReply(response.content, wizardState, Boolean(hasAttachments));
                const nextMissingQuestion = getNextMissingQuestion(wizardState, Boolean(hasAttachments));

                if (!nextMissingQuestion && !readyNudgeTriggeredRef.current) {
                    readyNudgeTriggeredRef.current = true;
                    const preparingMessage: Message = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: 'I have enough details. Preparing your draft.',
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, preparingMessage]);
                    window.setTimeout(() => {
                        handleSend(READY_NUDGE_MESSAGE, { hidden: true });
                    }, 0);
                    return;
                }

                const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: normalizedReply || response.content,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, assistantMessage]);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to get response';
            const lowerMessage = message.toLowerCase();
            const isQuotaExhausted =
                lowerMessage.includes('quota exceeded') ||
                lowerMessage.includes('exceeded your current quota') ||
                lowerMessage.includes('insufficient quota') ||
                (lowerMessage.includes('quota') && lowerMessage.includes('billing'));
            const isRateLimited =
                !isQuotaExhausted &&
                (
                    lowerMessage.includes('rate limit') ||
                    lowerMessage.includes('1 minute') ||
                    lowerMessage.includes('too many requests')
                );
            const isLeakedKey =
                lowerMessage.includes('reported as leaked') ||
                lowerMessage.includes('replace the configured key') ||
                lowerMessage.includes('use another api key');
            const isServiceUnavailable =
                !isLeakedKey &&
                (
                    lowerMessage.includes('temporarily unavailable') ||
                    lowerMessage.includes('contact admin') ||
                    lowerMessage.includes('ai service')
                );

            if (!isServiceUnavailable && !isQuotaExhausted && !isRateLimited) {
                toast.error(message);
            }
            if (isQuotaExhausted) {
                setQuotaBlocked(false);
                setLocalFallbackMode(true);
                const localOutcome = buildLocalWizardOutcome(wizardState, Boolean(hasAttachments));
                const fallbackMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: localOutcome.message,
                    timestamp: new Date()
                };
                if (localOutcome.draft) {
                    setTaskDraft(localOutcome.draft);
                }
                setMessages(prev => [...prev, fallbackMessage]);
                return;
            }
            if (isRateLimited) {
                setQuotaBlocked(true);
                setLocalFallbackMode(true);
                const localOutcome = buildLocalWizardOutcome(wizardState, Boolean(hasAttachments));
                const quotaMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: localOutcome.message,
                    timestamp: new Date()
                };
                if (localOutcome.draft) {
                    setTaskDraft(localOutcome.draft);
                }
                setMessages(prev => [...prev, quotaMessage]);
                return;
            }

            if (isLeakedKey) {
                const leakedKeyMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: 'Gemini API key is blocked because it was reported as leaked. Replace the configured key in the backend and restart the server.',
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, leakedKeyMessage]);
                return;
            }

            if (isServiceUnavailable) {
                setLocalFallbackMode(true);
                const localOutcome = buildLocalWizardOutcome(wizardState, Boolean(hasAttachments));
                const unavailableMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: localOutcome.message,
                    timestamp: new Date()
                };
                if (localOutcome.draft) {
                    setTaskDraft(localOutcome.draft);
                }
                setMessages(prev => [...prev, unavailableMessage]);
                return;
            }

            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "I encountered an error. Please try again.",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSubmitToDraft = () => {
        if (taskDraft && onTaskCreated) {
            onTaskCreated(taskDraft);
            toast.success('Draft moved to the New Request form. Review it before final submission.');
            onClose();
        }
    };

    const handleRegenerateDraft = () => {
        setTaskDraft(null);
        setInput('Can you regenerate the task draft with more details?');
        setTimeout(() => handleSend(), 100);
    };

    const shouldOfferAttachmentUpload = (content: string) => {
        if (!onOpenUploader) return false;
        const lower = String(content || '').toLowerCase();
        const wantsUpload =
            lower.includes('upload') ||
            lower.includes('attach') ||
            lower.includes('attachment');
        const wantsFiles =
            lower.includes('file') ||
            lower.includes('asset') ||
            lower.includes('assets') ||
            lower.includes('logo') ||
            lower.includes('reference') ||
            lower.includes('image') ||
            lower.includes('screenshot') ||
            lower.includes('document') ||
            lower.includes('final text') ||
            lower.includes('content');
        return wantsUpload && wantsFiles;
    };

    const handleAttachmentUploadRequest = () => {
        if (!onOpenUploader) return;
        pendingAttachmentFollowUpRef.current = true;
        onOpenUploader();
        toast.success('Upload files in the form. Task Buddy will continue after the upload is ready.');
    };

    const WAKE_WORDS = ['hey task buddy', 'hi task buddy', 'task buddy', 'buddy', 'hey buddy'];
    const STOP_WORDS = ['stop', 'cancel'];

    const normalizeTranscript = (value: string) =>
        value
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();

    const clearCaptureTimer = () => {
        if (captureSilenceTimerRef.current) {
            window.clearTimeout(captureSilenceTimerRef.current);
            captureSilenceTimerRef.current = null;
        }
    };

    const stopAllRecognition = () => {
        wakeRecognizerRef.current?.stop();
        captureRecognizerRef.current?.stop();
        clearCaptureTimer();
        setVoiceState('idle');
    };

    const startCaptureMode = () => {
        if (!captureRecognizerRef.current) return;

        captureBufferRef.current = '';
        setVoiceState('capture');

        const captureRecognizer = captureRecognizerRef.current;
        captureRecognizer.lang = 'en-IN';
        captureRecognizer.continuous = true;
        captureRecognizer.interimResults = true;

        captureRecognizer.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                transcript += event.results[i][0].transcript;
            }
            const normalized = normalizeTranscript(transcript);
            if (!normalized) return;

            if (STOP_WORDS.some(word => normalized.includes(word))) {
                stopAllRecognition();
                return;
            }

            captureBufferRef.current = normalized;
            clearCaptureTimer();
            captureSilenceTimerRef.current = window.setTimeout(() => {
                captureRecognizer.stop();
            }, 5000);
        };

        captureRecognizer.onend = () => {
            clearCaptureTimer();
            const captured = captureBufferRef.current.trim();
            setVoiceState('idle');
            if (captured) {
                setInput(captured);
                setTimeout(() => handleSend(), 0);
            }
        };

        captureRecognizer.start();
    };

    const startWakeWordListening = () => {
        const SpeechRecognitionImpl = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognitionImpl) {
            toast.error('Speech recognition is not available in this browser.');
            return;
        }

        if (!wakeRecognizerRef.current) {
            wakeRecognizerRef.current = new SpeechRecognitionImpl();
        }
        if (!captureRecognizerRef.current) {
            captureRecognizerRef.current = new SpeechRecognitionImpl();
        }

        const wakeRecognizer = wakeRecognizerRef.current;
        wakeRecognizer.lang = 'en-IN';
        wakeRecognizer.continuous = true;
        wakeRecognizer.interimResults = true;

        wakeRecognizer.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                transcript += event.results[i][0].transcript;
            }
            const normalized = normalizeTranscript(transcript);
            if (!normalized) return;

            if (WAKE_WORDS.some(word => normalized.includes(word))) {
                wakeRecognizer.stop();
                startCaptureMode();
            }
        };

        wakeRecognizer.onend = () => {
            if (voiceState === 'wake') {
                wakeRecognizer.start();
            }
        };

        setVoiceState('wake');
        wakeRecognizer.start();
    };

    const handleVoiceInput = () => {
        if (voiceState !== 'idle') {
            stopAllRecognition();
            return;
        }
        startWakeWordListening();
    };

    const suggestions = [
        "Draft a design request for a modern office branding",
        "Create a task for website homepage redesign",
        "Need a social media campaign graphic request",
        "Create an event LED backdrop design request"
    ];
    const latestDeadlineQuestionId =
        [...messages]
            .reverse()
            .find((message) => message.role === 'assistant' && inferQuestionSlot(message.content) === 'deadline')
            ?.id || '';

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl h-[700px] flex flex-col p-0 gap-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl overflow-hidden rounded-[32px] border-white/20 dark:border-slate-700/60 shadow-2xl ring-1 ring-white/40 dark:ring-slate-700/60">
                <DialogHeader className="sr-only">
                    <DialogTitle>Task Buddy AI</DialogTitle>
                    <DialogDescription>
                        Chat with Task Buddy to prepare and auto-fill your design request draft.
                    </DialogDescription>
                </DialogHeader>
                {/* Close Button Only */}


                <div className="flex-1 flex flex-col items-center justify-center overflow-hidden bg-white/40 dark:bg-slate-900/40 relative">
                    {showWelcome ? (
                        <div className="w-full max-w-2xl px-8 flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
                            {/* Hero Section */}
                            <div className="mb-8 flex flex-col items-center text-center">
                                <div className="h-16 w-16 mb-6 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg shadow-primary/10 flex items-center justify-center ring-1 ring-primary/10 backdrop-blur-sm">
                                    <Sparkles className="h-8 w-8 text-primary" />
                                </div>
                                <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2 tracking-tight">Task Buddy AI</h2>
                                <p className="text-slate-500 dark:text-slate-300 text-lg">
                                    Your personal design assistant for creating perfect requests
                                </p>
                            </div>

                            {/* Suggestions Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mb-8">
                                {suggestions.map((suggestion, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            setInput(suggestion);
                                            // Optional: auto-send
                                            // handleSend();
                                        }}
                                        className="text-left p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group backdrop-blur-sm"
                                    >
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-primary transition-colors">
                                            {suggestion}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <ScrollArea className="flex-1 w-full px-4 md:px-20" ref={scrollRef}>
                            <div className="space-y-8 py-8">
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`flex gap-4 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                            <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${message.role === 'user' ? 'bg-primary shadow-lg shadow-primary/20' : 'bg-primary shadow-lg shadow-primary/20'}`}>
                                                {message.role === 'user' ? <User className="h-4 w-4 text-white" /> : <Sparkles className="h-4 w-4 text-white" />}
                                            </div>
                                            <div className="space-y-1">
                                                <div className={`text-sm font-semibold mb-1 ${message.role === 'user' ? 'text-right text-slate-900 dark:text-slate-100' : 'text-left text-slate-900 dark:text-slate-100'}`}>
                                                    {message.role === 'user' ? 'You' : 'Task Buddy'}
                                                </div>
                                                <div className="text-slate-600 dark:text-slate-300 leading-relaxed text-[15px]">
                                                    {message.content}
                                                </div>
                                                {message.role === 'assistant' && shouldOfferAttachmentUpload(message.content) && (
                                                    <div className="mt-3">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={handleAttachmentUploadRequest}
                                                            className="border-primary/20 text-primary hover:bg-primary/5"
                                                        >
                                                            <Paperclip className="mr-2 h-4 w-4" />
                                                            {hasAttachments ? 'Upload More Attachments' : 'Upload Attachments'}
                                                        </Button>
                                                    </div>
                                                )}
                                                {message.role === 'assistant' &&
                                                    message.id === latestDeadlineQuestionId &&
                                                    inferQuestionSlot(message.content) === 'deadline' &&
                                                    formattedFreeDateSuggestions.length > 0 && (
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            {formattedFreeDateSuggestions.map((suggestion) => (
                                                                <Button
                                                                    key={suggestion.value}
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => {
                                                                        void handleSend(suggestion.value);
                                                                    }}
                                                                    className="border-primary/20 text-primary hover:bg-primary/5"
                                                                >
                                                                    {suggestion.label}
                                                                </Button>
                                                            ))}
                                                        </div>
                                                    )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex gap-4 justify-start">
                                        <div className="shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                                            <Sparkles className="h-4 w-4 text-white" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-sm font-semibold mb-1 text-slate-900 dark:text-slate-100">Task Buddy</div>
                                            <div className="flex gap-1.5 items-center h-6">
                                                <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                                <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                                <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {/* Task Draft Card Inline */}
                                {taskDraft && (
                                    <div className="ml-12 p-4 rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 backdrop-blur-sm w-fit max-w-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CheckCircle2 className="h-4 w-4 text-primary" />
                                            <span className="font-semibold text-slate-900 dark:text-slate-100">Draft Ready: {taskDraft.title}</span>
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">{taskDraft.description}</p>
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={handleSubmitToDraft} className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">Submit to Draft</Button>
                                            <Button size="sm" variant="outline" onClick={handleRegenerateDraft} className="border-primary/20 text-primary hover:bg-primary/5">Refine Draft</Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    )}

                    {/* Footer Input */}
                    <div className="w-full px-4 md:px-20 pb-8 pt-4 z-10">
                    <div className="relative group">
                            <div className="absolute inset-0 bg-white/40 dark:bg-slate-800/40 rounded-[32px] blur-xl group-hover:bg-primary/5 transition-all duration-500" />
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={handleAttachmentUploadRequest}
                                    disabled={!onOpenUploader}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                    aria-label="Upload attachments"
                                >
                                    <Paperclip className="h-5 w-5 text-slate-400 dark:text-slate-500 group-focus-within:text-primary/70 transition-colors" />
                                </button>
                                <Input
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="Ask me anything..."
                                    className="w-full h-14 pl-12 pr-24 rounded-[28px] border-slate-200/80 dark:border-slate-700/70 shadow-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl text-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-primary/20 focus-visible:border-primary/30 transition-all duration-300"
                                    disabled={isLoading}
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    <Button
                                        onClick={handleVoiceInput}
                                        size="icon"
                                        variant="ghost"
                                        className={`h-10 w-10 rounded-full transition-all ${voiceState !== 'idle' ? 'bg-red-50 dark:bg-red-950/40 text-red-500 animate-pulse' : 'text-slate-500 dark:text-slate-400 hover:bg-[#EEF4FF] hover:text-[#1E2A5A] dark:hover:bg-slate-800/80 dark:hover:text-slate-100'}`}
                                        title="Enable wake word listening"
                                    >
                                        <Mic className="h-5 w-5" />
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            void handleSend();
                                        }}
                                        disabled={(!input.trim() && !hasAttachments) || isLoading}
                                        size="icon"
                                        className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-white disabled:opacity-50 transition-all shadow-lg shadow-primary/20 hover:scale-105 active:scale-95"
                                    >
                                        {isLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Send className="h-4 w-4 ml-0.5" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className="text-center mt-3">
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                                This AI isn't used to train our models. Always verify critical details.
                            </p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

