<template>
  <div class="skeleton-card card h-100" aria-hidden="true">
    <div class="skeleton-block skeleton-image"></div>
    <div class="card-body">
      <div class="d-flex justify-content-between mb-3">
        <div class="skeleton-block skeleton-badge"></div>
        <div class="skeleton-block skeleton-badge"></div>
      </div>
      <div class="skeleton-block skeleton-line skeleton-line--title"></div>
      <div class="skeleton-block skeleton-line"></div>
      <div class="skeleton-block skeleton-line skeleton-line--short"></div>
    </div>
  </div>
</template>

<style scoped>
.skeleton-card {
  overflow: hidden;
  border-radius: 8px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
}

.skeleton-block {
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.06) 25%, rgba(255, 255, 255, 0.14) 37%, rgba(255, 255, 255, 0.06) 63%);
  background-size: 400% 100%;
  animation: skeleton-shimmer 1.4s ease infinite;
  border-radius: 4px;
}

.skeleton-image {
  width: 100%;
  height: 170px;
  border-radius: 0;
}

.skeleton-badge {
  width: 80px;
  height: 20px;
  border-radius: 999px;
}

.skeleton-line {
  height: 12px;
  margin-bottom: 8px;
}

.skeleton-line--title {
  width: 60%;
  height: 16px;
  margin-bottom: 12px;
}

.skeleton-line--short {
  width: 40%;
  margin-bottom: 0;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: 0 0;
  }
}
</style>
