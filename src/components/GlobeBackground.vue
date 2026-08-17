<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import * as THREE from 'three'
import { feature } from 'topojson-client'
import worldAtlas from 'world-atlas/countries-110m.json'

const canvasEl = ref(null)

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
  const isMobile = window.innerWidth < 768
  globe.position.x = isMobile ? 0.5 : 1.7
  globe.position.y = isMobile ? 0.6 : 0
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

function onScroll() {
  const currentY = window.scrollY
  const delta = currentY - lastScrollY
  lastScrollY = currentY
  velocity = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, velocity + delta * SCROLL_IMPULSE))
}

function onResize() {
  if (!renderer || !camera) return
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  updateComposition()
}

function animate(time) {
  const dt = lastFrameTime ? time - lastFrameTime : 16
  lastFrameTime = time

  globe.rotation.y += velocity * dt
  const targetSpeed = prefersReducedMotion ? 0 : BASE_SPEED
  velocity += (targetSpeed - velocity) * DAMPING

  renderer.render(scene, camera)
  animationId = requestAnimationFrame(animate)
}

onMounted(() => {
  try {
    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    velocity = prefersReducedMotion ? 0 : BASE_SPEED
    lastScrollY = window.scrollY

    initScene()

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    animationId = requestAnimationFrame(animate)
  } catch {
    // WebGL indisponible : le fond sombre uni du site reste affiché.
  }
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onResize)

  scene?.traverse((object) => {
    object.geometry?.dispose()
    object.material?.dispose()
  })
  renderer?.dispose()
})
</script>

<template>
  <canvas ref="canvasEl" class="globe-background" aria-hidden="true"></canvas>
</template>

<style scoped>
.globe-background {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  display: block;
}
</style>
