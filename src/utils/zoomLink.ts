const ZOOM_LINK_STORAGE_KEY = 'zoom_link';

/** Default template shown in Settings UI only — must never be emailed or persisted. */
export const ZOOM_LINK_PLACEHOLDER_TEMPLATE = `[Your Name] is inviting you to a scheduled Zoom meeting.

Topic: [Your Meeting Topic]

Join Zoom Meeting
[Your Zoom Meeting Link]

Meeting ID: [Your Meeting ID]
Passcode: [Your Passcode]

---

Join instructions
[Your join instructions]`;

const PLACEHOLDER_MARKERS = [
  '[Your Zoom Meeting Link]',
  '[Your Meeting Topic]',
  '[Your Meeting ID]',
  '[Your Passcode]',
  '[Your join instructions]',
  '[Your Name] is inviting you to a scheduled Zoom meeting',
];

export function isZoomLinkPlaceholder(value: string | null | undefined): boolean {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return true;
  return PLACEHOLDER_MARKERS.some((marker) => trimmed.includes(marker));
}

/** Zoom invitation text for emails, or empty if unset / still the placeholder template. */
export function getEffectiveZoomLink(): string {
  if (typeof localStorage === 'undefined') return '';
  const raw = localStorage.getItem(ZOOM_LINK_STORAGE_KEY);
  if (!raw || isZoomLinkPlaceholder(raw)) {
    if (raw && isZoomLinkPlaceholder(raw)) {
      localStorage.removeItem(ZOOM_LINK_STORAGE_KEY);
    }
    return '';
  }
  return raw;
}

export function readStoredZoomLinkForSettings(): string {
  if (typeof localStorage === 'undefined') return '';
  const raw = localStorage.getItem(ZOOM_LINK_STORAGE_KEY);
  if (!raw || isZoomLinkPlaceholder(raw)) return '';
  return raw;
}

export function persistZoomLink(value: string): void {
  const trimmed = value.trim();
  if (!trimmed || isZoomLinkPlaceholder(trimmed)) {
    localStorage.removeItem(ZOOM_LINK_STORAGE_KEY);
    return;
  }
  localStorage.setItem(ZOOM_LINK_STORAGE_KEY, trimmed);
}
