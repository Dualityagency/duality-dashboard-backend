import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { EmployeesService } from '../../employees/services/employees.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const GROQ_MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';

function cleanJsonString(raw: string): string {
  let text = raw.trim();
  // Remove markdown code fences
  if (text.includes('```')) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match?.[1]) {
      text = match[1].trim();
    } else {
      text = text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
    }
  }
  return text;
}

@Injectable()
export class AIGeneratorService {
  private groq: Groq | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private employeesService: EmployeesService,
    private notificationsService: NotificationsService,
  ) {
    const apiKey =
      this.configService.get<string>('GROQ_API_KEY') ||
      process.env.GROQ_API_KEY;

    if (apiKey) {
      this.groq = new Groq({ apiKey });
      console.log(`[AI] Groq API ready (model: ${GROQ_MODEL}).`);
    } else {
      console.warn('[AI] GROQ_API_KEY manquante — fonctionnalités IA désactivées.');
    }
  }

  private async extractTextFromFile(filePath: string): Promise<string> {
    const normalizedPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    const absolutePath = path.resolve(process.cwd(), normalizedPath);

    console.log(`[AI] Reading CDC from: ${absolutePath}`);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Fichier introuvable: ${absolutePath}`);
    }

    const fileBuffer = fs.readFileSync(absolutePath);
    const extension = path.extname(absolutePath).toLowerCase();

    if (extension === '.pdf') {
      console.log('[AI] Parsing PDF...');
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pdfParseLib = require('pdf-parse');

        let text: string;

        if (typeof pdfParseLib === 'function') {
          // pdf-parse v1 — exports a callable function directly
          const data: { text: string } = await pdfParseLib(fileBuffer);
          text = data.text;
        } else if (typeof pdfParseLib.default === 'function') {
          // ES Module default export (v1-compatible)
          const data: { text: string } = await pdfParseLib.default(fileBuffer);
          text = data.text;
        } else if (pdfParseLib.PDFParse) {
          // pdf-parse v2 — clase PDFParse({ data: Uint8Array }), puis .getText()
          // pdfjs-dist v2 requiert un Uint8Array (pas un Buffer brut)
          const uint8 = new Uint8Array(
            fileBuffer.buffer,
            fileBuffer.byteOffset,
            fileBuffer.byteLength,
          );
          const parser = new pdfParseLib.PDFParse({ data: uint8 });
          const result: { text: string } = await parser.getText();
          await parser.destroy();
          text = result.text;
        } else {
          throw new Error(
            `pdf-parse: export type inconnu. Clés: ${Object.keys(pdfParseLib).join(', ')}`,
          );
        }

        console.log(`[AI] PDF parsed successfully. Length: ${text.length} chars`);
        return text;
      } catch (pdfError) {
        const msg = pdfError instanceof Error ? pdfError.message : String(pdfError);
        console.error('[AI] Erreur fatale pdf-parse:', msg);
        throw new Error(`Impossible de lire le contenu du PDF: ${msg}`);
      }
    }

    return fileBuffer.toString('utf-8');
  }

  async generateSprints(projectId: number, requesterId?: number) {
    if (!this.groq) {
      throw new InternalServerErrorException(
        'Clé API Groq manquante. Configurez GROQ_API_KEY dans votre fichier .env.',
      );
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        webProject: true,
        equipes: {
          include: {
            employee: {
              include: {
                utilisateur: true,
              },
            },
          },
        },
      },
    });

    if (!project || !project.webProject) {
      throw new NotFoundException('Projet web introuvable.');
    }

    if (!project.webProject.cahierDesCharges) {
      throw new BadRequestException(
        "Aucun cahier des charges associé. Uploadez un fichier PDF d'abord via /projects/:id/upload-cdc.",
      );
    }

    const webProjectId = project.webProject.id;
    const projectEmployees = project.equipes.map((eq) => eq.employee);

    let specificationText = '';
    try {
      specificationText = await this.extractTextFromFile(project.webProject.cahierDesCharges);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[AI] Échec extraction du contenu PDF:', msg);
      throw new BadRequestException(
        `Impossible de lire le cahier des charges. Vérifiez que le PDF n'est pas protégé ou corrompu. Détail: ${msg}`,
      );
    }

    // Guard: reject if extracted text looks like just the file path
    const mightBeFilePath =
      specificationText.trim().startsWith('/') ||
      specificationText.trim().startsWith('C:') ||
      specificationText.trim().startsWith('uploads/');

    if (!specificationText || specificationText.trim().length < 50 || mightBeFilePath) {
      throw new BadRequestException(
        'Contenu du cahier des charges trop court ou invalide (min. 50 caractères). Uploadez un document plus détaillé.',
      );
    }

    const employeesList = projectEmployees
      .map((e) => `ID: ${e.id}, Nom: ${e.utilisateur.prenom} ${e.utilisateur.nom}, Poste: ${e.poste}`)
      .join('\n');

    const today = new Date().toISOString().split('T')[0];
    const prompt = `
Tu es un expert Agile / Scrum Master. Analyse ce cahier des charges et génère un plan de sprints complet.

Date du jour : ${today}
Durée d'un sprint : 14 jours
Maximum 40 story points par sprint
Points de Fibonacci : 1, 2, 3, 5, 8, 13

Cahier des charges :
${specificationText.substring(0, 8000)}

Employés disponibles (assigne selon le poste) :
${employeesList}

CONSIGNE STRICTE : Retourne UNIQUEMENT un objet JSON valide, sans Markdown, sans backticks, sans commentaires.
Structure JSON attendue (LES CLÉS NE DOIVENT PAS ÊTRE TRADUITES, UTILISE EXACTEMENT CES NOMS DE CLÉS EN ANGLAIS) :
{
  "sprints": [
    {
      "nom": "Sprint 1 - Fondation",
      "goal": "Objectif clair du sprint",
      "dateDebut": "YYYY-MM-DD",
      "dateFin": "YYYY-MM-DD",
      "velocityPrevue": 25,
      "tasks": [
        {
          "titre": "Nom de la tâche",
          "description": "Description détaillée",
          "priority": "HAUTE",
          "storyPoints": 5,
          "dateFin": "YYYY-MM-DD",
          "employeeId": 1
        }
      ]
    }
  ]
}

Valeurs valides pour priority : "HAUTE", "MOYENNE", "BASSE", "URGENTE".
Tu dois générer au moins 3 à 5 tâches par sprint !
`;

    let rawText = '';
    try {
      console.log(`[AI] Sending prompt to Groq (${GROQ_MODEL})...`);
      const response = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: GROQ_MODEL,
        temperature: 0.2, // Low temp for more deterministic JSON
        response_format: { type: 'json_object' }
      });
      rawText = response.choices[0]?.message?.content || "";
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI request failed';
      console.error('[AI] Groq API error:', message);
      throw new InternalServerErrorException(`Erreur API Groq: ${message}`);
    }

    if (!rawText?.trim()) {
      throw new InternalServerErrorException(
        "L'IA n'a retourné aucun texte. Réessayez.",
      );
    }

    console.log('[AI] Raw response (first 300 chars):', rawText.substring(0, 300));

    const jsonStr = cleanJsonString(rawText);

    let data: { sprints: any[] };
    try {
      data = JSON.parse(jsonStr);
    } catch {
      console.error('[AI] JSON parse failed. Raw text:', rawText);
      throw new InternalServerErrorException(
        "L'IA a retourné un format JSON invalide. Réessayez.",
      );
    }

    if (!data.sprints || !Array.isArray(data.sprints)) {
      throw new InternalServerErrorException(
        "La structure JSON retournée est invalide (champ 'sprints' manquant).",
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      const createdSprints: any[] = [];

      for (const s of data.sprints) {
        const sprint = await tx.sprint.create({
          data: {
            nom: s.nom ?? `Sprint ${createdSprints.length + 1}`,
            goal: s.goal ?? null,
            dateDebut: new Date(s.dateDebut),
            dateFin: new Date(s.dateFin),
            velocityPrevue: s.velocityPrevue ?? 0,
            webProjectId: webProjectId,
          },
        });

        const taskList = s.tasks || s.taches || s.Taches || s.task || [];

        if (taskList && taskList.length > 0) {
          await tx.sprintTask.createMany({
            data: taskList.map((t: any) => ({
              sprintId: sprint.id,
              titre: t.titre ?? t.title ?? t.nom ?? 'Sans titre',
              description: t.description ?? t.details ?? '',
              priority: t.priority ?? t.priorite ?? 'BASSE',
              storyPoints: t.storyPoints ?? t.points ?? 0,
              dateFin: t.dateFin ? new Date(t.dateFin) : new Date(s.dateFin),
              employeeId: t.employeeId ?? t.employeId ?? null,
            })),
          });
        }

        // Fetch sprint with its tasks to include in response
        const sprintWithTasks = await tx.sprint.findUnique({
          where: { id: sprint.id },
          include: {
            tasks: {
              include: {
                employee: {
                  include: { utilisateur: true },
                },
              },
            },
          },
        });

        createdSprints.push(sprintWithTasks);
      }

      console.log(`[AI] ${createdSprints.length} sprint(s) créé(s) avec succès.`);

      // Notify requester
      if (requesterId) {
        this.notificationsService.createNotification(
          requesterId,
          NotificationType.PROJECT_AI_SPRINTS,
          'Sprints IA générés',
          `${createdSprints.length} sprint(s) ont été générés automatiquement pour le projet "${project.nom}".`,
          projectId,
          'Project',
        ).catch(() => {});
      }

      return {
        message: `${createdSprints.length} sprint(s) générés avec succès.`,
        total: createdSprints.length,
        sprints: createdSprints,
      };
    });
  }
}
