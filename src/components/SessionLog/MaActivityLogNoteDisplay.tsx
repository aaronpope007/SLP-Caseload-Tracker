import { Box, Stack, Typography } from '@mui/material';
import type { SessionLogEntry } from '../../types';
import { splitMaActivityLogNote } from '../../utils/maActivityLogNote';

function formatSessionDateOnly(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

function formatSessionClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function formatSessionEnd(iso: string | null | undefined): string {
  if (iso == null || iso === '') return '—';
  return formatSessionClock(iso);
}

interface MaActivityLogNoteDisplayProps {
  entry: SessionLogEntry;
  noteText: string;
}

/** SpedForms-style metadata row (codes) + plain narrative body (no codes). */
export function MaActivityLogNoteDisplay({ entry, noteText }: MaActivityLogNoteDisplayProps) {
  const { lateEntryHeader, body } = splitMaActivityLogNote(noteText);
  const serviceLabel = entry.isGroup
    ? `Group${entry.groupSize ? ` (${entry.groupSize})` : ''}`
    : 'Individual';
  const metadataLine = [
    formatSessionDateOnly(entry.startTime || entry.date),
    formatSessionClock(entry.startTime || entry.date),
    formatSessionEnd(entry.endTime),
    serviceLabel,
    entry.resolvedCptCode || '—',
    entry.icd10Codes.length ? entry.icd10Codes.join(', ') : '—',
  ].join(' | ');

  return (
    <Stack spacing={1.25}>
      <Box
        sx={{
          border: 2,
          borderColor: 'error.main',
          borderRadius: 1,
          px: 1.25,
          py: 1,
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.45 }}>
          {metadataLine}
        </Typography>
      </Box>
      {lateEntryHeader ? (
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {lateEntryHeader}
        </Typography>
      ) : null}
      <Typography
        variant="body2"
        component="p"
        sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', m: 0, lineHeight: 1.55 }}
      >
        {body || '—'}
      </Typography>
    </Stack>
  );
}
