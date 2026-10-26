export function requestOrigin(headersList: Headers): string {
  const host = headersList.get("host") || "localhost:3000";
  const protoHeader = headersList.get("x-forwarded-proto");
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const protocol = protoHeader || (isLocal ? "http" : "https");
  return `${protocol}://${host}`;
}
