/**
 * Loading Skeletons
 * 
 * Reusable skeleton components for better perceived loading performance.
 * These provide visual placeholders while data is being fetched.
 */

import { Box, Skeleton, Card, CardContent, Grid, Paper } from '@mui/material';

/**
 * Table skeleton with rows
 */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, px: 2 }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text" width={`${100 / columns}%`} height={32} />
        ))}
      </Box>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Box key={rowIndex} sx={{ display: 'flex', gap: 2, mb: 1.5, px: 2 }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} variant="text" width={`${100 / columns}%`} height={24} />
          ))}
        </Box>
      ))}
    </Box>
  );
}

/**
 * Card grid skeleton
 */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <Grid container spacing={2}>
      {Array.from({ length: count }).map((_, i) => (
        <Grid item xs={12} sm={6} md={4} key={i}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width="60%" height={28} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="80%" height={20} />
              <Skeleton variant="text" width="40%" height={20} />
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Skeleton variant="rounded" width={60} height={24} />
                <Skeleton variant="rounded" width={60} height={24} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

/**
 * List skeleton
 */
export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <Box>
      {Array.from({ length: items }).map((_, i) => (
        <Box
          key={i}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Skeleton variant="circular" width={40} height={40} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="40%" height={24} />
            <Skeleton variant="text" width="60%" height={18} />
          </Box>
          <Skeleton variant="rounded" width={80} height={32} />
        </Box>
      ))}
    </Box>
  );
}

/**
 * Dashboard statistics skeleton
 */
export function DashboardStatsSkeleton() {
  return (
    <Grid container spacing={2}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Grid item xs={6} md={3} key={i}>
          <Paper sx={{ p: 2 }}>
            <Skeleton variant="text" width="60%" height={20} />
            <Skeleton variant="text" width="40%" height={40} sx={{ mt: 1 }} />
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}

/**
 * Detail page skeleton
 */
export function DetailPageSkeleton() {
  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Skeleton variant="circular" width={64} height={64} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="30%" height={32} />
          <Skeleton variant="text" width="50%" height={20} />
        </Box>
        <Skeleton variant="rounded" width={100} height={36} />
      </Box>
      
      {/* Content sections */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Skeleton variant="text" width="20%" height={28} sx={{ mb: 2 }} />
            <Skeleton variant="text" width="100%" height={20} />
            <Skeleton variant="text" width="90%" height={20} />
            <Skeleton variant="text" width="70%" height={20} />
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Skeleton variant="text" width="25%" height={28} sx={{ mb: 2 }} />
            <ListSkeleton items={3} />
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Skeleton variant="text" width="40%" height={28} sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" width="100%" height={200} />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

/**
 * Form skeleton
 */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {Array.from({ length: fields }).map((_, i) => (
        <Box key={i}>
          <Skeleton variant="text" width="20%" height={20} sx={{ mb: 0.5 }} />
          <Skeleton variant="rounded" width="100%" height={40} />
        </Box>
      ))}
      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
        <Skeleton variant="rounded" width={100} height={36} />
        <Skeleton variant="rounded" width={80} height={36} />
      </Box>
    </Box>
  );
}

/**
 * Calendar skeleton
 */
export function CalendarSkeleton() {
  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Skeleton variant="rounded" width={100} height={36} />
        <Skeleton variant="text" width={150} height={32} />
        <Skeleton variant="rounded" width={100} height={36} />
      </Box>
      
      {/* Days header */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, mb: 1 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} variant="text" height={24} />
        ))}
      </Box>
      
      {/* Calendar grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={80} />
        ))}
      </Box>
    </Box>
  );
}

export default {
  TableSkeleton,
  CardGridSkeleton,
  ListSkeleton,
  DashboardStatsSkeleton,
  DetailPageSkeleton,
  FormSkeleton,
  CalendarSkeleton,
};

