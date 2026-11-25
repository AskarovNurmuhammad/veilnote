import type { VaultDocument } from '../types/veilnote';

export const PRESET_DOCUMENTS: VaultDocument[] = [
  {
    id: 'preset-clinical',
    title: 'Outpatient Intake Follow-up',
    domain: 'Healthcare Triage',
    updatedAt: '2026-11-25T10:15:00Z',
    rawText: `Patient: Elena Rostova
DOB: 04/18/1984
Phone: +1 (415) 892-4410
Email: elena.rostova84@gmail.com
Address: 742 Evergreen Terrace, Apt 4B, San Francisco, CA 94107
Member ID: HLT-994821-CA

Intake Summary:
Called Dr. Marcus Vance regarding recurring migraine episodes (3x/week) after switching dosage on Monday. Reported blurred vision for 20 minutes yesterday afternoon and mild nausea. Currently out of sumatriptan refills and traveling to Austin next Tuesday. Needs an expedited pharmacy transfer before travel and neurology screening confirmation.`,
  },
  {
    id: 'preset-freelance',
    title: 'Client Scope & Payment Escalation',
    domain: 'Legal & Finance',
    updatedAt: '2026-11-25T09:40:00Z',
    rawText: `Client: David Chen (Northstar Logistics)
Contact: d.chen@northstar-ops.io | +1 646-555-0192
Settlement IBAN: DE89370400440532013000
Tax ID: 84-2910482

Note:
Client requested 14 additional analytics views outside the October SOW without revising milestone #3 ($8,400 invoice overdue by 18 days). Also pasted their staging webhook token by mistake in Slack: sk-live9481029481029481abcd. Need a firm but constructive reply pausing extra scope until Invoice #104 is cleared and advising immediate token rotation.`,
  },
  {
    id: 'preset-security',
    title: 'Field Support Incident Log',
    domain: 'Security Ops',
    updatedAt: '2026-11-25T08:05:00Z',
    rawText: `Reporter: Nadia Al-Mansoor
Email: nadia.mansoor@meridianbank.org
Phone: +44 20 7946 0821
SSN: 123-45-6789

Incident Notes:
Customer forwarded a debug bundle containing an exposed GitHub personal access token ghp_9xK2mP7qR4tV8wZ1aB3cD5eF7gH9jK and internal billing export for 412 Elm Street, Boston, MA 02116. Logs show two failed OAuth callbacks from mobile clients on v2.4.1 before session timeout. Prepare containment checklist and customer notification draft.`,
  },
  {
    id: 'preset-ngo',
    title: 'Emergency Relief Case #408',
    domain: 'Field Aid',
    updatedAt: '2026-11-24T19:20:00Z',
    rawText: `Beneficiary: Faridun Karimov
National ID: AB4492018
Phone: +998 90 412 88 19
Address: 18 Navoiy Avenue, Samarkand

Field Assessment (recorded offline):
Family of 5 lost heating unit after power surge. Elderly parent requires daily insulin refrigeration; temporary generator needed within 24 hours. Local clinic verified prescription but regional warehouse needs formal procurement sign-off and 7-day fuel allocation estimate.`,
  },
];
