export function isValidEmail(email: string): boolean {
  if (email.length === 0 || email.length > 254) {
    return false;
  }
  if (/\s/.test(email)) {
    return false;
  }
  const atParts = email.split("@");
  if (atParts.length !== 2) {
    return false;
  }
  const [local, domain] = atParts;
  if (!local || !domain) {
    return false;
  }
  const domainParts = domain.split(".");
  if (domainParts.length < 2) {
    return false;
  }
  return domainParts.every((part) => part.length > 0);
}
