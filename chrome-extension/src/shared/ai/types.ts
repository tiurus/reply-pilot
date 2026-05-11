import type { AiSettings } from '@extension/storage';

export type { AiSettings };

export type ChatMessage = {
  text: string;
  direction?: 'incoming' | 'outgoing';
};

export type GenerateSuggestionsInput = {
  draft: string;
  messages: ChatMessage[];
  tone?: 'neutral' | 'friendly' | 'short' | 'funny';
  replyGender?: 'auto' | 'masculine' | 'feminine' | 'neutral';
};

export type GenerateSuggestionsResult = {
  suggestions: string[];
};

export type ExtensionMessage = {
  type: 'GENERATE_SUGGESTIONS';
  payload: GenerateSuggestionsInput;
};

export type ExtensionResponse =
  | {
      ok: true;
      data: GenerateSuggestionsResult;
    }
  | {
      ok: false;
      error: string;
    };
