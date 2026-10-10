import { useEffect, useId, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Camera, Check } from 'lucide-react'
import { updateProfile } from 'firebase/auth'
import { deleteField } from 'firebase/firestore'
import { useAuth } from '../components/AuthProvider'
import { useToast } from '../components/Toast'
import { uploadAvatar } from '../lib/photos'
import { fetchProfile, saveProfile, YEARS } from '../lib/users'
import { updateListerOnListings } from '../lib/listings'
import { GENDERS, GENDER_SELF_MAX, invalidateMyGroup } from '../lib/gender'
import type { Gender } from '../lib/gender'

// "Add a face to your name". Shown once, after a first listing goes live
// (and later after a first message). Every field is optional.
export default function ProfileSetup() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/'
  const fileId = useId()

  const [photoUrl, setPhotoUrl] = useState<string | undefined>()
  const [year, setYear] = useState<string | undefined>()
  const [bio, setBio] = useState('')
  const [gender, setGender] = useState<Gender | undefined>()
  const [genderSelf, setGenderSelf] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    fetchProfile(user.uid).then((p) => {
      if (!p) return
      setPhotoUrl(p.photoUrl)
      setYear(p.gradYear)
      setBio(p.bio ?? '')
      setGender(p.gender)
      setGenderSelf(p.genderSelfDescribe ?? '')
    })
  }, [user])

  useEffect(() => {
    if (!loading && !user) navigate('/', { replace: true })
  }, [loading, user, navigate])

  if (!user) return null

  async function pickPhoto(file: File | undefined) {
    if (!file || !user) return
    setUploading(true)
    setError(null)
    try {
      setPhotoUrl(await uploadAvatar(user.uid, file))
    } catch (e) {
      console.error('[handoff] avatar', e)
      setError("That photo didn't upload. Try another one.")
    } finally {
      setUploading(false)
    }
  }

  async function finish(skip: boolean) {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      if (skip) {
        await saveProfile(user.uid, { onboardingStep: 'skipped' })
      } else {
        await saveProfile(user.uid, {
          ...(photoUrl ? { photoUrl } : {}),
          ...(year ? { gradYear: year } : {}),
          bio: bio.trim(),
          gender: gender ?? deleteField(),
          genderSelfDescribe: gender === 'self' && genderSelf.trim() ? genderSelf.trim() : deleteField(),
          onboardingStep: 'done',
        })
        invalidateMyGroup()
        if (photoUrl) await updateProfile(user, { photoURL: photoUrl })
        await updateListerOnListings(user.uid, { photoUrl, year })
        toast('Profile saved')
      }
      navigate(next, { replace: true })
    } catch (e) {
      console.error('[handoff] profile', e)
      setError("Couldn't save. Check your connection and try again.")
      setSaving(false)
    }
  }

  const name = user.displayName || 'You'

  return (
    <div className="page verify">
      <h1 className="title">Add a face to your name</h1>
      <p className="muted">Help people know who they're talking to.</p>

      <label htmlFor={fileId} className="avatar-picker">
        {photoUrl ? (
          <img src={photoUrl} alt="Your profile photo" />
        ) : (
          <span className="avatar avatar-lg" aria-hidden="true">
            {name[0]}
          </span>
        )}
        <span className="avatar-cam" aria-hidden="true">
          <Camera size={18} strokeWidth={2} />
        </span>
        <span className="sr-only">{photoUrl ? 'Change photo' : 'Add a photo'}</span>
        <input
          id={fileId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => void pickPhoto(e.target.files?.[0])}
          disabled={uploading}
        />
      </label>
      {uploading && <p className="caption muted center">Uploading…</p>}

      <fieldset className="field chip-field">
        <legend className="label">Year</legend>
        <div className="chips-wrap">
          {YEARS.map((y) => (
            <button
              key={y}
              type="button"
              className={year === y ? 'chip chip-on' : 'chip'}
              aria-pressed={year === y}
              onClick={() => setYear(year === y ? undefined : y)}
            >
              {year === y && <Check size={14} strokeWidth={2} aria-hidden="true" />}
              {y}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="field chip-field">
        <legend className="label">Gender (optional)</legend>
        <div className="chips-wrap">
          {GENDERS.map(([g, label]) => (
            <button
              key={g}
              type="button"
              className={gender === g ? 'chip chip-on' : 'chip'}
              aria-pressed={gender === g}
              onClick={() => setGender(gender === g ? undefined : g)}
            >
              {gender === g && <Check size={14} strokeWidth={2} aria-hidden="true" />}
              {label}
            </button>
          ))}
        </div>
        {gender === 'self' && (
          <input
            className="input gender-self"
            aria-label="Your gender, in your words"
            maxLength={GENDER_SELF_MAX}
            placeholder="In your words"
            value={genderSelf}
            onChange={(e) => setGenderSelf(e.target.value)}
          />
        )}
        <p className="helper">Only you see this. We use it to show places that are open to you. Leave it blank if you'd rather not say.</p>
      </fieldset>

      <div className="field">
        <label htmlFor="bio">Short bio</label>
        <textarea
          id="bio"
          className="input textarea"
          rows={3}
          maxLength={140}
          placeholder="Ag business junior, quiet, early riser"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
        <p className="helper">{bio.length} / 140</p>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="verify-actions">
        <button type="button" className="btn btn-primary btn-block" disabled={saving || uploading} onClick={() => finish(false)}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="link-btn center-block" disabled={saving} onClick={() => finish(true)}>
          Skip for now
        </button>
      </div>
    </div>
  )
}
