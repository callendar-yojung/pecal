# @pecal/theme

Shared design tokens for Pecal Web, Desktop, and Mobile.

## Usage

### Web / Desktop (Tailwind)

In your `tailwind.config.js`:

```js
const { colors, spacing, borderRadius } = require('@pecal/theme');

module.exports = {
  theme: {
    extend: {
      colors: colors.light,
      spacing,
      borderRadius,
    },
  },
};
```

### Mobile (React Native)

```ts
import { colors } from '@pecal/theme';

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.light.background,
    padding: 16,
  },
});
```
