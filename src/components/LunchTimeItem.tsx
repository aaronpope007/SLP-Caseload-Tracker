import {
  Box,
  Card,
  CardContent,
  Typography,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  Restaurant as RestaurantIcon,
} from '@mui/icons-material';
import type { Lunch } from '../types';
import { formatDateTime } from '../utils/helpers';

interface LunchTimeItemProps {
  lunch: Lunch;
}

export const LunchTimeItem = ({ lunch }: LunchTimeItemProps) => {
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <RestaurantIcon color="primary" />
              <Typography variant="h6">
                Lunch
              </Typography>
            </Box>
            <Typography color="text.secondary" variant="body2">
              <AccessTimeIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
              {formatDateTime(lunch.startTime)}
              {lunch.endTime && ` - ${formatDateTime(lunch.endTime)}`}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

