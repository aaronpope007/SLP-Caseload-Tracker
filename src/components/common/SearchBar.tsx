import { TextField, InputAdornment, IconButton } from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const SearchBar = ({ value, onChange, placeholder = 'Search...', onKeyDown }: SearchBarProps) => {
  return (
    <TextField
      fullWidth
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon sx={{ color: 'text.secondary' }} />
          </InputAdornment>
        ),
        endAdornment: value && (
          <InputAdornment position="end">
            <IconButton
              edge="end"
              onClick={() => onChange('')}
              size="small"
              aria-label="clear search"
            >
              <ClearIcon />
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );
};

