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
  Alert,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  School as SchoolIcon,
} from '@mui/icons-material';
import type { CaseManager, Student } from '../types';
import { getStudentsByCaseManager } from '../utils/storage-api';

interface CaseManagerAccordionCardProps {
  caseManager: CaseManager;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: (caseManager: CaseManager) => void;
  onDelete: (id: string, relatedStudents: Student[]) => void;
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
  const [relatedStudents, setRelatedStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    if (expanded) {
      loadRelatedStudents();
    }
  }, [expanded, caseManager.id]);

  const loadRelatedStudents = async () => {
    setLoadingStudents(true);
    try {
      const students = await getStudentsByCaseManager(caseManager.id);
      setRelatedStudents(students);
    } catch (error) {
      console.error('Failed to load related students', error);
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
    onEdit(caseManager);
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
        students = await getStudentsByCaseManager(caseManager.id);
      } catch (error) {
        console.error('Failed to load related students', error);
      } finally {
        setLoadingStudents(false);
      }
    }
    onDelete(caseManager.id, students);
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
              <Typography variant="h6" component="div">{caseManager.name}</Typography>
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
              <Typography color="text.secondary" gutterBottom>
                Email: {caseManager.emailAddress}
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
                  No students assigned to this case manager
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

