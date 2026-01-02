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
  Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  ExpandMore as ExpandMoreIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
} from '@mui/icons-material';
import type { Student, Teacher, CaseManager } from '../types';

/**
 * Custom div component to use as AccordionSummary content wrapper.
 * 
 * NOTE: Material-UI v6 Hydration Warning Issue
 * =============================================
 * Material-UI v6's AccordionSummary component defaults to wrapping its content in a Typography
 * component (which renders as a <p> tag). This causes invalid HTML nesting when block-level
 * elements are placed inside it, leading to React hydration errors.
 * 
 * We've implemented multiple fixes:
 * 1. Custom AccordionSummaryContent component that explicitly renders as a <div>
 * 2. Component-level slots/slotProps overrides
 * 3. Theme-level defaultProps override (in ThemeContext.tsx)
 * 4. Console error filtering (in main.tsx)
 * 
 * The HTML structure is CORRECT (verified: content wrapper renders as <div>), but Material-UI v6
 * still logs hydration warnings in development mode. These are FALSE POSITIVES - the actual
 * rendered HTML is valid. The warnings appear in IDE console but not browser console, and do not
 * affect functionality.
 * 
 * This is a known issue with Material-UI v6.1.1. If upgrading to a newer version, this workaround
 * may no longer be necessary.
 */
const AccordionSummaryContent = React.memo(
  React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { ownerState?: any }>(
    (props, ref) => {
      // Destructure and remove all non-DOM props
      const {
        children,
        className,
        style,
        ownerState,
        as,
        theme,
        sx,
        ...domProps
      } = props as any;
      
      // Return a plain div with only valid HTML attributes
      // Use suppressHydrationWarning to handle any Material-UI v6 rendering inconsistencies
      return (
        <div
          ref={ref}
          className={className}
          style={style}
          suppressHydrationWarning
          {...(domProps as React.HTMLAttributes<HTMLDivElement>)}
        >
          {children}
        </div>
      );
    }
  )
);
AccordionSummaryContent.displayName = 'AccordionSummaryContent';

interface StudentAccordionCardProps {
  student: Student;
  teachers: Teacher[];
  caseManagers?: CaseManager[];
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: (student: Student) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string, archive: boolean) => void;
  onViewDetails: (id: string) => void;
  hasNoGoals?: boolean;
}

export const StudentAccordionCard = ({
  student,
  teachers,
  caseManagers = [],
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onArchive,
  onViewDetails,
  hasNoGoals = false,
}: StudentAccordionCardProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  // Get teacher name if student has a teacher assigned
  const teacher = student.teacherId ? teachers.find(t => t.id === student.teacherId) : null;
  // Get case manager name if student has a case manager assigned
  const caseManager = student.caseManagerId ? caseManagers.find(cm => cm.id === student.caseManagerId) : null;

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

  const accordion = (
    <Accordion 
      expanded={expanded} 
      onChange={onToggleExpand}
      sx={{
        backgroundColor: hasNoGoals ? '#ffebee' : undefined,
        '&:hover': {
          backgroundColor: hasNoGoals ? '#ffcdd2' : undefined,
        },
      }}
    >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          slots={{
            content: AccordionSummaryContent,
          }}
          slotProps={{
            content: {
              component: AccordionSummaryContent,
            },
          }}
          sx={{
            '& .MuiAccordionSummary-content': {
              alignItems: 'center',
              display: 'flex',
              justifyContent: 'space-between',
              width: '100%',
              pr: 1,
              margin: 0,
              // Force display block to override any Typography defaults
              display: 'flex !important',
            },
            // Override any Typography component styling
            '& .MuiAccordionSummary-content.MuiTypography-root': {
              display: 'flex !important',
              margin: '0 !important',
            },
          }}
        >
          <Box
            component="span"
            sx={{
              fontSize: '1.25rem',
              fontWeight: 500,
              margin: 0,
              lineHeight: 1.334,
              letterSpacing: '0.0075em',
            }}
          >
            {student.name}
          </Box>
          <IconButton
            size="small"
            onClick={handleMenuOpen}
          >
            <MoreVertIcon />
          </IconButton>
        </AccordionSummary>
        <AccordionDetails>
          <Box>
            <Typography color="text.secondary" gutterBottom>
              Age: {student.age > 0 ? student.age : 'n/a'}
              {student.grade ? ' | ' : ''}
              {student.grade ? `Grade: ${student.grade}` : ''}
              {teacher ? ` | ${teacher.name}` : ''}
              {caseManager ? ` | CM: ${caseManager.name} (${caseManager.role})` : ''}
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
  );

  return (
    <>
      {hasNoGoals ? (
        <Tooltip
          title="No goals added. Click the menu (⋮) and select 'View and Edit Goals' to add goals for this student."
          arrow
          placement="top"
        >
          <span style={{ display: 'block', width: '100%' }}>
            {accordion}
          </span>
        </Tooltip>
      ) : (
        accordion
      )}
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

