export const DEFAULT_PERMISSION_PROFILE_ID = ':read-only';

export const FALLBACK_PERMISSION_PROFILES = Object.freeze([{
  id: DEFAULT_PERMISSION_PROFILE_ID,
  description: 'Inspect project files; local writes require automatic review.',
  allowed: true,
}]);

export function normalizePermissionProfiles(result) {
  const profiles = (Array.isArray(result?.data) ? result.data : [])
    .slice(0, 100)
    .map((profile) => ({
      id: String(profile?.id || '').trim().slice(0, 200),
      description: profile?.description
        ? String(profile.description).trim().slice(0, 500)
        : '',
      allowed: profile?.allowed !== false,
    }))
    .filter((profile) => profile.id && profile.allowed);

  return profiles.length > 0
    ? profiles
    : FALLBACK_PERMISSION_PROFILES.map((profile) => ({ ...profile }));
}

export function resolvePermissionProfile(profiles, requested) {
  const allowed = Array.isArray(profiles) ? profiles.filter((profile) => profile?.allowed !== false) : [];
  const requestedId = String(requested || '').trim();
  return allowed.find((profile) => profile.id === requestedId)?.id
    || allowed.find((profile) => profile.id === DEFAULT_PERMISSION_PROFILE_ID)?.id
    || allowed[0]?.id
    || DEFAULT_PERMISSION_PROFILE_ID;
}
