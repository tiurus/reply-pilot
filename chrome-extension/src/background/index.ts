import 'webextension-polyfill';
import { aiSettingsStorage } from '@extension/storage';
import { generateSuggestions } from '@src/shared/ai/openai-client';
import type { ExtensionMessage, ExtensionResponse, GenerateSuggestionsInput } from '@src/shared/ai/types';

const handleGenerateSuggestions = async (payload: GenerateSuggestionsInput) => {
  const settings = await aiSettingsStorage.get();

  return generateSuggestions(
    {
      ...payload,
      tone: payload.tone ?? settings.tone ?? 'neutral',
      replyGender: payload.replyGender ?? settings.replyGender ?? 'masculine',
    },
    settings,
  );
};

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse: (response: ExtensionResponse) => void) => {
    if (message.type !== 'GENERATE_SUGGESTIONS') {
      return;
    }

    handleGenerateSuggestions(message.payload)
      .then(data => sendResponse({ ok: true, data }))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to generate suggestions.';
        sendResponse({ ok: false, error: message || 'Failed to generate suggestions.' });
      });

    return true;
  },
);
