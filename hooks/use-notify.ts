export async function sendChatworkNotification(message: string) {
  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
  } catch (e) {
    console.error('Chatwork notification failed:', e)
  }
}
