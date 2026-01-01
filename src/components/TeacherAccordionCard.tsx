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
import type { Teacher } from '../types';

interface TeacherAccordionCardProps {
  teacher: Teacher;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: (teacher: Teacher) => void;
  onDelete: (id: string) => void;
  formatPhoneForDisplay: (phoneNumber: string | undefined) => string;
}

export const TeacherAccordionCard = ({
  teacher,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  formatPhoneForDisplay,
}: TeacherAccordionCardProps) => {
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
    onEdit(teacher);
  };

  const handleDelete = () => {
    handleMenuClose();
    onDelete(teacher.id);
  };

  return (
    <>
      <Accordion expanded={expanded} onChange={onToggleExpand}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          slotProps={{
            content: {
              component: 'div',
            },
          }}
          sx={{
            '& .MuiAccordionSummary-content': {
              alignItems: 'center',
            },
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', pr: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon color="primary" />
              <Typography variant="h6">{teacher.name}</Typography>
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
              Grade: {teacher.grade}
            </Typography>
            {teacher.phoneNumber && (
              <Typography color="text.secondary" gutterBottom>
                Phone: {formatPhoneForDisplay(teacher.phoneNumber)}
              </Typography>
            )}
            {teacher.emailAddress && (
              <Typography color="text.secondary">
                Email: {teacher.emailAddress}
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

