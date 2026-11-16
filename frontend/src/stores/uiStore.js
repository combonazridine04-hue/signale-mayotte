import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({
    confirmVisible: false,
    confirmMessage: '',
    confirmResolve: null,
    alertVisible: false,
    alertMessage: ''
  }),

  actions: {
    confirmer(message) {
      this.confirmMessage = message
      this.confirmVisible = true
      return new Promise((resolve) => {
        this.confirmResolve = resolve
      })
    },

    repondreConfirmation(valeur) {
      this.confirmVisible = false
      if (this.confirmResolve) this.confirmResolve(valeur)
      this.confirmResolve = null
    },

    alerter(message) {
      this.alertMessage = message
      this.alertVisible = true
    },

    fermerAlerte() {
      this.alertVisible = false
      this.alertMessage = ''
    }
  }
})
