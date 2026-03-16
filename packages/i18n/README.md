# @pecal/i18n

Shared translation files for Pecal Web, Desktop, and Mobile.

## Usage

### Web (Next-Intl)

In `i18n/request.ts`:

```ts
import { messages } from '@pecal/i18n';

// Load from shared package
const localeMessages = messages[locale];
```

### Mobile / Desktop

```ts
import { messages } from '@pecal/i18n';

// Use with your i18n library (e.g., i18next)
i18next.init({
  resources: {
    en: { translation: messages.en },
    ko: { translation: messages.ko },
  },
});
```
