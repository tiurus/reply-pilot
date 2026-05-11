import { createStorage, StorageEnum } from '../base/index.js';
import type { AiSettings, BaseStorageType } from '../base/index.js';

export const defaultAiSettings: AiSettings = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4.1-mini',
  temperature: 0.7,
  tone: 'neutral',
  replyGender: 'masculine',
};

export const aiSettingsStorage: BaseStorageType<AiSettings> = createStorage<AiSettings>(
  'reply-pilot-ai-settings',
  defaultAiSettings,
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);
