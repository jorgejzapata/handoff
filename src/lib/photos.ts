import { deleteObject, getDownloadURL, ref, uploadBytes, uploadBytesResumable } from 'firebase/storage'
import { storage } from './firebase'
import type { Photo } from './listings'
import { track } from './track'

// Photos are resized in the browser before upload, so big phone photos never
// fail for size and listings load fast. Storage paths include the owner's uid,
// which is what the Storage rules check:
//   listing-photos/{uid}/{listingId}/{photoId}.jpg      1600px long edge
//   listing-photos/{uid}/{listingId}/{photoId}_400.jpg  400px thumbnail
//   avatars/{uid}.jpg

export async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Fallback for formats createImageBitmap can't read (some HEIC on Safari).
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

export async function resize(source: ImageBitmap | HTMLImageElement, longEdge: number, square = false) {
  const w = source.width
  const h = source.height
  let sx = 0
  let sy = 0
  let sw = w
  let sh = h
  if (square) {
    const side = Math.min(w, h)
    sx = (w - side) / 2
    sy = (h - side) / 2
    sw = sh = side
  }
  const scale = Math.min(1, longEdge / Math.max(sw, sh))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(sw * scale)
  canvas.height = Math.round(sh * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
  if (!blob) throw new Error("Couldn't process that photo")
  return { blob, width: canvas.width, height: canvas.height }
}

export function newId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}

export async function uploadListingPhoto(
  uid: string,
  listingId: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<Photo> {
  const source = await decode(file)
  const [full, thumb] = await Promise.all([resize(source, 1600), resize(source, 400)])
  if ('close' in source) source.close()

  const id = newId()
  const path = `listing-photos/${uid}/${listingId}/${id}.jpg`
  const thumbPath = `listing-photos/${uid}/${listingId}/${id}_400.jpg`
  const meta = { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000' }

  const task = uploadBytesResumable(ref(storage, path), full.blob, meta)
  task.on('state_changed', (s) => onProgress(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0))
  await task
  await uploadBytes(ref(storage, thumbPath), thumb.blob, meta)

  const [url, thumbUrl] = await Promise.all([getDownloadURL(ref(storage, path)), getDownloadURL(ref(storage, thumbPath))])
  track('photo_uploaded', { listing_id: listingId })
  return { id, path, url, thumbUrl, width: full.width, height: full.height }
}

export async function deleteListingPhoto(photo: Photo) {
  const thumbPath = photo.path.replace(/\.jpg$/, '_400.jpg')
  await Promise.all([
    deleteObject(ref(storage, photo.path)).catch(() => {}),
    deleteObject(ref(storage, thumbPath)).catch(() => {}),
  ])
}

export async function uploadAvatar(uid: string, file: File) {
  const source = await decode(file)
  const { blob } = await resize(source, 400, true)
  if ('close' in source) source.close()
  const r = ref(storage, `avatars/${uid}.jpg`)
  await uploadBytes(r, blob, { contentType: 'image/jpeg', cacheControl: 'public, max-age=300' })
  return getDownloadURL(r)
}
