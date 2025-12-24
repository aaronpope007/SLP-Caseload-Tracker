import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormGroup,
  FormControlLabel,
  Paper,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  ExpandMore as ExpandMoreIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import type { Student, Goal, Session } from '../types';
import { formatDate, toLocalDateTimeString } from '../utils/helpers';
import { StudentSelector } from './StudentSelector';
import { ServiceTypeSelector } from './ServiceTypeSelector';
import { GoalHierarchy } from './GoalHierarchy';
import { organizeGoalsHierarchy } from '../utils/goalHierarchy';
import { COMMON_SUBJECTIVE_STATEMENTS } from '../utils/soapNoteGenerator';

interface SessionFormData {
  studentIds: string[];
  date: string;
  endTime: string;
  goalsTargeted: string[];
  activitiesUsed: string[];
  performanceData: {
    goalId: string;
    studentId: string;
    accuracy?: string;
    correctTrials?: number;
    incorrectTrials?: number;
    notes?: string;
    cuingLevels?: ('independent' | 'verbal' | 'visual' | 'tactile' | 'physical')[];
  }[];
  notes: string;
  isDirectServices: boolean;
  indirectServicesNotes: string;
  missedSession: boolean;
  selectedSubjectiveStatements: string[];
  customSubjective: string;
}

interface SessionFormDialogProps {
  open: boolean;
  editingSession: Session | null;
  editingGroupSessionId: string | null;
  students: Student[];
  goals: Goal[];
  sessions: Session[];
  formData: SessionFormData;
  studentSearch: string;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  onFormDataChange: (data: Partial<SessionFormData>) => void;
  onStudentSearchChange: (value: string) => void;
  onStudentToggle: (studentId: string) => void;
  onGoalToggle: (goalId: string, studentId: string) => void;
  onPerformanceUpdate: (goalId: string, studentId: string, field: 'accuracy' | 'notes', value: string) => void;
  onCuingLevelToggle: (goalId: string, studentId: string, cuingLevel: 'independent' | 'verbal' | 'visual' | 'tactile' | 'physical') => void;
  onTrialUpdate: (goalId: string, studentId: string, isCorrect: boolean) => void;
  getRecentPerformance: (goalId: string, studentId: string) => number | null;
  isGoalAchieved: (goal: Goal) => boolean;
}

export const SessionFormDialog = ({
  open,
  editingSession,
  editingGroupSessionId,
  students,
  goals,
  sessions,
  formData,
  studentSearch,
  onClose,
  onSave,
  onDelete,
  onFormDataChange,
  onStudentSearchChange,
  onStudentToggle,
  onGoalToggle,
  onPerformanceUpdate,
  onCuingLevelToggle,
  onTrialUpdate,
  getRecentPerformance,
  isGoalAchieved,
}: SessionFormDialogProps) => {
  // Get goals for all selected students, grouped by student, separated into active and completed
  const availableGoalsByStudent = formData.studentIds.length > 0
    ? formData.studentIds.map(studentId => {
        const studentGoals = goals.filter((g) => g.studentId === studentId);
        const activeGoals = studentGoals.filter(g => !isGoalAchieved(g));
        const completedGoals = studentGoals.filter(g => isGoalAchieved(g));
        const hierarchy = organizeGoalsHierarchy(activeGoals);
        return {
          studentId,
          studentName: students.find(s => s.id === studentId)?.name || 'Unknown',
          goals: activeGoals,
          completedGoals: completedGoals,
          hierarchy,
        };
      })
    : [];

  const handleFormDataChange = (
    updatesOrUpdater: Partial<SessionFormData> | ((prev: SessionFormData) => SessionFormData)
  ) => {
    if (typeof updatesOrUpdater === 'function') {
      // If it's an updater function, we need to get the current formData and apply the updater
      const updated = updatesOrUpdater(formData);
      // Convert the full updated object to a partial update by extracting only changed fields
      // Since we're updating performanceData, we'll pass the entire updated object
      // The parent component will merge it properly
      onFormDataChange(updated);
    } else {
      // If it's a partial update, pass it through
      onFormDataChange(updatesOrUpdater);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={(event, reason) => {
        // Prevent closing on backdrop click or escape key - let the onClose handler decide
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
          onClose();
        }
      }} 
      maxWidth="lg" 
      fullWidth
    >
      <DialogTitle>
        {editingGroupSessionId ? 'Edit Group Session' : editingSession ? 'Edit Activity' : 'Log New Activity'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <StudentSelector
            students={students}
            selectedStudentIds={formData.studentIds}
            searchTerm={studentSearch}
            onSearchChange={onStudentSearchChange}
            onStudentToggle={onStudentToggle}
            autoFocus={!editingSession && !editingGroupSessionId}
          />

          <ServiceTypeSelector
            isDirectServices={formData.isDirectServices}
            onChange={(isDirect) => handleFormDataChange({ isDirectServices: isDirect })}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Start Time"
              type="datetime-local"
              fullWidth
              value={formData.date}
              onChange={(e) => handleFormDataChange({ date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <Box sx={{ display: 'flex', gap: 1, flex: 1, alignItems: 'flex-end' }}>
              <TextField
                label="End Time"
                type="datetime-local"
                fullWidth
                value={formData.endTime}
                onChange={(e) => handleFormDataChange({ endTime: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
              <Button
                variant="outlined"
                size="medium"
                startIcon={<AccessTimeIcon />}
                onClick={() => handleFormDataChange({ endTime: toLocalDateTimeString(new Date()) })}
                sx={{
                  minWidth: 'auto',
                  whiteSpace: 'nowrap',
                  mb: 0.5,
                }}
                title="Set end time to current time"
              >
                Now
              </Button>
            </Box>
          </Box>

          {formData.isDirectServices && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Checkbox
                checked={formData.missedSession}
                onChange={(e) => handleFormDataChange({ missedSession: e.target.checked })}
              />
              <Typography variant="body2">Missed Session</Typography>
            </Box>
          )}

          {formData.isDirectServices ? (
            <>
              {formData.studentIds.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Goals Targeted (by student):
                  </Typography>
                  {availableGoalsByStudent.length === 0 ? (
                    <Typography color="text.secondary" variant="body2">
                      No students selected. Please select at least one student.
                    </Typography>
                  ) : availableGoalsByStudent.length === 1 ? (
                    // Single student layout (original column layout)
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                      {availableGoalsByStudent.map(({ studentId, studentName, goals: studentGoals, completedGoals, hierarchy }) => (
                        <Box key={studentId}>
                          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
                            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: 'primary.main' }}>
                              {studentName}
                            </Typography>
                            {studentGoals.length === 0 ? (
                              <Typography color="text.secondary" variant="body2">
                                No active goals found for this student. Add goals in the student's detail page.
                              </Typography>
                            ) : (
                              <GoalHierarchy
                                hierarchy={hierarchy}
                                studentId={studentId}
                                goalsTargeted={formData.goalsTargeted}
                                performanceData={formData.performanceData}
                                isCompact={false}
                                getRecentPerformance={getRecentPerformance}
                                onGoalToggle={onGoalToggle}
                                onTrialUpdate={onTrialUpdate}
                                onPerformanceUpdate={onPerformanceUpdate}
                                onCuingLevelToggle={onCuingLevelToggle}
                                onFormDataChange={handleFormDataChange}
                              />
                            )}
                          </Box>
                          {completedGoals.length > 0 && (
                            <Accordion sx={{ mt: 2 }}>
                              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="subtitle2" color="text.secondary">
                                  Completed Goals ({completedGoals.length})
                                </Typography>
                              </AccordionSummary>
                              <AccordionDetails>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                  {completedGoals.map((goal) => (
                                    <Box key={goal.id} sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                                      <Typography variant="body2">
                                        {goal.description}
                                      </Typography>
                                      {goal.dateAchieved && (
                                        <Typography variant="caption" color="text.secondary">
                                          Achieved: {formatDate(goal.dateAchieved)}
                                        </Typography>
                                      )}
                                    </Box>
                                  ))}
                                </Box>
                              </AccordionDetails>
                            </Accordion>
                          )}
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    // Multiple students layout (side-by-side)
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      {availableGoalsByStudent.map(({ studentId, studentName, goals: studentGoals, completedGoals, hierarchy }) => (
                        <Grid item xs={12} sm={6} md={availableGoalsByStudent.length === 2 ? 6 : 4} key={studentId}>
                          <Box
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1,
                              p: 2,
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              maxHeight: '600px',
                              overflow: 'auto',
                            }}
                          >
                            <Typography
                              variant="subtitle1"
                              sx={{
                                mb: 1,
                                fontWeight: 'bold',
                                color: 'primary.main',
                                position: 'sticky',
                                top: 0,
                                bgcolor: 'background.paper',
                                pb: 1,
                                zIndex: 1,
                              }}
                            >
                              {studentName}
                            </Typography>
                            {studentGoals.length === 0 ? (
                              <Typography color="text.secondary" variant="body2">
                                No active goals found for this student. Add goals in the student's detail page.
                              </Typography>
                            ) : (
                              <GoalHierarchy
                                hierarchy={hierarchy}
                                studentId={studentId}
                                goalsTargeted={formData.goalsTargeted}
                                performanceData={formData.performanceData}
                                isCompact={true}
                                getRecentPerformance={getRecentPerformance}
                                onGoalToggle={onGoalToggle}
                                onTrialUpdate={onTrialUpdate}
                                onPerformanceUpdate={onPerformanceUpdate}
                                onCuingLevelToggle={onCuingLevelToggle}
                                onFormDataChange={handleFormDataChange}
                              />
                            )}
                            {completedGoals.length > 0 && (
                              <Accordion sx={{ mt: 2 }}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                  <Typography variant="subtitle2" color="text.secondary">
                                    Completed Goals ({completedGoals.length})
                                  </Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {completedGoals.map((goal) => (
                                      <Box key={goal.id} sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                                        <Typography variant="body2">
                                          {goal.description}
                                        </Typography>
                                        {goal.dateAchieved && (
                                          <Typography variant="caption" color="text.secondary">
                                            Achieved: {formatDate(goal.dateAchieved)}
                                          </Typography>
                                        )}
                                      </Box>
                                    ))}
                                  </Box>
                                </AccordionDetails>
                              </Accordion>
                            )}
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Box>
              )}

              {formData.isDirectServices && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">
                      Subjective Statements (for SOAP notes):
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <FormGroup>
                        <Grid container spacing={1}>
                          {COMMON_SUBJECTIVE_STATEMENTS.map((statement) => (
                            <Grid item xs={12} sm={6} key={statement}>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={formData.selectedSubjectiveStatements.includes(statement)}
                                    onChange={(e) => {
                                      const current = formData.selectedSubjectiveStatements;
                                      const updated = e.target.checked
                                        ? [...current, statement]
                                        : current.filter(s => s !== statement);
                                      handleFormDataChange({ selectedSubjectiveStatements: updated });
                                    }}
                                    size="small"
                                  />
                                }
                                label={
                                  <Typography variant="body2">
                                    {statement}
                                  </Typography>
                                }
                              />
                            </Grid>
                          ))}
                        </Grid>
                      </FormGroup>
                      <TextField
                        label="Custom Subjective Statement"
                        fullWidth
                        value={formData.customSubjective}
                        onChange={(e) => handleFormDataChange({ customSubjective: e.target.value })}
                        placeholder="Enter your own subjective statement..."
                      />
                    </Box>
                  </AccordionDetails>
                </Accordion>
              )}

              <TextField
                label="Activities Used (comma-separated)"
                fullWidth
                value={formData.activitiesUsed.join(', ')}
                onChange={(e) =>
                  handleFormDataChange({
                    activitiesUsed: e.target.value
                      .split(',')
                      .map((a) => a.trim())
                      .filter((a) => a.length > 0),
                  })
                }
              />

              <TextField
                label="Session Notes"
                fullWidth
                multiline
                rows={4}
                value={formData.notes}
                onChange={(e) => handleFormDataChange({ notes: e.target.value })}
              />
            </>
          ) : (
            <TextField
              label="Indirect Services Notes"
              fullWidth
              multiline
              rows={6}
              value={formData.indirectServicesNotes}
              onChange={(e) => handleFormDataChange({ indirectServicesNotes: e.target.value })}
              placeholder="Enter notes about indirect services provided..."
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        {(editingSession || editingGroupSessionId) && onDelete && (
          <Button
            onClick={onDelete}
            color="error"
            startIcon={<DeleteIcon />}
            sx={{ mr: 'auto' }}
          >
            Delete
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={onSave}
          variant="contained"
          disabled={formData.studentIds.length === 0}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

