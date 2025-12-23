import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  IconButton,
  Typography,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import type { Teacher } from '../types';

interface TeacherCardProps {
  teacher: Teacher;
  onEdit: (teacher: Teacher) => void;
  onDelete: (id: string) => void;
  formatPhoneForDisplay: (phoneNumber: string | undefined) => string;
}

export const TeacherCard = ({
  teacher,
  onEdit,
  onDelete,
  formatPhoneForDisplay,
}: TeacherCardProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
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
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flex: 1 }}>
              <PersonIcon color="primary" sx={{ mt: 0.5 }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" gutterBottom>
                  {teacher.name}
                </Typography>
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
            </Box>
            <IconButton
              size="small"
              onClick={handleMenuOpen}
              aria-label="more options"
            >
              <MoreVertIcon />
            </IconButton>
          </Box>
        </CardContent>
      </Card>
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

