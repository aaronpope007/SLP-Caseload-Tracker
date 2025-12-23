import React from 'react';
import { IconButton, Box } from '@mui/material';
import { Edit as EditIcon, ContentCopy as ContentCopyIcon } from '@mui/icons-material';

interface GoalActionButtonsProps {
  onEdit: () => void;
  onDuplicate: () => void;
  editTitle?: string;
  duplicateTitle?: string;
}

export const GoalActionButtons: React.FC<GoalActionButtonsProps> = ({
  onEdit,
  onDuplicate,
  editTitle = 'Edit goal',
  duplicateTitle = 'Duplicate goal',
}) => {
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      <IconButton
        size="small"
        onClick={onEdit}
        title={editTitle}
      >
        <EditIcon fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={onDuplicate}
        title={duplicateTitle}
      >
        <ContentCopyIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};

