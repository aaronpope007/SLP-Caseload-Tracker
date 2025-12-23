import React, { useState } from 'react';
import {
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import type { CaseManager } from '../types';

interface CaseManagerAccordionCardProps {
  caseManager: CaseManager;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: (caseManager: CaseManager) => void;
  onDelete: (id: string) => void;
  formatPhoneForDisplay: (phoneNumber: string | undefined) => string;
}

export const CaseManagerAccordionCard = ({
  caseManager,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  formatPhoneForDisplay,
}: CaseManagerAccordionCardProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    handleMenuClose();
    onEdit(caseManager);
  };

  const handleDelete = () => {
    handleMenuClose();
    onDelete(caseManager.id);
  };

  return (
    <>
      <Accordion expanded={expanded} onChange={onToggleExpand}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{
            '& .MuiAccordionSummary-content': {
              alignItems: 'center',
            },
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', pr: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon color="primary" />
              <Typography variant="h6">{caseManager.name}</Typography>
            </Box>
            <IconButton
              size="small"
              onClick={handleMenuOpen}
            >
              <MoreVertIcon />
            </IconButton>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box>
            <Typography color="text.secondary" gutterBottom>
              Role: {caseManager.role}
            </Typography>
            {caseManager.phoneNumber && (
              <Typography color="text.secondary" gutterBottom>
                Phone: {formatPhoneForDisplay(caseManager.phoneNumber)}
              </Typography>
            )}
            {caseManager.emailAddress && (
              <Typography color="text.secondary">
                Email: {caseManager.emailAddress}
              </Typography>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <EditIcon sx={{ mr: 1 }} /> Edit
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>
    </>
  );
};

