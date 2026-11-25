import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REDACTION_RULES,
  extractJsonObject,
  rehydrateTextLocally,
  sanitizeTextLocally,
} from '../privacyShield';

describe('privacyShield', () => {
  it('redacts emails, phones, secrets, and labeled person names into stable tokens', () => {
    const input =
      'Patient: Elena Rostova\nEmail: elena@clinic.org\nPhone: +1 415-892-4410\nKey: ghp_9xK2mP7qR4tV8wZ1aB3cD5eF7gH9jK\nFollow-up for Elena Rostova.';

    const result = sanitizeTextLocally(input, DEFAULT_REDACTION_RULES, [
      { value: 'Elena Rostova', category: 'PERSON' },
    ]);

    expect(result.sanitizedText).not.toContain('Elena Rostova');
    expect(result.sanitizedText).not.toContain('elena@clinic.org');
    expect(result.sanitizedText).not.toContain('415-892-4410');
    expect(result.sanitizedText).not.toContain('ghp_9xK2mP7qR4tV8wZ1aB3cD5eF7gH9jK');

    expect(result.sanitizedText).toContain('[PERSON_1]');
    expect(result.sanitizedText).toContain('[EMAIL_1]');
    expect(result.sanitizedText).toContain('[PHONE_1]');
    expect(result.sanitizedText).toContain('[SECRET_1]');
    expect(result.bytesScrubbed).toBeGreaterThan(40);
  });

  it('re-hydrates redacted tokens back to original values locally', () => {
    const input = 'Client: David Chen\nContact: d.chen@northstar-ops.io';
    const result = sanitizeTextLocally(input);
    const cloudOutput = `Schedule call with [PERSON_1] at [EMAIL_1].`;

    const restored = rehydrateTextLocally(cloudOutput, result.tokenMap);
    expect(restored).toBe('Schedule call with David Chen at d.chen@northstar-ops.io.');
  });

  it('respects toggled-off redaction categories', () => {
    const input = 'Email: team@example.com Phone: +1 646-555-0192';
    const result = sanitizeTextLocally(input, {
      ...DEFAULT_REDACTION_RULES,
      EMAIL: false,
    });

    expect(result.sanitizedText).toContain('team@example.com');
    expect(result.sanitizedText).toContain('[PHONE_1]');
  });

  it('preserves field labels and redacts multi-part addresses and member IDs', () => {
    const input =
      'DOB: 04/18/1984\nAddress: 742 Evergreen Terrace, Apt 4B, San Francisco, CA 94107\nMember ID: HLT-994821-CA\nAlso seen near 412 Elm Street, Boston, MA 02116.';
    const result = sanitizeTextLocally(input);

    expect(result.sanitizedText).toContain('DOB: [DATE_1]');
    expect(result.sanitizedText).toContain('Address: [ADDRESS_1]');
    expect(result.sanitizedText).toContain('Member ID: [GOV_ID_1]');
    expect(result.sanitizedText).toContain('[ADDRESS_2]');
    expect(result.sanitizedText).not.toContain('742 Evergreen Terrace');
    expect(result.sanitizedText).not.toContain('HLT-994821-CA');
  });

  it('extracts JSON wrapped in markdown fences', () => {
    const parsed = extractJsonObject(
      '```json\n{"headline":"Ready","urgency":"high"}\n```'
    );
    expect(parsed).toEqual({ headline: 'Ready', urgency: 'high' });
  });
});
