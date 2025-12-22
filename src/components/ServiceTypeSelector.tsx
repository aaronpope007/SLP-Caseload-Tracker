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
  "MN requires that specific start and end times are listed for any direct services provided remotely for each individual session. In the notes section of your entry for the school, list the specific start and end time of each direct telehealth session, with a separate line for each entry. If doing additional duties within a timeframe of billable services, you only need to include specific start/end times for the direct telehealth duties.";

const INDIRECT_SERVICES_TOOLTIP =
  'Any of the following activities: collaboration with teachers/staff, direct contact with the student to monitor and observe, modifying environment/items, preparation for sessions, or ordering/creation of materials for the student to support their IEP goals, setting up a therapeutic OT space for students, etc. It also includes performing documentation/record-keeping duties, including updating daily notes, scheduling, and updating caseload lists for Indigo sped director group schools. If you see a student for direct services and document "Direct/indirect services," since you did preparation and documentation, you do not need to write "Indirect services" as well. You will only write this if you do other indirect services beyond the preparation and documentation of direct services, such as fulfilling monthly minutes.';

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

