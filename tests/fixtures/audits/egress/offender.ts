// Fixture: audit-egress must reject this file. Never imported by the app.
export async function lookup(): Promise<unknown> {
  const response = await fetch('/rates')
  return response
}
