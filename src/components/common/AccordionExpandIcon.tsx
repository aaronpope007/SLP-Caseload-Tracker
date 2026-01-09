import React from 'react';
import { Box } from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';

export const AccordionExpandIcon: React.FC = () => {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '50%',
        p: 0.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'action.hover',
      }}
    >
      <ExpandMoreIcon sx={{ fontSize: '1.2rem' }} />
    </Box>
  );
};

