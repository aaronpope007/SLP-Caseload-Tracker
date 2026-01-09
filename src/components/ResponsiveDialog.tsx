/**
 * Responsive Dialog Component
 * 
 * A wrapper around MUI Dialog that provides better mobile experience:
 * - Full screen on mobile devices
 * - Slide up animation on mobile
 * - Standard modal on desktop
 */

import { forwardRef, ReactElement, ReactNode } from 'react';
import {
  Dialog,
  DialogProps,
  useMediaQuery,
  useTheme,
  Slide,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import { Close as CloseIcon } from '@mui/icons-material';

// Slide up transition for mobile
const SlideTransition = forwardRef(function Transition(
  props: TransitionProps & { children: ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface ResponsiveDialogProps extends Omit<DialogProps, 'fullScreen'> {
  title?: string;
  onClose: () => void;
  children: ReactNode;
  /** Force full screen regardless of screen size */
  forceFullScreen?: boolean;
  /** Show app bar with title on mobile */
  showMobileAppBar?: boolean;
  /** Actions to show in the mobile app bar (right side) */
  mobileAppBarActions?: ReactNode;
}

export function ResponsiveDialog({
  title,
  onClose,
  children,
  forceFullScreen = false,
  showMobileAppBar = true,
  mobileAppBarActions,
  ...dialogProps
}: ResponsiveDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const fullScreen = forceFullScreen || isMobile;

  return (
    <Dialog
      {...dialogProps}
      fullScreen={fullScreen}
      onClose={onClose}
      TransitionComponent={fullScreen ? SlideTransition : undefined}
      sx={{
        '& .MuiDialog-paper': {
          // Ensure dialog doesn't overflow on mobile
          ...(isMobile && {
            margin: 0,
            width: '100%',
            maxHeight: '100%',
          }),
        },
        ...dialogProps.sx,
      }}
    >
      {fullScreen && showMobileAppBar && title && (
        <AppBar sx={{ position: 'relative' }}>
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              onClick={onClose}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
              {title}
            </Typography>
            {mobileAppBarActions}
          </Toolbar>
        </AppBar>
      )}
      <Box
        sx={{
          // Add safe area padding for mobile devices with notches
          ...(fullScreen && {
            pb: 'env(safe-area-inset-bottom)',
            overflowY: 'auto',
          }),
        }}
      >
        {children}
      </Box>
    </Dialog>
  );
}

/**
 * Hook to get responsive dialog props
 * Use this to make existing dialogs responsive without wrapping them
 */
export function useResponsiveDialog() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return {
    isMobile,
    dialogProps: {
      fullScreen: isMobile,
      TransitionComponent: isMobile ? SlideTransition : undefined,
      sx: isMobile ? {
        '& .MuiDialog-paper': {
          margin: 0,
          width: '100%',
          maxHeight: '100%',
        },
      } : undefined,
    },
  };
}

export default ResponsiveDialog;

