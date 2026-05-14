function getGermanVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find(v => v.lang === 'de-DE' && v.name.toLowerCase().includes('neural')) ??
    voices.find(v => v.lang === 'de-DE') ??
    voices.find(v => v.lang.startsWith('de')) ??
    null
  )
}

export function speakGerman(text: string): void {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'de-DE'
  utterance.rate = 0.9

  const voice = getGermanVoice()
  if (voice) utterance.voice = voice

  window.speechSynthesis.speak(utterance)
}

export function cancelSpeech(): void {
  window.speechSynthesis?.cancel()
}

// Voices load async on some browsers — call once on app start
export function preloadVoices(): void {
  if (!window.speechSynthesis) return
  window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
}
