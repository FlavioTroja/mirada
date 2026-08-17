import { FastifyApplication } from "../types";
import { getPrismaClient } from "@utils/adapters/prisma";

/**
 * Segna l'indirizzo di un account come confermato.
 *
 * Serve a ogni test che **si registra e poi accede**: dal momento in cui la
 * conferma è obbligatoria, quel secondo passo fallisce con
 * `EMAIL_NOT_CONFIRMED` — che è il comportamento voluto, non un difetto.
 *
 * Scrive direttamente sulla riga invece di passare da `POST /auth/confirm-email`
 * perché il gettone vive **dentro l'email**, e in prova non c'è nessun server di
 * posta da cui recuperarlo. Il percorso vero — gettone firmato, verifica,
 * sessione restituita — è provato per intero in `EmailConfirmation.test.ts`;
 * qui interessa solo che l'account sia utilizzabile.
 */
export async function markEmailConfirmed(userId: number): Promise<void> {
    await getPrismaClient().user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() },
    });
}

export async function login(app: FastifyApplication, username: string, password: string) {
    const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { usernameOrEmail: username, password },
    });
    if (res.statusCode !== 200) {
        throw new Error(`Failed to login as ${username}: ${res.statusCode} ${res.body}`);
    }
    return `Bearer ${res.json().token}`;
}
