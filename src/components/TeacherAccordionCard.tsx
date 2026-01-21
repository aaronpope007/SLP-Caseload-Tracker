import React, { useState, useEffect } from 'react';
import {
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  School as SchoolIcon,
  Male as MaleIcon,
  Female as FemaleIcon,
} from '@mui/icons-material';
import type { Teacher, Student } from '../types';
import { getStudentsByTeacher } from '../utils/storage-api';
import { logError } from '../utils/logger';

interface TeacherAccordionCardProps {
  teacher: Teacher;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: (teacher: Teacher) => void;
  onDelete: (id: string, relatedStudents: Student[]) => void;
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
  const [relatedStudents, setRelatedStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    if (expanded) {
      loadRelatedStudents();
    }
  }, [expanded, teacher.id]);

  const loadRelatedStudents = async () => {
    setLoadingStudents(true);
    try {
      const students = await getStudentsByTeacher(teacher.id);
      setRelatedStudents(students);
    } catch (error) {
      logError('Failed to load related students', error);
    } finally {
      setLoadingStudents(false);
    }
  };

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

  const handleDelete = async () => {
    handleMenuClose();
    // Load students if not already loaded
    let students = relatedStudents;
    if (students.length === 0 && !loadingStudents && expanded) {
      await loadRelatedStudents();
      students = relatedStudents;
    } else if (students.length === 0 && !loadingStudents) {
      // If not expanded, load students now
      setLoadingStudents(true);
      try {
        students = await getStudentsByTeacher(teacher.id);
      } catch (error) {
        logError('Failed to load related students', error);
      } finally {
        setLoadingStudents(false);
      }
    }
    onDelete(teacher.id, students);
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
              <Box
                component="span"
                sx={{
                  fontSize: '1.25rem',
                  fontWeight: 500,
                  margin: 0,
                  lineHeight: 1.334,
                  letterSpacing: '0.0075em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                {teacher.name}
                {teacher.gender === 'male' && (
                  <MaleIcon sx={{ fontSize: '1.25rem', color: 'text.secondary' }} />
                )}
                {teacher.gender === 'female' && (
                  <FemaleIcon sx={{ fontSize: '1.25rem', color: 'text.secondary' }} />
                )}
              </Box>
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
              <Typography color="text.secondary" gutterBottom>
                Email: {teacher.emailAddress}
              </Typography>
            )}
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <SchoolIcon fontSize="small" /> Related Students
              </Typography>
              {loadingStudents ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : relatedStudents.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No students assigned to this teacher
                </Typography>
              ) : (
                <List dense sx={{ pt: 0 }}>
                  {relatedStudents.map((student) => (
                    <ListItem key={student.id} sx={{ px: 0, py: 0.5 }}>
                      <ListItemText
                        primary={student.name}
                        secondary={`${student.grade} • ${student.school}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
              {relatedStudents.length > 0 && (
                <Chip
                  label={`${relatedStudents.length} ${relatedStudents.length === 1 ? 'student' : 'students'}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ mt: 1 }}
                />
              )}
            </Box>
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

