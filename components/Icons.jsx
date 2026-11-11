const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
const I = ({ size = 24, children, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base} {...p}>{children}</svg>
);

export const IconBag = (p) => <I {...p}><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></I>;
export const IconSchool = (p) => <I {...p}><path d="M8 4h8v3a4 4 0 0 1-8 0V4z" /><path d="M6 21v-6a6 6 0 0 1 12 0v6" /><path d="M10 14h4" /></I>;
export const IconCollege = (p) => <I {...p}><path d="M2 9l10-5 10 5-10 5L2 9z" /><path d="M6 11v5c3 2 9 2 12 0v-5" /><path d="M22 9v6" /></I>;
export const IconIndustrial = (p) => <I {...p}><path d="M4 16a8 8 0 0 1 16 0" /><path d="M2 16h20v2H2z" /><path d="M10 8V5h4v3" /></I>;
export const IconHospital = (p) => <I {...p}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" /></I>;
export const IconSearch = (p) => <I {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></I>;
export const IconPin = (p) => <I {...p}><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></I>;
export const IconHome = (p) => <I {...p}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></I>;
export const IconGrid = (p) => <I {...p}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></I>;
export const IconUser = (p) => <I {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></I>;
export const IconCart = (p) => <I {...p}><path d="M3 4h2l2.4 11h10.2L20 7H6.2" /><circle cx="9" cy="19.5" r="1.5" /><circle cx="17" cy="19.5" r="1.5" /></I>;
export const IconBack = (p) => <I {...p}><path d="M15 5l-7 7 7 7" /></I>;

export const CATEGORY_ICONS = {
  'for-you': IconBag,
  'school-uniforms': IconSchool,
  'college-uniforms': IconCollege,
  'industrial-uniforms': IconIndustrial,
  'hospital-uniforms': IconHospital,
};
