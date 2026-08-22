export type AssistancePayload = {
  name: string;
  email: string;
  company: string;
  category: string;
  subject: string;
  message: string;
  website: string;
  startedAt: number;
};

export type AssistanceErrors = Partial<Record<keyof AssistancePayload, string>>;

export function validateAssistance(payload: AssistancePayload): AssistanceErrors {
  const errors: AssistanceErrors = {};
  if (payload.name.trim().length < 2) errors.name = 'Indiquez votre nom complet.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())) errors.email = 'Indiquez une adresse électronique valide.';
  if (!payload.category) errors.category = 'Choisissez le type de demande.';
  if (payload.subject.trim().length < 5) errors.subject = 'Précisez l’objet de la demande.';
  if (payload.message.trim().length < 20) errors.message = 'Décrivez la demande en au moins 20 caractères.';
  if (payload.message.length > 5000) errors.message = 'Le message ne doit pas dépasser 5 000 caractères.';
  if (payload.website) errors.website = 'Soumission invalide.';
  return errors;
}

export async function sendAssistanceRequest(payload: AssistancePayload, signal?: AbortSignal) {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!baseUrl) throw new Error('ASSISTANCE_UNAVAILABLE');
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/functions/v1/public-assistance`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('ASSISTANCE_REJECTED');
  return response.json() as Promise<{ requestId: string }>;
}
