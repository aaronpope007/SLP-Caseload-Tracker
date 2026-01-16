import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowDropDown as ArrowDropDownIcon,
} from '@mui/icons-material';

interface LogActivityMenuProps {
  onAddSession: () => void;
  onAddMeeting?: () => void;
}

export const LogActivityMenu = ({
  onAddSession,
  onAddMeeting,
}: LogActivityMenuProps) => {
  const navigate = useNavigate();
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(menuAnchorEl);

  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if no input/textarea is focused
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 's':
          event.preventDefault();
          setMenuAnchorEl(null);
          onAddSession();
          break;
        case 'e':
          event.preventDefault();
          setMenuAnchorEl(null);
          navigate('/evaluations');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen, onAddSession, navigate]);

  return (
    <Box>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        endIcon={<ArrowDropDownIcon />}
        onClick={(e) => setMenuAnchorEl(e.currentTarget)}
      >
        Log Activity
      </Button>
      <Menu
        anchorEl={menuAnchorEl}
        open={menuOpen}
        onClose={() => setMenuAnchorEl(null)}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchorEl(null);
            onAddSession();
          }}
        >
          <AddIcon sx={{ mr: 1 }} /> Add <span style={{ textDecoration: 'underline' }}>S</span>ession
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchorEl(null);
            navigate('/evaluations');
          }}
        >
          <AddIcon sx={{ mr: 1 }} /> Add <span style={{ textDecoration: 'underline' }}>E</span>valuation
        </MenuItem>
        {onAddMeeting && (
          <MenuItem
            onClick={() => {
              setMenuAnchorEl(null);
              onAddMeeting();
            }}
          >
            <AddIcon sx={{ mr: 1 }} /> Add <span style={{ textDecoration: 'underline' }}>M</span>eeting
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};

