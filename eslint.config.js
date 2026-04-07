import antfu from '@antfu/eslint-config'

export default antfu(
  {
    ignores: [
      // eslint ignore globs here
      '**/*.md',
      '*.md',
    ],
  },
  {
    rules: {
      // overrides
      'no-console': 'off',
    },
  },
)
