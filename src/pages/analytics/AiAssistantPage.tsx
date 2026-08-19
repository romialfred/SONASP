import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  BarChart3,
  Coins,
  FileText,
  Info,
  Landmark,
  Paperclip,
  Plus,
  Server,
  Sparkles,
  SquarePen,
  Trash2,
  Users,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, Note, PageHeader } from '@/components/ui/sn';
import { useAuth } from '@/contexts/AuthContext';
import './ai-assistant.css';

export type Auteur = 'utilisateur' | 'assistant';

export interface MessageAssistant {
  id: string;
  auteur: Auteur;
  texte: string;
}

export interface Conversation {
  id: string;
  titre: string;
  messages: MessageAssistant[];
}

/** Amorces proposées à l'ouverture, adossées aux données réellement suivies. */
export const SUGGESTIONS: Array<{ titre: string; invite: string; icon: typeof Coins }> = [
  {
    titre: 'Collecte du trimestre',
    invite: 'Quelle quantité d’or a été collectée par région au dernier trimestre ?',
    icon: Coins,
  },
  {
    titre: 'Artisans sans carte valide',
    invite: 'Liste les artisans miniers dont la carte professionnelle est expirée ou absente.',
    icon: Users,
  },
  {
    titre: 'Taxes à reverser',
    invite: 'Établis le montant des taxes et redevances à reverser sur l’exercice en cours.',
    icon: Landmark,
  },
  {
    titre: 'Rapport institutionnel',
    invite: 'Prépare un rapport de synthèse pour le ministère sur la production nationale.',
    icon: FileText,
  },
];

/** Titre de conversation dérivé de la première question posée. */
export function titreDepuisQuestion(question: string, longueurMax = 42): string {
  const propre = question.trim().replace(/\s+/g, ' ');
  if (!propre) return 'Nouvelle conversation';
  return propre.length <= longueurMax ? propre : `${propre.slice(0, longueurMax - 1).trimEnd()}…`;
}

export const CONVERSATION_VIDE: Conversation = { id: 'nouvelle', titre: 'Nouvelle conversation', messages: [] };

/**
 * Réponse d'attente.
 * Le moteur d'analyse n'est pas raccordé : l'assistant l'annonce au lieu de simuler
 * une réponse, ce qui laisserait croire à une interrogation réelle de la base.
 */
export const REPONSE_INDISPONIBLE =
  'Le moteur d’analyse n’est pas encore raccordé à la base de données. Votre question est enregistrée dans cette conversation ; elle recevra une réponse dès la mise en service.';

/** Initiales affichées sur la pastille de l'utilisateur. */
export function initialesUtilisateur(nom: string | null | undefined): string {
  const mots = (nom || '').trim().split(/[\s@._-]+/).filter(Boolean);
  if (mots.length === 0) return '?';
  return mots
    .slice(0, 2)
    .map((mot) => mot[0].toUpperCase())
    .join('');
}

export default function AiAssistantPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([CONVERSATION_VIDE]);
  const [conversationActive, setConversationActive] = useState(CONVERSATION_VIDE.id);
  const [question, setQuestion] = useState('');
  const filRef = useRef<HTMLDivElement | null>(null);

  const conversation = useMemo(
    () => conversations.find((item) => item.id === conversationActive) || conversations[0],
    [conversations, conversationActive]
  );

  useEffect(() => {
    // Affectation directe plutôt que `scrollTo` : la méthode n'existe pas partout
    // (jsdom notamment) et le fil doit simplement rester collé au dernier message.
    if (filRef.current) filRef.current.scrollTop = filRef.current.scrollHeight;
  }, [conversation.messages.length]);

  const envoyer = (texte: string) => {
    const propre = texte.trim();
    if (!propre) return;

    const horodatage = `${Date.now()}`;
    setConversations((courantes) =>
      courantes.map((item) =>
        item.id !== conversation.id
          ? item
          : {
              ...item,
              titre: item.messages.length === 0 ? titreDepuisQuestion(propre) : item.titre,
              messages: [
                ...item.messages,
                { id: `q-${horodatage}`, auteur: 'utilisateur', texte: propre },
                { id: `r-${horodatage}`, auteur: 'assistant', texte: REPONSE_INDISPONIBLE },
              ],
            }
      )
    );
    setQuestion('');
  };

  const nouvelleConversation = () => {
    const identifiant = `conv-${Date.now()}`;
    setConversations((courantes) => [{ ...CONVERSATION_VIDE, id: identifiant }, ...courantes]);
    setConversationActive(identifiant);
    setQuestion('');
  };

  const supprimer = (id: string) => {
    setConversations((courantes) => {
      const restantes = courantes.filter((item) => item.id !== id);
      const suivantes = restantes.length > 0 ? restantes : [CONVERSATION_VIDE];
      if (id === conversationActive) setConversationActive(suivantes[0].id);
      return suivantes;
    });
  };

  const soumettre = (event: FormEvent) => {
    event.preventDefault();
    envoyer(question);
  };

  return (
    <NationalDashboardLayout>
      <div className="sn-page assistant">
        <PageHeader
          icon={Sparkles}
          title="Analyse par assistance IA"
          subtitle="Interrogez les données de la plateforme en langage naturel et demandez des rapports."
          breadcrumb={[{ label: 'Rapports et analyses' }, { label: 'Assistance IA' }]}
          aside={
            <Badge tone="warning" icon={Server}>
              Moteur non raccordé
            </Badge>
          }
        />

        <Note tone="info" icon={Info}>
          Cette interface est <strong>prête, mais le moteur d’analyse n’est pas encore
          raccordé</strong> à la base de données. Les questions posées sont conservées dans la
          conversation ; aucune réponse n’est calculée pour l’instant.
        </Note>

        <div className="assistant__layout">
          <aside className="assistant__historique" aria-label="Conversations">
            <button type="button" className="sn-btn sn-btn--primary assistant__nouvelle" onClick={nouvelleConversation}>
              <Plus aria-hidden="true" /> Nouvelle conversation
            </button>

            <h2>Historique</h2>
            <ul>
              {conversations.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={item.id === conversation.id ? 'is-active' : ''}
                    onClick={() => setConversationActive(item.id)}
                  >
                    <SquarePen aria-hidden="true" />
                    <span>{item.titre}</span>
                  </button>
                  <button
                    type="button"
                    className="assistant__supprimer"
                    aria-label={`Supprimer « ${item.titre} »`}
                    onClick={() => supprimer(item.id)}
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>

            <p className="assistant__note-historique">
              L’historique reste local à cette session tant que le service n’est pas raccordé.
            </p>
          </aside>

          <section className="assistant__conversation" aria-label="Conversation">
            <div className="assistant__fil" ref={filRef}>
              {conversation.messages.length === 0 ? (
                <div className="assistant__accueil">
                  <span className="assistant__logo" aria-hidden="true">
                    <Sparkles />
                  </span>
                  <h2>Que souhaitez-vous analyser ?</h2>
                  <p>
                    Posez une question sur la collecte, les artisans, les ventes ou les taxes.
                    L’assistant s’appuiera sur les données de la plateforme.
                  </p>

                  <ul className="assistant__suggestions">
                    {SUGGESTIONS.map((suggestion) => {
                      const Icon = suggestion.icon;
                      return (
                        <li key={suggestion.titre}>
                          <button type="button" onClick={() => envoyer(suggestion.invite)}>
                            <Icon aria-hidden="true" />
                            <span>
                              <strong>{suggestion.titre}</strong>
                              <small>{suggestion.invite}</small>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <ol className="assistant__messages">
                  {conversation.messages.map((message) => (
                    <li key={message.id} className={`is-${message.auteur}`}>
                      <span className="assistant__auteur" aria-hidden="true">
                        {message.auteur === 'assistant' ? <Sparkles /> : initialesUtilisateur(user?.full_name)}
                      </span>
                      <div className="assistant__bulle">
                        <p>{message.texte}</p>
                        {message.auteur === 'assistant' && (
                          <footer>
                            <BarChart3 aria-hidden="true" /> Aucune donnée interrogée
                          </footer>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <form className="assistant__composeur" onSubmit={soumettre}>
              <button type="button" className="assistant__piece" aria-label="Joindre un document" disabled>
                <Paperclip aria-hidden="true" />
              </button>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    envoyer(question);
                  }
                }}
                rows={1}
                placeholder="Posez une question sur les données de la plateforme…"
                aria-label="Votre question"
              />
              <button type="submit" aria-label="Envoyer la question" disabled={!question.trim()}>
                <ArrowUp aria-hidden="true" />
              </button>
            </form>

            <p className="assistant__avertissement">
              L’assistant produira des analyses à partir des données enregistrées. Vérifiez les
              chiffres avant tout usage officiel.
            </p>
          </section>
        </div>
      </div>
    </NationalDashboardLayout>
  );
}
