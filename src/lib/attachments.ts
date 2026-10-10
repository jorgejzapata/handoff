import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { storage } from './firebase'
import { decode, newId, resize } from './photos'

// Chat attachments: photos (resized in the browser) and PDFs only.
// Stored at chat-attachments/{senderUid}/{conversationId}/{fileId}. Only the
// two people in the chat ever get the link, through the message itself.

export interface Attachment {
  url: string
  path: string
  name: string
  size: number
  contentType: 'image/jpeg' | 'application/pdf'
  width?: number
  height?: number
}

export const PDF_MAX_BYTES = 10 * 1024 * 1024

export function isAllowedFile(file: File) {
  return file.type.startsWith('image/') || /\.heic$/i.test(file.name) || file.type === 'application/pdf'
}

export async function uploadAttachment(
  uid: string,
  conversationId: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<Attachment> {
  const id = newId()
  const isPdf = file.type === 'application/pdf'

  if (isPdf && file.size > PDF_MAX_BYTES) throw new Error('too-big')

  let blob: Blob = file
  let width: number | undefined
  let height: number | undefined
  let name = file.name.slice(0, 120)
  if (!isPdf) {
    const source = await decode(file)
    const out = await resize(source, 1600)
    if ('close' in source) source.close()
    blob = out.blob
    width = out.width
    height = out.height
    name = name.replace(/\.[^.]+$/, '') + '.jpg'
  }

  const contentType = isPdf ? 'application/pdf' : 'image/jpeg'
  const path = `chat-attachments/${uid}/${conversationId}/${id}.${isPdf ? 'pdf' : 'jpg'}`
  const r = ref(storage, path)
  const task = uploadBytesResumable(r, blob, {
    contentType,
    contentDisposition: isPdf ? `inline; filename="${name.replace(/"/g, '')}"` : undefined,
  })
  task.on('state_changed', (s) => onProgress(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0))
  await task
  const url = await getDownloadURL(r)
  return { url, path, name, size: blob.size, contentType, width, height }
}

export function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
