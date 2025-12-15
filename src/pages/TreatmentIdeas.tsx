import { useState, useEffect } from 'react';
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
  Alert,
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
} from '../utils/storage';
import { generateId } from '../utils/helpers';
import { generateTreatmentIdeas } from '../utils/gemini';
import { useStorageSync } from '../hooks/useStorageSync';

export const TreatmentIdeas = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedIdeas, setGeneratedIdeas] = useState('');
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    goalArea: '',
    ageRange: '',
    materials: '',
  });

  useEffect(() => {
    loadActivities();
  }, []);

  // Sync data across browser tabs
  useStorageSync(() => {
    loadActivities();
  });

  const loadActivities = () => {
    setActivities(getActivities().sort((a, b) => 
      new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
    ));
  };

  const handleGenerate = async () => {
    if (!formData.goalArea || !formData.ageRange) {
      setError('Please fill in goal area and age range');
      return;
    }

    setGenerating(true);
    setError('');
    setGeneratedIdeas('');

    try {
      const apiKey = localStorage.getItem('gemini_api_key');
      if (!apiKey) {
        setError('Please set your Gemini API key in Settings');
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
      setDialogOpen(true);
    } catch (err: any) {
      setError(err.message || 'Failed to generate ideas. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveIdea = () => {
    if (!generatedIdeas || !formData.goalArea || !formData.ageRange) return;

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

    addActivity(activity);
    loadActivities();
    setDialogOpen(false);
    setGeneratedIdeas('');
  };

  const handleToggleFavorite = (id: string) => {
    const activity = activities.find((a) => a.id === id);
    if (activity) {
      updateActivity(id, { isFavorite: !activity.isFavorite });
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
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
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
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
          <Button
            onClick={handleSaveIdea}
            variant="contained"
            startIcon={<SaveIcon />}
          >
            Save to Library
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

