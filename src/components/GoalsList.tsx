import {
  Grid,
  Typography,
  Card,
  CardContent,
} from '@mui/material';
import type { Goal } from '../types';
import { GoalCard } from './GoalCard';

interface RecentSessionData {
  date: string;
  accuracy?: number;
  correctTrials?: number;
  incorrectTrials?: number;
}

interface GoalsListProps {
  goals: Goal[];
  getRecentPerformance: (goalId: string) => { recentSessions: RecentSessionData[]; average: number | null };
  onEdit: (goal: Goal) => void;
  onDelete: (goalId: string) => void;
  onCopyToSubGoal: (goal: Goal) => void;
  onAddSubGoal: (parentGoalId: string) => void;
  onEditSubGoal: (goal: Goal) => void;
  onDuplicateSubGoal: (goal: Goal) => void;
  onCopySubtree?: (goal: Goal) => void;
}

export const GoalsList = ({
  goals,
  getRecentPerformance,
  onEdit,
  onDelete,
  onCopyToSubGoal,
  onAddSubGoal,
  onEditSubGoal,
  onDuplicateSubGoal,
  onCopySubtree,
}: GoalsListProps) => {
  if (goals.length === 0) {
    return (
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography color="text.secondary" align="center">
              No goals added yet. Click "Add Goal" to create one.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    );
  }

  // Organize goals: main goals first, then sub-goals grouped under parents
  const mainGoals = goals.filter(g => !g.parentGoalId);
  const subGoals = goals.filter(g => g.parentGoalId);
  const subGoalsByParent = new Map<string, Goal[]>();
  subGoals.forEach(sub => {
    const parentId = sub.parentGoalId!;
    if (!subGoalsByParent.has(parentId)) {
      subGoalsByParent.set(parentId, []);
    }
    subGoalsByParent.get(parentId)!.push(sub);
  });

  // Group main goals by domain for better organization
  const goalsByDomain = new Map<string, Goal[]>();
  const goalsWithoutDomain: Goal[] = [];
  mainGoals.forEach(goal => {
    if (goal.domain) {
      if (!goalsByDomain.has(goal.domain)) {
        goalsByDomain.set(goal.domain, []);
      }
      goalsByDomain.get(goal.domain)!.push(goal);
    } else {
      goalsWithoutDomain.push(goal);
    }
  });

  return (
    <>
      {Array.from(goalsByDomain.entries()).map(([domain, domainGoals]) => (
        <Grid item xs={12} key={domain}>
          <Typography variant="h6" sx={{ mb: 1, mt: 1, fontSize: '1.5rem', fontWeight: 'bold' }}>
            {domain}
          </Typography>
          <Grid container spacing={2}>
            {domainGoals.map((goal) => {
              const subs = subGoalsByParent.get(goal.id) || [];
              return (
                <Grid item xs={12} md={6} key={goal.id}>
                  <GoalCard
                    goal={goal}
                    subGoals={subs}
                    allGoals={goals}
                    getRecentPerformance={getRecentPerformance}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onCopyToSubGoal={onCopyToSubGoal}
                    onAddSubGoal={onAddSubGoal}
                    onEditSubGoal={onEditSubGoal}
                    onDuplicateSubGoal={onDuplicateSubGoal}
                    onCopySubtree={onCopySubtree}
                  />
                </Grid>
              );
            })}
          </Grid>
        </Grid>
      ))}
      {goalsWithoutDomain.length > 0 && (
        <Grid item xs={12}>
          {goalsByDomain.size > 0 && (
            <Typography variant="h6" sx={{ mb: 1, mt: 1, fontSize: '1.5rem', fontWeight: 'bold' }}>
              Other Goals
            </Typography>
          )}
          <Grid container spacing={2}>
            {goalsWithoutDomain.map((goal) => {
              const subs = subGoalsByParent.get(goal.id) || [];
              return (
                <Grid item xs={12} md={6} key={goal.id}>
                  <GoalCard
                    goal={goal}
                    subGoals={subs}
                    allGoals={goals}
                    getRecentPerformance={getRecentPerformance}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onCopyToSubGoal={onCopyToSubGoal}
                    onAddSubGoal={onAddSubGoal}
                    onEditSubGoal={onEditSubGoal}
                    onDuplicateSubGoal={onDuplicateSubGoal}
                    onCopySubtree={onCopySubtree}
                  />
                </Grid>
              );
            })}
          </Grid>
        </Grid>
      )}
    </>
  );
};

