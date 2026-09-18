<template>
  <main class="py-5">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-12 col-lg-8">
          <p class="section-kicker">Signale Mayotte</p>
          <h1 class="fw-bold mb-4">Confidentialité des données</h1>

          <div class="card-glass rounded p-4 shadow-sm confidentialite-contenu">
            <h2 class="h5 fw-bold">Pourquoi un compte est nécessaire</h2>
            <p class="text-secondary">
              Envoyer un signalement, soutenir un signalement existant ou laisser un
              commentaire nécessite un compte. C'est uniquement pour limiter les abus (faux
              signalements, contenus inappropriés) : ça nous permet, en tant qu'administrateurs,
              de savoir qui a envoyé quoi si besoin de modérer.
            </p>

            <h2 class="h5 fw-bold mt-4">Quelles données sont collectées</h2>
            <ul class="text-secondary">
              <li>Votre nom, votre email et/ou numéro de téléphone (au moins l'un des deux), votre mot de passe (jamais stocké en clair, toujours chiffré).</li>
              <li>Le contenu que vous publiez : signalements, commentaires, photos.</li>
              <li>Les photos sont automatiquement nettoyées de leurs métadonnées (dont la géolocalisation GPS embarquée par les smartphones) avant d'être enregistrées.</li>
            </ul>

            <h2 class="h5 fw-bold mt-4">Qui peut voir quoi</h2>
            <ul class="text-secondary">
              <li><strong>Public</strong> (sans compte) : catégorie, commune, description, photos, statut et commentaires des signalements. Votre identité (nom, email, téléphone) n'est <strong>jamais</strong> affichée publiquement sur un signalement.</li>
              <li><strong>Administrateurs du site</strong> : peuvent voir qui a créé un signalement (nom, email ou téléphone), uniquement pour la modération.</li>
              <li>Vos commentaires affichent le pseudo choisi dans votre profil, ou à défaut le nom associé à votre compte — jamais votre email ni votre téléphone. Vous pouvez modifier ce pseudo à tout moment depuis votre profil.</li>
            </ul>

            <h2 class="h5 fw-bold mt-4">Combien de temps</h2>
            <p class="text-secondary">
              Vos données sont conservées tant que votre compte existe et que vos signalements
              sont en ligne. Vous pouvez supprimer un signalement que vous avez créé à tout moment.
            </p>

            <h2 class="h5 fw-bold mt-4">Vos droits</h2>
            <p class="text-secondary">
              Pour toute question, demande de suppression de votre compte ou de vos données,
              contactez-nous via la page <RouterLink to="/contact">Contact</RouterLink>.
            </p>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
