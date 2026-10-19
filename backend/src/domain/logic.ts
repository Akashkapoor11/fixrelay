import { createHash, randomBytes } from 'node:crypto';
import type { Severity, SafetyLevel, WarrantyEvaluation } from './types.js';

const STOP_WORDS = new Set([
  'a', 'about', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'bought', 'by', 'for', 'from',
  'has', 'have', 'help', 'i', 'in', 'is', 'it', 'its', 'me', 'my', 'of', 'on', 'or',
  'please', 'the', 'this', 'to', 'was', 'what', 'when', 'with', 'would', 'you', 'your',
]);

export function normalizeText(value: string): string {
  return value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function tokenize(value: string): string[] {
  return [...new Set((value.toLowerCase().match(/[a-z0-9][a-z0-9-]*/g) ?? [])
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term)))];
}

export function normalizeIssue(value: string): string {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, ' ').trim();
}

export function hashIssue(value: string): string {
  return createHash('sha256').update(normalizeIssue(value)).digest('hex');
}

/** Normalize a user-supplied source URL without implying that its publisher is authentic. */
export function normalizeReferenceUrl(value: string): string {
  const input = normalizeText(value);
  if (!input) return '';
  const parsed = new URL(input);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('Reference URL must use HTTP(S) and must not embed credentials.');
  }
  return parsed.toString();
}

/** Hash the exact normalized draft context so approval cannot be reused for altered text. */
export function hashApprovalDraft(input: { deviceId: string; issue: string; summary: string; sessionId: string }): string {
  const canonical = JSON.stringify({
    deviceId: normalizeText(input.deviceId),
    issue: normalizeText(input.issue),
    summary: normalizeText(input.summary),
    sessionId: normalizeText(input.sessionId),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export function mintApprovalToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function addMonths(inputDate: string, months: number): string {
  const datePart = inputDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) throw new Error('Purchase date must use YYYY-MM-DD.');
  const parsed = new Date(`${datePart}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== datePart) throw new Error('Purchase date is invalid.');
  if (!Number.isInteger(months) || months < 0 || months > 120) throw new Error('Warranty duration must be between 0 and 120 whole months.');
  const originalDay = parsed.getUTCDate();
  const targetMonthIndex = parsed.getUTCMonth() + months;
  const targetYear = parsed.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const endOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(originalDay, endOfTargetMonth))).toISOString().slice(0, 10);
}

export function evaluateWarranty(purchaseDate: string, warrantyMonths: number, today = new Date()): WarrantyEvaluation {
  const expiry = addMonths(purchaseDate, warrantyMonths);
  const nowIso = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).toISOString().slice(0, 10);
  const expiryDate = new Date(`${expiry}T00:00:00.000Z`);
  const nowDate = new Date(`${nowIso}T00:00:00.000Z`);
  const daysRemaining = Math.ceil((expiryDate.getTime() - nowDate.getTime()) / 86_400_000);
  const state: WarrantyEvaluation['state'] = warrantyMonths === 0
    ? 'No warranty recorded'
    : daysRemaining >= 0 ? 'Active by recorded dates' : 'Expired by recorded dates';
  return {
    purchaseDate: purchaseDate.slice(0, 10),
    warrantyMonths,
    calculatedExpiryDate: expiry,
    state,
    daysRemaining: Math.max(daysRemaining, 0),
    disclaimer: 'Date arithmetic only. This does not verify manufacturer terms, exclusions, proof of purchase, or claim eligibility.',
  };
}

export function detectSeverity(issue: string): Severity {
  const text = issue.toLowerCase();
  if (/fire|flame|explod|gas leak|carbon monoxide|smoke|sparks|electric shock|electrocution/.test(text)) return 'urgent';
  if (/burning smell|burning odor|overheating|melted|exposed wire|water near power|electrical fault/.test(text)) return 'high';
  if (/grinding|loud noise|vibration|leak|motor warning|won't turn on|not working/.test(text)) return 'medium';
  return 'low';
}

export function inferSafetyLevel(issue: string): SafetyLevel {
  const severity = detectSeverity(issue);
  return severity === 'urgent' || severity === 'high' ? 'high' : severity === 'medium' ? 'medium' : 'low';
}

export function safetyGuidance(issue: string): string[] {
  const text = issue.toLowerCase();
  const steps: string[] = [];
  if (/fire|flame|explod|gas leak|carbon monoxide|smoke|sparks|electric shock|electrocution/.test(text)) {
    steps.push('Stop using the device and move away from immediate danger.');
    steps.push('If there is fire, smoke, a suspected gas leak, or risk of injury, contact local emergency services from a safe location.');
    steps.push('Do not attempt troubleshooting, disassembly, or reconnection while a hazard may be present.');
    return steps;
  }
  if (/burning smell|burning odor|overheating|melted|exposed wire|water near power|electrical fault/.test(text)) {
    steps.push('Stop using the device. If it is safe to do so, disconnect power without touching damaged or wet components.');
    steps.push('Do not open the casing or try internal electrical repairs. Arrange qualified service.');
  } else if (/grinding|motor|vibration|loud noise/.test(text)) {
    steps.push('Switch the device off and disconnect it from power before inspecting accessible exterior parts.');
    steps.push('Check only user-serviceable items described in the relevant official manual. Do not open the motor housing.');
  } else {
    steps.push('Keep the device powered off if continued use appears unsafe or could worsen the issue.');
    steps.push('Check the actual manufacturer documentation before attempting maintenance.');
  }
  steps.push('Treat retrieved demo or user-provided excerpts as unverified until checked against the real product documentation.');
  return steps;
}

export function serviceRecommendations(issue: string): string[] {
  const severity = detectSeverity(issue);
  if (severity === 'urgent' || severity === 'high') {
    return [
      'Prioritize personal safety and stop using the device.',
      'Use the product maker’s verified support channel or a qualified service professional.',
      'Do not purchase replacement parts until the issue and compatible model are confirmed.',
    ];
  }
  return [
    'Compare the evidence excerpt with the real device manual and its safety warnings.',
    'Check the warranty window using your purchase record and the actual warranty terms.',
    'If the fault persists, request a qualified assessment and keep the repair case as a local draft.',
  ];
}
