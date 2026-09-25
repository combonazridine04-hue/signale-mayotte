<script setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import * as THREE from 'three'
import { feature } from 'topojson-client'
import worldAtlas from 'world-atlas/countries-110m.json'

const canvasEl = ref(null)
// Change de valeur pour forcer Vue à remplacer l'élément canvas (seule façon de
// récupérer un contexte WebGL après une perte définitive).
const cleCanvas = ref(0)

const RADIUS = 2
const BASE_SPEED = 0.00035
const SCROLL_IMPULSE = 0.00004
const MAX_SPEED = 0.02
const DAMPING = 0.02

let renderer = null
let scene = null
let camera = null
let globe = null
let animationId = null
let lastFrameTime = 0
let lastScrollY = 0
let velocity = BASE_SPEED
let prefersReducedMotion = false
let contextePerdu = false
let delaiReprise = null

// --- Version de secours en 2D ---
// Si le navigateur ne sait pas afficher la 3D (WebGL absent, désactivé ou planté à
// répétition), le même globe est redessiné avec le canvas 2D : mêmes lignes, même
// inclinaison, même rotation. Le globe ne doit jamais disparaître.
let mode2D = false
let contexte2D = null
let tracesGraticule = []
let tracesPays = []
let rotationY2D = 0
let echecsWebGL = 0
const ECHECS_AVANT_2D = 3
const INTERVALLE_2D_MS = 33 // ~30 images/s : largement assez pour une rotation lente

function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

function buildGraticule(radius) {
  const points = []
  const steps = 64

  for (let lat = -75; lat <= 75; lat += 15) {
    for (let i = 0; i < steps; i++) {
      points.push(latLonToVector3(lat, (i / steps) * 360 - 180, radius))
      points.push(latLonToVector3(lat, ((i + 1) / steps) * 360 - 180, radius))
    }
  }

  for (let lon = -180; lon < 180; lon += 15) {
    for (let i = 0; i < steps; i++) {
      points.push(latLonToVector3((i / steps) * 180 - 90, lon, radius))
      points.push(latLonToVector3(((i + 1) / steps) * 180 - 90, lon, radius))
    }
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 })
  )
}

function buildCountryBorders(radius) {
  const geo = feature(worldAtlas, worldAtlas.objects.countries)
  const points = []

  const addRing = (ring) => {
    for (let i = 0; i < ring.length - 1; i++) {
      const [lon1, lat1] = ring[i]
      const [lon2, lat2] = ring[i + 1]
      points.push(latLonToVector3(lat1, lon1, radius))
      points.push(latLonToVector3(lat2, lon2, radius))
    }
  }

  geo.features.forEach((countryFeature) => {
    const { type, coordinates } = countryFeature.geometry
    if (type === 'Polygon') {
      coordinates.forEach(addRing)
    } else if (type === 'MultiPolygon') {
      coordinates.forEach((polygon) => polygon.forEach(addRing))
    }
  })

  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
  )
}

function updateComposition() {
  if (!globe) return
  const aspect = window.innerWidth / window.innerHeight
  const isMobile = window.innerWidth < 768
  globe.position.x = isMobile ? 0.5 : 1.7
  globe.position.y = isMobile ? 0.6 : 0

  // Le champ de vision de la caméra est fixe verticalement, mais sur un écran
  // étroit et haut (téléphone en portrait), le champ de vision horizontal est
  // bien plus réduit : la sphère semble alors occuper tout l'écran. On la
  // réduit proportionnellement pour qu'elle reste un élément de fond discret,
  // comme sur desktop, au lieu de déborder bord à bord.
  const echelle = Math.min(1, Math.max(0.55, aspect / 0.9))
  globe.scale.setScalar(echelle)
}

function initScene() {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.z = 5.4

  renderer = new THREE.WebGLRenderer({ canvas: canvasEl.value, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight, false)

  globe = new THREE.Group()
  globe.add(buildGraticule(RADIUS))
  globe.add(buildCountryBorders(RADIUS * 1.004))
  globe.rotation.x = 0.28
  globe.rotation.z = 0.35
  scene.add(globe)

  updateComposition()
}

// Points du globe en coordonnées 3D, calculés une seule fois (mêmes formules que la 3D).
function preparerTraces2D() {
  const point = (lat, lon) => {
    const v = latLonToVector3(lat, lon, RADIUS)
    return [v.x, v.y, v.z]
  }
  const steps = 64
  tracesGraticule = []
  for (let lat = -75; lat <= 75; lat += 15) {
    const ligne = []
    for (let i = 0; i <= steps; i++) ligne.push(point(lat, (i / steps) * 360 - 180))
    tracesGraticule.push(ligne)
  }
  for (let lon = -180; lon < 180; lon += 15) {
    const ligne = []
    for (let i = 0; i <= steps; i++) ligne.push(point((i / steps) * 180 - 90, lon))
    tracesGraticule.push(ligne)
  }

  tracesPays = []
  const geo = feature(worldAtlas, worldAtlas.objects.countries)
  const ajouterAnneau = (anneau) => tracesPays.push(anneau.map(([lon, lat]) => point(lat, lon)))
  geo.features.forEach(({ geometry }) => {
    if (geometry.type === 'Polygon') geometry.coordinates.forEach(ajouterAnneau)
    else if (geometry.type === 'MultiPolygon') geometry.coordinates.forEach((p) => p.forEach(ajouterAnneau))
  })
}

// Reproduit la caméra 3D (champ de 45°, recul de 5,4) pour placer et dimensionner le
// globe au même endroit que la version 3D.
function composition2D(largeur, hauteur) {
  const isMobile = window.innerWidth < 768
  const aspect = window.innerWidth / window.innerHeight
  const echelle = Math.min(1, Math.max(0.55, aspect / 0.9))
  const pixelsParUnite = hauteur / (2 * 5.4 * Math.tan((45 / 2) * (Math.PI / 180)))
  // Rayon apparent d'une sphère de rayon 2 vue à 5,4 unités.
  const rayonApparent = 5.4 * Math.tan(Math.asin(RADIUS / 5.4))
  return {
    cx: largeur / 2 + (isMobile ? 0.5 : 1.7) * pixelsParUnite,
    cy: hauteur / 2 - (isMobile ? 0.6 : 0) * pixelsParUnite,
    k: ((rayonApparent * echelle) / RADIUS) * pixelsParUnite
  }
}

function dimensionner2D() {
  const canvas = canvasEl.value
  if (!canvas) return
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(window.innerWidth * ratio)
  canvas.height = Math.round(window.innerHeight * ratio)
}

function dessiner2D() {
  const canvas = canvasEl.value
  if (!canvas || !contexte2D) return
  const { width, height } = canvas
  const { cx, cy, k } = composition2D(width, height)

  // Même ordre de rotations que Three.js (Euler XYZ) : Z, puis Y (rotation animée), puis X.
  const [sz, cz] = [Math.sin(0.35), Math.cos(0.35)]
  const [sy, cy2] = [Math.sin(rotationY2D), Math.cos(rotationY2D)]
  const [sx, cx2] = [Math.sin(0.28), Math.cos(0.28)]
  const projeter = ([x, y, z]) => {
    const x1 = x * cz - y * sz
    const y1 = x * sz + y * cz
    const x2 = x1 * cy2 + z * sy
    const z2 = -x1 * sy + z * cy2
    const y3 = y1 * cx2 - z2 * sx
    return [cx + x2 * k, cy - y3 * k]
  }

  contexte2D.clearRect(0, 0, width, height)
  contexte2D.lineWidth = Math.max(1, (window.devicePixelRatio || 1) * 0.8)
  const tracer = (traces, opacite) => {
    contexte2D.strokeStyle = `rgba(255, 255, 255, ${opacite})`
    contexte2D.beginPath()
    for (const trace of traces) {
      const [x0, y0] = projeter(trace[0])
      contexte2D.moveTo(x0, y0)
      for (let i = 1; i < trace.length; i++) {
        const [x, y] = projeter(trace[i])
        contexte2D.lineTo(x, y)
      }
    }
    contexte2D.stroke()
  }
  tracer(tracesGraticule, 0.2)
  tracer(tracesPays, 0.9)
}

function animer2D(time) {
  if (!mode2D) return
  const dt = lastFrameTime ? Math.min(time - lastFrameTime, 100) : 16
  if (dt >= INTERVALLE_2D_MS || !lastFrameTime) {
    lastFrameTime = time
    rotationY2D += velocity * dt
    const targetSpeed = prefersReducedMotion ? 0 : BASE_SPEED
    velocity += (targetSpeed - velocity) * DAMPING
    dessiner2D()
  }
  animationId = requestAnimationFrame(animer2D)
}

async function demarrer2D() {
  if (mode2D) return
  libererScene()
  detacherCanvas()
  mode2D = true
  // Un canvas qui a servi (ou échoué) en WebGL ne peut pas passer en 2D : on en prend un neuf.
  cleCanvas.value += 1
  await nextTick()
  if (!canvasEl.value) return
  contexte2D = canvasEl.value.getContext('2d')
  if (!contexte2D) return
  if (!tracesPays.length) preparerTraces2D()
  dimensionner2D()
  lastFrameTime = 0
  animationId = requestAnimationFrame(animer2D)
}

function webglDisponible() {
  try {
    const essai = document.createElement('canvas')
    return Boolean(essai.getContext('webgl2') || essai.getContext('webgl'))
  } catch {
    return false
  }
}

function onScroll() {
  const currentY = window.scrollY
  const delta = currentY - lastScrollY
  lastScrollY = currentY
  velocity = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, velocity + delta * SCROLL_IMPULSE))
}

function onResize() {
  if (mode2D) {
    dimensionner2D()
    dessiner2D()
    return
  }
  if (!renderer || !camera) return
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  updateComposition()
}

// Libère la scène et le contexte WebGL avant d'en reconstruire un : sans ça chaque
// reprise laissait l'ancien derrière elle, et le navigateur finit par refuser d'en
// créer de nouveaux (limite d'une quinzaine de contextes par onglet).
function libererScene() {
  if (animationId) cancelAnimationFrame(animationId)
  animationId = null

  scene?.traverse((objet) => {
    objet.geometry?.dispose()
    objet.material?.dispose()
  })
  renderer?.dispose()
  renderer = null
  scene = null
  camera = null
  globe = null
}

function attacherCanvas() {
  canvasEl.value.addEventListener('webglcontextlost', onContextLost, false)
  canvasEl.value.addEventListener('webglcontextrestored', onContextRestored, false)
}

function detacherCanvas() {
  canvasEl.value?.removeEventListener('webglcontextlost', onContextLost)
  canvasEl.value?.removeEventListener('webglcontextrestored', onContextRestored)
}

function onContextLost(event) {
  // Les navigateurs mobiles récupèrent agressivement les contextes WebGL sous
  // pression mémoire (changement d'onglet, mise en arrière-plan...). Sans ce
  // handler, le canvas reste vide en permanence après coup.
  event.preventDefault()
  contextePerdu = true
  if (animationId) cancelAnimationFrame(animationId)
  animationId = null

  // `webglcontextrestored` n'arrive pas toujours — sur mobile, souvent jamais. On ne
  // se contente donc pas de l'attendre : on retente nous-mêmes un peu plus tard, et à
  // chaque retour au premier plan. C'était la cause du globe qui disparaissait
  // définitivement après un passage sur une autre application.
  clearTimeout(delaiReprise)
  delaiReprise = setTimeout(reprendre, 1500)
}

function onContextRestored() {
  reprendre()
}

// Un canvas dont le contexte WebGL est perdu ne peut PAS en obtenir un nouveau :
// `getContext()` renvoie le même objet, mort. La seule reprise possible, quand le
// navigateur ne restaure pas de lui-même, est de remplacer l'élément canvas — d'où
// la clé, qui force Vue à en créer un neuf.
async function reprendre() {
  if (document.hidden || mode2D) return
  // Contexte 3D perdu trop souvent : la carte graphique ne suit pas, on passe en 2D.
  echecsWebGL += 1
  if (echecsWebGL >= ECHECS_AVANT_2D) {
    demarrer2D()
    return
  }

  libererScene()
  detacherCanvas()
  cleCanvas.value += 1
  await nextTick()
  if (!canvasEl.value) return

  try {
    attacherCanvas()
    lastFrameTime = 0
    initScene()
    animationId = requestAnimationFrame(animate)
    contextePerdu = false
  } catch {
    // Toujours indisponible : on réessaiera au prochain retour au premier plan.
    contextePerdu = true
  }
}

function onVisibilite() {
  if (document.hidden) return
  if (mode2D) {
    lastFrameTime = 0
    return
  }
  if (contextePerdu) {
    reprendre()
    return
  }
  // Après un long passage en arrière-plan, l'écart entre deux images est énorme :
  // sans remise à zéro, le globe fait un bond d'un quart de tour au retour.
  lastFrameTime = 0
}

function animate(time) {
  // Une seule exception non rattrapée ici arrête la boucle pour de bon, et le globe
  // se fige puis disparaît au premier redimensionnement. On préfère perdre une image.
  try {
    const dt = lastFrameTime ? Math.min(time - lastFrameTime, 100) : 16
    lastFrameTime = time

    globe.rotation.y += velocity * dt
    const targetSpeed = prefersReducedMotion ? 0 : BASE_SPEED
    velocity += (targetSpeed - velocity) * DAMPING

    renderer.render(scene, camera)
    animationId = requestAnimationFrame(animate)
  } catch {
    animationId = null
    contextePerdu = true
    clearTimeout(delaiReprise)
    delaiReprise = setTimeout(reprendre, 1500)
  }
}

onMounted(() => {
  try {
    // Aucune condition de connexion ici : le globe doit toujours s'afficher (voir App.vue).
    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    velocity = prefersReducedMotion ? 0 : BASE_SPEED
    lastScrollY = window.scrollY

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisibilite)

    // « ?globe=2d » force la version de secours, pour pouvoir la vérifier.
    const forcer2D = new URLSearchParams(window.location.search).get('globe') === '2d'
    if (forcer2D || !webglDisponible()) {
      demarrer2D()
      return
    }

    attacherCanvas()
    initScene()
    animationId = requestAnimationFrame(animate)
  } catch {
    // WebGL présent mais inutilisable : version 2D.
    demarrer2D()
  }
})

onUnmounted(() => {
  clearTimeout(delaiReprise)
  detacherCanvas()
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onResize)
  document.removeEventListener('visibilitychange', onVisibilite)

  mode2D = false
  libererScene()
})
</script>

<template>
  <canvas :key="cleCanvas" ref="canvasEl" class="globe-background" aria-hidden="true"></canvas>
</template>
