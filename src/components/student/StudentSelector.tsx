import { useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  Typography,
  FormControlLabel,
  Checkbox,
  IconButton,
  InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import type { Student } from '../../types';

interface StudentSelectorProps {
  students: Student[];
  selectedStudentIds: string[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onStudentToggle: (studentId: string) => void;
  autoFocus?: boolean;
}

export const StudentSelector = ({
  students,
  selectedStudentIds,
  searchTerm,
  onSearchChange,
  onStudentToggle,
  autoFocus = false,
}: StudentSelectorProps) => {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => {
        searchRef.current?.focus();
      }, 100);
    }
  }, [autoFocus]);

  const filteredStudents = students.filter((student) =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredStudents.length === 1 && !selectedStudentIds.includes(filteredStudents[0].id)) {
        onStudentToggle(filteredStudents[0].id);
        onSearchChange('');
      }
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Students (select one or more):
      </Typography>
      <TextField
        inputRef={searchRef}
        fullWidth
        size="small"
        placeholder="Search students..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        onKeyDown={handleKeyDown}
        sx={{ mt: 1, mb: 1 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
          endAdornment: searchTerm && (
            <InputAdornment position="end">
              <IconButton
                size="small"
                onClick={() => onSearchChange('')}
                edge="end"
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
          gap: 0.5,
          maxHeight: '200px',
          overflow: 'auto',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          p: 1,
        }}
      >
        {filteredStudents.length === 0 ? (
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              p: 1, 
              textAlign: 'center',
              gridColumn: '1 / -1',
            }}
          >
            No students found
          </Typography>
        ) : (
          filteredStudents.map((student) => {
            const grade = student.grade != null && student.grade !== undefined ? ` (${student.grade})` : '';
            return (
              <FormControlLabel
                key={student.id}
                control={
                  <Checkbox
                    checked={selectedStudentIds.includes(student.id)}
                    onChange={() => onStudentToggle(student.id)}
                  />
                }
                label={`${student.name}${grade}`}
                sx={{
                  margin: 0,
                  '& .MuiFormControlLabel-label': {
                    fontSize: '0.875rem',
                  },
                }}
              />
            );
          })
        )}
      </Box>
    </Box>
  );
};

