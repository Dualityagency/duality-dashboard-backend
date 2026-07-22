export interface ActivityDay {
  day: string;
  created: number;
  completed: number;
  hours: number;
}

export interface ProjectProgress {
  name: string;
  value: number;
  color: string;
}

export interface EmployeeWorkload {
  name: string;
  active: number;
  completed: number;
}

export interface TaskPriority {
  name: string;
  value: number;
  color: string;
}

export interface ProjectProgressItem {
  name: string;
  progress: number;
}

export interface ProjectTypeStat {
  name: string;
  value: number;
}

export interface HoursPerEmployee {
  name: string;
  hours: number;
}

export interface AdminStats {
  activeProjects: number;
  activeProjectsTrend: string;
  completedProjects: number;
  tasksCompletionRate: number;
  tasksCompletionRateTrend: string;
  totalTasks: number;
  completedTasks: number;
  totalWorkedHours: number;
  totalWorkedHoursTrend: string;
  totalRevenue: number;
  totalRevenueTrend: string;
  monthlyRevenue: number;
  activeUsers: number;
  totalEmployees: number;
  totalProjects: number;
  totalFeedbacks: number;
  projectProgress: ProjectProgress[];
  workload: EmployeeWorkload[];
  priority: TaskPriority[];
  globalProgress: ProjectProgressItem[];
  projectTypes: ProjectTypeStat[];
  hoursPerEmployee: HoursPerEmployee[];
}

export interface PageAnalyseKPI {
  projectsActifs: number;
  projectsTermines: number;
  tasksEnCours: number;
  tasksTotale: number;
  tauxCompletion: number;
  heuresTotales: number;
  revenueTotalAnnee: number;
  revenueMois: number;
  weeklyActivity: ActivityDay[];
  projectStatusDistribution: ProjectProgress[];
  workload: EmployeeWorkload[];
  projectGlobalProgress: ProjectProgressItem[];
  priority: TaskPriority[];
  projectTypes: ProjectTypeStat[];
  hoursPerEmployee: HoursPerEmployee[];
  detailedStats: {
    employees: number;
    projects: number;
    tasks: number;
    feedbacks: number;
    totalHours: number;
  };
  feedbackAnalysis: ProjectProgress[];
}





