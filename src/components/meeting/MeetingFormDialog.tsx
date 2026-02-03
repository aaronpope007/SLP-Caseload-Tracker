import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
} from '@mui/material';
import type { Meeting, Student } from '../../types';
import { toLocalDateTimeString } from '../../utils/helpers';
import { useSchool } from '../../context/SchoolContext';

interface MeetingFormDialogProps {
  open: boolean;
  editingMeeting: Meeting | null;
  onClose: () => void;
  onSave: (meeting: Omit<Meeting, 'id' | 'dateCreated' | 'dateUpdated'>) => Promise<void>;
  students?: Student[];
}

export const MeetingFormDialog = ({
  open,
  editingMeeting,
  onClose,
  onSave,
  students = [],
}: MeetingFormDialogProps) => {
  const { selectedSchool } = useSchool();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: toLocalDateTimeString(new Date()),
    endTime: '',
    studentId: '',
    category: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingMeeting) {
      // Convert ISO strings back to local datetime format for datetime-local inputs
      const dateForInput = editingMeeting.date ? toLocalDateTimeString(new Date(editingMeeting.date)) : '';
      const endTimeForInput = editingMeeting.endTime ? toLocalDateTimeString(new Date(editingMeeting.endTime)) : '';
      
      setFormData({
        title: editingMeeting.title,
        description: editingMeeting.description || '',
        date: dateForInput,
        endTime: endTimeForInput,
        studentId: editingMeeting.studentId || '',
        category: editingMeeting.category || '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        date: toLocalDateTimeString(new Date()),
        endTime: '',
        studentId: '',
        category: '',
      });
    }
  }, [editingMeeting, open]);

  const handleSave = async () => {
    if (!formData.title || !formData.date) {
      alert('Please fill in Title and Date');
      return;
    }

    setSaving(true);
    try {
      // Convert datetime-local format to ISO string
      // datetime-local returns format: "2026-01-16T14:15"
      // We need to convert to ISO string
      const dateISO = new Date(formData.date).toISOString();
      const endTimeISO = formData.endTime ? new Date(formData.endTime).toISOString() : undefined;

      await onSave({
        title: formData.title,
        description: formData.description || undefined,
        date: dateISO,
        endTime: endTimeISO,
        school: selectedSchool,
        studentId: formData.studentId || undefined,
        category: formData.category || undefined,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save meeting', error);
      alert('Failed to save meeting. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const categories = [
    'IEP',
    'Staff Meeting',
    'Team Meeting',
    'Parent Meeting',
    'Professional Development',
    'Speech screening',
    '3 year assessment',
    'Other',
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box component="div">
          <Box component="span">{editingMeeting ? 'Edit Meeting' : 'Add Meeting'}</Box>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Title"
            fullWidth
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            autoFocus
            margin="normal"
          />
          <TextField
            label="Date & Time"
            type="datetime-local"
            fullWidth
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
            margin="normal"
            InputLabelProps={{
              shrink: true,
            }}
          />
          <TextField
            label="End Time"
            type="datetime-local"
            fullWidth
            value={formData.endTime}
            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
            margin="normal"
            InputLabelProps={{
              shrink: true,
            }}
          />
          <TextField
            label="Category"
            select
            fullWidth
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            margin="normal"
          >
            <MenuItem value="">None</MenuItem>
            {categories.map((cat) => (
              <MenuItem key={cat} value={cat}>
                {cat}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Student (Optional)"
            select
            fullWidth
            value={formData.studentId}
            onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
            margin="normal"
          >
            <MenuItem value="">None</MenuItem>
            {students.map((student) => (
              <MenuItem key={student.id} value={student.id}>
                {student.name} {student.grade ? `(${student.grade})` : ''}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            margin="normal"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving || !formData.title || !formData.date}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

