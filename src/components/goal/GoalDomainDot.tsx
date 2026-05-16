import { Box, Tooltip, Typography } from '@mui/material';
import { DOMAIN_META, inferGoalDomain, type GoalDomainBucket } from '../../utils/goalDomainMap';

export function GoalDomainDot({ goalText, domain: domainProp }: { goalText: string; domain?: GoalDomainBucket }) {
  const domain = domainProp ?? inferGoalDomain(goalText);
  const meta = DOMAIN_META[domain];
  return (
    <Tooltip title={meta.label}>
      <Box
        component="span"
        aria-hidden
        sx={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          bgcolor: meta.color,
          flexShrink: 0,
          display: 'inline-block',
        }}
      />
    </Tooltip>
  );
}

export function GoalDomainLabel({
  goalText,
  domain: domainProp,
  showLabel = true,
}: {
  goalText: string;
  domain?: GoalDomainBucket;
  showLabel?: boolean;
}) {
  const domain = domainProp ?? inferGoalDomain(goalText);
  const meta = DOMAIN_META[domain];
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <GoalDomainDot goalText={goalText} domain={domain} />
      {showLabel ? (
        <Typography component="span" variant="body2" sx={{ ml: '6px' }}>
          {meta.label}
        </Typography>
      ) : null}
    </Box>
  );
}
