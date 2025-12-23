import React, { useState } from 'react';
import {
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  ExpandMore as ExpandMoreIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
} from '@mui/icons-material';
import type { Student, Teacher } from '../types';

interface StudentAccordionCardProps {
  student: Student;
  teachers: Teacher[];
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: (student: Student) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string, archive: boolean) => void;
  onViewDetails: (id: string) => void;
}

export const StudentAccordionCard = ({
  student,
  teachers,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onArchive,
  onViewDetails,
}: StudentAccordionCardProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  // Get teacher name if student has a teacher assigned
  const teacher = student.teacherId ? teachers.find(t => t.id === student.teacherId) : null;

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    handleMenuClose();
    onEdit(student);
  };

  const handleDelete = () => {
    handleMenuClose();
    onDelete(student.id);
  };

  const handleArchive = () => {
    handleMenuClose();
    onArchive(student.id, !student.archived);
  };

  const handleViewDetails = () => {
    handleMenuClose();
    onViewDetails(student.id);
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
            <Typography variant="h6">{student.name}</Typography>
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
              {student.age > 0 ? `Age: ${student.age}` : ''}
              {student.age > 0 && student.grade ? ' | ' : ''}
              {student.grade ? `Grade: ${student.grade}` : ''}
              {teacher ? ` | ${teacher.name}` : ''}
            </Typography>
            <Box sx={{ mt: 1, mb: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              <Chip
                label={student.status}
                size="small"
                color={student.status === 'active' ? 'primary' : 'default'}
              />
              {student.archived && (
                <Chip
                  label="Archived"
                  size="small"
                  color="default"
                  variant="outlined"
                />
              )}
            </Box>
            {student.concerns.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Concerns:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                  {student.concerns.map((concern, idx) => (
                    <Chip
                      key={idx}
                      label={concern}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Box>
            )}
            {student.exceptionality && student.exceptionality.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Exceptionality:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                  {student.exceptionality.map((except, idx) => (
                    <Chip
                      key={idx}
                      label={except}
                      size="small"
                      variant="outlined"
                      color="primary"
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleViewDetails}>
          <EditIcon sx={{ mr: 1 }} /> View and Edit Goals
        </MenuItem>
        <MenuItem onClick={handleEdit}>
          <EditIcon sx={{ mr: 1 }} /> Edit
        </MenuItem>
        {student.archived ? (
          <MenuItem onClick={handleArchive}>
            <UnarchiveIcon sx={{ mr: 1 }} /> Unarchive
          </MenuItem>
        ) : (
          <MenuItem onClick={handleArchive}>
            <ArchiveIcon sx={{ mr: 1 }} /> Archive
          </MenuItem>
        )}
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>
    </>
  );
};

