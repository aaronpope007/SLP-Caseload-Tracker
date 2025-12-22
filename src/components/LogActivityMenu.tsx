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
  Restaurant as RestaurantIcon,
} from '@mui/icons-material';
import { toLocalDateTimeString } from '../utils/helpers';

interface LogActivityMenuProps {
  onAddSession: () => void;
  onAddLunch: (startTime: string, endTime: string) => void;
}

export const LogActivityMenu = ({
  onAddSession,
  onAddLunch,
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
        case 'l': {
          event.preventDefault();
          setMenuAnchorEl(null);
          const now = new Date();
          const defaultEndTime = new Date(now.getTime() + 30 * 60000);
          onAddLunch(
            toLocalDateTimeString(now),
            toLocalDateTimeString(defaultEndTime)
          );
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen, onAddSession, onAddLunch, navigate]);

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
        <MenuItem
          onClick={() => {
            setMenuAnchorEl(null);
            const now = new Date();
            const defaultEndTime = new Date(now.getTime() + 30 * 60000);
            onAddLunch(
              toLocalDateTimeString(now),
              toLocalDateTimeString(defaultEndTime)
            );
          }}
        >
          <RestaurantIcon sx={{ mr: 1 }} /> Add <span style={{ textDecoration: 'underline' }}>L</span>unch
        </MenuItem>
      </Menu>
    </Box>
  );
};

