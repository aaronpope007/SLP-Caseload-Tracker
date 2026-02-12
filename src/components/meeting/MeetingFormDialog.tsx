import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Autocomplete,
  IconButton,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import type { Meeting, Student, MeetingActivitySubtype } from '../../types';
import { toLocalDateTimeString, extractTimeFromISO, combineDateWithTime } from '../../utils/helpers';
import { useSchool } from '../../context/SchoolContext';
import { useConfirm } from '../../hooks';
import {
  MEETING_CATEGORY_GROUPS,
  getCategoryGroup,
  isCategoryWithActivitySubtype,
  type MeetingCategoryGroup,
} from '../../utils/meetingCategories';

interface MeetingFormDialogProps {
  open: boolean;
  editingMeeting: Meeting | null;
  onClose: () => void;
  onSave: (meeting: Omit<Meeting, 'id' | 'dateCreated' | 'dateUpdated'>) => Promise<void>;
  /** When editing, called when user clicks delete (after confirmation). Omit to hide delete. */
  onDelete?: (meetingId: string) => void | Promise<void>;
  students?: Student[];
  /** When adding a new meeting, pre-fill subcategory (e.g. "IEP", "3 Year Reassessment") */
  defaultCategory?: string;
  /** When adding a new meeting, pre-fill date as YYYY-MM-DD (time will be 8:00 AM local) */
  defaultDate?: string;
}

export const MeetingFormDialog = ({
  open,
  editingMeeting,
  onClose,
  onSave,
  onDelete,
  students = [],
  defaultCategory,
  defaultDate,
}: MeetingFormDialogProps) => {
  const { selectedSchool, availableSchools } = useSchool();
  const { confirm, ConfirmDialog } = useConfirm();
  const [deleting, setDeleting] = useState(false);
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
  const [studentInputValue, setStudentInputValue] = useState('');
  const studentInputRef = useRef('');

  useEffect(() => {
    if (editingMeeting) {
      // Convert ISO strings back to local datetime format for datetime-local inputs
      const dateForInput = editingMeeting.date ? toLocalDateTimeString(new Date(editingMeeting.date)) : '';
      // Extract just the time portion (HH:mm) from the endTime ISO string
      const endTimeForInput = editingMeeting.endTime ? extractTimeFromISO(editingMeeting.endTime) : '';
      const studentId = editingMeeting.studentId || '';
      setFormData({
        school: editingMeeting.school || '',
        title: editingMeeting.title,
        description: editingMeeting.description || '',
        date: dateForInput,
        endTime: endTimeForInput,
        studentId,
        category: editingMeeting.category || '',
        activitySubtype: (editingMeeting.activitySubtype || '') as '' | MeetingActivitySubtype,
      });
      const student = students.find((s) => s.id === studentId);
      setStudentInputValue(student?.name ?? '');
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
        activitySubtype: (defaultCategory && isCategoryWithActivitySubtype(defaultCategory) ? 'meeting' : '') as '' | MeetingActivitySubtype,
      });
      setStudentInputValue('');
    }
  }, [editingMeeting, open, selectedSchool, availableSchools, defaultCategory, defaultDate, students]);

  const doSave = useCallback(async () => {
    if (!formData.title || !formData.date || !formData.school) return;

    setSaving(true);
    try {
      const dateISO = new Date(formData.date).toISOString();
      const endTimeISO = formData.endTime
        ? new Date(combineDateWithTime(formData.date, formData.endTime)).toISOString()
        : undefined;

      await onSave({
        title: formData.title,
        description: formData.description || undefined,
        date: dateISO,
        endTime: endTimeISO,
        school: formData.school,
        studentId: formData.studentId || undefined,
        category: formData.category || undefined,
        activitySubtype: isCategoryWithActivitySubtype(formData.category)
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
  }, [formData, onSave, onClose]);

  const handleSave = async () => {
    if (!formData.title || !formData.date) {
      alert('Please fill in Title and Date');
      return;
    }
    if (!formData.school) {
      alert('Please select a school');
      return;
    }

    // For new meetings only: warn if the selected date is in the past
    if (!editingMeeting) {
      const selectedDate = new Date(formData.date);
      const now = new Date();
      if (selectedDate.getTime() < now.getTime()) {
        confirm({
          title: 'Date in the past',
          message: 'You selected a date in the past. Do you want to save this meeting anyway?',
          confirmText: 'Yes, save anyway',
          cancelText: 'No, change date',
          onConfirm: doSave,
        });
        return;
      }
    }

    await doSave();
  };

  const studentsInSchool = formData.school
    ? students.filter((s) => s.school === formData.school)
    : [];

  const studentsInSchoolDeduped = useMemo(() => {
    const seen = new Set<string>();
    return studentsInSchool.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [studentsInSchool]);

  const filterStudentOptions = useCallback((options: Student[], inputValue: string) => {
    if (!inputValue) return options;
    const searchTerm = inputValue.toLowerCase().trim();
    const seen = new Set<string>();
    return options.filter((student) => {
      if (seen.has(student.id)) return false;
      const nameMatch = (student.name || '').toLowerCase().includes(searchTerm);
      const gradeMatch = (student.grade || '').toLowerCase().includes(searchTerm);
      const concernsMatch = student.concerns?.some((c) => c.toLowerCase().includes(searchTerm)) ?? false;
      const matches = nameMatch || gradeMatch || concernsMatch;
      if (matches) seen.add(student.id);
      return matches;
    });
  }, []);

  const handleDelete = () => {
    if (!editingMeeting?.id || !onDelete) return;
    confirm({
      title: 'Delete Meeting',
      message: 'Are you sure you want to delete this meeting?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmColor: 'error',
      onConfirm: async () => {
        setDeleting(true);
        try {
          await onDelete(editingMeeting.id);
          onClose();
        } catch (error) {
          console.error('Failed to delete meeting', error);
          alert('Failed to delete meeting. Please try again.');
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  const handleAutocompleteKeyDown = useCallback(
    (e: React.KeyboardEvent, filtered: Student[], onSelect: (option: Student) => void) => {
      if (e.key === 'Tab' || e.key === 'Enter') {
        if (filtered.length === 1 && !e.shiftKey) {
          e.preventDefault();
          onSelect(filtered[0]);
        }
      }
    },
    []
  );

  const categoryGroups = Object.keys(MEETING_CATEGORY_GROUPS) as MeetingCategoryGroup[];
  const currentGroup: MeetingCategoryGroup | '' = formData.category ? (getCategoryGroup(formData.category) ?? '') : '';
  const subcategoriesForGroup = currentGroup ? MEETING_CATEGORY_GROUPS[currentGroup] : [];
  const showActivitySubtype = isCategoryWithActivitySubtype(formData.category);
  const showAssessmentOption = formData.category === 'IEP'; // only IEP has meeting/updates/assessment; planning & legacy have meeting/updates

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  };

  return (
    <>
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleFormSubmit}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box component="span">{editingMeeting ? 'Edit Meeting' : 'Add Meeting'}</Box>
          {editingMeeting && onDelete && (
            <IconButton
              aria-label="Delete meeting"
              onClick={handleDelete}
              disabled={saving || deleting}
              color="error"
              size="small"
            >
              <DeleteIcon />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <FormControl fullWidth required margin="normal">
            <InputLabel>School</InputLabel>
            <Select
              value={formData.school}
              onChange={(e) => {
                setFormData({ ...formData, school: e.target.value, studentId: '' });
                setStudentInputValue('');
              }}
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
            type="time"
            fullWidth
            value={formData.endTime}
            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
            margin="normal"
            InputLabelProps={{
              shrink: true,
            }}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Category</InputLabel>
            <Select
              value={currentGroup}
              onChange={(e) => {
                const group = e.target.value as MeetingCategoryGroup;
                const subs = MEETING_CATEGORY_GROUPS[group];
                const firstSub = subs?.[0] ?? '';
                setFormData({
                  ...formData,
                  category: firstSub,
                  activitySubtype: (firstSub && isCategoryWithActivitySubtype(firstSub) ? formData.activitySubtype || 'meeting' : '') as '' | MeetingActivitySubtype,
                });
              }}
              label="Category"
            >
              <MenuItem value="">None</MenuItem>
              {categoryGroups.map((group) => (
                <MenuItem key={group} value={group}>
                  {group}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {currentGroup && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Type</InputLabel>
              <Select
                value={formData.category}
                onChange={(e) => setFormData({
                  ...formData,
                  category: e.target.value,
                  activitySubtype: (e.target.value && isCategoryWithActivitySubtype(e.target.value) ? formData.activitySubtype || 'meeting' : '') as '' | MeetingActivitySubtype,
                })}
                label="Type"
              >
                {subcategoriesForGroup.map((sub) => (
                  <MenuItem key={sub} value={sub}>
                    {sub}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {showActivitySubtype && (
            <TextField
              label="Activity type"
              select
              fullWidth
              value={formData.activitySubtype || 'meeting'}
              onChange={(e) => setFormData({ ...formData, activitySubtype: e.target.value as MeetingActivitySubtype })}
              margin="normal"
              helperText={
                formData.category === 'IEP'
                  ? 'Shows on timesheet as "IEP meeting:", "IEP updates:", or "IEP assessment:"'
                  : formData.category === 'IEP planning'
                    ? 'Shows on timesheet as "IEP planning, meeting:" or "updates:"'
                    : formData.category === 'Assessment planning'
                      ? 'Shows on timesheet as "Assessment planning, meeting:" or "updates:"'
                      : formData.category === '3 year reassessment planning' || formData.category === 'Assessment'
                        ? 'Shows on timesheet as "3 year reassessment planning, meeting:" or "updates:" (or legacy "3 year reassessment...")'
                        : undefined
              }
            >
              <MenuItem value="meeting">Meeting</MenuItem>
              <MenuItem value="updates">Updates</MenuItem>
              {showAssessmentOption && <MenuItem value="assessment">Assessment</MenuItem>}
            </TextField>
          )}
          <Autocomplete
            options={studentsInSchoolDeduped}
            getOptionLabel={(option) => (option ? `${option.name}${option.grade ? ` (${option.grade})` : ''}` : '')}
            filterOptions={(options, state) => filterStudentOptions(options, state.inputValue)}
            value={studentsInSchoolDeduped.find((s) => s.id === formData.studentId) ?? null}
            inputValue={studentInputValue}
            onInputChange={(_, value) => {
              setStudentInputValue(value);
              studentInputRef.current = value;
            }}
            onChange={(_, newValue) => {
              setFormData({ ...formData, studentId: newValue?.id ?? '' });
              if (newValue) {
                setStudentInputValue(newValue.name ?? '');
              } else {
                setStudentInputValue('');
                studentInputRef.current = '';
              }
            }}
            disabled={!formData.school}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Student (Optional)"
                margin="normal"
                InputLabelProps={{ shrink: true }}
                helperText={formData.school ? '' : 'Select a school first to choose a student'}
                onKeyDown={(e) => {
                  const filtered = filterStudentOptions(studentsInSchoolDeduped, studentInputRef.current);
                  handleAutocompleteKeyDown(e, filtered, (option) => {
                    setFormData((prev) => ({ ...prev, studentId: option.id }));
                    setStudentInputValue(option.name ?? '');
                  });
                }}
              />
            )}
            isOptionEqualToValue={(option, value) => value != null && option.id === value.id}
          />
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
          <Button type="button" onClick={onClose} disabled={saving || deleting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={saving || deleting || !formData.school || !formData.title || !formData.date}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
    <ConfirmDialog />
    </>
  );
};

