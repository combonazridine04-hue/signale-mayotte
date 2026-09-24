import * as L from 'leaflet'

const CLE_MAPTILER = import.meta.env.VITE_MAPTILER_KEY

// Sans clé MapTiler configurée (dev local sans .env par ex.), on retombe sur
// OpenStreetMap France : gratuit, sans inscription, mais moins garanti dans le temps.
const URL_TUILES = CLE_MAPTILER
  ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${CLE_MAPTILER}`
  : 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png'

const ATTRIBUTION = CLE_MAPTILER ? '© MapTiler © OpenStreetMap contributors' : '© OpenStreetMap contributors'

export function ajouterCoucheTuiles(carte) {
  L.tileLayer(URL_TUILES, { maxZoom: 18, subdomains: 'abc' }).addTo(carte)
  L.control.attribution({ prefix: false }).addAttribution(ATTRIBUTION).addTo(carte)
}
