import { buildSuggestionsPrompt } from './prompt.js';
import type { AiSettings, GenerateSuggestionsInput, GenerateSuggestionsResult } from './types.js';

const OPENAI_RESPONSES_API_URL = 'https://api.openai.com/v1/responses';
const MAX_SUGGESTIONS = 3;
const MAX_SUGGESTION_LENGTH = 500;

const sanitizeSuggestions = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((suggestion): suggestion is string => typeof suggestion === 'string')
    .map(suggestion => suggestion.trim())
    .filter(Boolean)
    .slice(0, MAX_SUGGESTIONS)
    .map(suggestion => suggestion.slice(0, MAX_SUGGESTION_LENGTH));
};

const extractTextFromResponse = (data: unknown) => {
  if (typeof data !== 'object' || data === null) {
    return '';
  }

  const response = data as {
    output_text?: unknown;
    output?: Array<{
      content?: Array<{
        text?: unknown;
      }>;
    }>;
  };

  if (typeof response.output_text === 'string') {
    return response.output_text;
  }

  return (
    response.output
      ?.flatMap(item => item.content ?? [])
      .map(content => content.text)
      .filter((text): text is string => typeof text === 'string')
      .join('\n') ?? ''
  );
};

const parseSuggestionsJson = (text: string): GenerateSuggestionsResult => {
  const parse = (source: string) => {
    const parsed = JSON.parse(source) as { suggestions?: unknown };
    return { suggestions: sanitizeSuggestions(parsed.suggestions) };
  };

  try {
    return parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*"suggestions"[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Failed to parse AI response.');
    }

    return parse(jsonMatch[0]);
  }
};

export const generateSuggestions = async (
  input: GenerateSuggestionsInput,
  settings: AiSettings,
): Promise<GenerateSuggestionsResult> => {
  if (!settings.apiKey.trim()) {
    throw new Error('Add your API key in extension settings.');
  }

  const response = await fetch(OPENAI_RESPONSES_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      input: buildSuggestionsPrompt(input),
      temperature: settings.temperature,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage =
      typeof data === 'object' && data !== null && 'error' in data
        ? ((data as { error?: { message?: string } }).error?.message ?? 'Failed to generate suggestions.')
        : 'Failed to generate suggestions.';

    throw new Error(errorMessage);
  }

  return parseSuggestionsJson(extractTextFromResponse(data));
};
