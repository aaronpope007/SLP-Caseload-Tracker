import { Box, Typography } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

export function GroupSessionDataWarning() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 0.75,
        color: 'error.main',
      }}
    >
      <ErrorOutlineIcon fontSize="small" sx={{ mt: '2px', flexShrink: 0 }} />
      <Typography variant="caption" color="error">
        * <strong>Warning:</strong> This student has no goals addressed or performance data recorded for this
        session. They may have been accidentally left selected when the group session was saved. Do not copy or bill
        this note for this student without verifying their participation.
      </Typography>
    </Box>
  );
}
