export const TASK_DETAIL_INCLUDE = {
  employee: { include: { utilisateur: true } },
  timerTask: true,
  files: true,
  conversations: { include: { messages: true } },
  blockedByTask: { select: { id: true, titre: true } },
  marketingProject: { include: { project: true } },
  assistantIA: true,
};

export const TASK_LIST_INCLUDE = {
  employee: { include: { utilisateur: true } },
  timerTask: true,
  blockedByTask: { select: { id: true, titre: true } },
  marketingProject: { include: { project: true } },
  assistantIA: true,
  feedbackRequests: { select: { id: true, status: true } },
};

export const SPRINT_TASK_DETAIL_INCLUDE = {
  employee: { include: { utilisateur: true } },
  timerTask: true,
  files: true,
  sprint: {
    include: {
      webProject: {
        include: { project: true },
      },
    },
  },
};
