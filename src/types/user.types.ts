// src/types/user.types.ts
import { Role } from '@prisma/client';

export interface UserResponse {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: Role;
  telephone?: string | null;
  avatar?: string | null;
  nomSociete?: string; // Pour Client
  poste?: string; // Pour Employee uniquement
}
