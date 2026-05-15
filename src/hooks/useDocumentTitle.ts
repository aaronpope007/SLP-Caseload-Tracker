import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getDocumentTitleForPathname } from '../config/routeTitles';

/** Sets `document.title` from the current route (e.g. `SLP MA billing`). */
export function useDocumentTitle(): void {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = getDocumentTitleForPathname(pathname);
  }, [pathname]);
}
