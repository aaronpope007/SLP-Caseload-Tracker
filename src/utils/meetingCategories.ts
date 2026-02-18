/**
 * Meeting category groups and subcategories for the timesheet.
 * - Direct contact (show in timesheet direct section): Initial Assessment, 3 Year Reassessment
 * - Planning (indirect, with meeting/updates): IEP planning, Assessment planning, 3 year reassessment planning
 * - IEP (indirect, with meeting/updates/assessment): IEP
 * - Other meeting types: Staff Meeting, Team Meeting, etc.
 */

export const MEETING_CATEGORY_GROUPS = {
  'Direct Contact': ['Initial Assessment', '3 Year Reassessment', 'Assessment'], // Assessment = legacy, prefer Initial/3 Year
  Planning: ['IEP planning', 'Assessment planning', '3 year reassessment planning'],
  Meetings: ['IEP', 'Staff Meeting', 'Team Meeting', 'Parent Meeting', 'Professional Development', 'Speech screening', 'Assessment documentation'],
  Other: ['Other'],
} as const;

export type MeetingCategoryGroup = keyof typeof MEETING_CATEGORY_GROUPS;

/** All subcategory values stored on Meeting.category */
export const ALL_MEETING_SUBCATEGORIES = (
  Object.values(MEETING_CATEGORY_GROUPS) as readonly string[][]
).flat();

/** Categories that show as direct contact on the timesheet (with studentId). Includes legacy "Assessment" when activitySubtype === 'assessment'. */
export const DIRECT_CONTACT_CATEGORIES = ['Initial Assessment', '3 Year Reassessment'];

/** Categories that use activity subtype (meeting / updates; IEP also has assessment) */
export const CATEGORIES_WITH_ACTIVITY_SUBTYPE = [
  'IEP',
  'IEP planning',
  'Assessment planning',
  '3 year reassessment planning',
  'Assessment', // legacy
];

/** Legacy category: stored on old meetings; we map to new behavior in timesheet */
export const LEGACY_ASSESSMENT_CATEGORY = 'Assessment';

export function getCategoryGroup(subcategory: string): MeetingCategoryGroup | null {
  for (const [group, subs] of Object.entries(MEETING_CATEGORY_GROUPS)) {
    if ((subs as readonly string[]).includes(subcategory)) return group as MeetingCategoryGroup;
  }
  return null;
}

export function isDirectContactCategory(category: string | undefined): boolean {
  if (!category) return false;
  if (DIRECT_CONTACT_CATEGORIES.includes(category)) return true;
  return false;
}

/** For backward compat: old "Assessment" + activitySubtype 'assessment' = direct (3 Year Reassessment) */
export function isLegacyDirectAssessment(meeting: { category?: string; activitySubtype?: string }): boolean {
  return meeting.category === LEGACY_ASSESSMENT_CATEGORY && meeting.activitySubtype === 'assessment';
}

export function isCategoryWithActivitySubtype(category: string | undefined): boolean {
  return !!category && CATEGORIES_WITH_ACTIVITY_SUBTYPE.includes(category);
}
