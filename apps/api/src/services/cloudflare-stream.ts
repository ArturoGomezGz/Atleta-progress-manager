const BASE = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/stream`

const headers = () => ({
  Authorization: `Bearer ${process.env.CF_STREAM_API_TOKEN}`,
  "Content-Type": "application/json",
})

export async function createDirectUploadUrl(expirySeconds = 3600): Promise<{ uploadUrl: string; uid: string }> {
  const expiry = new Date(Date.now() + expirySeconds * 1000).toISOString()

  const res = await fetch(`${BASE}/direct_upload`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      maxDurationSeconds: 300, // 5 min max per exercise video
      expiry,
      requireSignedURLs: false,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Cloudflare Stream error ${res.status}: ${text}`)
  }

  const json = await res.json() as { result: { uploadURL: string; uid: string } }
  return { uploadUrl: json.result.uploadURL, uid: json.result.uid }
}

export async function deleteVideo(uid: string): Promise<void> {
  await fetch(`${BASE}/${uid}`, {
    method: "DELETE",
    headers: headers(),
  })
}
