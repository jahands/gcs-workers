import GoogleAuth, { GoogleKey } from "./google";

export interface Env {
  GCS_JSON_KEY: string;
  KV: KVNamespace;
}

export interface KVMetadata {
  expiration: number;
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
    let { value: access_token, metadata } =
      await env.KV.getWithMetadata<KVMetadata>("token");

    const expired = !access_token || (metadata?.expiration || 0) < Date.now();
    console.log({ expired, metadata });
    console.log("expiresIn", ((metadata?.expiration || 0) - Date.now())/1000);

    const end = Date.now();
    console.log(`KV get took ${end - start}ms`);
    if (expired) {
      console.log("getting new token");
      const start = Date.now();
      const res = await oauth.getGoogleAuthToken();
      access_token = res.access_token;

      const end = Date.now();
      console.log(`token took ${end - start}ms`);

      if (!access_token) {
        return new Response("Failed to get token");
      }

      // 4 minutes before expiry just in case
      const padding = 60 * 4;
      const expiration = Date.now() + (res.expires_in - padding) * 1000;
      console.log("newExpiration", expiration);
      const meta: KVMetadata = { expiration };

      await env.KV.put("token", access_token, {
        expirationTtl: res.expires_in - padding,
        metadata: meta,
      });
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
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    return new Response(res.body);
  },
};
