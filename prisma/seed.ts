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
  const allSprintTaskDefs: Record<string, { titre: string; priority: number; storyPoints: number; description: string; overrideDateFin?: Date }[]> = {
    'Refonte Portail RH_Sprint 1': [
      { titre: 'Initialisation du dépôt et configuration CI/CD',      priority: 1, storyPoints: 3,  description: 'Mise en place du dépôt Git, pipelines CI/CD et environnements.' },
      { titre: 'Conception de la base de données RH',                  priority: 2, storyPoints: 5,  description: 'Modélisation du schéma Prisma pour les entités RH.' },
      { titre: 'Implémentation de l\'authentification JWT',            priority: 3, storyPoints: 8,  description: 'Mise en place de l\'auth JWT avec refresh tokens.' },
    ],
    'Refonte Portail RH_Sprint 2': [
      { titre: 'Développement des endpoints employés',                 priority: 2, storyPoints: 8,  description: 'CRUD complet pour la gestion des employés.',          overrideDateFin: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      { titre: 'Intégration du module de congés',                      priority: 3, storyPoints: 13, description: 'Gestion des demandes et validations de congés.',        overrideDateFin: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
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
              dateFin: td.overrideDateFin ?? new Date(sprint.dateFin),
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
            // Second session — 7 days ago, 90 minutes
            const timer2Exists = await prisma.timerTask.findFirst({
              where: {
                sprintTaskId: sprintTask.id,
                startTime: {
                  gte: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
                  lte: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
                },
                endTime: { not: null },
              },
            });
            if (!timer2Exists) {
              await prisma.timerTask.create({
                data: {
                  sprintTaskId: sprintTask.id,
                  startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                  endTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
                },
              });
            }
          }
        }
      }
    }
  }

  // ─────────────────────────────────────────────
  // Extra sprint tasks for Lucas's dashboard
  // ─────────────────────────────────────────────
  if (lucas.employee) {
    const rhProject = projects.find((p) => p.nom === 'Refonte Portail RH');
    if (rhProject) {
      const rhWebProj = await prisma.webProject.findUnique({ where: { projectId: rhProject.id } });
      if (rhWebProj) {
        const sprint2 = await prisma.sprint.findFirst({ where: { nom: 'Sprint 2', webProjectId: rhWebProj.id } });
        if (sprint2) {
          // Today task
          const todayEnd = new Date();
          todayEnd.setHours(23, 59, 59, 0);
          const todayTaskExists = await prisma.sprintTask.findFirst({
            where: { titre: 'Revue de code et documentation API', sprintId: sprint2.id },
          });
          let todayTask: any = todayTaskExists;
          if (!todayTaskExists) {
            todayTask = await prisma.sprintTask.create({
              data: {
                titre: 'Revue de code et documentation API',
                status: 'EN_COURS',
                priority: 'HAUTE',
                dateFin: todayEnd,
                employeeId: lucas.employee.id,
                storyPoints: 5,
                description: 'Relecture du code backend et mise à jour de la documentation Swagger.',
                sprintId: sprint2.id,
              },
            });
            console.log(`  ✅ SprintTask (today): ${todayTask.titre}`);
          }
          // Timer session for today task (2h ago → 1h ago)
          if (todayTask) {
            const todayTimerExists = await prisma.timerTask.findFirst({
              where: {
                sprintTaskId: todayTask.id,
                startTime: { gte: new Date(Date.now() - 3 * 60 * 60 * 1000) },
                endTime: { not: null },
              },
            });
            if (!todayTimerExists) {
              await prisma.timerTask.create({
                data: {
                  sprintTaskId: todayTask.id,
                  startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
                  endTime: new Date(Date.now() - 1 * 60 * 60 * 1000),
                },
              });
              console.log(`    ✅ TimerTask seeded for today task "${todayTask.titre}"`);
            }
          }

          // Upcoming deadline task (4 days from now)
          const upcomingExists = await prisma.sprintTask.findFirst({
            where: { titre: 'Optimisation des requêtes Prisma', sprintId: sprint2.id },
          });
          if (!upcomingExists) {
            const upcoming = await prisma.sprintTask.create({
              data: {
                titre: 'Optimisation des requêtes Prisma',
                status: 'A_FAIRE',
                priority: 'MOYENNE',
                dateFin: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
                employeeId: lucas.employee.id,
                storyPoints: 3,
                description: 'Identifier et optimiser les requêtes N+1 dans le module employés.',
                sprintId: sprint2.id,
              },
            });
            console.log(`  ✅ SprintTask (upcoming): ${upcoming.titre}`);
          }
        }
      }
    }
  }

  // ─────────────────────────────────────────────
  // MARKETING project → MarketingProject → Tasks
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
          // Session 2 — 3 days ago, 45 minutes
          const timer2Exists = await prisma.timerTask.findFirst({
            where: {
              taskId: task.id,
              startTime: {
                gte: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
                lte: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
              },
            },
          });
          if (!timer2Exists) {
            await prisma.timerTask.create({
              data: {
                taskId: task.id,
                startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                endTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000),
              },
            });
          }
          // Session 3 — yesterday, 30 minutes
          const timer3Exists = await prisma.timerTask.findFirst({
            where: {
              taskId: task.id,
              startTime: {
                gte: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                lte: new Date(Date.now() - 12 * 60 * 60 * 1000),
              },
            },
          });
          if (!timer3Exists) {
            await prisma.timerTask.create({
              data: {
                taskId: task.id,
                startTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
                endTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
              },
            });
          }
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
  // Extra timer sessions for EN_COURS tasks
  // ─────────────────────────────────────────────

  // EN_COURS marketing task: "Lancement campagne Google Ads été"
  // — one completed session yesterday (60 min) + one active session (no endTime)
  const adsTask = await prisma.task.findFirst({
    where: { titre: 'Lancement campagne Google Ads été' },
  });
  if (adsTask) {
    const adsTimer1Exists = await prisma.timerTask.findFirst({
      where: { taskId: adsTask.id, startTime: { gte: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }, endTime: { not: null } },
    });
    if (!adsTimer1Exists) {
      await prisma.timerTask.create({
        data: {
          taskId: adsTask.id,
          startTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          endTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        },
      });
      console.log(`✅ Completed timer session seeded for "${adsTask.titre}"`);
    }
    const adsActiveExists = await prisma.timerTask.findFirst({
      where: { taskId: adsTask.id, endTime: null },
    });
    if (!adsActiveExists) {
      await prisma.timerTask.create({
        data: {
          taskId: adsTask.id,
          startTime: new Date(Date.now() - 15 * 60 * 1000), // started 15 min ago
          endTime: null,
        },
      });
      console.log(`✅ Active timer session seeded for "${adsTask.titre}"`);
    }
  }

  // EN_COURS sprint tasks (first task of Sprint 2 in each web project, status EN_COURS)
  // — one completed session from 2 days ago (45 minutes)
  for (const proj of webProjects) {
    const webProj = await prisma.webProject.findUnique({ where: { projectId: proj.id } });
    if (!webProj) continue;
    const sprint2 = await prisma.sprint.findFirst({ where: { nom: 'Sprint 2', webProjectId: webProj.id } });
    if (!sprint2) continue;
    const enCoursTask = await prisma.sprintTask.findFirst({
      where: { sprintId: sprint2.id, status: 'EN_COURS' },
    });
    if (enCoursTask) {
      const sessionExists = await prisma.timerTask.findFirst({
        where: { sprintTaskId: enCoursTask.id, endTime: { not: null } },
      });
      if (!sessionExists) {
        await prisma.timerTask.create({
          data: {
            sprintTaskId: enCoursTask.id,
            startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000),
          },
        });
        console.log(`✅ Completed timer session seeded for sprint task "${enCoursTask.titre}"`);
      }
    }
  }

  // ─────────────────────────────────────────────
  // Analytics timer data — weekly spread for Lucas & Emma
  // ─────────────────────────────────────────────

  // Helper: seed a timer session idempotently using a narrow time window
  const seedTimer = async (opts: {
    sprintTaskId?: number;
    taskId?: number;
    daysAgo: number;
    offsetHours: number;
    durationMinutes: number;
  }) => {
    const start = new Date(Date.now() - opts.daysAgo * 24 * 60 * 60 * 1000 + opts.offsetHours * 60 * 60 * 1000);
    const end = new Date(start.getTime() + opts.durationMinutes * 60 * 1000);
    const windowStart = new Date(start.getTime() - 30 * 60 * 1000);
    const windowEnd = new Date(start.getTime() + 30 * 60 * 1000);
    const where: any = { startTime: { gte: windowStart, lte: windowEnd }, endTime: { not: null } };
    if (opts.sprintTaskId) where.sprintTaskId = opts.sprintTaskId;
    if (opts.taskId) where.taskId = opts.taskId;
    const exists = await prisma.timerTask.findFirst({ where });
    if (!exists) {
      await prisma.timerTask.create({
        data: {
          ...(opts.sprintTaskId ? { sprintTaskId: opts.sprintTaskId } : {}),
          ...(opts.taskId ? { taskId: opts.taskId } : {}),
          startTime: start,
          endTime: end,
        },
      });
    }
  };

  // ── Lucas: weekly spread across all his sprint tasks ──────────────────────
  if (lucas.employee) {
    // Fetch all sprint tasks assigned to Lucas
    const lucasTasks = await prisma.sprintTask.findMany({
      where: { employeeId: lucas.employee.id },
      orderBy: { id: 'asc' },
    });

    // Sessions spread: [daysAgo, offsetHours, durationMinutes]
    const lucasSchedule: [number, number, number][] = [
      [6, 9,  90],
      [6, 14, 45],
      [5, 10, 60],
      [5, 15, 30],
      [4, 9,  120],
      [3, 11, 75],
      [3, 16, 45],
      [2, 9,  60],
      [2, 14, 90],
      [1, 10, 45],
      [1, 15, 60],
      [0, 9,  30],
      [0, 13, 75],
    ];

    for (let i = 0; i < lucasSchedule.length; i++) {
      const task = lucasTasks[i % lucasTasks.length];
      if (!task) continue;
      const [daysAgo, offsetHours, durationMinutes] = lucasSchedule[i];
      await seedTimer({ sprintTaskId: task.id, daysAgo, offsetHours, durationMinutes });
    }
    console.log(`✅ Weekly timer sessions seeded for Lucas`);

    // Make 2 more of Lucas's A_FAIRE tasks overdue
    const lucasAFaireTasks = await prisma.sprintTask.findMany({
      where: { employeeId: lucas.employee.id, status: 'A_FAIRE' },
      orderBy: { id: 'asc' },
      take: 2,
    });
    for (const t of lucasAFaireTasks) {
      const alreadyLate = t.dateFin < new Date();
      if (!alreadyLate) {
        await prisma.sprintTask.update({
          where: { id: t.id },
          data: { dateFin: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
        });
        console.log(`✅ Made sprint task overdue: "${t.titre}"`);
      }
    }
  }

  // ── Emma: weekly spread across her marketing tasks ────────────────────────
  if (emma.employee) {
    const emmaTasks = await prisma.task.findMany({
      where: { employeeId: emma.employee.id },
      orderBy: { id: 'asc' },
    });

    const emmaSchedule: [number, number, number][] = [
      [6, 9,  60],
      [5, 10, 90],
      [5, 15, 30],
      [4, 9,  75],
      [3, 11, 45],
      [3, 14, 60],
      [2, 10, 90],
      [1, 9,  30],
      [1, 14, 60],
      [0, 10, 45],
    ];

    for (let i = 0; i < emmaSchedule.length; i++) {
      const task = emmaTasks[i % emmaTasks.length];
      if (!task) continue;
      const [daysAgo, offsetHours, durationMinutes] = emmaSchedule[i];
      await seedTimer({ taskId: task.id, daysAgo, offsetHours, durationMinutes });
    }
    console.log(`✅ Weekly timer sessions seeded for Emma`);
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
          content: av.description,
          sentiment: av.description,
          taskTitle: av.description,
          clientId: clientRecord.id,
          category: 'General',
          score: av.projectIdx,
          projectId: proj.id,
          status: 'EN_ATTENTE',
        } as any,
      });
      console.log(`✅ Feedback seeded for ${proj.nom}`);
    }
  }

  // ─────────────────────────────────────────────
  // Notifications
  // ─────────────────────────────────────────────
  const notificationsData = [
    { userId: adminUser.id,  titre: 'Nouveau projet créé',   description: 'Refonte Portail RH a été créé.', type: 'PROJECT_ASSIGNED' as const },
    { userId: lucas.id,      titre: 'Tâche assignée',        description: 'Vous avez été assigné à "Initialisation du dépôt et configuration CI/CD".', type: 'TASK_ASSIGNED' as const },
    { userId: thomas.id,     titre: 'Sprint démarré',        description: 'Le Sprint 2 de Refonte Portail RH a commencé.', type: 'SPRINT_CREATED' as const },
    { userId: clientUser.id, titre: 'Projet en cours',       description: 'Campagne Été 2026 est en cours.', type: 'PROJECT_STATUS_CHANGED' as const },
    { userId: emma.id,       titre: 'Rappel deadline',       description: 'La deadline de "Lancement campagne Google Ads été" approche dans 25 jours.', etat: 'LUE' as const, type: 'TASK_DEADLINE_TODAY' as const },
    { userId: lucas.id,      titre: 'Tâche en retard',       description: 'La tâche "Développement des endpoints employés" est en retard de 3 jours.', type: 'TASK_OVERDUE' as const },
    { userId: lucas.id,      titre: 'Commentaire reçu',      description: 'Thomas Petit a commenté votre tâche "Implémentation de l\'authentification JWT".', type: 'TASK_FILE_ATTACHED' as const },
    { userId: lucas.id,      titre: 'Sprint mis à jour',     description: 'Le Sprint 2 de "Refonte Portail RH" a été mis à jour par l\'administrateur.', type: 'PROJECT_STATUS_CHANGED' as const },
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
          type: notif.type,
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
    console.log(`✅ Direct conversation between ${lucas.email} and ${emma.email} created.`);
  }

  // ─────────────────────────────────────────────
  // Realistic Seed Data for Client Dashboard
  // ─────────────────────────────────────────────
  console.log('🌱 Adding realistic seed data for client dashboard...');

  // Helper: offset from now in days
  const d = (offsetDays: number) => new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);

  const emmaEmpId = emma.employee?.id ?? null;

  // ── 3 Projects linked to the client ─────────────────────────────────────────
  const extraProjectsData = [
    {
      nom: 'Refonte site E-commerce',
      budget: 15000,
      description: "Refonte complète du site e-commerce avec tunnel d'achat optimisé.",
      status: 'ACTIF' as const,
      dateDebut: d(-60),
      dateFin: d(60),
      type: 'WEB' as const,
    },
    {
      nom: 'Campagne Social Media Printemps 2026',
      budget: 8000,
      description: 'Campagne marketing digitale sur les réseaux sociaux.',
      status: 'ACTIF' as const,
      dateDebut: d(-30),
      dateFin: d(45),
      type: 'MARKETING' as const,
    },
    {
      // Fixed: was type 'OTHER' — no sub-project was ever created so tasks/progress were always 0
      nom: 'Stratégie SEO 2026',
      budget: 5000,
      description: 'Optimisation SEO technique et rédaction de contenu ciblé.',
      status: 'EN_PAUSE' as const,
      dateDebut: d(-45),
      dateFin: d(75),
      type: 'MARKETING' as const,
    },
  ];

  const extraProjects: any[] = [];
  for (const pData of extraProjectsData) {
    let p = await prisma.project.findFirst({
      where: { nom: pData.nom, clientId: clientRecord.id },
    });
    if (!p) {
      p = await prisma.project.create({
        data: {
          nom: pData.nom,
          budget: pData.budget,
          description: pData.description,
          status: pData.status,
          dateDebut: pData.dateDebut,
          dateFin: pData.dateFin,
          clientId: clientRecord.id,
        },
      });
      console.log(`  ✅ Project created: ${p.nom}`);
    } else if (p.dateFin && p.dateFin < new Date()) {
      // Refresh stale dateFin so dashboard deadline is always in the future
      await prisma.project.update({ where: { id: p.id }, data: { dateFin: pData.dateFin } });
    }
    extraProjects.push({ ...p, type: pData.type });
  }

  const ep1 = extraProjects.find(p => p.nom === 'Refonte site E-commerce')!;
  const ep2 = extraProjects.find(p => p.nom === 'Campagne Social Media Printemps 2026')!;
  const ep3 = extraProjects.find(p => p.nom === 'Stratégie SEO 2026')!;

  // ── Project 1 (WEB) → WebProject → Sprint → SprintTasks ────────────────────
  let webP1 = await prisma.webProject.findUnique({ where: { projectId: ep1.id } });
  if (!webP1) {
    webP1 = await prisma.webProject.create({
      data: { projectId: ep1.id, cahierDesCharges: "Cahier des charges E-commerce v1" },
    });
  }

  let sprintP1 = await prisma.sprint.findFirst({ where: { webProjectId: webP1.id } });
  if (!sprintP1) {
    sprintP1 = await prisma.sprint.create({
      data: {
        nom: 'Sprint de Lancement',
        goal: "Mise en place du tunnel d'achat",
        status: 'EN_COURS',
        dateDebut: d(-30),
        dateFin: d(15),
        webProjectId: webP1.id,
      },
    });
  }

  const p1TaskDefs = [
    { titre: 'Configurer checkout Stripe',  status: 'TERMINE' as const,  priority: 'HAUTE' as const,   dateFin: d(-15) },
    { titre: 'Intégration API paiement',    status: 'EN_COURS' as const, priority: 'HAUTE' as const,   dateFin: d(10)  },
    { titre: "Refonte page d'accueil",      status: 'A_FAIRE' as const,  priority: 'MOYENNE' as const, dateFin: d(25)  },
    { titre: 'Tests de performance',        status: 'A_FAIRE' as const,  priority: 'BASSE' as const,   dateFin: d(40)  },
  ];

  for (const t of p1TaskDefs) {
    const exists = await prisma.sprintTask.findFirst({ where: { titre: t.titre, sprintId: sprintP1.id } });
    if (!exists) {
      await prisma.sprintTask.create({
        data: { ...t, sprintId: sprintP1.id, description: `Tâche: ${t.titre}`, storyPoints: 5 },
      });
    }
  }
  console.log(`  ✅ WebProject seeded for ${ep1.nom}`);

  // ── Project 2 (MARKETING) → MarketingProject → Tasks ───────────────────────
  let mktP2 = await prisma.marketingProject.findUnique({ where: { projectId: ep2.id } });
  if (!mktP2) {
    mktP2 = await prisma.marketingProject.create({ data: { projectId: ep2.id } });
  }

  const p2TaskDefs = [
    { titre: 'Analyser stories Instagram',   status: 'TERMINE' as const,  priority: 'MOYENNE' as const, dateFin: d(-20) },
    { titre: 'Rédiger calendrier éditorial', status: 'TERMINE' as const,  priority: 'MOYENNE' as const, dateFin: d(-10) },
    { titre: 'Créer visuels campagne',       status: 'EN_COURS' as const, priority: 'HAUTE' as const,   dateFin: d(18)  },
    { titre: 'Audit SEO technique',          status: 'A_FAIRE' as const,  priority: 'HAUTE' as const,   dateFin: d(30)  },
  ];

  // Track the EN_COURS task id — will be the target of the pending feedback request
  let p2PendingTaskId: number | null = null;

  for (const t of p2TaskDefs) {
    let task = await prisma.task.findFirst({ where: { titre: t.titre, marketingProjectId: mktP2.id } });
    if (!task) {
      task = await prisma.task.create({
        data: {
          ...t,
          marketingProjectId: mktP2.id,
          description: `Tâche marketing: ${t.titre}`,
          // Fixed: was missing employeeId — tasks had no assignee
          ...(emmaEmpId ? { employeeId: emmaEmpId } : {}),
        },
      });
    }
    if (t.status === 'EN_COURS') p2PendingTaskId = task.id;
  }
  console.log(`  ✅ MarketingProject tasks seeded for ${ep2.nom}`);

  // Add Emma to the Equipe for ep2 so the Projects page shows this project
  if (emmaEmpId) {
    const equipeEp2Exists = await prisma.equipe.findUnique({
      where: { employeeId_projectId: { employeeId: emmaEmpId, projectId: ep2.id } },
    });
    if (!equipeEp2Exists) {
      await prisma.equipe.create({ data: { employeeId: emmaEmpId, projectId: ep2.id } });
      console.log(`  ✅ Emma added to equipe for ${ep2.nom}`);
    }
  }

  // ── Project 3 (MARKETING) → MarketingProject → Tasks ───────────────────────
  // Fixed: was type 'OTHER' with no sub-project → progress always 0/0
  let mktP3 = await prisma.marketingProject.findUnique({ where: { projectId: ep3.id } });
  if (!mktP3) {
    mktP3 = await prisma.marketingProject.create({ data: { projectId: ep3.id } });
  }

  const p3TaskDefs = [
    { titre: 'Audit des mots-clés cibles',       status: 'TERMINE' as const,  priority: 'HAUTE' as const,   dateFin: d(-25) },
    { titre: 'Optimisation des balises meta',     status: 'EN_COURS' as const, priority: 'MOYENNE' as const, dateFin: d(20)  },
    { titre: 'Rédaction articles de blog SEO',    status: 'A_FAIRE' as const,  priority: 'BASSE' as const,   dateFin: d(50)  },
  ];

  for (const t of p3TaskDefs) {
    const exists = await prisma.task.findFirst({ where: { titre: t.titre, marketingProjectId: mktP3.id } });
    if (!exists) {
      await prisma.task.create({
        data: {
          ...t,
          marketingProjectId: mktP3.id,
          description: `Tâche SEO: ${t.titre}`,
          ...(emmaEmpId ? { employeeId: emmaEmpId } : {}),
        },
      });
    }
  }
  console.log(`  ✅ MarketingProject tasks seeded for ${ep3.nom}`);

  // Add Emma to the Equipe for ep3 so the Projects page shows this project
  if (emmaEmpId) {
    const equipeEp3Exists = await prisma.equipe.findUnique({
      where: { employeeId_projectId: { employeeId: emmaEmpId, projectId: ep3.id } },
    });
    if (!equipeEp3Exists) {
      await prisma.equipe.create({ data: { employeeId: emmaEmpId, projectId: ep3.id } });
      console.log(`  ✅ Emma added to equipe for ${ep3.nom}`);
    }
  }

  // ── Feedbacks ────────────────────────────────────────────────────────────────
  // fb1 — project 1: client submitted content, employee is reviewing (EN_COURS)
  const fb1Exists = await prisma.feedback.findFirst({
    where: { clientId: clientRecord.id, projectId: ep1.id, feedbackRequestedAt: null },
  });
  if (!fb1Exists) {
    await prisma.feedback.create({
      data: {
        content: 'La vitesse de chargement doit être améliorée, surtout sur mobile.',
        status: 'EN_COURS',
        sentiment: 'Neutre',
        taskTitle: 'Configurer checkout Stripe',
        category: 'Performance',
        score: 50,
        clientId: clientRecord.id,
        projectId: ep1.id,
      },
    });
    console.log(`  ✅ Feedback EN_COURS seeded for ${ep1.nom}`);
  }

  // fb2 — project 2: employee requested feedback on the EN_COURS task, client hasn't responded yet
  // Fixed: was missing feedbackRequestedAt and taskId → never appeared in "en attente de votre feedback" card
  const fb2Exists = await prisma.feedback.findFirst({
    where: { clientId: clientRecord.id, projectId: ep2.id, feedbackRequestedAt: { not: null } },
  });
  if (!fb2Exists && p2PendingTaskId) {
    await prisma.feedback.create({
      data: {
        content: '',
        status: 'EN_ATTENTE',
        taskTitle: 'Créer visuels campagne',
        taskPriority: 'HAUTE',
        feedbackRequestedAt: d(-2),
        clientId: clientRecord.id,
        projectId: ep2.id,
        taskId: p2PendingTaskId,
      },
    });
    console.log(`  ✅ Pending feedback request seeded for ${ep2.nom} (taskId: ${p2PendingTaskId})`);
  }

  // fb3 — project 3: fully resolved
  const fb3Exists = await prisma.feedback.findFirst({
    where: { clientId: clientRecord.id, projectId: ep3.id },
  });
  if (!fb3Exists) {
    await prisma.feedback.create({
      data: {
        content: "La page manque d'impact visuel — pourriez-vous enrichir les visuels et la palette de couleurs ?",
        status: 'RESOLU',
        sentiment: 'Neutre',
        taskTitle: 'Audit des mots-clés cibles',
        category: 'Design',
        score: 40,
        clientId: clientRecord.id,
        projectId: ep3.id,
      },
    });
    console.log(`  ✅ Feedback RESOLU seeded for ${ep3.nom}`);
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