// Affichage public d'un nom. Le site promet que l'identité reste privée : un signalement
// peut viser un voisin, un commerce ou un service public, et on ne veut pas qu'un
// habitant soit identifiable par tout le village parce qu'il a alerté sur un dépôt sauvage.
//
// « Combo Nazridine » -> « Combo N. ». Le prénom seul reste (rien à abréger), et un pseudo
// choisi par l'utilisateur est affiché tel quel : c'est lui qui décide de ce qu'il montre.

export function nomPublic(nom) {
  if (typeof nom !== 'string') return ''
  const parties = nom.trim().split(/\s+/).filter(Boolean)
  if (parties.length === 0) return ''
  if (parties.length === 1) return parties[0]

  const prenom = parties[0]
  const nomFamille = parties[parties.length - 1]
  const initiale = [...nomFamille][0]
  return `${prenom} ${initiale.toUpperCase()}.`
}
