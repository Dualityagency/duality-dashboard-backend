import { Prisma, TaskPriority } from '@prisma/client';
import { TaskType } from '../dto/start-timer.dto';
import { TASK_DETAIL_INCLUDE, TASK_LIST_INCLUDE, SPRINT_TASK_DETAIL_INCLUDE } from '../constants/task.constants';

export function computeRelativeTime(dateFin: Date | null | undefined): string {
  if (!dateFin) return 'Aucune deadline';

  const now = new Date();
  const diffMs = dateFin.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffHours / 24);

  if (diffMs < 0) {
    if (Math.abs(diffHours) < 24) return `il y a environ ${Math.abs(diffHours)} heures`;
    return `il y a ${Math.abs(diffDays)} jours`;
  } else {
    if (diffHours < 24) return `Dans environ ${diffHours} heures`;
    return `Dans ${diffDays} jours`;
  }
}

export const PRIORITY_COLOR_MAP: Record<string, string> = {
  BASSE: 'bg-[#F3F4F6] text-[#364153]',
  MOYENNE: 'bg-[#DBEAFE] text-[#3447E6]',
  HAUTE: 'bg-[#FFEDD4] text-[#CD3500]',
  URGENTE: 'bg-[#FFC9C9] text-[#C10108]',
};

export const PRIORITY_ACCENT_MAP: Record<string, string> = {
  BASSE: '#D1D5DB',
  MOYENNE: '#3B82F6',
  HAUTE: '#F59E0B',
  URGENTE: '#F43F5E',
};

export const PRIORITY_LABEL_MAP: Record<string, string> = {
  BASSE: 'Basse',
  MOYENNE: 'Moyenne',
  HAUTE: 'Haute',
  URGENTE: 'Urgente',
};

export function mapIntPriorityToLabel(priority: number): string {
  switch (priority) {
    case 1: return 'Basse';
    case 2: return 'Moyenne';
    case 3: return 'Haute';
    case 4: return 'Urgente';
    default: return 'Basse';
  }
}

export function mapTaskPriorityToInt(priority: TaskPriority): number {
  switch (priority) {
    case TaskPriority.BASSE: return 1;
    case TaskPriority.MOYENNE: return 2;
    case TaskPriority.HAUTE: return 3;
    case TaskPriority.URGENTE: return 4;
    default: return 1;
  }
}

export function mapIntToTaskPriority(priority: number): TaskPriority {
  switch (priority) {
    case 1: return TaskPriority.BASSE;
    case 2: return TaskPriority.MOYENNE;
    case 3: return TaskPriority.HAUTE;
    case 4: return TaskPriority.URGENTE;
    default: return TaskPriority.BASSE;
  }
}

export function mapTaskToFrontend(task: Prisma.TaskGetPayload<{ include: typeof TASK_DETAIL_INCLUDE }>) {
  const isOverdue = task.dateFin ? task.dateFin < new Date() && task.status !== 'TERMINE' : false;
  
  const feedbacks = task.conversations
    ? task.conversations.reduce((acc: number, conv: any) => acc + (conv.messages?.length || 0), 0)
    : undefined;

  const attachments = task.files
    ? task.files.map((file: any) => ({
        name: file.name,
        size: '', 
        date: new Intl.DateTimeFormat('fr-FR').format(file.createdAt),
      }))
    : [];

  const timerTasks = Array.isArray(task.timerTask) ? task.timerTask : (task.timerTask ? [task.timerTask] : []);
  const activeTimer = timerTasks.find((t: any) => !t.endTime);
  const mostRecentTimer = timerTasks.length > 0 
    ? timerTasks.reduce((prev: any, curr: any) => 
        (new Date(curr.startTime).getTime() > new Date(prev.startTime).getTime() ? curr : prev)
      )
    : null;
  const resolvedTimerTask = activeTimer || mostRecentTimer;

  return {
    id: task.id,
    type: 'MARKETING',
    marketingProjectId: task.marketingProjectId,
    title: task.titre,
    description: task.description,
    project: task.marketingProject?.project?.nom || undefined,
    time: computeRelativeTime(task.dateFin),
    priority: task.priority,
    priorityColor: PRIORITY_COLOR_MAP[task.priority],
    leftAccentColor: PRIORITY_ACCENT_MAP[task.priority],
    estimatedHours: task.estimatedHours ?? undefined,
    isRunning: timerTasks.some((t: any) => !t.endTime),
    isOverdue,
    files: task.files?.length > 0 ? `${task.files.length} Fichier${task.files.length > 1 ? 's' : ''}` : undefined,
    feedbacks: feedbacks > 0 ? `${feedbacks} Feedback${feedbacks > 1 ? 's' : ''}` : undefined,
    tags: task.tags || [],
    timerTask: resolvedTimerTask,
    deadline: task.dateFin ? task.dateFin.toISOString().split('T')[0] : undefined,
    status: task.status,
    attachments,
    assignedMemberIds: task.employee ? [task.employee.utilisateurId] : [], 
    assignedMembers: task.employee ? [{ 
      id: task.employee.utilisateurId, 
      name: `${task.employee.utilisateur.prenom} ${task.employee.utilisateur.nom}`, 
      email: task.employee.utilisateur.email, 
      avatar: task.employee.utilisateur.avatar ?? null,
    }] : [], 
    blockedBy: task.blockedByTask?.titre,
    aiSuggestions: task.assistantIA || undefined,
  };
}

export function mapSprintTaskToFrontend(task: Prisma.SprintTaskGetPayload<{ include: typeof SPRINT_TASK_DETAIL_INCLUDE }>) {
  const isOverdue = task.dateFin ? task.dateFin < new Date() && task.status !== 'TERMINE' : false;
  
  const attachments = (task as any).files
    ? (task as any).files.map((file: any) => ({
        name: file.name,
        size: '', 
        date: new Intl.DateTimeFormat('fr-FR').format(file.createdAt),
      }))
    : [];

  const timerTasks = Array.isArray(task.timerTask) ? task.timerTask : (task.timerTask ? [task.timerTask] : []);
  const activeTimer = timerTasks.find((t: any) => !t.endTime);
  const mostRecentTimer = timerTasks.length > 0 
    ? timerTasks.reduce((prev: any, curr: any) => 
        (new Date(curr.startTime).getTime() > new Date(prev.startTime).getTime() ? curr : prev)
      )
    : null;
  const resolvedTimerTask = activeTimer || mostRecentTimer;

  const priorityName = task.priority;

  return {
    id: task.id,
    type: TaskType.SPRINT,
    title: task.titre,
    description: task.description,
    project: task.sprint?.webProject?.project?.nom || undefined,
    time: computeRelativeTime(task.dateFin),
    priority: priorityName,
    priorityColor: PRIORITY_COLOR_MAP[priorityName] || PRIORITY_COLOR_MAP['BASSE'],
    leftAccentColor: PRIORITY_ACCENT_MAP[priorityName] || PRIORITY_ACCENT_MAP['BASSE'],
    storyPoints: task.storyPoints,
    isRunning: activeTimer ? true : false,
    isOverdue,
    files: (task as any).files?.length > 0 ? `${(task as any).files.length} Fichier${(task as any).files.length > 1 ? 's' : ''}` : undefined,
    timerTask: resolvedTimerTask,
    deadline: task.dateFin ? task.dateFin.toISOString().split('T')[0] : undefined,
    status: task.status,
    attachments,
    assignedMemberIds: task.employee ? [task.employee.utilisateurId] : [], 
    assignedMembers: task.employee ? [{ 
      id: task.employee.utilisateurId, 
      name: `${task.employee.utilisateur.prenom} ${task.employee.utilisateur.nom}`, 
      email: task.employee.utilisateur.email, 
      avatar: task.employee.utilisateur.avatar ?? null,
    }] : [], 
  };
}
