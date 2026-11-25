import type {
  PiiCategory,
  RedactedEntity,
  RedactionRuleSet,
  SanitizationResult,
} from '../types/veilnote';

export const DEFAULT_REDACTION_RULES: RedactionRuleSet = {
  EMAIL: true,
  PHONE: true,
  PERSON: true,
  FINANCIAL: true,
  GOV_ID: true,
  SECRET: true,
  ADDRESS: true,
  DATE: true,
};

interface CandidateMatch {
  category: PiiCategory;
  original: string;
  start: number;
  end: number;
  source: 'regex' | 'on_device_ai';
}

const PATTERN_DEFINITIONS: Array<{
  category: PiiCategory;
  regex: RegExp;
  captureGroup?: number;
}> = [
  {
    category: 'SECRET',
    regex:
      /\b(?:AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z]{16,}|ghp_[0-9A-Za-z]{20,}|Bearer\s+[A-Za-z0-9._-]{16,}|xox[baprs]-[0-9A-Za-z-]{12,})\b/g,
  },
  {
    category: 'EMAIL',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    category: 'FINANCIAL',
    regex:
      /\b(?:[A-Z]{2}\d{2}[A-Z0-9]{11,26}|(?:\d{4}[-\s]?){3}\d{4}|\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:account|acct|routing|balance)?)\b/g,
  },
  {
    category: 'GOV_ID',
    regex:
      /\b(?:SSN|Passport|National ID|Policy|Member ID|TIN|MRN)[ \t]*[:#]?[ \t]*([A-Z0-9-]{5,18})\b/gi,
    captureGroup: 1,
  },
  {
    category: 'GOV_ID',
    regex: /\b(\d{3}-\d{2}-\d{4})\b/g,
  },
  {
    category: 'PHONE',
    regex:
      /(?<!\w)(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{3}[\s.-]?\d{2,4}(?:[\s.-]?\d{2,4})?(?!\w)/g,
  },
  {
    category: 'ADDRESS',
    regex: /Address[ \t]*:[ \t]*([^\r\n]+)/gi,
    captureGroup: 1,
  },
  {
    category: 'ADDRESS',
    regex:
      /\b\d{1,5}[ \t]+[A-Z][A-Za-z0-9.'-]+(?:[ \t]+[A-Z][A-Za-z0-9.'-]+){0,3}[ \t]+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ln|Lane|Dr|Drive|Way|Court|Ct|Terrace|Ter|Place|Pl|Circle|Cir|Parkway|Pkwy|Trail|Trl|Square|Sq)\.?(?:,[ \t]*(?:Apt|Unit|Suite|Ste|#)[ \t]*[A-Za-z0-9-]+|[ \t]+(?:Apt|Suite|Ste)[ \t]*#?[A-Za-z0-9-]+)?(?:,[ \t]*[A-Z][A-Za-z \t.-]+(?:,[ \t]*[A-Z]{2}[ \t]*\d{5})?)?/g,
  },
  {
    category: 'DATE',
    regex:
      /\b(?:DOB|Birthdate|Born)[ \t]*[:#]?[ \t]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[ \t]+\d{1,2},?[ \t]+\d{4})\b/gi,
    captureGroup: 1,
  },
  {
    category: 'PERSON',
    regex:
      /(?:Patient|Client|Contact|Beneficiary|Reporter|Sender|Recipient|Manager|Doctor|Attorney|Name)[ \t]*:[ \t]*([A-Z][a-z]+(?:[ \t]+[A-Z][a-z.'-]+){1,2})/g,
    captureGroup: 1,
  },
  {
    category: 'PERSON',
    regex: /\b(?:Dr|Mr|Mrs|Ms|Prof)\.[ \t]+([A-Z][a-z]+(?:[ \t]+[A-Z][a-z.'-]+){0,2})/g,
  },
];

function isLikelyPhone(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return false;
  // Avoid flagging plain dates like 2026-11-25 or version numbers
  if (/^\d{4}[-.]\d{2}[-.]\d{2}$/.test(candidate.trim())) return false;
  return true;
}

function collectPatternMatches(
  text: string,
  rules: RedactionRuleSet
): CandidateMatch[] {
  const matches: CandidateMatch[] = [];

  for (const def of PATTERN_DEFINITIONS) {
    if (!rules[def.category]) continue;
    const flags = def.regex.flags.includes('g')
      ? def.regex.flags
      : `${def.regex.flags}g`;
    const re = new RegExp(def.regex.source, flags);

    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      let value = m[0];
      let start = m.index;

      if (def.captureGroup && m[def.captureGroup]) {
        const captured = m[def.captureGroup];
        const offset = m[0].indexOf(captured);
        if (offset >= 0) {
          value = captured;
          start = m.index + offset;
        }
      }

      if (def.category === 'PHONE' && !isLikelyPhone(value)) {
        continue;
      }

      if (def.category === 'FINANCIAL' && value.trim().startsWith('$') && !/(account|acct|routing|balance)/i.test(value)) {
        continue;
      }

      matches.push({
        category: def.category,
        original: value,
        start,
        end: start + value.length,
        source: 'regex',
      });
    }
  }

  return matches;
}

function collectAiEntityMatches(
  text: string,
  extraEntities: Array<{ value: string; category: PiiCategory }>,
  rules: RedactionRuleSet
): CandidateMatch[] {
  const matches: CandidateMatch[] = [];
  for (const item of extraEntities) {
    const trimmed = item.value.trim();
    if (trimmed.length < 3 || !rules[item.category]) continue;

    let searchFrom = 0;
    while (searchFrom < text.length) {
      const idx = text.indexOf(trimmed, searchFrom);
      if (idx === -1) break;
      matches.push({
        category: item.category,
        original: trimmed,
        start: idx,
        end: idx + trimmed.length,
        source: 'on_device_ai',
      });
      searchFrom = idx + trimmed.length;
    }
  }
  return matches;
}

/**
 * Deterministically scrubs sensitive fields locally in the browser and builds a
 * reversible token vault (`[CATEGORY_N] -> original`) that never leaves the device.
 */
export function sanitizeTextLocally(
  rawText: string,
  rules: RedactionRuleSet = DEFAULT_REDACTION_RULES,
  extraAiEntities: Array<{ value: string; category: PiiCategory }> = []
): SanitizationResult {
  const candidates = [
    ...collectPatternMatches(rawText, rules),
    ...collectAiEntityMatches(rawText, extraAiEntities, rules),
  ];

  // Sort by earliest start, then longest match, preferring regex over duplicate AI hits
  candidates.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.end !== b.end) return b.end - a.end;
    return a.source === 'regex' ? -1 : 1;
  });

  const accepted: CandidateMatch[] = [];
  let cursor = 0;
  for (const c of candidates) {
    if (c.start < cursor) continue;
    accepted.push(c);
    cursor = c.end;
  }

  const counters: Record<PiiCategory, number> = {
    EMAIL: 0,
    PHONE: 0,
    PERSON: 0,
    FINANCIAL: 0,
    GOV_ID: 0,
    SECRET: 0,
    ADDRESS: 0,
    DATE: 0,
  };

  const valueToToken = new Map<string, string>();
  const tokenMap: Record<string, string> = {};
  const entities: RedactedEntity[] = [];

  let sanitized = '';
  let lastIndex = 0;
  let bytesScrubbed = 0;
  const encoder = new TextEncoder();

  for (const match of accepted) {
    sanitized += rawText.slice(lastIndex, match.start);

    const cacheKey = `${match.category}::${match.original}`;
    let token = valueToToken.get(cacheKey);
    if (!token) {
      counters[match.category] += 1;
      token = `[${match.category}_${counters[match.category]}]`;
      valueToToken.set(cacheKey, token);
      tokenMap[token] = match.original;
    }

    sanitized += token;
    lastIndex = match.end;
    bytesScrubbed += encoder.encode(match.original).length;

    entities.push({
      token,
      category: match.category,
      original: match.original,
      start: match.start,
      end: match.end,
      source: match.source,
    });
  }

  sanitized += rawText.slice(lastIndex);

  return {
    rawText,
    sanitizedText: sanitized,
    entities,
    tokenMap,
    bytesRaw: encoder.encode(rawText).length,
    bytesScrubbed,
  };
}

/**
 * Restores masked tokens back to real values strictly inside the user's browser
 * after cloud or local generation finishes.
 */
export function rehydrateTextLocally(
  text: string,
  tokenMap: Record<string, string>
): string {
  if (!text) return text;
  let output = text;
  for (const [token, original] of Object.entries(tokenMap)) {
    output = output.split(token).join(original);
  }
  return output;
}

export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
