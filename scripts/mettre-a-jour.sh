#!/bin/sh
# Met à jour Signale Mayotte sur le serveur (alwaysdata), en une commande :
#   sh ~/signale-mayotte/scripts/mettre-a-jour.sh
#
# 1. récupère la dernière version du code (branche main) ;
# 2. installe les dépendances et compile le front (dist/) ;
# 3. retire les outils de développement pour économiser le disque ;
# 4. rappelle de redémarrer le site.
# Les données ne sont pas touchées : base MariaDB, photos (server/data/uploads) et journal
# (server/data/journal) restent en place. En cas d'erreur, le script s'arrête aussitôt.
set -eu

cd "$(dirname "$0")/.."

echo "→ Récupération du code"
git pull --ff-only

echo "→ Installation des dépendances (sans le navigateur des tests)"
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --no-audit --no-fund

echo "→ Compilation du front"
npm run build

echo "→ Retrait des outils de développement"
npm prune --omit=dev --no-audit --no-fund

echo
echo "✔ Code à jour. Redémarrez le site : panneau alwaysdata → Web → Sites → Redémarrer."
