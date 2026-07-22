/**
 * @file feedback-ai.service.ts
 * @description Service gérant les interactions avec l'IA Groq pour l'analyse des feedbacks.
 * @feature Gestion des feedbacks clients / IA
 */

import { Injectable, BadRequestException } from '@nestjs/common'; 
import { ConfigService } from '@nestjs/config'; 
import Groq from 'groq-sdk'; 
 
/**
 * Interface représentant le résultat de l'analyse effectuée par l'IA.
 */
export interface AIAnalysisResult { 
  score: number; // Score de qualité/détail du feedback (0-100)
  sentiment: 'Positif' | 'Neutre' | 'Frustré'; // Sentiment détecté
  category: string; // Catégorie du feedback (Design, Tech, etc.)
  suggestions: string[]; // Conseils générés par l'IA
  template: { 
    like: string; // Ce que le client a aimé
    change: string; // Ce qui doit changer
    improvement: string; // Amélioration suggérée
  }; 
} 
 
/**
 * Service d'analyse de feedback basé sur l'IA.
 * @Injectable Permet l'injection de ce service.
 */
@Injectable() 
export class FeedbackAiService { 
  private groq: Groq; 
 
  constructor(private configService: ConfigService) { 
    // Récupération de la clé API Groq depuis les variables d'environnement
    const apiKey = this.configService.get<string>('GROQ_API_KEY'); 
    if (!apiKey) { 
      throw new Error('GROQ_API_KEY is missing in .env'); 
    } 
    // Initialisation du client SDK Groq
    this.groq = new Groq({ apiKey }); 
  } 
 
  /**
   * Analyse un texte de feedback en utilisant le modèle Llama-3 via l'API Groq.
   * @param {string} content - Le contenu textuel du feedback à analyser.
   * @param {string} [taskTitle] - Le titre optionnel de la tâche concernée.
   * @returns {Promise<AIAnalysisResult>} Un objet JSON structuré contenant l'analyse.
   * @throws {BadRequestException} En cas d'erreur de communication ou de parsing JSON.
   */
  async analyzeFeedback( 
    content: string, 
    taskTitle?: string, 
  ): Promise<AIAnalysisResult> { 
    // Construction du prompt système pour guider l'IA vers une réponse JSON stricte
    const prompt = ` 
      You are an AI assistant specialized in analyzing client feedback  
      for a digital agency. 
      Analyze this feedback and return ONLY a valid JSON object. 
      No markdown, no backticks, no extra text. 
 
      Return exactly this structure: 
      { 
        "score": number between 0 and 100, 
        "sentiment": "Positif" or "Neutre" or "Frustré", 
        "category": "Design" or "Tech" or "Content" or "Général", 
        "suggestions": [ 
          "tip 1 in French", 
          "tip 2 in French", 
          "tip 3 in French" 
        ], 
        "template": { 
          "like": "what is positive in French", 
          "change": "what should change in French", 
          "improvement": "suggested improvement in French" 
        } 
      } 
 
      Scoring rules: 
      - 0-30: very vague or negative 
      - 31-60: average feedback 
      - 61-80: good feedback 
      - 81-100: excellent, detailed and constructive 
 
      All text values must be in French. 
      ${taskTitle ? `Tâche concernée : "${taskTitle}"` : ''} 
      Feedback à analyser : "${content}" 
    `; 
 
    try { 
      // Appel à l'API Groq (Service LLM externe)
      // Modèle utilisé : llama-3.3-70b-versatile
      const completion = await this.groq.chat.completions.create({ 
        messages: [{ role: 'user', content: prompt }], 
        model: 'llama-3.3-70b-versatile', 
        temperature: 0.3, 
        max_tokens: 1000, 
      }); 
 
      // Extraction et nettoyage de la réponse brute
      const text = completion.choices[0]?.message?.content || ''; 
      const cleaned = text 
        .replace(/```json/gi, '') 
        .replace(/```/g, '') 
        .trim(); 
 
      // Parsing de la chaîne JSON renvoyée par l'IA
      const analysis = JSON.parse(cleaned) as AIAnalysisResult; 
 
      // Validation basique de la structure reçue
      if ( 
        typeof analysis.score !== 'number' || 
        !analysis.sentiment || 
        !analysis.category 
      ) { 
        throw new Error('Structure JSON invalide'); 
      } 
 
      return analysis; 
    } catch (error) { 
      // Gestion des erreurs d'API ou de formatage
      throw new BadRequestException( 
        "Erreur lors de l'analyse IA : " + (error as Error).message, 
      ); 
    } 
  } 
} 
