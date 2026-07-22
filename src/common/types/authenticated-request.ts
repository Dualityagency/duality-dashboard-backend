import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: number;
  role: Role;
  email: string;
  nom: string;
  prenom: string;
  avatar?: string | null;
  status: string;
  employee?: { id: number; poste: string; utilisateurId: number } | null;
  client?: { id: number; nomSociete: string; utilisateurId: number } | null;
  admin?: { id: number; utilisateurId: number } | null;
}

// Plain interface (no extend Request) to satisfy isolatedModules + emitDecoratorMetadata
export interface AuthenticatedRequest {
  user: AuthenticatedUser;
}
