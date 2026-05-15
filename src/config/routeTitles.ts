/** Nav labels for browser tab titles: `SLP {pageTitle}` */
const ROUTE_PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/session-calendar': 'Calendar',
  '/sessions': 'Session History',
  '/students': 'Students',
  '/teachers': 'Teachers',
  '/case-managers': 'Case Managers',
  '/schools': 'Schools',
  '/evaluations': 'Evaluations',
  '/soap-notes': 'SOAP Notes',
  '/iep-notes': 'IEP Notes',
  '/ideas': 'Treatment Ideas',
  '/progress': 'Progress Tracking',
  '/progress-reports': 'Progress Reports',
  '/reports': 'Reports',
  '/due-date-items': 'Due Date Items',
  '/documentation': 'Documentation',
  '/communications': 'Communications',
  '/time-tracking': 'Time Tracking',
  '/goal-export': 'Goal export',
  '/session-log': 'MA billing',
  '/goal-mapper': 'Goal mapper',
  '/login': 'Login',
};

const DEFAULT_PAGE_TITLE = 'Caseload Tracker';

/** Browser tab title for a route, e.g. `SLP MA billing`. */
export function formatDocumentTitle(pageTitle: string): string {
  return `SLP ${pageTitle}`;
}

export function getPageTitleForPathname(pathname: string): string {
  if (ROUTE_PAGE_TITLES[pathname]) {
    return ROUTE_PAGE_TITLES[pathname];
  }
  if (/^\/students\/[^/]+$/.test(pathname)) {
    return 'Student';
  }
  return DEFAULT_PAGE_TITLE;
}

export function getDocumentTitleForPathname(pathname: string): string {
  return formatDocumentTitle(getPageTitleForPathname(pathname));
}
