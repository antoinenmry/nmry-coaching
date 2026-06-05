/* Mode invité : entrer sans compte (données navigateur). Marqué par un cookie
   pour que le middleware et les Server Components puissent l'autoriser. */

export const GUEST_COOKIE = "nmry-guest";

export function isGuestClient(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((c) => c === `${GUEST_COOKIE}=1`);
}

export function setGuest(on: boolean): void {
  if (typeof document === "undefined") return;
  document.cookie = on
    ? `${GUEST_COOKIE}=1; path=/; max-age=31536000; samesite=lax`
    : `${GUEST_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
