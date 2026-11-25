import Link from "next/link";
import { PRIVACY_CONTACT, PRIVACY_VERSION } from "@/lib/privacy";

export const metadata = { title: "Confidentialité — NMRY Coaching" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-black">{title}</h2>
      <div className="space-y-2 text-[15px] leading-relaxed text-ink/90">{children}</div>
    </section>
  );
}

/**
 * Politique de confidentialité. Les passages entre crochets sont à compléter par le responsable
 * du traitement (identité juridique, région d'hébergement, durée de conservation) avant diffusion.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-7 p-5 pb-16">
      <header className="space-y-1">
        <Link href="/" className="text-sm font-bold text-accent">‹ Retour à l&apos;appli</Link>
        <h1 className="text-2xl font-black">Confidentialité et données personnelles</h1>
        <p className="text-sm text-dim">Version {PRIVACY_VERSION}</p>
      </header>

      <Section title="Qui est responsable de tes données ?">
        <p>[À COMPLÉTER : nom de la structure ou de l&apos;entrepreneur qui exploite NMRY Coaching, adresse, numéro SIRET.]</p>
        <p>Pour toute question ou demande : <a className="font-bold text-accent" href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>.</p>
      </Section>

      <Section title="Les données que l'appli utilise">
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Compte</b> : prénom, nom, email, mot de passe (stocké chiffré, jamais lisible).</li>
          <li><b>Profil</b> : photo, date de naissance, genre, sports pratiqués, compte Instagram, ville.</li>
          <li><b>Entraînement</b> : séances, charges, répétitions, RPE, ressenti, durées, records, objectifs et compétitions, vacances.</li>
          <li><b>Santé</b> : blessures, douleurs, poids, mensurations, diète. Ce sont des données sensibles, utilisées uniquement avec ton accord explicite.</li>
          <li><b>Messages</b> avec ton coach : textes, vocaux, photos et vidéos.</li>
          <li><b>Notes de suivi</b> que ton coach garde pour lui (par exemple une douleur à surveiller ou un exercice à remplacer). Tu peux en demander la communication.</li>
          <li><b>Notifications</b> : l&apos;identifiant technique de ton téléphone si tu les actives.</li>
        </ul>
      </Section>

      <Section title="Pourquoi">
        <ul className="list-disc space-y-1 pl-5">
          <li>Permettre à ton coach de programmer et suivre ton entraînement (exécution du service).</li>
          <li>Adapter l&apos;entraînement à ta santé (ton consentement explicite, que tu peux retirer).</li>
          <li>Échanger avec ton coach et recevoir des rappels.</li>
          <li>Carte de la communauté et partage de tes victoires : seulement si tu les actives dans ton profil.</li>
        </ul>
        <p>Aucune publicité, aucune revente, aucun outil de mesure d&apos;audience.</p>
      </Section>

      <Section title="Qui y a accès">
        <p>Ton coach, pour ses seuls sportifs, et l&apos;administrateur technique de l&apos;appli pour la maintenance. Les autres sportifs ne voient rien, sauf ce que tu choisis de partager (carte, victoires).</p>
        <p>Prestataires techniques qui hébergent ou transportent les données : Supabase (base de données et fichiers, région [À VÉRIFIER dans Supabase]), Vercel (hébergement de l&apos;appli), OVH et Google (envoi des emails), Apple, Google et Mozilla (notifications), OpenStreetMap (recherche de ta ville, depuis ton navigateur). Vercel et Google sont des sociétés américaines : les transferts sont encadrés par le Data Privacy Framework et les clauses contractuelles types de la Commission européenne.</p>
      </Section>

      <Section title="Combien de temps">
        <p>Tant que ton compte existe. Quand tu le supprimes, tes données et tes fichiers sont effacés immédiatement. [À COMPLÉTER : durée au-delà de laquelle un compte inactif est supprimé.]</p>
      </Section>

      <Section title="Tes droits">
        <p>Tu peux accéder à tes données, les corriger, les récupérer, les effacer, retirer ton consentement ou t&apos;opposer à un traitement.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Télécharger tes données</b> et <b>supprimer ton compte</b> : Réglages → Compte, directement dans l&apos;appli.</li>
          <li>Pour le reste : écris à <a className="font-bold text-accent" href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>, réponse sous un mois.</li>
          <li>Tu peux aussi saisir la CNIL (cnil.fr).</li>
        </ul>
      </Section>

      <Section title="Cookies et stockage local">
        <p>Uniquement ce qui est nécessaire : la session de connexion et tes préférences d&apos;affichage (thème, dernier écran). Pas de cookie publicitaire ni de pistage, donc pas de bandeau cookies.</p>
      </Section>

      <Section title="Moins de 15 ans">
        <p>Si tu as moins de 15 ans, l&apos;accord d&apos;un de tes parents est nécessaire pour utiliser l&apos;appli.</p>
      </Section>

      <Section title="Sécurité">
        <p>Connexions chiffrées, accès cloisonné par coach, données vérifiées côté serveur. En cas de violation de données, la CNIL et les personnes concernées sont prévenues comme la loi l&apos;exige.</p>
      </Section>
    </main>
  );
}
