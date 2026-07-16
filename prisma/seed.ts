// prisma/seed.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const hashedAdminPassword = await bcrypt.hash('Admin@1234', 10);
  const hashedEmployeePassword = await bcrypt.hash('Employee@123', 10);
  const hashedClientPassword = await bcrypt.hash('Client@123', 10);

  // ─────────────────────────────────────────────
  // Admin
  // ─────────────────────────────────────────────
  const adminEmail = 'admin@duality-agency.com';
  let adminUser = await prisma.utilisateur.findUnique({ where: { email: adminEmail } });
  if (!adminUser) {
    adminUser = await prisma.utilisateur.create({
      data: {
        nom: 'Admin',
        prenom: 'Super',
        email: adminEmail,
        password: hashedAdminPassword,
        role: 'ADMIN',
        telephone: '0601020304',
        admin: { create: {} },
      },
    });
    console.log(`✅ Admin created: ${adminUser.email}`);
  }

  // ─────────────────────────────────────────────
  // Employees
  // ─────────────────────────────────────────────
  const employeesData = [
    { nom: 'Bernard', prenom: 'Lucas', email: 'lucas.bernard@duality-agency.com', poste: 'Développeur Backend' },
    { nom: 'Rousseau', prenom: 'Emma',  email: 'emma.rousseau@duality-agency.com',  poste: 'Analyste Business' },
    { nom: 'Petit',   prenom: 'Thomas', email: 'thomas.petit@duality-agency.com',   poste: 'Scrum Master' },
  ];

  const employees: any[] = [];

  for (const emp of employeesData) {
    let user = await prisma.utilisateur.findUnique({
      where: { email: emp.email },
      include: { employee: true },
    });
    if (!user) {
      user = await prisma.utilisateur.create({
        data: {
          nom: emp.nom,
          prenom: emp.prenom,
          email: emp.email,
          password: hashedEmployeePassword,
          role: 'EMPLOYEE',
          telephone: '0600000000',
          employee: { create: { poste: emp.poste } },
        },
        include: { employee: true },
      });
      console.log(`✅ Employee created: ${user.email}`);
    }
    employees.push(user);
  }

  // employees[0] = lucas (WEB only)
  // employees[1] = emma  (MARKETING only)
  // employees[2] = thomas (WEB only)
  const lucas  = employees[0];
  const emma   = employees[1];
  const thomas = employees[2];

  // ─────────────────────────────────────────────
  // Client
  // ─────────────────────────────────────────────
  const clientEmail = 'client@duality-agency.com';
  let clientUser = await prisma.utilisateur.findUnique({
    where: { email: clientEmail },
    include: { client: true },
  });
  if (!clientUser) {
    clientUser = await prisma.utilisateur.create({
      data: {
        nom: 'Client',
        prenom: 'Alpha',
        email: clientEmail,
        password: hashedClientPassword,
        role: 'CLIENT',
        telephone: '0611223344',
        client: { create: { nomSociete: 'Alpha Corp' } },
      },
      include: { client: true },
    });
    console.log(`✅ Client created: ${clientUser.email}`);
  }
  const clientRecord = clientUser.client!;

  // ─────────────────────────────────────────────
  // Projects
  // ─────────────────────────────────────────────
  const projectsData = [
    {
      nom: 'Refonte Portail RH',
      description: 'Refonte complète du portail RH interne avec une stack moderne.',
      budget: 20000,
      type: 'WEB' as const,
      team: [lucas, thomas],
    },
    {
      nom: 'Campagne Été 2026',
      description: 'Campagne marketing digitale pour la saison estivale 2026.',
      budget: 12000,
      type: 'MARKETING' as const,
      team: [emma],
    },
    {
      nom: 'Application Mobile Livraison',
      description: 'Développement d\'une application mobile de suivi de livraison.',
      budget: 30000,
      type: 'WEB' as const,
      team: [lucas, thomas],
    },
  ];

  const projects: any[] = [];

  for (const pData of projectsData) {
    let p = await prisma.project.findFirst({
      where: { nom: pData.nom, clientId: clientRecord.id },
    });
    if (!p) {
      p = await prisma.project.create({
        data: {
          nom: pData.nom,
          description: pData.description,
          budget: pData.budget,
          dateDebut: new Date(),
          dateFin: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          status: 'ACTIF',
          clientId: clientRecord.id,
        },
      });
      console.log(`✅ Project created: ${p.nom}`);
    }
    projects.push({ ...p, type: pData.type, team: pData.team });
  }

  // projects[0] = Refonte Portail RH      (WEB)
  // projects[1] = Campagne Été 2026        (MARKETING)
  // projects[2] = Application Mobile Livraison (WEB)

  // ─────────────────────────────────────────────
  // Equipe assignments
  // ─────────────────────────────────────────────
  for (const proj of projects) {
    for (const emp of proj.team) {
      if (!emp.employee) continue;
      const exists = await prisma.equipe.findUnique({
        where: { employeeId_projectId: { employeeId: emp.employee.id, projectId: proj.id } },
      });
      if (!exists) {
        await prisma.equipe.create({
          data: { employeeId: emp.employee.id, projectId: proj.id },
        });
        console.log(`✅ ${emp.email} → ${proj.nom}`);
      }
    }
  }

  // ─────────────────────────────────────────────
  // WEB projects → WebProject → Sprints → SprintTasks
  // Sprint task titles are globally unique across all sprints
  // ─────────────────────────────────────────────

  // All sprint task definitions upfront to guarantee uniqueness
  const allSprintTaskDefs: Record<string, { titre: string; priority: number; storyPoints: number; description: string }[]> = {
    'Refonte Portail RH_Sprint 1': [
      { titre: 'Initialisation du dépôt et configuration CI/CD',      priority: 1, storyPoints: 3,  description: 'Mise en place du dépôt Git, pipelines CI/CD et environnements.' },
      { titre: 'Conception de la base de données RH',                  priority: 2, storyPoints: 5,  description: 'Modélisation du schéma Prisma pour les entités RH.' },
      { titre: 'Implémentation de l\'authentification JWT',            priority: 3, storyPoints: 8,  description: 'Mise en place de l\'auth JWT avec refresh tokens.' },
    ],
    'Refonte Portail RH_Sprint 2': [
      { titre: 'Développement des endpoints employés',                 priority: 2, storyPoints: 8,  description: 'CRUD complet pour la gestion des employés.' },
      { titre: 'Intégration du module de congés',                      priority: 3, storyPoints: 13, description: 'Gestion des demandes et validations de congés.' },
      { titre: 'Tableau de bord administrateur RH',                    priority: 1, storyPoints: 5,  description: 'Interface d\'administration avec statistiques RH.' },
    ],
    'Application Mobile Livraison_Sprint 1': [
      { titre: 'Setup React Native et navigation',                     priority: 1, storyPoints: 3,  description: 'Initialisation du projet React Native avec React Navigation.' },
      { titre: 'Écran de suivi de livraison en temps réel',            priority: 3, storyPoints: 13, description: 'Carte interactive avec position du livreur en temps réel.' },
      { titre: 'Système de notifications push',                        priority: 2, storyPoints: 8,  description: 'Intégration des notifications push via Firebase.' },
    ],
    'Application Mobile Livraison_Sprint 2': [
      { titre: 'Module de gestion des commandes',                      priority: 2, storyPoints: 8,  description: 'Liste, détail et historique des commandes client.' },
      { titre: 'Intégration API paiement mobile',                      priority: 3, storyPoints: 13, description: 'Connexion Stripe pour les paiements in-app.' },
      { titre: 'Tests end-to-end et optimisation performances',        priority: 1, storyPoints: 5,  description: 'Suite de tests E2E et profiling des performances.' },
    ],
  };

  const webProjects = projects.filter((p) => p.type === 'WEB');

  for (const proj of webProjects) {
    let webProj = await prisma.webProject.findUnique({ where: { projectId: proj.id } });
    if (!webProj) {
      webProj = await prisma.webProject.create({
        data: { projectId: proj.id, cahierDesCharges: `Cahier des charges pour ${proj.nom}.` },
      });
      console.log(`✅ WebProject created for ${proj.nom}`);
    }

    const sprintsConfig = [
      {
        nom: 'Sprint 1',
        goal: 'Mise en place des fondations techniques',
        status: 'TERMINE' as const,
        dateDebut: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        dateFin: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000),
        velocityPrevue: 20,
        taskKey: `${proj.nom}_Sprint 1`,
      },
      {
        nom: 'Sprint 2',
        goal: 'Développement des fonctionnalités principales',
        status: 'EN_COURS' as const,
        dateDebut: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        dateFin: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        velocityPrevue: 30,
        taskKey: `${proj.nom}_Sprint 2`,
      },
    ];

    // WEB team members for task assignment (lucas & thomas only)
    const webTeamEmployeeIds = proj.team
      .filter((m: any) => m.employee)
      .map((m: any) => m.employee.id as number);

    for (const sc of sprintsConfig) {
      let sprint = await prisma.sprint.findFirst({
        where: { nom: sc.nom, webProjectId: webProj.id },
      });
      if (!sprint) {
        sprint = await prisma.sprint.create({
          data: {
            nom: sc.nom,
            goal: sc.goal,
            status: sc.status,
            dateDebut: sc.dateDebut,
            dateFin: sc.dateFin,
            velocityPrevue: sc.velocityPrevue,
            webProjectId: webProj.id,
          },
        });
        console.log(`✅ Sprint created: ${sc.nom} (${proj.nom})`);
      }

      const taskDefs = allSprintTaskDefs[sc.taskKey] ?? [];

      for (let i = 0; i < taskDefs.length; i++) {
        const td = taskDefs[i];
        const exists = await prisma.sprintTask.findFirst({
          where: { titre: td.titre, sprintId: sprint.id },
        });
        if (!exists) {
          // Alternate between lucas and thomas
          const assignedEmployeeId = webTeamEmployeeIds[i % webTeamEmployeeIds.length] ?? null;
          const taskStatus = sprint.status === 'TERMINE' ? 'TERMINE' as const : (i === 0 ? 'EN_COURS' as const : 'A_FAIRE' as const);

          const sprintTask = await prisma.sprintTask.create({
            data: {
              titre: td.titre,
              status: taskStatus,
              priority: td.priority === 1 ? 'BASSE' : td.priority === 2 ? 'MOYENNE' : 'HAUTE',
              storyPoints: td.storyPoints,
              description: td.description,
              dateFin: new Date(sprint.dateFin),
              sprintId: sprint.id,
              employeeId: assignedEmployeeId,
            },
          });
          console.log(`  ✅ SprintTask: ${sprintTask.titre}`);

          if (sprintTask.status === 'TERMINE') {
            const timerExists = await prisma.timerTask.findFirst({ where: { sprintTaskId: sprintTask.id } });
            if (!timerExists) {
              await prisma.timerTask.create({
                data: {
                  sprintTaskId: sprintTask.id,
                  startTime: new Date(Date.now() - 5 * 60 * 60 * 1000),
                  endTime: new Date(Date.now() - 3 * 60 * 60 * 1000),
                },
              });
            }
          }
        }
      }
    }
  }

  // ─────────────────────────────────────────────
  // MARKETING project → MarketingProject → Tasks
  // All assigned to emma only
  // ─────────────────────────────────────────────
  const marketingProjects = projects.filter((p) => p.type === 'MARKETING');

  for (const proj of marketingProjects) {
    let mktProj = await prisma.marketingProject.findUnique({ where: { projectId: proj.id } });
    if (!mktProj) {
      mktProj = await prisma.marketingProject.create({
        data: { projectId: proj.id },
      });
      console.log(`✅ MarketingProject created for ${proj.nom}`);
    }

    const emmaEmployeeId = emma.employee?.id ?? null;

    const marketingTasksData = [
      {
        titre: 'Stratégie de contenu réseaux sociaux',
        description: 'Définir et planifier la stratégie éditoriale pour tous les réseaux sociaux de la campagne.',
        status: 'TERMINE' as const,
        priority: 'HAUTE' as const,
        estimatedHours: 8,
        tags: ['Social-media', 'Stratégie'],
        dateDebut: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        dateFin: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        employeeId: emmaEmployeeId,
        aiSuggestions: {
          subtasks: [
            'Analyser les concurrents sur les réseaux',
            'Définir la ligne éditoriale',
            'Créer un calendrier éditorial mensuel',
            'Préparer les templates visuels',
          ],
          estimatedDuration: '480 minutes',
          suggestedPriority: 'HAUTE' as const,
          tips: [
            'Utiliser des outils comme Hootsuite pour planifier',
            'Varier les formats de contenu',
            'Analyser les métriques hebdomadairement',
          ],
        },
      },
      {
        titre: 'Lancement campagne Google Ads été',
        description: 'Configurer et optimiser les campagnes Google Ads pour maximiser le ROI estival.',
        status: 'EN_COURS' as const,
        priority: 'URGENTE' as const,
        estimatedHours: 12,
        tags: ['Ads', 'Google', 'ROI'],
        dateDebut: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        dateFin: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        employeeId: emmaEmployeeId,
        aiSuggestions: {
          subtasks: [
            'Définir les mots-clés cibles',
            'Créer les annonces textuelles',
            'Configurer le suivi des conversions',
            'Optimiser les enchères',
          ],
          estimatedDuration: '720 minutes',
          suggestedPriority: 'URGENTE' as const,
          tips: [
            'Commencer avec un budget test de 500€',
            'Utiliser les extensions d\'annonces',
            'A/B tester les titres des annonces',
          ],
        },
      },
      {
        titre: 'Analyse du marché cible été 2026',
        description: 'Étude approfondie du marché cible et des tendances consommateurs pour l\'été 2026.',
        status: 'A_FAIRE' as const,
        priority: 'MOYENNE' as const,
        estimatedHours: 6,
        tags: ['Analyse', 'Marché'],
        dateDebut: new Date(),
        dateFin: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        employeeId: emmaEmployeeId,
        aiSuggestions: null,
      },
    ];

    for (const td of marketingTasksData) {
      const exists = await prisma.task.findFirst({
        where: { titre: td.titre, marketingProjectId: mktProj.id },
      });
      if (!exists) {
        if (!td.employeeId) {
          console.log(`  ⚠️ Skipping "${td.titre}" — no employee found`);
          continue;
        }

        const task = await prisma.task.create({
          data: {
            titre: td.titre,
            description: td.description,
            status: td.status,
            priority: td.priority,
            estimatedHours: td.estimatedHours,
            tags: td.tags,
            dateDebut: td.dateDebut,
            dateFin: td.dateFin,
            marketingProjectId: mktProj.id,
            employeeId: td.employeeId,
          },
        });
        console.log(`  ✅ Task: ${task.titre}`);

        if (td.aiSuggestions) {
          await prisma.taskAssistantIA.create({
            data: {
              taskId: task.id,
              subtasks: td.aiSuggestions.subtasks,
              estimatedDuration: td.aiSuggestions.estimatedDuration,
              suggestedPriority: td.aiSuggestions.suggestedPriority,
              tips: td.aiSuggestions.tips,
            },
          });
          console.log(`    ✅ TaskAssistantIA seeded for "${task.titre}"`);
        }

        if (task.status === 'TERMINE') {
          await prisma.timerTask.create({
            data: {
              taskId: task.id,
              startTime: new Date(Date.now() - 8 * 60 * 60 * 1000),
              endTime: new Date(Date.now() - 6 * 60 * 60 * 1000),
            },
          });
          console.log(`    ✅ TimerTask seeded for Task "${task.titre}"`);
        }

        await prisma.file.createMany({
          data: [
            { name: `brief_${task.id}.pdf`,    url: `/uploads/brief_${task.id}.pdf`,    taskId: task.id },
            { name: `rapport_${task.id}.docx`, url: `/uploads/rapport_${task.id}.docx`, taskId: task.id },
          ],
        });
        console.log(`    ✅ Files seeded for Task "${task.titre}"`);
      }
    }
  }

  // ─────────────────────────────────────────────
  // Avis
  // ─────────────────────────────────────────────
  const avisData = [
    { projectIdx: 0, description: 'Excellent travail sur la refonte du portail RH !' },
    { projectIdx: 1, description: 'Très bonne campagne marketing pour l\'été 2026.' },
    { projectIdx: 2, description: 'L\'application mobile livraison démarre très bien.' },
    { projectIdx: 0, description: 'Excellent travail sur Project Alpha !', etoiles: 5 },
    { projectIdx: 1, description: 'Bonne campagne marketing pour Project Beta.', etoiles: 4 },
    { projectIdx: 2, description: 'Project Gamma démarre bien.', etoiles: 5 },
  ];

  for (const av of avisData) {
    const proj = projects[av.projectIdx];
    const exists = await prisma.feedback.findFirst({
      where: { clientId: clientRecord.id, projectId: proj.id },
    });
    if (!exists) {
      await prisma.feedback.create({
        data: { 
          description: av.description, 
          clientId: clientRecord.id, 
          projectId: proj.id,
          etoiles: (av as any).etoiles || 5
        },
      });
      console.log(`✅ Feedback seeded for ${proj.nom}`);
    }
  }

  // ─────────────────────────────────────────────
  // Notifications
  // ─────────────────────────────────────────────
  const notificationsData = [
    { userId: adminUser.id,  titre: 'Nouveau projet créé',   description: 'Refonte Portail RH a été créé.' },
    { userId: lucas.id,      titre: 'Tâche assignée',        description: 'Vous avez été assigné à "Initialisation du dépôt et configuration CI/CD".' },
    { userId: thomas.id,     titre: 'Sprint démarré',        description: 'Le Sprint 2 de Refonte Portail RH a commencé.' },
    { userId: clientUser.id, titre: 'Projet en cours',       description: 'Campagne Été 2026 est en cours.' },
    { userId: emma.id,       titre: 'Rappel deadline',       description: 'La deadline de "Lancement campagne Google Ads été" approche dans 25 jours.', etat: 'LUE' as const },
  ];

  for (const notif of notificationsData) {
    const exists = await prisma.notification.findFirst({
      where: { utilisateurId: notif.userId, titre: notif.titre },
    });
    if (!exists) {
      await prisma.notification.create({
        data: {
          titre: notif.titre,
          description: notif.description,
          etat: notif.etat ?? 'NON_LUE',
          utilisateurId: notif.userId,
        },
      });
    }
  }
  console.log(`✅ Notifications seeded`);

  // ─────────────────────────────────────────────
  // Conversations
  // ─────────────────────────────────────────────
  for (const proj of projects) {
    let projConv = await prisma.conversation.findFirst({
      where: { type: 'PROJECT', projectId: proj.id },
    });

    if (!projConv) {
      const equipeMembers = await prisma.equipe.findMany({
        where: { projectId: proj.id },
        include: { employee: true },
      });

      const participantData = [
        { utilisateurId: clientUser.id },
        { utilisateurId: adminUser.id },
        ...equipeMembers.map((eq: any) => ({ utilisateurId: eq.employee.utilisateurId })),
      ];

      const seen = new Set<number>();
      const uniqueParticipants = participantData.filter((p) => {
        if (seen.has(p.utilisateurId)) return false;
        seen.add(p.utilisateurId);
        return true;
      });

      projConv = await prisma.conversation.create({
        data: {
          type: 'PROJECT',
          projectId: proj.id,
          createdBy: adminUser.id,
          lastMessageAt: new Date(),
          participants: { create: uniqueParticipants },
        },
      });

      await prisma.message.createMany({
        data: [
          { content: `Bienvenue dans le chat du projet ${proj.nom} !`, senderId: clientUser.id, conversationId: projConv.id },
          { content: `Bonjour l'équipe ! Je suis prêt à démarrer ${proj.nom}.`, senderId: adminUser.id, conversationId: projConv.id },
        ],
      });
      console.log(`✅ Project Conversation + Messages seeded for ${proj.nom}`);
    }
  }

  // Direct: Admin ↔ Lucas
  const directConv1 = await prisma.conversation.findFirst({
    where: { type: 'DIRECT', participants: { some: { utilisateurId: adminUser.id } } },
  });
  if (!directConv1) {
    const conv = await prisma.conversation.create({
      data: {
        type: 'DIRECT',
        createdBy: adminUser.id,
        lastMessageAt: new Date(),
        participants: {
          create: [
            { utilisateurId: adminUser.id },
            { utilisateurId: lucas.id },
          ],
        },
      },
    });
    await prisma.message.createMany({
      data: [
        { content: 'Bonjour Lucas, bienvenue dans l\'équipe !', senderId: adminUser.id, conversationId: conv.id },
        { content: 'Merci ! Je suis prêt à démarrer.', senderId: lucas.id, conversationId: conv.id },
      ],
    });
    console.log(`✅ Direct conversation seeded: Admin ↔ ${lucas.email}`);
  }

  // Direct: Client ↔ Emma
  const directConv2 = await prisma.conversation.findFirst({
    where: { type: 'DIRECT', participants: { some: { utilisateurId: clientUser.id } } },
  });
  if (!directConv2) {
    const conv = await prisma.conversation.create({
      data: {
        type: 'DIRECT',
        createdBy: clientUser.id,
        lastMessageAt: new Date(),
        participants: {
          create: [
            { utilisateurId: clientUser.id },
            { utilisateurId: emma.id },
          ],
        },
      },
    });
    await prisma.message.createMany({
      data: [
        { content: 'Bonjour Emma, merci de bien vouloir examiner les exigences de la campagne.', senderId: clientUser.id, conversationId: conv.id },
        { content: 'Bien reçu ! Je reviens vers vous très vite.', senderId: emma.id, conversationId: conv.id },
      ],
    });
    console.log(`✅ Direct conversation seeded: Client ↔ ${emma.email}`);
  }

  console.log('\n🎉 Seed terminé ! Toutes les tables sont peuplées.');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
