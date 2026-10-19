import { describe, expect, it } from 'vitest';
import { addMonths, detectSeverity, evaluateWarranty, hashApprovalDraft, hashIssue, hashToken, normalizeIssue, normalizeReferenceUrl, safetyGuidance, tokenize } from './logic.js';

describe('FixRelay domain logic', () => {
  it('clamps end-of-month dates and handles leap years', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2025-01-31', 1)).toBe('2025-02-28');
    expect(addMonths('2024-02-29', 12)).toBe('2025-02-28');
  });

  it('rejects invalid warranty ranges', () => {
    expect(() => addMonths('2025-01-01', -1)).toThrow();
    expect(() => addMonths('not-a-date', 12)).toThrow();
    expect(() => addMonths('2024-02-31', 12)).toThrow();
  });

  it('labels warranty as date arithmetic rather than manufacturer approval', () => {
    const active = evaluateWarranty('2026-01-01', 12, new Date('2026-06-01T00:00:00Z'));
    expect(active.state).toBe('Active by recorded dates');
    expect(active.calculatedExpiryDate).toBe('2027-01-01');
    expect(active.disclaimer).toContain('does not verify manufacturer terms');
    const expired = evaluateWarranty('2024-01-01', 12, new Date('2026-06-01T00:00:00Z'));
    expect(expired.state).toBe('Expired by recorded dates');
    expect(expired.daysRemaining).toBe(0);
  });

  it('prioritizes emergency safety language for immediate hazards', () => {
    expect(detectSeverity('There are sparks and smoke')).toBe('urgent');
    expect(safetyGuidance('There are sparks and smoke').join(' ')).toContain('local emergency services');
    expect(detectSeverity('The fan makes a grinding noise')).toBe('medium');
  });

  it('normalizes an issue consistently for approval binding', () => {
    expect(normalizeIssue('  Grinding  NOISE! ')).toBe('grinding noise');
    expect(hashIssue('Grinding noise')).toBe(hashIssue(' grinding NOISE '));
    expect(hashToken('secret-token')).not.toBe('secret-token');
  });

  it('binds approval to the exact normalized case draft, not just device and issue', () => {
    const draft = { deviceId: 'device-1', issue: 'Grinding noise', summary: 'Reviewed evidence', sessionId: 'session_test_123' };
    expect(hashApprovalDraft(draft)).toBe(hashApprovalDraft({ ...draft, summary: '  Reviewed   evidence  ' }));
    expect(hashApprovalDraft(draft)).not.toBe(hashApprovalDraft({ ...draft, summary: 'Different summary' }));
    expect(hashApprovalDraft(draft)).not.toBe(hashApprovalDraft({ ...draft, sessionId: 'session_test_456' }));
  });

  it('drops generic words from search tokens without corrupting real terms', () => {
    expect(tokenize('What about the warranty?')).toEqual(['warranty']);
    expect(tokenize('grinding noise')).toEqual(['grinding', 'noise']);
  });

  it('stores reference URLs only as HTTP(S) provenance and rejects embedded credentials', () => {
    expect(normalizeReferenceUrl(' https://docs.example.com/manual.pdf ')).toBe('https://docs.example.com/manual.pdf');
    expect(normalizeReferenceUrl('')).toBe('');
    expect(() => normalizeReferenceUrl('javascript:alert(1)')).toThrow();
    expect(() => normalizeReferenceUrl('https://user:pass@example.com/manual')).toThrow();
  });
});
