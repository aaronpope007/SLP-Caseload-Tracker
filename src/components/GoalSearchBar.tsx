import { useState, useMemo, useRef } from 'react';
import {
  TextField,
  Box,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Chip,
  InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import type { Goal, Student } from '../types';
import { getGoalPath, flattenGoalHierarchy } from '../utils/goalPaths';

interface GoalSearchBarProps {
  goals: Goal[];
  students: Student[];
  selectedStudentIds: string[];
  goalsTargeted: string[];
  onGoalSelect: (goalId: string, studentId: string) => void;
  onClose?: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
}

export const GoalSearchBar = ({
  goals,
  students,
  selectedStudentIds,
  goalsTargeted,
  onGoalSelect,
  onClose,
  inputRef,
}: GoalSearchBarProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const internalRef = useRef<HTMLInputElement>(null);
  const searchInputRef = inputRef || internalRef;

  // Flatten all goals from selected students into a searchable list
  const searchableGoals = useMemo(() => {
    const selectedStudents = students.filter(s => selectedStudentIds.includes(s.id));
    const allFlattened: Array<{ goal: Goal; path: string; studentId: string; studentName: string }> = [];
    
    selectedStudents.forEach(student => {
      const studentGoals = goals.filter(g => g.studentId === student.id);
      const flattened = flattenGoalHierarchy(studentGoals, goals, student.id, student.name);
      allFlattened.push(...flattened);
    });
    
    return allFlattened;
  }, [goals, students, selectedStudentIds]);

  // Filter goals based on search term
  const filteredGoals = useMemo(() => {
    if (!searchTerm.trim()) {
      return [];
    }
    
    const term = searchTerm.toLowerCase();
    return searchableGoals.filter(({ goal, path, studentName }) => {
      return (
        goal.description.toLowerCase().includes(term) ||
        path.toLowerCase().includes(term) ||
        studentName.toLowerCase().includes(term) ||
        goal.domain?.toLowerCase().includes(term)
      );
    }).slice(0, 20); // Limit to 20 results for performance
  }, [searchTerm, searchableGoals]);

  const handleGoalSelect = (goalId: string, studentId: string) => {
    onGoalSelect(goalId, studentId);
    setSearchTerm('');
    setIsFocused(false);
    onClose?.();
  };

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      <TextField
        inputRef={searchInputRef}
        fullWidth
        placeholder="Search goals by name, path, or student... (Press / to focus)"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={(e) => {
          // Delay to allow click events on results
          setTimeout(() => setIsFocused(false), 200);
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
          endAdornment: searchTerm ? (
            <InputAdornment position="end">
              <ClearIcon
                sx={{ cursor: 'pointer' }}
                onClick={() => {
                  setSearchTerm('');
                  setIsFocused(false);
                }}
              />
            </InputAdornment>
          ) : null,
        }}
        size="small"
      />
      {isFocused && filteredGoals.length > 0 && (
        <Paper
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            mt: 0.5,
            maxHeight: '400px',
            overflow: 'auto',
            boxShadow: 3,
          }}
          onMouseDown={(e) => e.preventDefault()} // Prevent blur
        >
          <List dense>
            {filteredGoals.map(({ goal, path, studentId, studentName }) => {
              const isSelected = goalsTargeted.includes(goal.id);
              return (
                <ListItem key={`${studentId}-${goal.id}`} disablePadding>
                  <ListItemButton
                    onClick={() => handleGoalSelect(goal.id, studentId)}
                    selected={isSelected}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body2" component="span">
                            {goal.description}
                          </Typography>
                          {isSelected && (
                            <Chip label="Selected" size="small" color="primary" />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Chip
                            label={studentName}
                            size="small"
                            variant="outlined"
                            sx={{ height: '20px', fontSize: '0.7rem' }}
                          />
                          {path !== goal.description && (
                            <Typography variant="caption" color="text.secondary">
                              {path}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Paper>
      )}
    </Box>
  );
};

