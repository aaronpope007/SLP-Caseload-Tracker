import { memo, useMemo } from 'react';
import { Grid } from '@mui/material';
import type { Session } from '../types';
import { SessionCard } from './SessionCard';
import { GroupSessionAccordion } from './GroupSessionAccordion';

interface SessionsListProps {
  sessions: Session[];
  getStudentName: (studentId: string) => string;
  getGoalDescription: (goalId: string) => string;
  onEdit: (session?: Session, groupSessionId?: string) => void;
  onDelete: (sessionId: string) => void;
  onGenerateSOAP: (session: Session) => void;
}

export const SessionsList = memo(({
  sessions,
  getStudentName,
  getGoalDescription,
  onEdit,
  onDelete,
  onGenerateSOAP,
}: SessionsListProps) => {
  // Create a combined array of all session entries, sorted chronologically (most recent first)
  interface SessionDisplayItem {
    type: 'group' | 'individual';
    groupSessionId?: string;
    groupSessions?: Session[];
    session?: Session;
    date: string; // For sorting
  }

  // Memoize the expensive grouping and sorting operation
  const allSessionItems = useMemo<SessionDisplayItem[]>(() => {
    // Group sessions by groupSessionId
    const groupedSessions = new Map<string, Session[]>();
    const individualSessions: Session[] = [];

    sessions.forEach((session) => {
      if (session.groupSessionId) {
        if (!groupedSessions.has(session.groupSessionId)) {
          groupedSessions.set(session.groupSessionId, []);
        }
        groupedSessions.get(session.groupSessionId)!.push(session);
      } else {
        individualSessions.push(session);
      }
    });

    const items: SessionDisplayItem[] = [];

    // Add group sessions (one entry per group)
    groupedSessions.forEach((groupSessions, groupSessionId) => {
      const firstSession = groupSessions[0];
      items.push({
        type: 'group',
        groupSessionId,
        groupSessions,
        date: firstSession.date,
      });
    });

    // Add individual sessions
    individualSessions.forEach((session) => {
      items.push({
        type: 'individual',
        session,
        date: session.date,
      });
    });

    // Sort all items by date (most recent first)
    items.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA; // Most recent first
    });

    return items;
  }, [sessions]);

  // Helper function to render a single session
  const renderSession = (session: Session) => (
    <SessionCard
      key={session.id}
      session={session}
      getStudentName={getStudentName}
      getGoalDescription={getGoalDescription}
      onEdit={onEdit}
      onDelete={onDelete}
      onGenerateSOAP={onGenerateSOAP}
    />
  );

  return (
    <>
      {allSessionItems.map((item) => {
        if (item.type === 'group' && item.groupSessions && item.groupSessionId) {
          return (
            <Grid item xs={12} key={item.groupSessionId}>
              <GroupSessionAccordion
                groupSessionId={item.groupSessionId}
                groupSessions={item.groupSessions}
                getStudentName={getStudentName}
                renderSession={renderSession}
                onEdit={(groupSessionId) => onEdit(undefined, groupSessionId)}
              />
            </Grid>
          );
        } else if (item.type === 'individual' && item.session) {
          return (
            <Grid item xs={12} key={item.session.id}>
              {renderSession(item.session)}
            </Grid>
          );
        }
        return null;
      })}
    </>
  );
});

