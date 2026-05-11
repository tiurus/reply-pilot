import '@src/Popup.css';
import { t } from '@extension/i18n';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { aiSettingsStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useEffect, useState } from 'react';

const notificationOptions = {
  type: 'basic',
  iconUrl: chrome.runtime.getURL('icon-34.png'),
  title: 'Injecting content script error',
  message: 'You cannot inject script here!',
} as const;

const clampTemperature = (value: number) => Math.min(2, Math.max(0, value));

const Popup = () => {
  const settings = useStorage(aiSettingsStorage);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [model, setModel] = useState(settings.model);
  const [temperature, setTemperature] = useState(settings.temperature.toString());
  const [tone, setTone] = useState(settings.tone ?? 'neutral');
  const [replyGender, setReplyGender] = useState(settings.replyGender ?? 'masculine');
  const [status, setStatus] = useState('');

  useEffect(() => {
    setApiKey(settings.apiKey);
    setModel(settings.model);
    setTemperature(settings.temperature.toString());
    setTone(settings.tone ?? 'neutral');
    setReplyGender(settings.replyGender ?? 'masculine');
  }, [settings.apiKey, settings.model, settings.temperature, settings.tone, settings.replyGender]);

  const handleSave = async () => {
    const normalizedTemperature = clampTemperature(Number.parseFloat(temperature) || 0);

    await aiSettingsStorage.set({
      provider: 'openai',
      apiKey: apiKey.trim(),
      model: model.trim() || 'gpt-4.1-mini',
      temperature: normalizedTemperature,
      tone,
      replyGender,
    });

    setTemperature(normalizedTemperature.toString());
    setStatus('Settings saved.');
    window.setTimeout(() => setStatus(''), 1800);
  };

  const injectContentScript = async () => {
    const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });

    if (tab.url!.startsWith('about:') || tab.url!.startsWith('chrome:')) {
      chrome.notifications.create('inject-error', notificationOptions);
    }

    await chrome.scripting
      .executeScript({
        target: { tabId: tab.id! },
        files: ['/content-runtime/example.iife.js', '/content-runtime/all.iife.js'],
      })
      .catch(err => {
        if (err.message.includes('Cannot access a chrome:// URL')) {
          chrome.notifications.create('inject-error', notificationOptions);
        }
      });
  };

  return (
    <main className="reply-pilot-popup">
      <header className="reply-pilot-popup-header">
        <div>
          <h1>ReplyPilot</h1>
          <p>AI Copilot for Telegram Web</p>
        </div>
      </header>

      <label className="reply-pilot-field">
        <span>API Key</span>
        <input
          autoComplete="off"
          onChange={event => setApiKey(event.target.value)}
          placeholder="sk-..."
          type="password"
          value={apiKey}
        />
      </label>

      <label className="reply-pilot-field">
        <span>Model</span>
        <input onChange={event => setModel(event.target.value)} placeholder="gpt-4.1-mini" type="text" value={model} />
      </label>

      <label className="reply-pilot-field">
        <span>Temperature</span>
        <input
          max="2"
          min="0"
          onChange={event => setTemperature(event.target.value)}
          step="0.1"
          type="number"
          value={temperature}
        />
      </label>

      <label className="reply-pilot-field">
        <span>Tone</span>
        <select onChange={event => setTone(event.target.value as typeof tone)} value={tone}>
          <option value="neutral">Neutral</option>
          <option value="friendly">Friendly</option>
          <option value="short">Short</option>
          <option value="funny">Funny</option>
        </select>
      </label>

      <label className="reply-pilot-field">
        <span>Reply gender</span>
        <select onChange={event => setReplyGender(event.target.value as typeof replyGender)} value={replyGender}>
          <option value="masculine">Masculine</option>
          <option value="feminine">Feminine</option>
          <option value="neutral">Neutral wording</option>
          <option value="auto">Auto</option>
        </select>
      </label>

      <button className="reply-pilot-save-button" type="button" onClick={handleSave}>
        Save settings
      </button>

      {status && <div className="reply-pilot-save-status">{status}</div>}

      <button
        className={cn('mt-4 rounded px-4 py-1 font-bold shadow hover:scale-105', 'bg-blue-200 text-black')}
        onClick={injectContentScript}>
        {t('injectButton')}
      </button>
    </main>
  );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay);
