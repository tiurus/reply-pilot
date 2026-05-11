import type { GenerateSuggestionsInput } from './types.js';

const genderInstructions: Record<NonNullable<GenerateSuggestionsInput['replyGender']>, string> = {
  auto: 'Определи по черновику и контексту. Если неясно, избегай форм, где нужен род говорящего.',
  masculine: 'Пиши от мужского лица, если в ответе нужны формы рода: "понял", "готов", "сделал".',
  feminine: 'Пиши от женского лица, если в ответе нужны формы рода: "поняла", "готова", "сделала".',
  neutral: 'Избегай форм, где нужен род говорящего. Формулируй нейтрально.',
};

const formatMessages = (messages: GenerateSuggestionsInput['messages']) => {
  if (messages.length === 0) {
    return 'Сообщений нет.';
  }

  return messages
    .map(message => {
      const author = message.author ? `${message.author}: ` : '';
      const direction = message.direction ? `[${message.direction}] ` : '';
      return `${direction}${author}${message.text}`;
    })
    .join('\n');
};

export const buildSuggestionsPrompt = ({
  draft,
  messages,
  tone = 'neutral',
  replyGender = 'masculine',
}: GenerateSuggestionsInput) => `Ты ReplyPilot — AI-помощник для ответов в Telegram.

Задача:
Сгенерируй 3 варианта ответа на основе контекста переписки и черновика пользователя.

Правила:
- Пиши на языке переписки.
- Ответы должны быть естественными, как живой человек.
- Не используй канцелярит.
- Не объясняй свои действия.
- Не добавляй нумерацию.
- Не отправляй сообщение сам.
- Если контекста мало, предложи нейтральные варианты.
- Если черновик есть, улучши или продолжи его.
- Каждый вариант должен быть коротким: 1–2 предложения.

Тон:
${tone}

Пол автора ответа:
${genderInstructions[replyGender]}

Последние сообщения:
${formatMessages(messages)}

Черновик пользователя:
${draft || 'Черновика нет.'}

Верни результат строго в JSON:
{
  "suggestions": [
    "вариант 1",
    "вариант 2",
    "вариант 3"
  ]
}`;
