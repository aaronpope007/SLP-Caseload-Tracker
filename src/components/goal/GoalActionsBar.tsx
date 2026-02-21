import {
  Box,
  Button,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Psychology as PsychologyIcon,
  School as SchoolIcon,
  FlashOn as FlashOnIcon,
  Archive as ArchiveIcon,
} from '@mui/icons-material';

interface GoalActionsBarProps {
  onAddGoal: () => void;
  onQuickGoal: () => void;
  onGenerateIEPGoals: () => void;
  onGenerateTreatmentRecommendations: () => void;
  onArchiveGoals?: () => void;
  hasGoals: boolean;
}

export const GoalActionsBar = ({
  onAddGoal,
  onQuickGoal,
  onGenerateIEPGoals,
  onGenerateTreatmentRecommendations,
  onArchiveGoals,
  hasGoals,
}: GoalActionsBarProps) => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
      <Typography variant="h5" sx={{ fontSize: '1.75rem', fontWeight: 'bold' }}>Goals</Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          startIcon={<SchoolIcon />}
          onClick={onGenerateIEPGoals}
        >
          Generate IEP Goals
        </Button>
        <Button
          variant="outlined"
          startIcon={<PsychologyIcon />}
          onClick={onGenerateTreatmentRecommendations}
          disabled={!hasGoals}
        >
          Treatment Recommendations
        </Button>
        <Button
          variant="outlined"
          startIcon={<FlashOnIcon />}
          onClick={onQuickGoal}
        >
          Quick Goal
        </Button>
        {onArchiveGoals && (
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<ArchiveIcon />}
            onClick={onArchiveGoals}
            disabled={!hasGoals}
          >
            Archive Goals & Start Fresh
          </Button>
        )}
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAddGoal}
        >
          Add Goal
        </Button>
      </Box>
    </Box>
  );
};

