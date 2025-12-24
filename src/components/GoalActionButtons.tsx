import React from 'react';
import { IconButton, Box } from '@mui/material';
import { Edit as EditIcon, ContentCopy as ContentCopyIcon, Delete as DeleteIcon, AccountTree as AccountTreeIcon } from '@mui/icons-material';

interface GoalActionButtonsProps {
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
  onCopySubtree?: () => void;
  editTitle?: string;
  duplicateTitle?: string;
  deleteTitle?: string;
  copySubtreeTitle?: string;
}

export const GoalActionButtons: React.FC<GoalActionButtonsProps> = ({
  onEdit,
  onDuplicate,
  onDelete,
  onCopySubtree,
  editTitle = 'Edit goal',
  duplicateTitle = 'Duplicate goal',
  deleteTitle = 'Delete goal',
  copySubtreeTitle = 'Copy subtree',
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
      {onCopySubtree && (
        <IconButton
          size="small"
          onClick={onCopySubtree}
          title={copySubtreeTitle}
          color="primary"
        >
          <AccountTreeIcon fontSize="small" />
        </IconButton>
      )}
      {onDelete && (
        <IconButton
          size="small"
          onClick={onDelete}
          title={deleteTitle}
          color="error"
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
};

