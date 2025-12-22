import {
  Box,
  IconButton,
  InputAdornment,
  TextField,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';

interface SchoolSearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export const SchoolSearchBar = ({
  searchTerm,
  onSearchChange,
}: SchoolSearchBarProps) => {
  return (
    <Box sx={{ mb: 3 }}>
      <TextField
        fullWidth
        placeholder="Search schools by name or state..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: 'text.secondary' }} />
            </InputAdornment>
          ),
          endAdornment: searchTerm && (
            <InputAdornment position="end">
              <IconButton
                edge="end"
                onClick={() => onSearchChange('')}
                size="small"
                aria-label="clear search"
              >
                <ClearIcon />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
    </Box>
  );
};

