const KEY = "asd.safety.accepted.v1";

export function hasAcceptedSafety(): boolean {
  try {
    return localStorage.getItem(KEY) === "yes";
  } catch {
    return false;
  }
}

export function acceptSafety(): void {
  localStorage.setItem(KEY, "yes");
}
