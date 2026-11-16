import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default [
  {
    ignores: ['dist/**', 'node_modules/**']
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  // Code du navigateur (et règles partagées avec le back-end, dans src/shared/)
  {
    files: ['src/**/*.{js,vue}'],
    languageOptions: {
      globals: { ...globals.browser }
    }
  },

  // Fichiers de configuration (exécutés par Node)
  {
    files: ['*.config.js'],
    languageOptions: {
      globals: { ...globals.node }
    }
  },

  {
    rules: {
      // Un argument ou une variable préfixé par « _ » est volontairement ignoré.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      // Les noms de vues d'un seul mot (HomeView…) sont la convention du projet.
      'vue/multi-word-component-names': 'off'
    }
  },

  // Désactive les règles de mise en forme : c'est le rôle de Prettier.
  prettier
]
