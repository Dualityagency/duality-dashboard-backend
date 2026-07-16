// src/modules/mail/services/mail.service.ts
import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendUserCredentials(
    email: string,
    nom: string,
    prenom: string,
    password: string,
  ) {
    await this.mailerService.sendMail({
      to: email,
      subject: 'Bienvenue chez Duality Agency - Vos identifiants',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #2c3e50; text-align: center;">Bienvenue chez Duality Agency</h2>
          <p>Bonjour <strong>${prenom} ${nom}</strong>,</p>
          <p>Votre compte a été créé avec succès. Voici vos identifiants de connexion :</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Email / Utilisateur :</strong> ${email}</p>
            <p style="margin: 5px 0;"><strong>Mot de passe :</strong> ${password}</p>
          </div>
          <p style="color: #e74c3c;"><strong>Important :</strong> Pour des raisons de sécurité, nous vous conseillons de changer votre mot de passe dès votre première connexion.</p>
          <p>Cordialement,<br>L'équipe Duality Agency</p>
          <hr style="border: none; border-top: 1px solid #eeeeee; margin: 20px 0;">
          <p style="font-size: 12px; color: #7f8c8d; text-align: center;">Ceci est un message automatique, merci de ne pas y répondre.</p>
        </div>
      `,
    });
  }
}
