import { useState } from 'react';
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
          <AddIcon sx={{ mr: 1 }} /> Add Session
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchorEl(null);
            navigate('/evaluations');
          }}
        >
          <AddIcon sx={{ mr: 1 }} /> Add Evaluation
        </MenuItem>
        {onAddMeeting && (
          <MenuItem
            onClick={() => {
              setMenuAnchorEl(null);
              onAddMeeting();
            }}
          >
            <AddIcon sx={{ mr: 1 }} /> Add Meeting
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};

