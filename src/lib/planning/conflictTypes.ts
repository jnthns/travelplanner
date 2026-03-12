export type PlanningConflictSeverity = 'info' | 'warning';

export type PlanningConflictScope = 'trip' | 'day' | 'route' | 'budget';

export interface PlanningConflict {
  id: string;
  type: string;
  scope: PlanningConflictScope;
  severity: PlanningConflictSeverity;
  title: string;
  message: string;
  date?: string;
  routeId?: string;
}
