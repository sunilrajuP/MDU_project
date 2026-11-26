// Seed for the in-progress mock job (MDU-000001): the runbook state drawn in the Figma frames.
// WHS and BFD complete, External 7/8, Internal Network partly filled, everything else untouched.
// Codes below match src/features/survey/runbook/config/* (a test asserts they all exist).
// Seeded photos are placeholders: they point at no stored file, so thumbnails show a generic image tile.

import type { MediaAttachment, RunbookSectionRecord } from '@/types/surveyor';

const at = (day: number, hour: number, minute: number) => new Date(2026, 9, day, hour, minute).toISOString();

const photo = (id: string): MediaAttachment => ({ id: `seed-${id}`, kind: 'photo', capturedAt: at(28, 9, 24), hasMarkup: false });
const item = (values: Record<string, string | string[]>, confirmed = true, media: MediaAttachment[] = []) => ({
  values,
  media,
  confirmed,
});
const open = (values: Record<string, string | string[]> = {}) => item(values, false);

export function seedSections(jobRef: string): RunbookSectionRecord[] {
  const whsAnswers = (value: string, details = '') => ({ value, details });
  return [
    {
      key: 'whs',
      rev: 1,
      completed: true,
      completedAt: at(28, 9, 12),
      data: {
        answers: {
          'whs.ppe': whsAnswers('yes'),
          'whs.induction': whsAnswers('yes'),
          'whs.confinedSpaceId': whsAnswers(
            'yes',
            'Basement plant area — pit access beside PoC. No entry authorised; specialist assessment required.',
          ),
          'whs.asbestosRegister': whsAnswers('yes'),
          'whs.asbestosPits': whsAnswers('yes', 'Suspected pit material. No disturbance; asbestos procedure to be followed.'),
          'whs.siteAccess': whsAnswers('yes'),
          'whs.ledLight': whsAnswers('yes'),
          'whs.heights': whsAnswers('yes', 'Upper riser inspection from floor only. Height access requires approved controls.'),
          'whs.confinedEntry': whsAnswers('yes', 'Pit entry excluded from this visit. Record referred for specialist access.'),
          'whs.electrical': whsAnswers('yes', 'Building contact to escort. Do not open electrical equipment.'),
          'whs.fireWalls': whsAnswers('yes', 'Brick fire wall/floor penetration required. Approved fire sealing to be specified.'),
          'whs.trenching': whsAnswers('no'),
          'whs.epr': whsAnswers(
            'yes',
            'Electrical proximity assessment required before installation. Survey from safe accessible areas only.',
          ),
        },
        hazardNotes:
          'Clear access via roller door. LED work light on hand for basement plan capture. Identified hazards and access restrictions recorded; no confined-space entry or intrusive works during survey.',
        siteNotes: 'Site induction complete. Building contact has confirmed safe survey access and recorded restrictions.',
      },
    },
    {
      key: 'bfd',
      rev: 1,
      completed: true,
      data: {
        answers: {
          floorsAboveGround: '4',
          basementLevels: '1',
          gponPremises: '22',
          businessP2p: '2',
          businessP2pNote: 'GF shops',
          fibreTv: 'no',
          fdtLikely: 'no',
        },
        selection: {
          code: 'BUDI-1S',
          name: 'Medium building fibre device',
          spec: '12F FSL · up to 200 GPON · multiple P2P',
          rationale: 'BUDI-1S — ≥2 potential business customers (Fig 4)',
          figure: 'Figure 4',
          savedAt: at(28, 9, 18),
        },
      },
    },
    {
      key: 'external',
      rev: 1,
      completed: false,
      data: {
        items: {
          'ext.letterbox': item({ notes: 'Letterbox bank, all 22 panels legible.' }, true, [photo('letterbox')]),
          'ext.eupCount': item(
            { residential: '20', commercial: '2', essential: '0', notes: 'Letterbox method count.' },
            true,
            [photo('eup')],
          ),
          'ext.pit': item(
            { gpsTag: 'Attached to pit evidence · location recorded', notes: 'FJL pit located on nature strip, GPS tagged.' },
            true,
            [photo('pit')],
          ),
          'ext.leadIn': item(
            {
              size: '50 mm',
              condition: 'Good · roped P50',
              capacity: 'Draw rope present; proposed lead-in route available',
              notes: 'P50 conduit, good condition.',
            },
            true,
            [photo('leadin')],
          ),
          'ext.entryPoint': item(
            { measurements: 'Penetration Ø 50 mm · height 650 mm above finished floor', notes: 'Cable entry at concrete wall penetration.' },
            true,
            [photo('entry')],
          ),
          'ext.entrance': item({ notes: 'Overall entrance context.' }, true, [photo('entrance')]),
          'ext.pitDistance': item({ distance: '6 m', notes: 'Roped through existing P50.' }, true, [photo('distance')]),
        },
        siteNotes:
          'Lead-in from street pit via 6m roped P50 to concrete wall penetration. Letterbox count 22 EUP (20 res / 2 comm).',
      },
    },
    {
      key: 'internal',
      rev: 1,
      completed: false,
      data: {
        buildingConfirmed: false,
        building: {
          'bldg.bep': item({ location: 'B1 service wall beside roller-door access' }, true, [photo('bep')]),
          'bldg.poc': item({ location: 'B1 service wall beside roller-door access' }, true, [photo('poc')]),
          'bldg.bfdType': item({ type: 'BUDI-1S' }),
          'bldg.height': item({ value: '1200' }),
          'bldg.switchboard': item({ value: '1200' }),
          'bldg.pipe': item({ value: '200' }),
          'bldg.gas': item({ value: '650' }),
          'bldg.prohibited': item({ locations: [] }),
          'bldg.nbnLabel': item({ status: 'Absent-photo', note: 'Absence recorded with photo; label not legible.' }),
        },
        byFloor: {
          B1: {
            unitSeq: 2,
            checklist: {
              'floor.risers': open({ riserLocation: 'B1 · service corridor' }),
              'floor.containment': open({ type: 'Tray' }),
              'floor.accessSecurity': open({ notes: 'Building contact escort required' }),
            },
            basement: {
              'bsmt.access': open({ access: 'Roller door · escorted access' }),
              'bsmt.pocConfirmation': open({ confirmation: 'Shared building BFD-01 in B1' }),
              'bsmt.confinedSpace': open({ risk: 'Yes', controls: 'Logged' }),
            },
            units: [
              {
                id: 'seed-unit-b1-01',
                label: 'B1-01',
                completed: false,
                items: {
                  'unit.identifier': item({ identifier: `B1-01 · Linked ${jobRef}/B1` }),
                  'unit.gpo': open({ distance: '2.4' }),
                  'unit.existingIcd': item({ present: 'No' }),
                },
              },
              {
                id: 'seed-unit-b1-02',
                label: 'B1-02',
                completed: false,
                items: { 'unit.identifier': item({ identifier: `B1-02 · Linked ${jobRef}/B1` }) },
              },
            ],
          },
        },
        siteNotes:
          'B1 inspection in progress. Restricted access requires building contact. No intrusive survey or confined-space entry authorised.',
      },
    },
    {
      key: 'floorPlans',
      rev: 1,
      completed: false,
      data: {
        byFloor: {
          B1: {
            media: [],
            calibration: null,
            devices: [],
            notes: 'Capture B1 escape plan; include basement PoC-to-riser pathway.',
            reviewed: false,
            ready: false,
          },
        },
        siteNotes: '',
      },
    },
    {
      key: 'nbnDesign',
      rev: 1,
      completed: false,
      data: {
        site: { commonAreas: '3', mduSolution: 'MT-LFN' },
        design: { pitPipe: 'Yes', cabling: 'PIC direct' },
        siteNotes: '',
      },
    },
  ];
}
