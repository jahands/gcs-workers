import GoogleAuth, { GoogleKey } from "./google";

export interface Env {
  GCS_JSON_KEY: string;
  KV: KVNamespace;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const bucketName = "play-powershell";
    const fileName = "DB/Play/JhaContentDB.csv";
    // https://developers.google.com/identity/protocols/oauth2/scopes
    const scopes: string[] = [
      "https://www.googleapis.com/auth/devstorage.full_control",
    ];
    const googleAuth: GoogleKey = JSON.parse(env.GCS_JSON_KEY);

    // Initialize the service
    const oauth = new GoogleAuth(googleAuth, scopes);
    const start = Date.now();
    let token = await env.KV.get("token");
    const end = Date.now();
    console.log(`KV get took ${end - start}ms`);
    if (!token) {
      console.log("getting new token");
      token = await oauth.getGoogleAuthToken();

      if (!token) {
        return new Response("Failed to get token");
      }

      await env.KV.put("token", token, { expirationTtl: 60 });
    }

    // Example with Google Cloud Storage
    const res = await fetch(
      `https://storage.googleapis.com/storage/v1/b/${bucketName}/o/${encodeURIComponent(
        fileName
      )}`,
      {
        method: "PATCH",
        body: JSON.stringify({ customTime: new Date().toISOString() }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    return new Response(res.body);
  },
};
