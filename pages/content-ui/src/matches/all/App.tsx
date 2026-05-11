import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    console.log('[ReplyPilot] Content UI loaded');
  }, []);

  return null;
}
