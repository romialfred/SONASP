/**
 * Gabarit HTML des courriels de la SONASP.
 *
 * ══ POURQUOI DES TABLEAUX ET DES STYLES EN LIGNE ══
 *
 * Outlook rend le HTML avec le moteur de Word : ni flexbox, ni grille, ni
 * feuille de style externe, et un `<div>` porteur d'un fond et d'une bordure y
 * perd sa mise en forme. Tout ce qui doit tenir passe donc par des `<table>` et
 * des attributs en ligne. C'est laid à écrire, et c'est la seule façon qu'un
 * message arrive présentable partout.
 *
 * La palette reprend l'identite officielle : vert SONASP, rouge et or.
 */

export const POLICE =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const ENCRE = '#10243e';
const TEXTE = '#33485f';
const DISCRET = '#60738c';
const VERT = '#0f7a56';
const ROUGE = '#d71920';
const FILET = '#e0e7ee';
const FOND = '#f4f7f9';

/** Échappe ce qui vient de la base : un titre porte parfois « & » ou « < ». */
export function echapper(valeur: string): string {
  return String(valeur ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Un corps de message en texte brut : les sauts de ligne sont respectés. */
export function paragraphe(corps: string): string {
  const lignes = echapper(corps).split('\n').filter((l) => l.trim().length > 0);
  return lignes
    .map((ligne) =>
      `<p style="margin:0 0 14px;font-family:${POLICE};font-size:14px;line-height:22px;color:${TEXTE}">${ligne}</p>`)
    .join('');
}

/** Couples libellé / valeur, en tableau : dates, quantités, montants. */
export function faits(items: { label: string; valeur: string }[]): string {
  if (!items.length) return '';
  const lignes = items.map((item, rang) => `
    <tr>
      <td style="padding:9px 14px;border-top:${rang === 0 ? '0' : `1px solid ${FILET}`};font-family:${POLICE};font-size:12.5px;color:${DISCRET};white-space:nowrap">${echapper(item.label)}</td>
      <td align="right" style="padding:9px 14px;border-top:${rang === 0 ? '0' : `1px solid ${FILET}`};font-family:${POLICE};font-size:13px;font-weight:700;color:${ENCRE}">${echapper(item.valeur)}</td>
    </tr>`).join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="border-collapse:collapse;border:1px solid ${FILET};border-radius:10px;background:#fbfcfd;margin:0 0 18px">
    ${lignes}
  </table>`;
}

/**
 * Bouton d'action.
 * Doublé d'un lien en toutes lettres dessous : certains clients n'affichent ni
 * les fonds de cellule ni les images, le bouton y devient invisible.
 */
export function bouton(url: string, libelle: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
    <tr><td align="center" style="padding:4px 0 10px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate">
        <tr><td bgcolor="${VERT}" style="background-color:${VERT};border-radius:9px">
          <a href="${url}" style="display:inline-block;padding:12px 26px;font-family:${POLICE};font-size:14px;font-weight:700;color:#ffffff;text-decoration:none">${echapper(libelle)}</a>
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:0 0 18px">
      <span style="font-family:${POLICE};font-size:11.5px;color:${DISCRET};line-height:18px">Le bouton ne fonctionne pas ? Ouvrez ce lien :<br />
        <a href="${url}" style="color:${VERT};text-decoration:underline;word-break:break-all">${echapper(url)}</a>
      </span>
    </td></tr>
  </table>`;
}

/** Encadré discret, pour un identifiant ou une valeur à recopier. */
export function encart(contenu: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="border-collapse:collapse;margin:0 0 18px">
    <tr><td bgcolor="#fbfcfd" style="background-color:#fbfcfd;border:1px solid ${FILET};border-radius:10px;padding:16px 18px">${contenu}</td></tr>
  </table>`;
}

/**
 * Enveloppe du message : bandeau, corps, signature.
 * La signature nomme l'expéditeur en toutes lettres — un message de la
 * plateforme doit se reconnaître même quand les images ne s'affichent pas.
 */
export function coquille(params: {
  titre: string;
  corps: string;
  mention?: string;
  origineApplication?: string;
}): string {
  const origine = (params.origineApplication ?? 'https://sonasp.data-univers.com').replace(/\/$/, '');
  const logo = `${origine}/sonasp_logo.png`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${params.titre}</title>
</head>
<body style="margin:0;padding:0;background-color:${FOND}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="border-collapse:collapse;background-color:${FOND}">
  <tr><td align="center" style="padding:28px 14px">

    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
      style="border-collapse:collapse;width:600px;max-width:100%;background-color:#ffffff;border:1px solid ${FILET};border-radius:14px;overflow:hidden">

      <tr><td bgcolor="${ROUGE}" style="height:7px;background-color:${ROUGE};font-size:0;line-height:7px">&nbsp;</td></tr>
      <tr><td bgcolor="${VERT}" align="center" style="background-color:${VERT};padding:20px 30px 18px">
        <img src="${echapper(logo)}" width="250" alt="SONASP — Société Nationale des Substances Précieuses" style="display:block;width:250px;max-width:100%;height:auto;border:0;background-color:#ffffff;border-radius:8px" />
        <p style="margin:12px 0 0;font-family:${POLICE};font-size:12.5px;font-weight:600;color:#ffffff;line-height:18px">Plateforme nationale de collecte et du suivi de la traçabilité de l’or</p>
      </td></tr>

      <tr><td style="padding:28px 30px 8px">
        <h1 style="margin:0 0 16px;font-family:${POLICE};font-size:19px;font-weight:700;color:${ENCRE};line-height:26px">${params.titre}</h1>
        ${params.corps}
      </td></tr>

      <tr><td bgcolor="#f8fafc" style="background-color:#f8fafc;border-top:1px solid ${FILET};padding:20px 30px">
        <p style="margin:0;font-family:${POLICE};font-size:13.5px;font-weight:700;color:${ENCRE};line-height:19px">Administration SONASP</p>
        <p style="margin:3px 0 0;font-family:${POLICE};font-size:12px;color:${DISCRET};line-height:18px">Société nationale des substances précieuses · Ouagadougou, Burkina Faso</p>
        <p style="margin:10px 0 0;font-family:${POLICE};font-size:11px;color:${DISCRET};line-height:17px">${
          echapper(params.mention ?? 'Ce message vous est adressé automatiquement par la plateforme. Il n’appelle pas de réponse à cette adresse.')
        }</p>
      </td></tr>

    </table>

  </td></tr>
</table>
</body>
</html>`;
}
