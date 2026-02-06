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
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import type { Meeting, Student, MeetingActivitySubtype } from '../../types';
import { toLocalDateTimeString } from '../../utils/helpers';
import { useSchool } from '../../context/SchoolContext';

interface MeetingFormDialogProps {
  open: boolean;
  editingMeeting: Meeting | null;
  onClose: () => void;
  onSave: (meeting: Omit<Meeting, 'id' | 'dateCreated' | 'dateUpdated'>) => Promise<void>;
  students?: Student[];
  /** When adding a new meeting, pre-fill category (e.g. "IEP") */
  defaultCategory?: string;
  /** When adding a new meeting, pre-fill date as YYYY-MM-DD (time will be 8:00 AM local) */
  defaultDate?: string;
}

export const MeetingFormDialog = ({
  open,
  editingMeeting,
  onClose,
  onSave,
  students = [],
  defaultCategory,
  defaultDate,
}: MeetingFormDialogProps) => {
  const { selectedSchool, availableSchools } = useSchool();
  const [formData, setFormData] = useState({
    school: '',
    title: '',
    description: '',
    date: toLocalDateTimeString(new Date()),
    endTime: '',
    studentId: '',
    category: '',
    activitySubtype: '' as '' | MeetingActivitySubtype,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingMeeting) {
      // Convert ISO strings back to local datetime format for datetime-local inputs
      const dateForInput = editingMeeting.date ? toLocalDateTimeString(new Date(editingMeeting.date)) : '';
      const endTimeForInput = editingMeeting.endTime ? toLocalDateTimeString(new Date(editingMeeting.endTime)) : '';
      
      setFormData({
        school: editingMeeting.school || '',
        title: editingMeeting.title,
        description: editingMeeting.description || '',
        date: dateForInput,
        endTime: endTimeForInput,
        studentId: editingMeeting.studentId || '',
        category: editingMeeting.category || '',
        activitySubtype: (editingMeeting.activitySubtype || '') as '' | MeetingActivitySubtype,
      });
    } else {
      // New meeting: use default date (e.g. selected date on Time Tracking) at 8:00 AM local, or now
      const dateForNew = defaultDate
        ? `${defaultDate}T08:00`
        : toLocalDateTimeString(new Date()).slice(0, 16);
      setFormData({
        school: selectedSchool || (availableSchools[0] ?? ''),
        title: '',
        description: '',
        date: dateForNew,
        endTime: '',
        studentId: '',
        category: defaultCategory || '',
        activitySubtype: (defaultCategory === 'IEP' || defaultCategory === '3 year assessment' ? 'meeting' : '') as '' | MeetingActivitySubtype,
      });
    }
  }, [editingMeeting, open, selectedSchool, availableSchools, defaultCategory, defaultDate]);

  const handleSave = async () => {
    if (!formData.title || !formData.date) {
      alert('Please fill in Title and Date');
      return;
    }
    if (!formData.school) {
      alert('Please select a school');
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
        school: formData.school,
        studentId: formData.studentId || undefined,
        category: formData.category || undefined,
        activitySubtype: (formData.category === 'IEP' || formData.category === '3 year assessment')
          ? (formData.activitySubtype || undefined) as MeetingActivitySubtype | undefined
          : undefined,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save meeting', error);
      alert('Failed to save meeting. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const studentsInSchool = formData.school
    ? students.filter(s => s.school === formData.school)
    : [];

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
          <FormControl fullWidth required margin="normal">
            <InputLabel>School</InputLabel>
            <Select
              value={formData.school}
              onChange={(e) => setFormData({ ...formData, school: e.target.value, studentId: '' })}
              label="School"
            >
              {availableSchools.map((schoolName) => (
                <MenuItem key={schoolName} value={schoolName}>
                  {schoolName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
            onChange={(e) => setFormData({
              ...formData,
              category: e.target.value,
              activitySubtype: (e.target.value === 'IEP' || e.target.value === '3 year assessment') ? formData.activitySubtype || 'meeting' : '',
            })}
            margin="normal"
          >
            <MenuItem value="">None</MenuItem>
            {categories.map((cat) => (
              <MenuItem key={cat} value={cat}>
                {cat}
              </MenuItem>
            ))}
          </TextField>
          {(formData.category === 'IEP' || formData.category === '3 year assessment') && (
            <TextField
              label="Activity type"
              select
              fullWidth
              value={formData.activitySubtype || 'meeting'}
              onChange={(e) => setFormData({ ...formData, activitySubtype: e.target.value as MeetingActivitySubtype })}
              margin="normal"
              helperText={formData.category === 'IEP' ? 'Shows on timesheet as "IEP activity, meeting:" or "IEP activity, updates:"' : 'Shows on timesheet as "3 Year Reassessment Planning, meeting:" or "updates:"'}
            >
              <MenuItem value="meeting">Meeting</MenuItem>
              <MenuItem value="updates">Updates</MenuItem>
            </TextField>
          )}
          <TextField
            label="Student (Optional)"
            select
            fullWidth
            value={formData.studentId}
            onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
            margin="normal"
            disabled={!formData.school}
            helperText={formData.school ? '' : 'Select a school first to choose a student'}
          >
            <MenuItem value="">None</MenuItem>
            {studentsInSchool.map((student) => (
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
          disabled={saving || !formData.school || !formData.title || !formData.date}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

