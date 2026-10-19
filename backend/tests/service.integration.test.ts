import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeDatabase, pool } from '../src/db/pool.js';
import { FixRelayService } from '../src/domain/service.js';
import { randomUUID } from 'node:crypto';

const databaseAvailable = Boolean(process.env.DATABASE_URL);

describe('evidence retrieval query hygiene', () => {
  it('does not return unrelated recent excerpts when query contains only stop words', async () => {
    await expect(new FixRelayService().searchManuals('what about it')).resolves.toEqual([]);
  });
});

describe.skipIf(!databaseAvailable)('PostgreSQL workflow integration', () => {
  const service = new FixRelayService();
  const testSuffix = randomUUID().slice(0, 8);
  let deviceId = '';
  beforeAll(async () => {
    await initializeDatabase();
    const created = await service.addDevice({
      name: `Integration test purifier ${testSuffix}`, brand: 'Test brand', category: 'Air purifier', model: 'TEST-1',
      serialNumber: `TEST-${testSuffix}`, purchaseDate: '2026-01-15', warrantyMonths: 12, room: 'Test room', condition: 'Needs attention',
      referenceTitle: 'Test excerpt', referenceSection: 'Testing', referenceExcerpt: 'For a grinding noise, power down safely and verify the official manual.', referenceUrl: 'https://docs.example.test/manual',
    });
    deviceId = created.id;
  });
  afterAll(async () => {
    if (deviceId) await pool.query('DELETE FROM devices WHERE id = $1', [deviceId]);
  });
  it('persists a device and retrieves its source-labelled reference excerpt', async () => {
    const found = await service.getDevice(deviceId);
    expect(found?.model).toBe('TEST-1');
    // A source label must never promote an excerpt to verified status by implication.
    await pool.query(
      `UPDATE manuals SET source_label = $1, source_note = $2 WHERE device_id = $3`,
      ['Official manufacturer manual', 'Appears to be an official source, but has not been independently verified by FixRelay.', deviceId],
    );
    const evidence = await service.searchManuals('grinding noise', deviceId);
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence[0]?.verified).toBe(false);
    expect(evidence[0]?.sourceUrl).toBe('https://docs.example.test/manual');
    expect(evidence[0]?.sourceNote).toContain('not independently verified');
  });
  it('creates a local draft only with a matching single-use approval token', async () => {
    const sessionId = `session_test_${testSuffix}`;
    const issue = 'The device makes a grinding noise during use.';
    const summary = 'Test-only local draft';
    const approval = await service.createApproval({ deviceId, issue, summary, sessionId });
    await expect(service.createCase({
      deviceId, issue, sessionId, summary: 'Changed after approval', approvalToken: approval.approvalToken,
    })).rejects.toThrow(/invalid|different request/i);
    // A failed, mismatched use must not consume the token; the exact approved draft can still be created.
    const created = await service.createCase({
      deviceId, issue, sessionId, summary, approvalToken: approval.approvalToken,
    });
    expect(created.status).toBe('Draft');
    expect(created.resolution).toContain('No provider has been contacted');
    const note = await service.addCaseNote(created.id, 'User confirmed follow-up is needed.');
    expect(note.caseId).toBe(created.id);
    const withHistory = await service.getCase(created.id);
    expect(withHistory?.events?.some((event) => event.kind === 'note')).toBe(true);
    await expect(service.createCase({
      deviceId, issue, sessionId, summary: 'Replay must fail', approvalToken: approval.approvalToken,
    })).rejects.toThrow(/invalid|used|consumed/i);
    await pool.query('DELETE FROM repair_cases WHERE id = $1', [created.id]);
  });
});
