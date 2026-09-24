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

  // Code du navigateur
  {
    files: ['src/**/*.{js,vue}'],
    languageOptions: {
      globals: { ...globals.browser }
    }
  },

  // Code du serveur, des tests et des outils
  {
    files: ['server/**/*.js', 'tests/**/*.js', '*.config.js'],
    languageOptions: {
      globals: { ...globals.node }
    }
  },

  // Code partagé : exécuté des deux côtés
  {
    files: ['shared/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
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
