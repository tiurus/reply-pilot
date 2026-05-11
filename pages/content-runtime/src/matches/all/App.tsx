import { useCallback, useEffect, useMemo, useState } from 'react';

type Suggestion = {
  id: string;
  text: string;
};

type ChatMessage = {
  text: string;
  direction?: 'incoming' | 'outgoing';
};

type GenerateSuggestionsResult = {
  suggestions: string[];
};

type ExtensionResponse =
  | {
      ok: true;
      data: GenerateSuggestionsResult;
    }
  | {
      ok: false;
      error: string;
    };

const TELEGRAM_HOST = 'web.telegram.org';
const MAX_CONTEXT_MESSAGES = 10;

const composerSelectors = [
  '[contenteditable="true"][role="textbox"]',
  '.input-message-input[contenteditable="true"]',
  '#editable-message-text[contenteditable="true"]',
  'div[contenteditable="true"]',
  'textarea',
  'input[type="text"]',
];

const messageSelectors = [
  '[data-message-id] .text-content',
  '[data-message-id] .translatable-message',
  '.message .text-content',
  '.message .translatable-message',
  '.Message .text-content',
  '.bubble-content .text-content',
  '[data-message-id]',
  '.message',
];

const isVisibleElement = (element: Element) => {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

const normalizeText = (text: string) => text.replace(/\s+/g, ' ').trim();

const getElementText = (element: Element) => {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    return element.value;
  }

  return element.textContent ?? '';
};

const findComposer = () => {
  const candidates = composerSelectors
    .flatMap(selector => Array.from(document.querySelectorAll<HTMLElement>(selector)))
    .filter(isVisibleElement)
    .filter(element => !element.closest('[aria-hidden="true"]'));

  return candidates
    .map(element => ({ element, rect: element.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width > 80 && rect.height > 16)
    .sort((a, b) => b.rect.bottom - a.rect.bottom)[0]?.element;
};

const getMessageDirection = (element: Element): ChatMessage['direction'] => {
  const messageContainer = element.closest('[data-message-id], .message, .Message');
  const className = messageContainer?.className.toString().toLowerCase() ?? '';

  if (className.includes('own') || className.includes('out') || className.includes('is-out')) {
    return 'outgoing';
  }

  if (className.includes('in') || className.includes('message')) {
    return 'incoming';
  }

  return undefined;
};

const collectRecentMessages = () => {
  const messages: ChatMessage[] = [];
  const seen = new Set<string>();

  for (const selector of messageSelectors) {
    const elements = Array.from(document.querySelectorAll(selector)).filter(isVisibleElement);

    for (const element of elements) {
      if (element.closest('[contenteditable="true"]')) {
        continue;
      }

      const text = normalizeText(getElementText(element));

      if (text.length < 2 || seen.has(text)) {
        continue;
      }

      seen.add(text);
      messages.push({
        text: text.slice(0, 500),
        direction: getMessageDirection(element),
      });
    }
  }

  return messages.slice(-MAX_CONTEXT_MESSAGES);
};

const insertTextIntoComposer = (composer: HTMLElement, text: string) => {
  composer.focus();

  if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
    const valueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(composer), 'value')?.set;
    valueSetter?.call(composer, text);
    composer.dispatchEvent(new Event('input', { bubbles: true }));
    composer.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(composer);
  selection?.removeAllRanges();
  selection?.addRange(range);

  if (!document.execCommand('insertText', false, text)) {
    composer.textContent = text;
    composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  }
};

const sendGenerateSuggestionsMessage = async (payload: {
  draft: string;
  messages: ChatMessage[];
}): Promise<GenerateSuggestionsResult> => {
  const response = (await chrome.runtime.sendMessage({
    type: 'GENERATE_SUGGESTIONS',
    payload,
  })) as ExtensionResponse;

  if (!response?.ok) {
    throw new Error(response?.error || 'Failed to generate suggestions.');
  }

  return response.data;
};

export default function App() {
  const isTelegramWeb = useMemo(() => window.location.hostname === TELEGRAM_HOST, []);
  const [isReady, setIsReady] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (!isTelegramWeb) {
      return;
    }

    const updateComposerState = () => {
      setIsReady(Boolean(findComposer()));
    };

    updateComposerState();

    const observer = new MutationObserver(updateComposerState);
    observer.observe(document.body, { childList: true, subtree: true });

    const intervalId = window.setInterval(updateComposerState, 2000);

    return () => {
      observer.disconnect();
      window.clearInterval(intervalId);
    };
  }, [isTelegramWeb]);

  const handleSuggest = useCallback(async () => {
    const composer = findComposer();

    if (!composer) {
      setError('Telegram input field was not found.');
      setIsOpen(true);
      return;
    }

    const draft = normalizeText(getElementText(composer));
    const messages = collectRecentMessages();

    setError(null);
    setIsOpen(true);
    setIsLoading(true);
    setSuggestions([]);

    try {
      const result = await sendGenerateSuggestionsMessage({ draft, messages });
      const nextSuggestions = result.suggestions
        .filter(Boolean)
        .slice(0, 3)
        .map((text, index) => ({ id: `${index}-${text}`, text }));

      if (nextSuggestions.length === 0) {
        setError('No suggestions generated. Try again.');
      }

      setSuggestions(nextSuggestions);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to generate suggestions.');
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handlePickSuggestion = useCallback((text: string) => {
    const composer = findComposer();

    if (!composer) {
      setError('Telegram input field was not found.');
      return;
    }

    insertTextIntoComposer(composer, text);
    setIsOpen(false);
  }, []);

  if (!isTelegramWeb) {
    return null;
  }

  return (
    <div className="reply-pilot">
      {isOpen && (
        <section className="reply-pilot-panel" aria-label="ReplyPilot suggestions">
          <div className="reply-pilot-panel-header">
            <div>
              <div className="reply-pilot-title">ReplyPilot</div>
              <div className="reply-pilot-subtitle">AI Copilot for Telegram Web</div>
            </div>
            <button
              className="reply-pilot-icon-button"
              type="button"
              aria-label="Close suggestions"
              onClick={() => setIsOpen(false)}>
              ×
            </button>
          </div>

          {isLoading && <div className="reply-pilot-state">Generating...</div>}
          {error && <div className="reply-pilot-error">{error}</div>}

          {!isLoading && !error && suggestions.length > 0 && (
            <div className="reply-pilot-options">
              {suggestions.map(suggestion => (
                <button
                  className="reply-pilot-option"
                  key={suggestion.id}
                  type="button"
                  onClick={() => handlePickSuggestion(suggestion.text)}>
                  {suggestion.text}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <button
        className="reply-pilot-suggest-button"
        type="button"
        onClick={handleSuggest}
        disabled={isLoading}
        title={isReady ? 'Generate reply suggestions' : 'Open a chat to use ReplyPilot'}>
        <span aria-hidden="true">✨</span>
        Suggest
      </button>
    </div>
  );
}
