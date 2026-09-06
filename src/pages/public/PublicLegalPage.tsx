import { Link } from 'react-router-dom';
import { PageMetadata } from '../../components/seo/PageMetadata';

type LegalKind = 'legal' | 'privacy' | 'terms' | 'security';

const legalContent: Record<LegalKind, { title: string; intro: string; sections: Array<{ title: string; body: string }> }> = {
  legal: {
    title: 'Mentions légales',
    intro: 'Informations relatives à la vitrine institutionnelle de Faso SANAMA, plateforme nationale de traçabilité du secteur minier.',
    sections: [
      { title: 'Rattachement institutionnel', body: 'Faso SANAMA est une plateforme de la Présidence du Faso. Conception et support : Quantix Solutions Burkina Faso. La SONASP intervient parmi les acteurs du secteur minier.' },
      { title: 'Contenus', body: 'Les informations publiées présentent la plateforme et les services accessibles aux acteurs autorisés. Les publications officielles sont datées et administrées par des profils habilités.' },
      { title: 'Assistance', body: 'Les demandes relatives au site ou aux espaces métiers doivent être transmises depuis la page Assistance.' },
    ],
  },
  privacy: {
    title: 'Politique de confidentialité',
    intro: 'La protection des données personnelles et opérationnelles fait partie des exigences de la plateforme.',
    sections: [
      { title: 'Données de la vitrine', body: 'La consultation des pages publiques ne donne pas accès aux données du tableau de bord national ni aux informations des sociétés minières.' },
      { title: 'Demandes d’assistance', body: 'Les informations transmises servent à traiter la demande, sécuriser le service et assurer le suivi. Elles ne doivent contenir aucun mot de passe.' },
      { title: 'Droits et demandes', body: 'Toute demande relative aux données transmises peut être adressée par le formulaire d’assistance, en précisant l’objet de la demande.' },
    ],
  },
  terms: {
    title: 'Conditions d’utilisation',
    intro: 'L’accès à la vitrine est public. Les espaces métiers de Faso SANAMA sont réservés aux utilisateurs autorisés.',
    sections: [
      { title: 'Accès réservé', body: 'Chaque compte est personnel. Les droits sont limités au rôle et au périmètre de la société ou de l’institution rattachée.' },
      { title: 'Usage responsable', body: 'L’utilisateur doit préserver ses moyens d’authentification, signaler tout incident et s’abstenir de toute tentative d’accès non autorisé.' },
      { title: 'Disponibilité', body: 'Des interruptions programmées peuvent être annoncées dans les publications. Les équipes s’attachent à restaurer le service dans les meilleurs délais.' },
    ],
  },
  security: {
    title: 'Sécurité de la plateforme',
    intro: 'La sécurité repose sur des contrôles d’accès, une traçabilité des opérations et des responsabilités clairement séparées.',
    sections: [
      { title: 'Accès', body: 'Les pages privées nécessitent une session valide et un profil actif. Le Portail Mine est limité à la société rattachée au compte.' },
      { title: 'Signalement', body: 'Un comportement inhabituel, une perte d’accès ou un document suspect doit être signalé depuis la page Assistance sans transmettre de secret.' },
      { title: 'Prudence', body: 'L’équipe Faso SANAMA ne demandera jamais la communication d’un mot de passe dans un formulaire d’assistance ou une publication.' },
    ],
  },
};

export default function PublicLegalPage({ kind }: { kind: LegalKind }) {
  const content = legalContent[kind];
  return (
    <article className="public-legal-page">
      <PageMetadata title={`${content.title} | Faso SANAMA`} description={content.intro} openGraph={{ type: 'website', locale: 'fr_BF', siteName: 'Faso SANAMA' }} />
      <header><div className="public-shell public-legal-page__narrow"><span>Faso SANAMA</span><h1>{content.title}</h1><p>{content.intro}</p></div></header>
      <div className="public-shell public-legal-page__narrow public-legal-page__body">
        {content.sections.map((section) => <section key={section.title}><h2>{section.title}</h2><p>{section.body}</p></section>)}
        <Link className="public-button public-button--outline" to="/assistance">Contacter l’assistance</Link>
      </div>
    </article>
  );
}
