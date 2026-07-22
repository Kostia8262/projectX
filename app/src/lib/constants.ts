// Shared between the client (AgeGate component) and the server
// (api/age/confirm route) — the signature only verifies if both sides
// sign/verify the exact same string.
export const AGE_DISCLAIMER_MESSAGE =
  "Я подтверждаю, что мне исполнилось 18 лет, и осознанно соглашаюсь на просмотр контента 18+ на этом сайте.";
