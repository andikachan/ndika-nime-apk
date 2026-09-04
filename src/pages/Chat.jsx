import React, { useEffect } from 'react';
import Chat from '../components/Chat';
import { setSeoMeta, SITE_URL } from '../utils/seo';

const ChatPage = () => {
  const { user } = useAuth(); // Sesuaikan dengan auth context kamu

  useEffect(() => {
    setSeoMeta(
      'Chat Global | Ndichan',
      'Ngobrol bareng komunitas penggemar anime dan komik di Chat Global Ndichan.',
      null,
      `${SITE_URL}/chat`,
      { noIndex: true }
    );
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-6">💬 Chat Global</h1>
      <div className="h-[600px]">
        <Chat user={user} showLoginPopup={() => setShowLoginPopup(true)} />
      </div>
    </div>
  );
};

export default ChatPage;