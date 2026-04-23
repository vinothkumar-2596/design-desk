import { useState, useRef, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Loader2, CheckCircle2, X, Paperclip, User, Mic, Eye, Calendar as CalendarIcon } from 'lucide-react';
import { sendMessageToAI, mapActionPayloadToDraft, type TaskDraft, type AIResponse, type TaskBuddyActionPayload, type AIRequestType } from '@/lib/ai';
import { useAuth } from '@/contexts/AuthContext';
import {
    AttachmentPreviewDialog,
    isAttachmentPreviewable,
    type AttachmentPreviewFile,
} from '@/components/tasks/AttachmentPreviewDialog';
import { Calendar as DateCalendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { Zap, Layers3, ArrowRight, RefreshCcw, Check, RotateCw } from 'lucide-react';
import './task-buddy-brand.css';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

type WizardSlot = 'deliverable' | 'context' | 'details' | 'category' | 'urgency' | 'deadline' | 'department' | 'phone' | 'attachments' | 'unknown';
type AttachmentState = 'unknown' | 'provided' | 'skipped';

interface WizardState {
    deliverable: string;
    context: string;
    details: string;
    category: TaskDraft['category'] | '';
    urgency: TaskDraft['urgency'] | '';
    deadline: string;
    department: string;
    phone: string;
    attachmentState: AttachmentState;
    askedCounts: Record<WizardSlot, number>;
}

const MIN_BRIEF_WORDS = 30;

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

const CATEGORY_QUICK_OPTIONS: Array<{ label: string; value: TaskDraft['category'] }> = [
    { label: 'Banner', value: 'banner' },
    { label: 'Campaign or Others', value: 'campaign_or_others' },
    { label: 'Social Media Creative', value: 'social_media_creative' },
    { label: 'Website Assets', value: 'website_assets' },
    { label: 'UI/UX', value: 'ui_ux' },
    { label: 'LED Backdrop', value: 'led_backdrop' },
    { label: 'Brochure', value: 'brochure' },
    { label: 'Flyer', value: 'flyer' },
];

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
        lower.includes('which department') ||
        lower.includes('what department') ||
        lower.includes('department is this for') ||
        lower.includes('requesting department') ||
        /\bdepartment\b/.test(lower)
    ) {
        return 'department';
    }
    if (
        lower.includes('contact number') ||
        lower.includes('phone number') ||
        lower.includes('mobile number') ||
        lower.includes('whatsapp number') ||
        lower.includes('10-digit') ||
        /\b(phone|mobile|whatsapp)\b/.test(lower)
    ) {
        return 'phone';
    }
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
    department: 0,
    phone: 0,
    attachments: 0,
    unknown: 0,
});

const PHONE_PATTERN = /\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/;

const extractPhoneCandidate = (content: string): string => {
    const match = String(content || '').match(PHONE_PATTERN);
    if (!match) return '';
    const digits = match[0].replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : '';
};

const DEPARTMENT_HINT_PATTERN = /\b(marketing|admissions?|placement(?:\s+cell)?|finance|examinations?|hr|human resources?|administration|admin|student affairs?|training|placement cell|office of the principal|library|hostel|it|computer(?:\s+science)?|mechanical|electrical|civil|biotech(?:nology)?|ece|cse|eee|mba)\b/i;

const extractDepartmentCandidate = (content: string): string => {
    const normalized = normalizeSpace(content);
    if (!normalized) return '';
    const trimmed = normalized.replace(/^(the|our|for|from|in)\s+/i, '').trim();
    const match = trimmed.match(DEPARTMENT_HINT_PATTERN);
    if (match) {
        return match[0].replace(/\s+/g, ' ').trim();
    }
    if (trimmed.length <= 48 && /\b(department|dept|cell|office)\b/i.test(trimmed)) {
        return trimmed;
    }
    return '';
};

const buildWizardState = (
    messages: Message[],
    attachmentsUploaded: boolean,
    seed?: { department?: string; phone?: string }
): WizardState => {
    const state: WizardState = {
        deliverable: '',
        context: '',
        details: '',
        category: '',
        urgency: '',
        deadline: '',
        department: String(seed?.department || '').trim(),
        phone: String(seed?.phone || '').trim(),
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
        } else if (pendingSlot === 'deadline') {
            state.deadline = content;
        } else if (pendingSlot === 'department' && !state.department) {
            state.department = extractDepartmentCandidate(content) || content.slice(0, 60);
        } else if (pendingSlot === 'phone' && !state.phone) {
            state.phone = extractPhoneCandidate(content);
        } else if (pendingSlot === 'attachments' && state.attachmentState === 'unknown') {
            state.attachmentState = attachmentsUploaded ? 'provided' : 'skipped';
        }

        if (!state.phone) {
            state.phone = extractPhoneCandidate(content);
        }
        if (!state.department) {
            const dept = extractDepartmentCandidate(content);
            if (dept) state.department = dept;
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
            return getUserBriefWordCount(state) >= MIN_BRIEF_WORDS
                ? 'Any missing requirements?'
                : 'Please share a fuller 30-word brief.';
        case 'category':
            return 'Which category fits best?';
        case 'urgency':
            return 'Urgency normal or urgent?';
        case 'deadline':
            return 'When do you need it?';
        case 'department':
            return 'Which department is this for?';
        case 'phone':
            return 'Share a 10-digit contact number.';
        case 'attachments':
            return buildAttachmentRequestMessage();
        default:
            return '';
    }
};

const isSlotSatisfied = (
    slot: WizardSlot,
    state: WizardState,
    attachmentsUploaded: boolean,
    isDeadlineAvailable?: (date: Date) => boolean
) => {
    switch (slot) {
        case 'deliverable':
            return Boolean(state.deliverable);
        case 'context':
            return Boolean(state.context);
        case 'details':
            return Boolean(state.details) && getUserBriefWordCount(state) >= MIN_BRIEF_WORDS;
        case 'category':
            return Boolean(state.category);
        case 'urgency':
            return Boolean(state.urgency);
        case 'deadline':
            return isDeadlineValueValid(state.deadline, isDeadlineAvailable);
        case 'department':
            return Boolean(state.department);
        case 'phone':
            return Boolean(state.phone);
        case 'attachments':
            return attachmentsUploaded || state.attachmentState !== 'unknown';
        default:
            return false;
    }
};

const getNextMissingQuestion = (
    state: WizardState,
    attachmentsUploaded: boolean,
    isDeadlineAvailable?: (date: Date) => boolean
) => {
    if (!state.deliverable) return getCanonicalQuestion('deliverable', state);
    if (!state.context) return getCanonicalQuestion('context', state);
    if (!isSlotSatisfied('details', state, attachmentsUploaded, isDeadlineAvailable)) return getCanonicalQuestion('details', state);
    if (!state.category) return getCanonicalQuestion('category', state);
    if (!state.urgency) return getCanonicalQuestion('urgency', state);
    if (!isDeadlineValueValid(state.deadline, isDeadlineAvailable)) return getCanonicalQuestion('deadline', state);
    if (!state.department) return getCanonicalQuestion('department', state);
    if (!state.phone) return getCanonicalQuestion('phone', state);
    if (!attachmentsUploaded && state.attachmentState === 'unknown') {
        return buildAttachmentRequestMessage();
    }
    return '';
};

const buildLiveTaskContext = (
    state: WizardState,
    attachmentsUploaded: boolean,
    isDeadlineAvailable?: (date: Date) => boolean
) => {
    const knownDetails = [
        state.deliverable ? `- deliverable: ${state.deliverable}` : '',
        state.context ? `- context: ${state.context}` : '',
        state.details ? `- details: ${state.details}` : '',
        state.category ? `- category: ${state.category}` : '',
        state.urgency ? `- urgency: ${state.urgency}` : '',
        isDeadlineValueValid(state.deadline, isDeadlineAvailable) ? `- deadline: ${state.deadline}` : '',
        state.department ? `- department: ${state.department}` : '',
        state.phone ? `- phone: ${state.phone}` : '',
        attachmentsUploaded
            ? '- attachments: already uploaded'
            : state.attachmentState === 'skipped'
                ? '- attachments: user said no attachments'
                : '',
    ].filter(Boolean);

    const nextMissing = getNextMissingQuestion(state, attachmentsUploaded, isDeadlineAvailable);

    return [
        'LIVE TASK STATE:',
        ...(knownDetails.length > 0 ? knownDetails : ['- no confirmed details yet']),
        'STRICT REPLY RULES:',
        '- Do not ask again about known details.',
        '- Ask one short question only.',
        '- Maximum 8 words.',
        '- Never repeat or rephrase the same slot.',
        `- Require at least ${MIN_BRIEF_WORDS} user words before READY.`,
        '- Do not ask optional style or copy questions before READY.',
        nextMissing
            ? `- Ask only for this missing item next: ${nextMissing}`
            : '- All minimum fields are already collected. Return STATUS: READY now.',
    ].join('\n');
};

const normalizeAssistantReply = (
    content: string,
    state: WizardState,
    attachmentsUploaded: boolean,
    isDeadlineAvailable?: (date: Date) => boolean
) => {
    const normalized = normalizeSpace(content);
    const fallbackQuestion = getNextMissingQuestion(state, attachmentsUploaded, isDeadlineAvailable);
    const slot = inferQuestionSlot(normalized);

    if (!normalized) {
        return fallbackQuestion;
    }

    if (slot !== 'unknown') {
        if (isSlotSatisfied(slot, state, attachmentsUploaded, isDeadlineAvailable)) {
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

const parseIsoToLocalDate = (isoDate: string) => {
    const normalized = normalizeSpace(isoDate);
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
};

const isDeadlineValueValid = (
    value: string,
    isDeadlineAvailable?: (date: Date) => boolean
) => {
    const isoDeadline = parseDeadlineToIso(value);
    if (!isoDeadline) return false;
    const localDate = parseIsoToLocalDate(isoDeadline);
    if (!localDate) return false;
    return isDeadlineAvailable ? isDeadlineAvailable(localDate) : true;
};

const formatDeadlineChipValue = (date: Date) =>
    date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

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

const countWords = (value: string) =>
    normalizeSpace(value)
        .split(/\s+/)
        .filter(Boolean).length;

const getUserBriefWordCount = (state: WizardState) => {
    const deliverable = cleanSlotValue(state.deliverable);
    const context = cleanContextForDraft(state.context, deliverable);
    const details = cleanDetailsForDraft(state.details, deliverable, context);

    return countWords([deliverable, context, details].filter(Boolean).join(' '));
};

const buildLocalTaskDraft = (state: WizardState, attachmentsUploaded: boolean): TaskDraft | null => {
    const deliverable = cleanSlotValue(state.deliverable);
    const context = cleanContextForDraft(state.context, deliverable);
    const details = cleanDetailsForDraft(state.details, deliverable, context);
    const deadline = parseDeadlineToIso(state.deadline);
    const userBriefWordCount = getUserBriefWordCount(state);

    if (!deliverable || !details || !deadline || userBriefWordCount < MIN_BRIEF_WORDS) {
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
        details.endsWith('.') ? details : `${details}.`,
        context
            ? `Deliverable: ${deliverable} for ${context}.`
            : `Deliverable: ${deliverable}.`,
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

const buildDraftRefinementPrompt = (draft: TaskDraft | null) => {
    if (!draft) {
        return 'Refine the current draft into a more professional, precise brief using only the confirmed details already collected.';
    }

    const detailLines = [
        draft.title ? `Title: ${draft.title}` : '',
        draft.description ? `Description: ${draft.description}` : '',
        draft.category ? `Category: ${draft.category}` : '',
        draft.urgency ? `Urgency: ${draft.urgency}` : '',
        draft.deadline ? `Deadline: ${draft.deadline}` : '',
    ].filter(Boolean);

    return [
        'Refine the current draft into a more professional, precise brief.',
        'Keep only confirmed details and improve clarity.',
        ...detailLines,
    ].join('\n');
};

const GENERIC_USER_PREVIEW_PATTERNS = [
    /^hi$/i,
    /^hello$/i,
    /^hey$/i,
    /^task buddy$/i,
    /^buddy$/i,
    /^okay$/i,
    /^ok$/i,
    /^yes$/i,
    /^no$/i,
    /^thanks?$/i,
];

const buildUserProvidedDraftPreview = (messages: Message[]) => {
    const normalizedMessages = messages
        .filter((message) => message.role === 'user')
        .map((message) => normalizeSpace(message.content))
        .filter(Boolean)
        .filter((content) => !GENERIC_USER_PREVIEW_PATTERNS.some((pattern) => pattern.test(content)))
        .filter((content) => !ATTACHMENT_SKIP_PATTERNS.some((pattern) => pattern.test(content)))
        .filter((content) => !ATTACHMENT_PROVIDED_PATTERNS.some((pattern) => pattern.test(content)));

    if (normalizedMessages.length === 0) {
        return '';
    }

    const substantialMessages = normalizedMessages.filter((content) => countWords(content) >= 12);
    if (substantialMessages.length > 0) {
        return substantialMessages[substantialMessages.length - 1];
    }

    return normalizedMessages.join('. ');
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

const buildLocalWizardOutcome = (
    state: WizardState,
    attachmentsUploaded: boolean,
    isDeadlineAvailable?: (date: Date) => boolean
) => {
    const nextQuestion = getNextMissingQuestion(state, attachmentsUploaded, isDeadlineAvailable);
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
    autoSendInitialMessage?: boolean;
    onOpenUploader?: () => void;
    hasAttachments?: boolean;
    attachmentContext?: string;
    attachmentFiles?: AttachmentPreviewFile[];
    isDeadlineAvailable?: (date: Date) => boolean;
    freeDateSuggestions?: Date[];
}

export function TaskBuddyModal({ isOpen, onClose, onTaskCreated, initialMessage, autoSendInitialMessage = false, onOpenUploader, hasAttachments, attachmentContext, attachmentFiles = [], isDeadlineAvailable, freeDateSuggestions = [] }: TaskBuddyModalProps) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [animatedPlaceholder, setAnimatedPlaceholder] = useState('Ask me anything…');
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
    const initialAutoSentRef = useRef(false);
    const docExtractionTriggeredRef = useRef(false);
    const [isDocExtracting, setIsDocExtracting] = useState(false);
    const [quotaBlocked, setQuotaBlocked] = useState(false);
    const [localFallbackMode, setLocalFallbackMode] = useState(false);
    const [attachmentPreviewFile, setAttachmentPreviewFile] = useState<AttachmentPreviewFile | null>(null);
    const [deadlineCalendarOpen, setDeadlineCalendarOpen] = useState(false);
    const requesterName = useMemo(() => {
        const normalizedName = normalizeSpace(user?.name || '');
        return normalizedName ? normalizedName.split(' ')[0] : '';
    }, [user?.name]);
    const requesterContext = useMemo(() => {
        const contextLines = [
            user?.name ? `- requester name: ${user.name}` : '',
            user?.email ? `- requester email: ${user.email}` : '',
            user?.department ? `- requester department: ${user.department}` : '',
            user?.phone ? `- requester phone: ${user.phone}` : '',
            user?.role ? `- requester role: ${user.role}` : '',
        ].filter(Boolean);

        if (contextLines.length === 0) return '';

        return [
            'REQUESTER LOGIN DETAILS:',
            ...contextLines,
            '- Use these confirmed details when relevant.',
            '- Do not ask again for requester identity details already known.',
        ].join('\n');
    }, [user?.department, user?.email, user?.name, user?.phone, user?.role]);
    const personalizeAssistantMessage = (content: string) => {
        const normalized = normalizeSpace(content);
        if (!normalized || !requesterName) return normalized;
        if (inferQuestionSlot(normalized) === 'deliverable') {
            return `${requesterName}, what should be designed?`;
        }
        return normalized;
    };

    const [showWelcome, setShowWelcome] = useState(true);
    const [selectedRequestType, setSelectedRequestType] = useState<AIRequestType | null>(null);
    const selectedRequestTypeRef = useRef<AIRequestType | null>(null);
    const applySelectedRequestType = (type: AIRequestType | null) => {
        selectedRequestTypeRef.current = type;
        setSelectedRequestType(type);
    };
    const stampRequestType = (draft: TaskDraft): TaskDraft => ({
        ...draft,
        requestType:
            draft.requestType ||
            selectedRequestTypeRef.current ||
            selectedRequestType ||
            'single_task',
    });
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
    const selectedDeadlineDate = useMemo(() => {
        const deadlineValue = buildWizardState(messages, Boolean(hasAttachments), {
            department: user?.department || '',
            phone: user?.phone || '',
        }).deadline;
        const isoDeadline = parseDeadlineToIso(deadlineValue);
        return isoDeadline ? parseIsoToLocalDate(isoDeadline) : null;
    }, [messages, hasAttachments]);

    const isCalendarDateDisabled = (date: Date) => {
        const normalized = new Date(date);
        normalized.setHours(0, 0, 0, 0);

        if (Number.isNaN(normalized.getTime())) {
            return true;
        }

        if (isDeadlineAvailable) {
            return !isDeadlineAvailable(normalized);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return normalized < today;
    };

    const handleDeadlineCalendarSelect = (date?: Date) => {
        if (!date) return;
        setDeadlineCalendarOpen(false);
        void handleSend(formatDeadlineChipValue(date));
    };

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
            setSelectedRequestType(null);
            selectedRequestTypeRef.current = null;
            setLastFailedMessage(null);
            lastFailedMessageRef.current = null;
            autoDraftTriggeredRef.current = false;
            readyNudgeTriggeredRef.current = false;
            pendingAttachmentFollowUpRef.current = false;
            lastAttachmentContextRef.current = '';
            initialAutoSentRef.current = false;
            docExtractionTriggeredRef.current = false;
            setQuotaBlocked(false);
            setLocalFallbackMode(false);
            setAttachmentPreviewFile(null);
            setDeadlineCalendarOpen(false);
            shouldAutoScrollRef.current = true;
            hasInitializedScrollRef.current = false;
        }
    }, [isOpen, initialMessage]);

    useEffect(() => {
        if (!isOpen || input.length > 0) return;
        const phrases = [
            'Ask me anything…',
            'Create a new task…',
            'Summarise my pending work…',
            'Draft an email to the team…',
            'Plan tomorrow’s schedule…',
            'Find that file I uploaded…',
        ];
        let phraseIdx = 0;
        let charIdx = phrases[0].length;
        let mode: 'pause' | 'deleting' | 'typing' = 'pause';
        let timer: number | null = null;
        const tick = () => {
            const current = phrases[phraseIdx];
            if (mode === 'pause') {
                mode = 'deleting';
                timer = window.setTimeout(tick, 30);
            } else if (mode === 'deleting') {
                charIdx -= 1;
                setAnimatedPlaceholder(current.slice(0, Math.max(0, charIdx)));
                if (charIdx <= 0) {
                    mode = 'typing';
                    phraseIdx = (phraseIdx + 1) % phrases.length;
                    charIdx = 0;
                    timer = window.setTimeout(tick, 280);
                    return;
                }
                timer = window.setTimeout(tick, 25);
            } else {
                const next = phrases[phraseIdx];
                charIdx += 1;
                setAnimatedPlaceholder(next.slice(0, charIdx));
                if (charIdx >= next.length) {
                    mode = 'pause';
                    timer = window.setTimeout(tick, 1600);
                    return;
                }
                timer = window.setTimeout(tick, 55);
            }
        };
        timer = window.setTimeout(tick, 1600);
        return () => {
            if (timer !== null) window.clearTimeout(timer);
        };
    }, [isOpen, input.length]);

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
        if (!autoSendInitialMessage) return;
        const normalizedInitialMessage = String(initialMessage || '').trim();
        if (!normalizedInitialMessage) return;
        if (initialAutoSentRef.current) return;
        if (messages.length > 0 || isLoading) return;

        initialAutoSentRef.current = true;
        window.setTimeout(() => {
            handleSend(normalizedInitialMessage);
        }, 0);
    }, [autoSendInitialMessage, initialMessage, isLoading, isOpen, messages.length]);

    useEffect(() => {
        if (!isOpen) return;
        if (!hasAttachments) return;
        if (autoSendInitialMessage && String(initialMessage || '').trim()) return;
        if (isLoading) return;
        if (quotaBlocked) return;
        if (autoDraftTriggeredRef.current) return;
        if (messages.length > 0) return;
        autoDraftTriggeredRef.current = true;
        handleSend();
    }, [autoSendInitialMessage, attachmentContext, hasAttachments, initialMessage, isOpen, isLoading, messages.length, quotaBlocked]);

    const getDocumentExtractedText = () => {
        for (const file of attachmentFiles) {
            const text = String((file as any)?.extractedContent || '').trim();
            if (text.length > 100) return text;
        }
        return '';
    };

    useEffect(() => {
        if (!isOpen) return;
        const normalizedAttachmentContext = String(attachmentContext || '').trim();
        if (!hasAttachments || !normalizedAttachmentContext) return;
        if (lastAttachmentContextRef.current === normalizedAttachmentContext) return;
        if (isLoading || quotaBlocked) return;

        const extractedText = getDocumentExtractedText();
        const hasDocumentContent = extractedText.length > 100;

        if (hasDocumentContent && !docExtractionTriggeredRef.current && !taskDraft) {
            // Document with readable content — auto-extract all fields
            docExtractionTriggeredRef.current = true;
            lastAttachmentContextRef.current = normalizedAttachmentContext;
            pendingAttachmentFollowUpRef.current = false;
            setInput('');
            setIsDocExtracting(true);
            window.setTimeout(() => {
                handleSend('', { docExtract: true, docText: extractedText });
            }, 0);
            return;
        }

        if (!pendingAttachmentFollowUpRef.current) return;

        lastAttachmentContextRef.current = normalizedAttachmentContext;
        pendingAttachmentFollowUpRef.current = false;
        setInput('');
        window.setTimeout(() => {
            handleSend(uploadFollowUpMessage);
        }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attachmentContext, hasAttachments, isLoading, isOpen, quotaBlocked]);

    useEffect(() => {
        return () => {
            wakeRecognizerRef.current?.stop();
            captureRecognizerRef.current?.stop();
            if (captureSilenceTimerRef.current) {
                window.clearTimeout(captureSilenceTimerRef.current);
            }
        };
    }, []);

    // ── Live wizard state for the progress rail ──────────────────────────
    const profileSeed = useMemo(
        () => ({
            department: String(user?.department || '').trim(),
            phone: String(user?.phone || '').trim(),
        }),
        [user?.department, user?.phone]
    );

    const liveWizardState = useMemo(
        () => buildWizardState(messages, Boolean(hasAttachments), profileSeed),
        [messages, hasAttachments, profileSeed]
    );

    // ── Typewriter for the stage label ───────────────────────────────────
    const useTypewriter = (text: string, charDelayMs = 28) => {
        const [typed, setTyped] = useState('');
        useEffect(() => {
            if (!text) {
                setTyped('');
                return;
            }
            setTyped('');
            let index = 0;
            const tick = () => {
                index += 1;
                setTyped(text.slice(0, index));
                if (index < text.length) {
                    timer = window.setTimeout(tick, charDelayMs);
                }
            };
            let timer = window.setTimeout(tick, charDelayMs);
            return () => window.clearTimeout(timer);
        }, [text, charDelayMs]);
        return typed;
    };

    const lastFailedMessageRef = useRef<string | null>(null);
    const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);

    type ProgressSlot = {
        key: WizardSlot;
        label: string;
        state: 'done' | 'active' | 'pending';
        value?: string;
    };

    const progressSlots = useMemo<ProgressSlot[]>(() => {
        const slots: Array<{ key: WizardSlot; label: string; filled: boolean; value: string }> = [
            { key: 'deliverable', label: 'Deliverable', filled: Boolean(liveWizardState.deliverable), value: liveWizardState.deliverable },
            { key: 'context', label: 'Context', filled: Boolean(liveWizardState.context), value: liveWizardState.context },
            { key: 'details', label: 'Details', filled: Boolean(liveWizardState.details), value: liveWizardState.details },
            { key: 'category', label: 'Category', filled: Boolean(liveWizardState.category), value: liveWizardState.category || '' },
            { key: 'urgency', label: 'Urgency', filled: Boolean(liveWizardState.urgency), value: liveWizardState.urgency || '' },
            { key: 'deadline', label: 'Deadline', filled: Boolean(liveWizardState.deadline), value: liveWizardState.deadline },
            { key: 'department', label: 'Department', filled: Boolean(liveWizardState.department), value: liveWizardState.department },
            {
                key: 'phone',
                label: 'Contact',
                filled: Boolean(liveWizardState.phone),
                value: liveWizardState.phone ? `+91 ${liveWizardState.phone}` : '',
            },
            {
                key: 'attachments',
                label: 'Attachments',
                filled: liveWizardState.attachmentState !== 'unknown',
                value: liveWizardState.attachmentState === 'provided' ? 'Uploaded' : liveWizardState.attachmentState === 'skipped' ? 'Skipped' : '',
            },
        ];
        const firstPendingIndex = slots.findIndex((slot) => !slot.filled);
        return slots.map((slot, index) => ({
            key: slot.key,
            label: slot.label,
            state: slot.filled ? 'done' : index === firstPendingIndex ? 'active' : 'pending',
            value: slot.value,
        }));
    }, [liveWizardState]);

    const progressDoneCount = progressSlots.filter((slot) => slot.state === 'done').length;
    const progressTotal = progressSlots.length;
    const progressPercent = progressTotal === 0 ? 0 : Math.round((progressDoneCount / progressTotal) * 100);
    const activeProgressSlot = progressSlots.find((slot) => slot.state === 'active');
    const activeStepIndex = activeProgressSlot
        ? progressSlots.indexOf(activeProgressSlot)
        : progressSlots.length - 1;
    const isBuddyReady = Boolean(taskDraft) || progressDoneCount === progressTotal;

    // ── Cycling phrases for the active slot ──────────────────────────────
    const stagePhrases = useMemo(() => {
        if (isBuddyReady) return ['Draft prepared', 'Ready to submit', 'All details captured'];
        if (isDocExtracting) return ['Reading document', 'Extracting fields…', 'Preparing draft'];
        if (!activeProgressSlot) return ['Finalizing'];
        const slot = activeProgressSlot.label.toLowerCase();
        return [
            `Gathering ${slot}`,
            'Waiting on your reply...',
            isLoading ? 'Thinking' : `Next up · ${slot}`,
        ];
    }, [activeProgressSlot, isBuddyReady, isDocExtracting, isLoading]);

    const [stagePhraseIndex, setStagePhraseIndex] = useState(0);
    useEffect(() => {
        setStagePhraseIndex(0);
    }, [stagePhrases]);
    useEffect(() => {
        if (stagePhrases.length <= 1) return;
        const id = window.setInterval(() => {
            setStagePhraseIndex((prev) => (prev + 1) % stagePhrases.length);
        }, 3400);
        return () => window.clearInterval(id);
    }, [stagePhrases]);

    const activePhrase = stagePhrases[stagePhraseIndex] || stagePhrases[0] || '';
    const typedStageLabel = useTypewriter(activePhrase, 26);

    const handleResetConversation = () => {
        if (isLoading) return;
        if (messages.length > 0) {
            const confirmed = window.confirm('Start over? This will clear the conversation.');
            if (!confirmed) return;
        }
        setMessages([]);
        setInput('');
        setTaskDraft(null);
        setShowWelcome(true);
        setLastFailedMessage(null);
        lastFailedMessageRef.current = null;
        autoDraftTriggeredRef.current = false;
        readyNudgeTriggeredRef.current = false;
        pendingAttachmentFollowUpRef.current = false;
        initialAutoSentRef.current = false;
        docExtractionTriggeredRef.current = false;
    };

    const handleRetryLastMessage = () => {
        const toRetry = lastFailedMessageRef.current;
        if (!toRetry || isLoading) return;
        setLastFailedMessage(null);
        lastFailedMessageRef.current = null;
        void handleSend(toRetry);
    };

    const handleSend = async (overrideInput?: string, options?: { hidden?: boolean; docExtract?: boolean; docText?: string }) => {
        const nextInput = typeof overrideInput === 'string' ? overrideInput : input;
        const trimmedInput = nextInput.trim();
        const isDocExtract = Boolean(options?.docExtract);
        if ((!trimmedInput && !hasAttachments && !isDocExtract) || isLoading) return;
        const isHiddenMessage = Boolean(options?.hidden) || isDocExtract;
        if (!isHiddenMessage) {
            lastFailedMessageRef.current = null;
            setLastFailedMessage(null);
        }

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
        const wizardState = buildWizardState(nextConversation, Boolean(hasAttachments), profileSeed);
        const parsedDeadlineIso = parseDeadlineToIso(wizardState.deadline);
        const parsedDeadlineDate = parsedDeadlineIso ? parseIsoToLocalDate(parsedDeadlineIso) : null;
        const hasUnavailableDeadline =
            Boolean(parsedDeadlineDate) &&
            Boolean(isDeadlineAvailable) &&
            !isDeadlineAvailable(parsedDeadlineDate as Date);
        const freeDateContext =
            formattedFreeDateSuggestions.length > 0
                ? `\nAVAILABLE FREE DATES:\n- ${formattedFreeDateSuggestions.map((entry) => entry.value).join('\n- ')}`
                : '';
        const liveTaskContext = `${buildLiveTaskContext(wizardState, Boolean(hasAttachments), isDeadlineAvailable)}${freeDateContext}`;
        const payloadText = trimmedInput || 'Continue with the next missing step.';
        const requesterLoginContext = requesterContext ? `\n\n${requesterContext}` : '';
        const effectiveRequestType: AIRequestType =
            selectedRequestTypeRef.current || selectedRequestType || 'single_task';
        const requestTypeContext =
            `REQUEST TYPE: ${effectiveRequestType}\n` +
            (effectiveRequestType === 'campaign_request'
                ? '- The user is planning a campaign with multiple deliverables.\n- Focus on overall campaign brief (objective, audience, message, tone) and details of the first deliverable.\n- The user will add more deliverables later in the form.\n- Make the title a campaign name, not a single asset title.'
                : '- The user needs a single design deliverable.');

        let userText: string;
        if (isDocExtract && options?.docText) {
            const docSnippet = options.docText.length > MAX_ATTACHMENT_CONTEXT_CHARS
                ? `${options.docText.slice(0, MAX_ATTACHMENT_CONTEXT_CHARS).trim()}\n...[truncated]`
                : options.docText;
            userText = [
                'DOCUMENT EXTRACTION MODE',
                'The user has uploaded a readable document. Extract all required design request fields from the document content below.',
                'Return STATUS: READY immediately with title, description, category, urgency, deadline, department, and phone.',
                'Infer missing fields from context. Use today\'s date + 7 days as default deadline if not stated.',
                requesterLoginContext.trim() ? requesterLoginContext.trim() : '',
                `\nDOCUMENT CONTENT:\n${docSnippet}`,
            ].filter(Boolean).join('\n\n');
        } else {
            const userTextBase = systemEvent
                ? `${requestTypeContext}\n\n${systemEvent}\n\n${liveTaskContext}${requesterLoginContext}\n\n${payloadText}`
                : `${requestTypeContext}\n\n${liveTaskContext}${requesterLoginContext}\n\n${payloadText}`;
            userText = `${userTextBase}${fileContext}`;
        }

        if (!isHiddenMessage) {
            readyNudgeTriggeredRef.current = false;
        }

        if (provisionalUserMessage) {
            setMessages(prev => [...prev, provisionalUserMessage]);
        }

        if (hasUnavailableDeadline) {
            if (!isHiddenMessage) {
                setInput('');
            }
            setShowWelcome(false);
            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: personalizeAssistantMessage('That date is unavailable. When do you need it?'),
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, assistantMessage]);
            return;
        }

        setTaskDraft(null);
        if (!isHiddenMessage) {
            setInput('');
        }
        setIsLoading(true);
        setShowWelcome(false);

        if (localFallbackMode) {
            const localOutcome = buildLocalWizardOutcome(wizardState, Boolean(hasAttachments), isDeadlineAvailable);
            if (localOutcome.draft) {
                setTaskDraft(stampRequestType(localOutcome.draft));
            }
            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: personalizeAssistantMessage(localOutcome.message),
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
            const nextMissingQuestion = getNextMissingQuestion(wizardState, Boolean(hasAttachments), isDeadlineAvailable);

            if (response.type === 'task_draft' && response.data) {
                setQuotaBlocked(false);
                readyNudgeTriggeredRef.current = false;
                if (!isDocExtract && nextMissingQuestion) {
                    const assistantMessage: Message = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: personalizeAssistantMessage(nextMissingQuestion),
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, assistantMessage]);
                    return;
                }
                setTaskDraft(stampRequestType(mergeDraftWithWizardState(response.data, wizardState, Boolean(hasAttachments))));
                const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: personalizeAssistantMessage(isDocExtract
                        ? "I read your document and prepared a draft. Review it and click Submit to Draft."
                        : response.ready
                            ? "I have everything needed. Click Submit to Draft to fill the New Request form."
                            : "I've prepared a draft based on your request. Review it and submit it to the form when you're ready."),
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
                if (nextMissingQuestion) {
                    const assistantMessage: Message = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: personalizeAssistantMessage(nextMissingQuestion),
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, assistantMessage]);
                    return;
                }
                setTaskDraft(stampRequestType(draft));
                const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: personalizeAssistantMessage(response.action === 'SUBMIT_REQUEST'
                        ? "I have everything needed. Click Submit to Draft to move it into the New Request form."
                        : "The draft is ready. Review it and click Submit to Draft when you want to continue."),
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, assistantMessage]);
            } else if (response.content) {
                setQuotaBlocked(false);
                const normalizedReply = normalizeAssistantReply(
                    response.content,
                    wizardState,
                    Boolean(hasAttachments),
                    isDeadlineAvailable
                );

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
                    content: personalizeAssistantMessage(normalizedReply || response.content),
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
                const localOutcome = buildLocalWizardOutcome(wizardState, Boolean(hasAttachments), isDeadlineAvailable);
                const fallbackMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: personalizeAssistantMessage(localOutcome.message),
                    timestamp: new Date()
                };
                if (localOutcome.draft) {
                    setTaskDraft(stampRequestType(localOutcome.draft));
                }
                setMessages(prev => [...prev, fallbackMessage]);
                return;
            }
            if (isRateLimited) {
                setQuotaBlocked(true);
                setLocalFallbackMode(true);
                const localOutcome = buildLocalWizardOutcome(wizardState, Boolean(hasAttachments), isDeadlineAvailable);
                const quotaMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: personalizeAssistantMessage(localOutcome.message),
                    timestamp: new Date()
                };
                if (localOutcome.draft) {
                    setTaskDraft(stampRequestType(localOutcome.draft));
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
                const localOutcome = buildLocalWizardOutcome(wizardState, Boolean(hasAttachments), isDeadlineAvailable);
                const unavailableMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: personalizeAssistantMessage(localOutcome.message),
                    timestamp: new Date()
                };
                if (localOutcome.draft) {
                    setTaskDraft(stampRequestType(localOutcome.draft));
                }
                setMessages(prev => [...prev, unavailableMessage]);
                return;
            }

            const isNetworkError =
                lowerMessage.includes('failed to fetch') ||
                lowerMessage.includes('networkerror') ||
                lowerMessage.includes('backend unreachable') ||
                lowerMessage.includes('network request failed');

            const errorContent = isNetworkError
                ? `Can't reach the AI server. ${message} Check that the backend is running, then try again.`
                : message || 'I encountered an error. Please try again.';

            const errorMessageObj: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: errorContent,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessageObj]);
            if (!isHiddenMessage && trimmedInput) {
                lastFailedMessageRef.current = trimmedInput;
                setLastFailedMessage(trimmedInput);
            }
        } finally {
            setIsLoading(false);
            if (isDocExtract) setIsDocExtracting(false);
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
        if (isLoading) return;
        const refinementPrompt = buildDraftRefinementPrompt(taskDraft);
        setTaskDraft(null);
        window.setTimeout(() => {
            void handleSend(refinementPrompt, { hidden: true });
        }, 0);
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
        toast.success('Select a file — Task Buddy will read it automatically.');
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

    const latestDeadlineQuestionId =
        [...messages]
            .reverse()
            .find((message) => message.role === 'assistant' && inferQuestionSlot(message.content) === 'deadline')
            ?.id || '';
    const latestCategoryQuestionId =
        [...messages]
            .reverse()
            .find((message) => message.role === 'assistant' && inferQuestionSlot(message.content) === 'category')
            ?.id || '';
    const shouldShowAttachmentFilesForMessage = (message: Message) => {
        if (!hasAttachments || attachmentFiles.length === 0) return false;
        if (message.role === 'assistant' && shouldOfferAttachmentUpload(message.content)) return true;
        if (message.role === 'user' && /uploaded the attachments/i.test(message.content)) return true;
        return false;
    };
    const userProvidedDraftPreview = useMemo(
        () => buildUserProvidedDraftPreview(messages),
        [messages]
    );

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (open) return;
                onClose();
            }}
        >
            <DialogContent
                onInteractOutside={(event) => {
                    event.preventDefault();
                }}
                className="task-buddy-brand max-w-4xl h-[740px] flex flex-col p-0 gap-0 bg-white dark:bg-[#0C1228] overflow-hidden rounded-[14px] border border-[#E5E7EE] dark:border-white/10 shadow-[0_40px_100px_-40px_rgba(15,23,42,0.4)] ring-0"
            >
                <DialogHeader className="sr-only">
                    <DialogTitle>Task Buddy AI</DialogTitle>
                    <DialogDescription>
                        Chat with Task Buddy to prepare and auto-fill your design request draft.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-1 flex overflow-hidden relative">
                    <div className="task-buddy-brand-canvas" aria-hidden="true" />
                    <div className="relative z-10 flex-1 flex flex-col min-w-0">
                    {showWelcome ? (
                        <div className="flex-1 flex items-center justify-center overflow-y-auto">
                        <div className="relative z-10 w-full max-w-2xl px-8 py-6 flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
                            {/* Hero Section */}
                            <div className="mb-7 flex flex-col items-center text-center">
                                <div className="task-buddy-brand-orb" aria-hidden="true">
                                    <Sparkles />
                                </div>
                                <h2 className="task-buddy-brand-title">
                                    Task <b>Buddy</b> AI
                                </h2>
                                <p className="mt-1 text-[13.5px] leading-6 text-[color:var(--smvec-ink-4)] max-w-md">
                                    Your personal design assistant — crafted for SMVEC brand standards.
                                </p>
                            </div>

                            {/* Request Type Picker */}
                            <div className="mb-6 w-full">
                                <p className="task-buddy-brand-eyebrow">
                                    <span className="task-buddy-brand-eyebrow-num">01</span>
                                    Request Type
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    {([
                                        {
                                            value: 'single_task' as const,
                                            label: 'Quick Design',
                                            hint: 'A single deliverable',
                                            badge: 'Single',
                                            variant: 'quick' as const,
                                            Icon: Zap,
                                        },
                                        {
                                            value: 'campaign_request' as const,
                                            label: 'Campaign Suite',
                                            hint: 'Multiple deliverables, one campaign',
                                            badge: 'Multi-item',
                                            variant: 'campaign' as const,
                                            Icon: Layers3,
                                        },
                                    ]).map((option) => {
                                        const active = selectedRequestType === option.value;
                                        const { Icon } = option;
                                        const starterMessage =
                                            option.value === 'campaign_request'
                                                ? "Let's start a Campaign Suite — I have multiple deliverables to plan."
                                                : "Let's start a Quick Design request.";
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => {
                                                    if (isLoading) return;
                                                    applySelectedRequestType(option.value);
                                                    setShowWelcome(false);
                                                    void handleSend(starterMessage);
                                                }}
                                                className="task-buddy-brand-type-card"
                                                data-active={active}
                                                data-variant={option.variant}
                                                aria-pressed={active}
                                            >
                                                <span className="task-buddy-brand-type-badge">{option.badge}</span>
                                                <span className="task-buddy-brand-type-icon">
                                                    <Icon className="h-4 w-4" strokeWidth={2} />
                                                </span>
                                                <div className="task-buddy-brand-type-label">{option.label}</div>
                                                <div className="task-buddy-brand-type-hint">{option.hint}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* What we'll cover — 9-step trail */}
                            <div className="w-full mb-2">
                                <p className="task-buddy-brand-eyebrow">
                                    <span className="task-buddy-brand-eyebrow-num">02</span>
                                    What we'll cover
                                </p>
                                <ol className="task-buddy-brand-trail">
                                    {[
                                        'Deliverable',
                                        'Context',
                                        'Details',
                                        'Category',
                                        'Urgency',
                                        'Deadline',
                                        'Department',
                                        'Contact',
                                        'Attachments',
                                    ].map((step, idx) => (
                                        <li key={step} className="task-buddy-brand-trail-item">
                                            <span className="task-buddy-brand-trail-num">{String(idx + 1).padStart(2, '0')}</span>
                                            <span className="task-buddy-brand-trail-label">{step}</span>
                                        </li>
                                    ))}
                                </ol>
                                <p className="task-buddy-brand-trail-note">
                                    Each step is a short question. Skip any you don't need — I'll infer what I can.
                                </p>
                            </div>
                        </div>
                        </div>
                    ) : (
                        <>
                        <div className="task-buddy-brand-stage">
                            <div className="task-buddy-brand-stage-left min-w-0">
                                <span className="task-buddy-brand-stage-dot" data-state={isBuddyReady ? 'done' : 'active'} />
                                <span
                                    key={`step-${progressDoneCount}-${isBuddyReady ? 'ready' : 'active'}`}
                                    className="task-buddy-brand-stage-step"
                                >
                                    {isBuddyReady ? `Ready · ${progressDoneCount} of ${progressTotal}` : `Step ${Math.min(activeStepIndex + 1, progressTotal)} of ${progressTotal}`}
                                </span>
                                <span className="task-buddy-brand-stage-divider">·</span>
                                <span className="task-buddy-brand-stage-label truncate">
                                    {typedStageLabel}
                                    <span
                                        className="task-buddy-brand-stage-caret"
                                        data-state={isBuddyReady ? 'done' : 'active'}
                                        aria-hidden="true"
                                    />
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={handleResetConversation}
                                className="task-buddy-brand-stage-reset"
                                disabled={isLoading}
                                title="Start over"
                            >
                                <RefreshCcw className="h-3 w-3" />
                                Start over
                            </button>
                        </div>
                        <ScrollArea className="relative z-10 flex-1 w-full px-4 md:px-14" ref={scrollRef}>
                            <div className="space-y-7 py-8">
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`flex gap-3.5 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                            <div className={`task-buddy-brand-avatar ${message.role === 'user' ? 'task-buddy-brand-avatar--user' : 'task-buddy-brand-avatar--assistant'}`}>
                                                {message.role === 'user' ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                                            </div>
                                            <div className="space-y-1 min-w-0">
                                                <div className={`task-buddy-brand-speaker ${message.role === 'user' ? 'task-buddy-brand-speaker--user text-right' : 'text-left'}`}>
                                                    {message.role === 'user' ? 'You' : 'Task Buddy'}
                                                </div>
                                                <div className={`task-buddy-brand-bubble ${message.role === 'user' ? 'task-buddy-brand-bubble--user text-right' : ''}`}>
                                                    {message.content}
                                                </div>
                                                {message.role === 'assistant' && shouldOfferAttachmentUpload(message.content) && (
                                                    <div className="mt-3">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={handleAttachmentUploadRequest}
                                                            className="task-buddy-brand-chip"
                                                        >
                                                            <Paperclip className="mr-1.5 h-3.5 w-3.5" />
                                                            {hasAttachments ? 'Upload More Attachments' : 'Upload Attachments'}
                                                        </Button>
                                                    </div>
                                                )}
                                                {shouldShowAttachmentFilesForMessage(message) && (
                                                    <div className="mt-3 rounded-xl border border-slate-200/70 bg-white/70 p-3 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/60">
                                                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                                            Attached Files
                                                        </div>
                                                        <div className="space-y-2">
                                                            {attachmentFiles.map((file) => {
                                                                const previewable = isAttachmentPreviewable(file);
                                                                return (
                                                                    <div
                                                                        key={file.id || file.name}
                                                                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/70 bg-white/80 px-3 py-2 dark:border-slate-700/60 dark:bg-slate-950/50"
                                                                    >
                                                                        <div className="min-w-0">
                                                                            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                                                                                {file.name}
                                                                            </p>
                                                                        </div>
                                                                        {previewable ? (
                                                                            <Button
                                                                                type="button"
                                                                                size="sm"
                                                                                variant="outline"
                                                                                onClick={() => setAttachmentPreviewFile(file)}
                                                                                className="border-primary/20 text-primary hover:bg-primary/5"
                                                                            >
                                                                                <Eye className="mr-2 h-4 w-4" />
                                                                                Preview
                                                                            </Button>
                                                                        ) : null}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                                {message.role === 'assistant' &&
                                                    message.id === latestCategoryQuestionId &&
                                                    inferQuestionSlot(message.content) === 'category' && (
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            {CATEGORY_QUICK_OPTIONS.map((suggestion) => (
                                                                <Button
                                                                    key={suggestion.value}
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => {
                                                                        void handleSend(suggestion.label);
                                                                    }}
                                                                    className="task-buddy-brand-chip"
                                                                >
                                                                    {suggestion.label}
                                                                </Button>
                                                            ))}
                                                        </div>
                                                    )}
                                                {message.role === 'assistant' &&
                                                    message.id === latestDeadlineQuestionId &&
                                                    inferQuestionSlot(message.content) === 'deadline' && (
                                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                                            {formattedFreeDateSuggestions.map((suggestion) => (
                                                                <Button
                                                                    key={suggestion.value}
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => {
                                                                        setDeadlineCalendarOpen(false);
                                                                        void handleSend(suggestion.value);
                                                                    }}
                                                                    className="task-buddy-brand-chip"
                                                                >
                                                                    {suggestion.label}
                                                                </Button>
                                                            ))}
                                                            <Popover open={deadlineCalendarOpen} onOpenChange={setDeadlineCalendarOpen}>
                                                                <PopoverTrigger asChild>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="task-buddy-brand-chip"
                                                                    >
                                                                        <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                        Pick Date
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent
                                                                    align="start"
                                                                    className="w-auto border-0 bg-transparent p-0 shadow-none"
                                                                >
                                                                    <DateCalendar
                                                                        mode="single"
                                                                        selected={selectedDeadlineDate ?? undefined}
                                                                        onSelect={handleDeadlineCalendarSelect}
                                                                        disabled={isCalendarDateDisabled}
                                                                        initialFocus
                                                                    />
                                                                </PopoverContent>
                                                            </Popover>
                                                        </div>
                                                    )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex gap-3.5 justify-start">
                                        <div className="task-buddy-brand-avatar task-buddy-brand-avatar--assistant">
                                            <Sparkles className="h-4 w-4" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="task-buddy-brand-speaker">Task Buddy</div>
                                            {isDocExtracting ? (
                                                <div className="text-[12px] font-medium" style={{ color: 'var(--smvec-blue)' }}>
                                                    Reading your document…
                                                </div>
                                            ) : (
                                                <div className="task-buddy-brand-dots flex gap-1.5 items-center h-6">
                                                    <span />
                                                    <span />
                                                    <span />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {lastFailedMessage && !isLoading && (
                                    <div className="task-buddy-brand-retry-row">
                                        <button
                                            type="button"
                                            className="task-buddy-brand-retry"
                                            onClick={handleRetryLastMessage}
                                        >
                                            <RotateCw className="h-3.5 w-3.5" />
                                            Retry last message
                                        </button>
                                    </div>
                                )}
                                {/* Task Draft Card Inline */}
                                {taskDraft && (
                                    <div className="task-buddy-brand-draft-card ml-[48px] w-fit max-w-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full" style={{ background: 'var(--smvec-gold)', color: '#fff' }}>
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                            </span>
                                            <span className="task-buddy-brand-speaker" style={{ margin: 0 }}>Draft Ready</span>
                                        </div>
                                        <div className="mb-2 text-[15px] font-medium" style={{ fontFamily: 'var(--tb-font-display)', color: 'var(--smvec-ink)' }}>
                                            {taskDraft.title}
                                        </div>
                                        <p className="mb-3 whitespace-pre-wrap text-[13.5px] leading-6" style={{ color: 'var(--smvec-ink-4)' }}>
                                            {userProvidedDraftPreview || taskDraft.description}
                                        </p>
                                        <div className="flex gap-2">
                                            <Button type="button" size="sm" onClick={handleSubmitToDraft} className="task-buddy-brand-send px-4">
                                                Submit to Draft
                                                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                        </>
                    )}

                    {/* Footer Input */}
                    <div className="relative z-10 w-full px-4 md:px-14 pb-7 pt-3">
                        <div className="task-buddy-brand-input-shell">
                            <button
                                type="button"
                                onClick={handleAttachmentUploadRequest}
                                disabled={!onOpenUploader}
                                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-md cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50 task-buddy-brand-mic"
                                aria-label="Upload attachments"
                            >
                                <Paperclip className="h-4 w-4" />
                            </button>
                            <Input
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder={animatedPlaceholder}
                                className="w-full pl-11 pr-24"
                                disabled={isLoading}
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                <Button
                                    onClick={handleVoiceInput}
                                    size="icon"
                                    variant="ghost"
                                    className="h-9 w-9 rounded-md task-buddy-brand-mic"
                                    data-listening={voiceState !== 'idle'}
                                    title="Enable wake word listening"
                                >
                                    <Mic className="h-4 w-4" />
                                </Button>
                                <Button
                                    onClick={() => {
                                        void handleSend();
                                    }}
                                    disabled={(!input.trim() && !hasAttachments) || isLoading}
                                    size="icon"
                                    className="h-9 w-9 rounded-md task-buddy-brand-send"
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="h-3.5 w-3.5 ml-0.5" />
                                    )}
                                </Button>
                            </div>
                        </div>
                        <p className="task-buddy-brand-disclaimer mt-3">
                            This AI isn't used to train our models — always verify critical details
                        </p>
                    </div>
                    </div>
                    {!showWelcome && (
                        <aside className="relative z-10 hidden md:flex task-buddy-brand-rail w-[240px] shrink-0">
                            <p className="task-buddy-brand-rail-title">Your progress</p>
                            <div className="task-buddy-brand-rail-count">
                                <span className="task-buddy-brand-rail-count-value">{progressDoneCount}</span>
                                <span className="task-buddy-brand-rail-count-total">/ {progressTotal}</span>
                            </div>
                            <div className="task-buddy-brand-rail-bar" aria-hidden="true">
                                <div className="task-buddy-brand-rail-bar-fill" style={{ width: `${progressPercent}%` }} />
                            </div>
                            <ul className="task-buddy-brand-rail-list">
                                {progressSlots.map((slot) => (
                                    <li
                                        key={slot.key}
                                        className="task-buddy-brand-rail-item"
                                        data-state={slot.state}
                                    >
                                        <span className="task-buddy-brand-rail-indicator">
                                            {slot.state === 'done' && <Check className="h-3 w-3" strokeWidth={3} />}
                                        </span>
                                        <span className="task-buddy-brand-rail-label">
                                            <div>{slot.label}</div>
                                            {slot.state === 'done' && slot.value ? (
                                                <div className="task-buddy-brand-rail-value" title={slot.value}>
                                                    {slot.value}
                                                </div>
                                            ) : null}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            {user?.name && (
                                <div className="task-buddy-brand-rail-meta">
                                    <p className="task-buddy-brand-rail-meta-title">Signed in as</p>
                                    <div className="task-buddy-brand-rail-meta-item">
                                        <span className="task-buddy-brand-rail-meta-value" title={user.name}>
                                            {user.name}
                                        </span>
                                        {user?.email ? (
                                            <span className="task-buddy-brand-rail-meta-label" title={user.email}>
                                                {user.email}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            )}

                            {attachmentFiles.length > 0 && (
                                <div className="task-buddy-brand-rail-files">
                                    <p className="task-buddy-brand-rail-meta-title">
                                        Uploaded files · {attachmentFiles.length}
                                    </p>
                                    <div>
                                        {attachmentFiles.map((file) => {
                                            const previewable = isAttachmentPreviewable(file);
                                            return (
                                                <div key={file.id || file.name} className="task-buddy-brand-rail-file">
                                                    <span className="task-buddy-brand-rail-file-icon">
                                                        <Paperclip className="h-3 w-3" />
                                                    </span>
                                                    <span className="task-buddy-brand-rail-file-name" title={file.name}>
                                                        {file.name}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="task-buddy-brand-rail-file-btn"
                                                        onClick={() => setAttachmentPreviewFile(file)}
                                                        disabled={!previewable}
                                                        title={previewable ? 'Preview' : 'No preview available'}
                                                        aria-label={`Preview ${file.name}`}
                                                    >
                                                        <Eye className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                        </aside>
                    )}
                </div>
                <AttachmentPreviewDialog
                    file={attachmentPreviewFile}
                    open={Boolean(attachmentPreviewFile)}
                    onOpenChange={(open) => {
                        if (!open) {
                            setAttachmentPreviewFile(null);
                        }
                    }}
                    description="Previewing attached file"
                />
            </DialogContent>
        </Dialog>
    );
}

