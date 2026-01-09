import React from 'react';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import type { Student } from '../../types';
import {
  goalTemplates,
  getGoalTemplatesByDomain,
  getGoalTemplatesByKeywords,
  getUniqueDomains,
} from '../../utils/goalTemplates';

interface GoalTemplateDialogProps {
  open: boolean;
  student: Student | null;
  filterDomain: string;
  showRecommendedTemplates: boolean;
  onClose: () => void;
  onFilterDomainChange: (domain: string) => void;
  onShowRecommendedTemplatesChange: (show: boolean) => void;
  onUseTemplate: (template: typeof goalTemplates[0]) => void;
}

export const GoalTemplateDialog: React.FC<GoalTemplateDialogProps> = ({
  open,
  student,
  filterDomain,
  showRecommendedTemplates,
  onClose,
  onFilterDomainChange,
  onShowRecommendedTemplatesChange,
  onUseTemplate,
}) => {
  const getRecommendedTemplates = (): typeof goalTemplates => {
    if (!student || !showRecommendedTemplates) return [];
    return getGoalTemplatesByKeywords(student.concerns);
  };

  const recommendedTemplates = getRecommendedTemplates();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Goal Templates</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Filter by Domain</InputLabel>
            <Select
              value={filterDomain}
              onChange={(e) => {
                onFilterDomainChange(e.target.value);
                onShowRecommendedTemplatesChange(false);
              }}
              label="Filter by Domain"
            >
              <MenuItem value="">All Domains</MenuItem>
              {getUniqueDomains().map(domain => (
                <MenuItem key={domain} value={domain}>{domain}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {showRecommendedTemplates && student && student.concerns.length > 0 && recommendedTemplates.length > 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Recommended for {student.name} ({student.concerns.join(', ')})
              </Typography>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                {recommendedTemplates.slice(0, 4).map((template) => (
                  <Grid item xs={12} sm={6} key={template.id}>
                    <Card variant="outlined" sx={{ bgcolor: 'action.hover' }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          {template.title}
                        </Typography>
                        <Chip label={template.domain} size="small" sx={{ mb: 1 }} />
                        <Typography variant="body2" color="text.secondary" paragraph>
                          {template.description}
                        </Typography>
                        {template.suggestedBaseline && (
                          <Typography variant="caption" display="block">
                            Baseline: {template.suggestedBaseline}
                          </Typography>
                        )}
                        {template.suggestedTarget && (
                          <Typography variant="caption" display="block">
                            Target: {template.suggestedTarget}
                          </Typography>
                        )}
                      </CardContent>
                      <CardActions>
                        <Button size="small" onClick={() => onUseTemplate(template)}>
                          Use Template
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
              <Divider sx={{ my: 2 }} />
            </Box>
          )}
          <Typography variant="h6" gutterBottom>
            {filterDomain ? `${filterDomain} Templates` : 'All Templates'}
          </Typography>
          <Grid container spacing={2}>
            {(filterDomain
              ? getGoalTemplatesByDomain(filterDomain)
              : goalTemplates
            ).map((template) => (
              <Grid item xs={12} sm={6} key={template.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {template.title}
                    </Typography>
                    <Chip label={template.domain} size="small" sx={{ mb: 1 }} />
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {template.description}
                    </Typography>
                    {template.suggestedBaseline && (
                      <Typography variant="caption" display="block">
                        Baseline: {template.suggestedBaseline}
                      </Typography>
                    )}
                    {template.suggestedTarget && (
                      <Typography variant="caption" display="block">
                        Target: {template.suggestedTarget}
                      </Typography>
                    )}
                  </CardContent>
                  <CardActions>
                    <Button size="small" onClick={() => onUseTemplate(template)}>
                      Use Template
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

