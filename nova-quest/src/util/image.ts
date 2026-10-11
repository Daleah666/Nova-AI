/** Reads an image file and downsizes it to a square-ish data URL small enough for localStorage. */
export function fileToPortrait(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'))
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not load that image.'))
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const g = canvas.getContext('2d')
        if (!g) return reject(new Error('Canvas unavailable.'))
        g.imageSmoothingEnabled = scale < 1
        g.drawImage(img, 0, 0, w, h)
        resolve(file.type === 'image/png' || file.type === 'image/gif' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.88))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
