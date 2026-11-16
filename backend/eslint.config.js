import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default [
  {
    ignores: ['node_modules/**']
  },

  js.configs.recommended,

  // Code du serveur, des tests, des outils et des règles partagées avec le front-end
  {
    files: ['src/**/*.js', 'tests/**/*.js', '*.config.js'],
    languageOptions: {
      globals: { ...globals.node }
    }
  },

  // Le test de parcours exécute aussi du code dans le navigateur (page.evaluate).
  {
    files: ['tests/e2e/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser }
    }
  },

  {
    rules: {
      // Un argument ou une variable préfixé par « _ » est volontairement ignoré.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }]
    }
  },

  // Désactive les règles de mise en forme : c'est le rôle de Prettier.
  prettier
]
