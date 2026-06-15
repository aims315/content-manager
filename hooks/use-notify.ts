// code を渡すと、コードごとの通知先（Chatworkルーム/Discordチャンネル）に振り分けられる
export async function sendChatworkNotification(message: string, code?: string) {
  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, code }),
    })
  } catch (e) {
    console.error('Notification failed:', e)
  }
}
