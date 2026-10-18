import { useSyncExternalStore } from 'react';

const NAME_KEY = 'kense.os.profileName';
const AVATAR_KEY = 'kense.os.profileAvatar';

export const PROFILE_NAME_MAX = 32;

type Profile = {
  name: string;
  avatarDataUrl: string | null;
};

function readProfile(): Profile {
  if (typeof window === 'undefined') return { name: '', avatarDataUrl: null };
  const name = window.localStorage.getItem(NAME_KEY) ?? '';
  const raw = window.localStorage.getItem(AVATAR_KEY);
  return {
    name,
    avatarDataUrl: raw && raw.startsWith('data:image/') ? raw : null,
  };
}

let profile = readProfile();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function commit(next: Profile) {
  profile = next;
  if (typeof window !== 'undefined') {
    if (next.name) window.localStorage.setItem(NAME_KEY, next.name);
    else window.localStorage.removeItem(NAME_KEY);
    if (next.avatarDataUrl) {
      window.localStorage.setItem(AVATAR_KEY, next.avatarDataUrl);
    } else {
      window.localStorage.removeItem(AVATAR_KEY);
    }
  }
  emit();
}

export function setProfile(name: string, avatarDataUrl: string | null) {
  const nextName = name.trim().slice(0, PROFILE_NAME_MAX);
  const nextAvatar =
    avatarDataUrl && avatarDataUrl.startsWith('data:image/')
      ? avatarDataUrl
      : null;
  if (nextName === profile.name && nextAvatar === profile.avatarDataUrl) return;
  commit({ name: nextName, avatarDataUrl: nextAvatar });
}

export function subscribeProfile(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useProfile() {
  return useSyncExternalStore(subscribeProfile, () => profile, () => profile);
}
