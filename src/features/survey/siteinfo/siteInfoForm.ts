import type { SiteInfo } from '@/types/surveyor';

/** Flat, string-only form state (the API shape nests fields and tracks `fromManager`). */
export interface SiteInfoValues {
  role: string;
  name: string;
  phone: string;
  email: string;
  parking: string;
  accessWindow: string;
  entryInstructions: string;
  accessRequirements: string;
}

export type SiteInfoErrors = Partial<Record<keyof SiteInfoValues, string>>;

export function toValues(info: SiteInfo): SiteInfoValues {
  return {
    role: info.stakeholder.role.value,
    name: info.stakeholder.name.value,
    phone: info.stakeholder.phone.value,
    email: info.stakeholder.email.value,
    parking: info.access.parking,
    accessWindow: info.access.accessWindow,
    entryInstructions: info.access.entryInstructions.value,
    accessRequirements: info.access.accessRequirements,
  };
}

/** Rebuilds the API payload, preserving which fields originated from the manager. */
export function toSiteInfo(values: SiteInfoValues, original: SiteInfo): Omit<SiteInfo, 'rev'> {
  const field = (value: string, source: { fromManager?: boolean }) =>
    source.fromManager ? { value, fromManager: true } : { value };
  return {
    stakeholder: {
      role: field(values.role, original.stakeholder.role),
      name: field(values.name, original.stakeholder.name),
      phone: field(values.phone, original.stakeholder.phone),
      email: field(values.email, original.stakeholder.email),
    },
    access: {
      parking: values.parking,
      accessWindow: values.accessWindow,
      entryInstructions: field(values.entryInstructions, original.access.entryInstructions),
      accessRequirements: values.accessRequirements,
    },
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Contact name and phone are required (the site must be reachable); email must be well formed when given. */
export function validate(values: SiteInfoValues): SiteInfoErrors {
  const errors: SiteInfoErrors = {};
  if (!values.name.trim()) errors.name = 'Enter the contact name.';
  const digits = values.phone.replaceAll(/\D/g, '');
  if (!values.phone.trim()) errors.phone = 'Enter the contact phone number.';
  else if (digits.length < 8) errors.phone = 'Enter a valid phone number.';
  if (values.email.trim() && !EMAIL.test(values.email.trim())) errors.email = 'Enter a valid email address.';
  return errors;
}
