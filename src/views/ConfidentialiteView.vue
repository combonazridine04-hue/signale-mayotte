<!--
  Politique de confidentialité (RGPD art. 12 à 14). Les durées de conservation annoncées
  ici sont appliquées par server/retention.js : modifier l'un impose de modifier l'autre.
-->
<template>
  <main class="py-5">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-12 col-lg-8">
          <p class="section-kicker">Signale Mayotte</p>
          <h1 class="fw-bold mb-2">Confidentialité des données</h1>
          <p class="text-secondary mb-4">Dernière mise à jour : 25 septembre 2026</p>

          <div class="card-glass rounded p-4 shadow-sm confidentialite-contenu">
            <h2 class="h5 fw-bold">En bref</h2>
            <ul class="text-secondary">
              <li>Votre nom, votre email et votre téléphone ne sont <strong>jamais</strong> affichés publiquement.</li>
              <li>Aucune publicité, aucun traceur, aucune revente de données.</li>
              <li>
                Depuis votre <RouterLink to="/profil">profil</RouterLink>, vous pouvez à tout moment télécharger vos
                données, corriger votre nom ou supprimer votre compte.
              </li>
            </ul>

            <h2 class="h5 fw-bold mt-4">Qui est responsable de vos données</h2>
            <p class="text-secondary">
              Le responsable du traitement est l'équipe de Signale Mayotte, joignable par le
              <RouterLink to="/contact">formulaire de contact</RouterLink> ou à l'adresse
              <a href="mailto:contact@signale-mayotte.yt">contact@signale-mayotte.yt</a>.
            </p>

            <h2 class="h5 fw-bold mt-4">Quelles données, pourquoi, et sur quelle base</h2>
            <div class="table-responsive">
              <table class="table table-sm confidentialite-table">
                <thead>
                  <tr>
                    <th>Données</th>
                    <th>À quoi elles servent</th>
                    <th>Base légale</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Nom, email et/ou téléphone, mot de passe (enregistré sous forme hachée, jamais en clair)</td>
                    <td>Créer et sécuriser votre compte, vous prévenir de l'avancement de vos signalements</td>
                    <td>Exécution du service que vous demandez (art. 6.1.b)</td>
                  </tr>
                  <tr>
                    <td>Pseudo et photo de profil (facultatifs)</td>
                    <td>Signer vos commentaires sans montrer votre nom</td>
                    <td>Exécution du service (art. 6.1.b)</td>
                  </tr>
                  <tr>
                    <td>Signalements : catégorie, commune, description, photos, position, urgence</td>
                    <td>Rendre le problème visible de tous et permettre son traitement par la commune</td>
                    <td>Intérêt légitime : l'amélioration du cadre de vie (art. 6.1.f)</td>
                  </tr>
                  <tr>
                    <td>Commentaires, soutiens, contenus signalés à la modération</td>
                    <td>Faire vivre la discussion et modérer les abus</td>
                    <td>Intérêt légitime (art. 6.1.f)</td>
                  </tr>
                  <tr>
                    <td>Email de suivi d'un signalement (facultatif)</td>
                    <td>Vous prévenir quand le signalement avance</td>
                    <td>Votre consentement, en le saisissant (art. 6.1.a)</td>
                  </tr>
                  <tr>
                    <td>Nom, email et message du formulaire de contact</td>
                    <td>Vous répondre</td>
                    <td>Intérêt légitime (art. 6.1.f)</td>
                  </tr>
                  <tr>
                    <td>
                      Adresse IP : gardée au plus une heure en mémoire, jamais enregistrée dans notre base ; elle figure
                      aussi dans les journaux techniques de l'hébergeur
                    </td>
                    <td>Limiter les envois automatiques et les tentatives de piratage</td>
                    <td>Intérêt légitime : la sécurité du service (art. 6.1.f)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2 class="h5 fw-bold mt-4">Qui peut voir quoi</h2>
            <ul class="text-secondary">
              <li>
                <strong>Tout le monde</strong> : le contenu des signalements (catégorie, commune, description, photos,
                position, statut) et les commentaires, signés de votre pseudo ou, à défaut, de votre prénom suivi de
                l'initiale de votre nom (« Zakaria B. »).
              </li>
              <li>
                <strong>Les administrateurs de la plateforme</strong> : l'auteur d'un signalement (nom, email ou
                téléphone), uniquement pour la modération et le suivi auprès des communes.
              </li>
              <li>Vos données ne sont ni vendues, ni louées, ni utilisées à des fins publicitaires.</li>
            </ul>

            <h2 class="h5 fw-bold mt-4">Prestataires techniques</h2>
            <p class="text-secondary">
              Ces sociétés traitent des données uniquement pour faire fonctionner le site, sur nos instructions :
            </p>
            <ul class="text-secondary">
              <li><strong>Render</strong> (États-Unis) : hébergement du site.</li>
              <li>
                <strong>Supabase</strong> : base de données et photos, stockées sur des serveurs à Londres (Royaume-Uni,
                pays reconnu par l'Union européenne comme protégeant correctement les données).
              </li>
              <li><strong>Brevo</strong> (France) : envoi des emails.</li>
              <li>
                <strong>MapTiler</strong> (Suisse, pays reconnu de la même façon) : fonds de carte. Votre navigateur lui
                transmet votre adresse IP pour afficher la carte.
              </li>
            </ul>

            <h2 class="h5 fw-bold mt-4">Traitement automatique des photos</h2>
            <p class="text-secondary">
              Avant publication, chaque photo est débarrassée de ses informations cachées (dont la position GPS
              enregistrée par les téléphones) et analysée par un logiciel qui détecte les images à caractère sexuel. Une
              photo détectée n'est pas publiée. Si vous pensez qu'une photo a été refusée à tort, écrivez-nous : une
              personne examinera votre demande.
            </p>

            <h2 class="h5 fw-bold mt-4">Combien de temps</h2>
            <ul class="text-secondary">
              <li>
                <strong>Compte</strong> : jusqu'à ce que vous le supprimiez, ou effacé automatiquement après 3 ans sans
                aucune connexion.
              </li>
              <li>
                <strong>Signalements</strong> : tant qu'ils sont en ligne. Si vous supprimez votre compte, ils restent
                visibles <strong>sans aucune information sur vous</strong>, sauf si vous choisissez de les supprimer
                aussi.
              </li>
              <li><strong>Messages de contact</strong> et <strong>notifications</strong> : 12 mois au plus.</li>
              <li>
                <strong>Codes et liens envoyés par email</strong> : 30 minutes pour le code de confirmation, 1 heure
                pour le lien de nouveau mot de passe.
              </li>
              <li><strong>Session de connexion</strong> : 12 heures au plus.</li>
            </ul>

            <h2 class="h5 fw-bold mt-4">Ce que le site garde dans votre navigateur</h2>
            <p class="text-secondary">
              Uniquement ce qui est nécessaire à son fonctionnement : votre session de connexion (effacée à la fermeture
              de l'onglet), votre choix d'ambiance de fond et, le cas échéant, les liens de suppression de vos
              signalements. Aucun cookie publicitaire ni outil de mesure d'audience : aucun bandeau de consentement
              n'est donc nécessaire. La police d'écriture est servie par le site lui-même, et non par un service tiers.
            </p>

            <h2 class="h5 fw-bold mt-4">Sécurité</h2>
            <p class="text-secondary">
              Échanges chiffrés (HTTPS), mots de passe hachés, nombre de tentatives de connexion limité, accès aux
              données personnelles réservé aux administrateurs.
            </p>

            <h2 class="h5 fw-bold mt-4">Vos droits</h2>
            <p class="text-secondary">Vous disposez des droits suivants sur vos données :</p>
            <ul class="text-secondary">
              <li>
                <strong>Accès et portabilité</strong> : bouton « Télécharger mes données » dans votre
                <RouterLink to="/profil">profil</RouterLink> (fichier réutilisable).
              </li>
              <li>
                <strong>Rectification</strong> : nom et pseudo modifiables dans votre profil ; pour un email ou un
                téléphone, écrivez-nous.
              </li>
              <li><strong>Effacement</strong> : bouton « Supprimer mon compte » dans votre profil.</li>
              <li>
                <strong>Opposition et limitation</strong> : par le
                <RouterLink to="/contact">formulaire de contact</RouterLink>.
              </li>
              <li>
                Retrait de votre consentement pour l'email de suivi : à tout moment, par le formulaire de contact.
              </li>
            </ul>
            <p class="text-secondary">
              Nous répondons dans un délai d'un mois. Si vous estimez que vos droits ne sont pas respectés, vous pouvez
              adresser une réclamation à la CNIL (<a href="https://www.cnil.fr/fr/plaintes" rel="noopener"
                >cnil.fr/fr/plaintes</a
              >).
            </p>

            <h2 class="h5 fw-bold mt-4">Mineurs</h2>
            <p class="text-secondary mb-0">
              Avant 15 ans, la création d'un compte nécessite l'accord d'un parent ou d'un responsable légal.
            </p>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
