import en from '../messages/en.json';
import ko from '../messages/ko.json';

export const messages = {
  en,
  ko,
} as const;

export type Locale = keyof typeof messages;
export type Messages = typeof messages.en;
