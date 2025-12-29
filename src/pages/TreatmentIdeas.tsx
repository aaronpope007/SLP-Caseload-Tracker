import { useState, useEffect } from 'react';
import { logError } from '../utils/logger';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  Lightbulb as LightbulbIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import type { Activity } from '../types';
import {
  getActivities,
  addActivity,
  updateActivity,
} from '../utils/storage-api';
import { generateId } from '../utils/helpers';
import { getErrorMessage } from '../utils/validators';
import { generateTreatmentIdeas } from '../utils/gemini';
import { useDialog, useSnackbar } from '../hooks';

export const TreatmentIdeas = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const dialog = useDialog();
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  const [generating, setGenerating] = useState(false);
  const [generatedIdeas, setGeneratedIdeas] = useState('');

  const [formData, setFormData] = useState({
    goalArea: '',
    ageRange: '',
    materials: '',
  });

  useEffect(() => {
    loadActivities();
  }, []);


  const loadActivities = async () => {
    try {
      const activities = await getActivities();
      setActivities(activities.sort((a, b) => 
        new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
      ));
    } catch (error) {
      logError('Failed to load activities', error);
    }
  };

  const handleGenerate = async () => {
    if (!formData.goalArea || !formData.ageRange) {
      showSnackbar('Please fill in goal area and age range', 'error');
      return;
    }

    setGenerating(true);
    setGeneratedIdeas('');

    try {
      const apiKey = localStorage.getItem('gemini_api_key');
      if (!apiKey) {
        showSnackbar('Please set your Gemini API key in Settings', 'error');
        setGenerating(false);
        return;
      }

      const materialsArray = formData.materials
        .split(',')
        .map((m) => m.trim())
        .filter((m) => m.length > 0);

      const ideas = await generateTreatmentIdeas(
        formData.goalArea,
        formData.ageRange,
        materialsArray,
        apiKey
      );

      setGeneratedIdeas(ideas);
      dialog.openDialog();
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      showSnackbar(errorMessage, 'error');
      logError('Failed to generate treatment ideas', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveIdea = async () => {
    if (!generatedIdeas || !formData.goalArea || !formData.ageRange) return;

    try {
      const materialsArray = formData.materials
        .split(',')
        .map((m) => m.trim())
        .filter((m) => m.length > 0);

      const activity: Activity = {
        id: generateId(),
        description: generatedIdeas,
        goalArea: formData.goalArea,
        ageRange: formData.ageRange,
        materials: materialsArray,
        isFavorite: false,
        source: 'AI',
        dateCreated: new Date().toISOString(),
      };

      await addActivity(activity);
      loadActivities();
      dialog.closeDialog();
      setGeneratedIdeas('');
      showSnackbar('Treatment idea saved successfully!', 'success');
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      showSnackbar(errorMessage, 'error');
      logError('Failed to save treatment idea', err);
    }
  };

  const handleToggleFavorite = async (id: string) => {
    const activity = activities.find((a) => a.id === id);
    if (activity) {
      await updateActivity(id, { isFavorite: !activity.isFavorite });
      loadActivities();
    }
  };

  const favoriteActivities = activities.filter((a) => a.isFavorite);
  const allActivities = activities.filter((a) => !a.isFavorite);

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Treatment Ideas
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Generate AI-Powered Treatment Ideas
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Goal Area"
                value={formData.goalArea}
                onChange={(e) => setFormData({ ...formData, goalArea: e.target.value })}
                placeholder="e.g., Articulation, Language, Fluency"
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Age Range"
                value={formData.ageRange}
                onChange={(e) => setFormData({ ...formData, ageRange: e.target.value })}
                placeholder="e.g., 5-8 years, Preschool"
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Materials Available (comma-separated)"
                value={formData.materials}
                onChange={(e) => setFormData({ ...formData, materials: e.target.value })}
                placeholder="e.g., iPad, paper, markers"
              />
            </Grid>
          </Grid>
          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              startIcon={generating ? <CircularProgress size={20} /> : <LightbulbIcon />}
              onClick={handleGenerate}
              disabled={generating || !formData.goalArea || !formData.ageRange}
            >
              {generating ? 'Generating...' : 'Generate Ideas'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {favoriteActivities.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Favorite Activities
          </Typography>
          <Grid container spacing={2}>
            {favoriteActivities.map((activity) => (
              <Grid item xs={12} md={6} key={activity.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Box>
                        <Chip label={activity.goalArea} size="small" sx={{ mr: 1 }} />
                        <Chip label={activity.ageRange} size="small" />
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleFavorite(activity.id)}
                        color="error"
                      >
                        <FavoriteIcon />
                      </IconButton>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        maxHeight: 200,
                        overflow: 'auto',
                        mb: 1,
                      }}
                    >
                      {activity.description}
                    </Typography>
                    {activity.materials.length > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        Materials: {activity.materials.join(', ')}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      <Box>
        <Typography variant="h6" gutterBottom>
          Saved Activities
        </Typography>
        {allActivities.length === 0 ? (
          <Card>
            <CardContent>
              <Typography color="text.secondary" align="center">
                No activities saved yet. Generate some ideas to get started!
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={2}>
            {allActivities.map((activity) => (
              <Grid item xs={12} md={6} key={activity.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Box>
                        <Chip label={activity.goalArea} size="small" sx={{ mr: 1 }} />
                        <Chip label={activity.ageRange} size="small" />
                        {activity.source === 'AI' && (
                          <Chip label="AI Generated" size="small" color="primary" sx={{ ml: 1 }} />
                        )}
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleFavorite(activity.id)}
                      >
                        <FavoriteBorderIcon />
                      </IconButton>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        maxHeight: 200,
                        overflow: 'auto',
                        mb: 1,
                      }}
                    >
                      {activity.description}
                    </Typography>
                    {activity.materials.length > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        Materials: {activity.materials.join(', ')}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      <Dialog open={dialog.open} onClose={dialog.closeDialog} maxWidth="md" fullWidth>
        <DialogTitle>Generated Treatment Ideas</DialogTitle>
        <DialogContent>
          <Typography
            variant="body1"
            sx={{ whiteSpace: 'pre-wrap', maxHeight: 500, overflow: 'auto' }}
          >
            {generatedIdeas}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={dialog.closeDialog}>Close</Button>
          <Button
            onClick={handleSaveIdea}
            variant="contained"
            startIcon={<SaveIcon />}
          >
            Save to Library
          </Button>
        </DialogActions>
      </Dialog>

      <SnackbarComponent />
    </Box>
  );
};

