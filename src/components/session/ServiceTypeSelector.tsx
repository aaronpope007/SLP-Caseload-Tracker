import {
  Box,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';

interface ServiceTypeSelectorProps {
  isDirectServices: boolean;
  onChange: (isDirect: boolean) => void;
}

const DIRECT_SERVICES_TOOLTIP =
  "Per SSG SLP-SLPA billing rules: For tele services, you must list the exact time in/out for each direct session. Direct services notes will include specific start and end times for each individual session. For any indirect services, you do not need to list specific in/out times.";

const INDIRECT_SERVICES_TOOLTIP =
  'Per SSG SLP-SLPA billing rules: Indirect services typically include lesson planning, documentation, and collaboration. For email correspondence, the coding depends on content: IEP emails are coded as IEP, Evaluation emails are coded as Evaluation, while scheduling/collaboration/intervention-based emails are coded as indirect services. Missed sessions are not billed; instead, replace that work with indirect work (documentation/lesson planning).';

export const ServiceTypeSelector = ({
  isDirectServices,
  onChange,
}: ServiceTypeSelectorProps) => {
  return (
    <FormControl component="fieldset">
      <Typography variant="subtitle2" gutterBottom>
        Service Type:
      </Typography>
      <RadioGroup
        row
        value={isDirectServices ? 'direct' : 'indirect'}
        onChange={(e) => onChange(e.target.value === 'direct')}
      >
        <Tooltip title={DIRECT_SERVICES_TOOLTIP} arrow placement="top">
          <FormControlLabel
            value="direct"
            control={<Radio />}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>Direct Services</span>
                <InfoIcon sx={{ fontSize: 16, color: 'action.active' }} />
              </Box>
            }
          />
        </Tooltip>
        <Tooltip title={INDIRECT_SERVICES_TOOLTIP} arrow placement="top">
          <FormControlLabel
            value="indirect"
            control={<Radio />}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>Indirect Services</span>
                <InfoIcon sx={{ fontSize: 16, color: 'action.active' }} />
              </Box>
            }
          />
        </Tooltip>
      </RadioGroup>
    </FormControl>
  );
};

