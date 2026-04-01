const SECTION_GAP = '  |  ';

/**
 * Collapses a multiline timesheet note to one line for systems that strip or ignore newlines.
 * Non-empty lines are joined with spaced pipes so sections stay easy to scan.
 */
export const timesheetNoteToSingleLine = (note: string): string =>
  note
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join(SECTION_GAP);
