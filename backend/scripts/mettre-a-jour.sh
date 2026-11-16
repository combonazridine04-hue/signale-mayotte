#!/bin/sh
# Met à jour l'API de Signale Mayotte (back-end) sur le serveur alwaysdata, en une commande :
#   sh ~/signale-mayotte/backend/scripts/mettre-a-jour.sh
#
# 1. récupère la dernière version du code (branche suivie, passage-mariadb) ;
# 2. installe les dépendances ;
# 3. retire les outils de développement pour économiser le disque ;
# 4. rappelle de redémarrer le site.
# Les données ne sont pas touchées : base MariaDB, photos (data/uploads) et journal
# (data/journal) restent en place. En cas d'erreur, le script s'arrête aussitôt.
set -eu

cd "$(dirname "$0")/.."

echo "→ Récupération du code"
git pull --ff-only

echo "→ Installation des dépendances (sans le navigateur des tests)"
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --no-audit --no-fund

echo "→ Retrait des outils de développement"
npm prune --omit=dev --no-audit --no-fund

echo
echo "✔ Code à jour. Redémarrez le site : panneau alwaysdata → Web → Sites → Redémarrer."
