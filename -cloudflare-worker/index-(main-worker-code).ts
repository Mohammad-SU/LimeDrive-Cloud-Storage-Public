/**
 * Welcome to Cloudflare Workers!
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler deploy src/index.ts --name my-worker` to deploy your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { Buffer } from "node:buffer";

const encoder = new TextEncoder();

export interface Env {
    BUCKET_URL_SYMMETRIC_KEY: string;
    WORKER_ENV: string;
    SIGN_URL_RATE_LIMITER: any;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        if (!validateEnvVariables(env)) {
            return new Response("Missing required environment variables.", { status: 500 });
        }

        // 403 Forbidden may occur if WAF rule blocks request to domain, it may be due to dev_ip being changed by ISP
        // Update lockdown WAF rule dev_ip (where it says IP Source Address does not equal) and backend env dev_ip

        // Local worker won't conflict with prod worker as local worker goes to r2-dev domain 
        // r2-dev is my custom subdomain, not to be confused with r2.dev which is a public bucket domain
        const url = new URL(request.url);

        // Called fetchHostname since in dev the request hostname is different, although in prod the 
        // request hostname is the same as fetchHostname since the prod worker is bound to this hostname.
        let fetchHostname = "r2.limedrive.net";

        // wrangler.toml routes can be left alone for local use because the worker for dev would be accessed through localhost
        // The dev domain is protected by zone lockdown
        if (env.WORKER_ENV === 'local') {
            // r2-dev is my custom subdomain, not to be confused with r2.dev which is a public bucket domain
            fetchHostname = "r2-dev.limedrive.net"
        }
        
        return handleRequestVerification(request, env, fetchHostname, url);
    }
};

function validateEnvVariables(env: Env): boolean {
    return !!(env.BUCKET_URL_SYMMETRIC_KEY && env.WORKER_ENV && env.SIGN_URL_RATE_LIMITER);
}

async function handleRequestVerification(request: Request, env: Env, fetchHostname: string, url: URL): Promise<Response> {
    const key = await importCryptoKey(env.BUCKET_URL_SYMMETRIC_KEY);

    const cfConnectingIp = request.headers.get("CF-Connecting-IP");
    const rateLimitCheck = await checkRateLimit(env, cfConnectingIp, fetchHostname);
    if (!rateLimitCheck) {
        return new Response(`Rate limit exceeded.`, { status: 429 });
    }

    const verificationResult = await verifyUrl(env, url, key, cfConnectingIp);
    if (!verificationResult) {
        return new Response("Unverified", { status: 401 });
    }

    if (Date.now() / 1000 > verificationResult.assertedExpiry) {
        return new Response(`URL expired at ${new Date(verificationResult.assertedExpiry * 1000)}`, { status: 410 });
    }

    return handleResponseModification(fetchHostname, url, request);
}

async function importCryptoKey(key: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        "raw",
        encoder.encode(key),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
    );
}

async function checkRateLimit(env: Env, ip: string | null, fetchHostname: string): Promise<boolean> {
    // Cloudflare doesn't recommend using IP as users may share it but it may be needed in this case since unauthenticated users can use this in link-share view which means userId may be null so it's not an option always to use userId for rate limit key. For normal use the current rate limit shouldn't usually cause issues despite this issue.
    // Has been tested and works, although the rate limit isn't 100% accurate all the time, it's good enough.
    // Rate limit is prioritised here (not on generation though to prevent accidentally limiting the backend), and with cfConnectingIp so that a malicious user has less chance of rate limiting a legitimate user
    // Rate limit is set quite high for zip file downloads on backend
    const { success } = await env.SIGN_URL_RATE_LIMITER.limit({ key: `${ip}-${fetchHostname}` });
    return success;
}

async function verifyUrl(env: Env, url: URL, key: CryptoKey, cfConnectingIp: string | null): Promise<{ assertedExpiry: number } | null> {
    const verifyParam = url.searchParams.get("verify");
    if (!verifyParam) {
        return null;
    }

    // Make sure this is same order when generating hmac on backend and when put in verify param (although for generation it's not spaced with '-')
    const [userId, userIp, generationTime, expiry, mac] = verifyParam.split("-");
    const assertedGenerationTime = Number(generationTime);
    const assertedExpiry = Number(expiry);

    const dataToAuthenticate = `${decodeURIComponent(url.pathname)}${userId}${userIp}${assertedGenerationTime}${assertedExpiry}`;
    const receivedMac = Buffer.from(mac, "base64");

    // Use crypto.subtle.verify() to guard against timing attacks. Since HMACs use
    // symmetric keys, you could technically implement this by calling crypto.subtle.sign()
    // and then doing a string comparison -- BUT this is insecure, as string comparisons
    // bail out on the first mismatch, which leaks information to potential attackers.
    const isMacVerified = await crypto.subtle.verify(
        "HMAC", 
        key, 
        receivedMac, 
        encoder.encode(dataToAuthenticate)
    );
    
    const isIpVerified = cfConnectingIp === userIp; // CF-Connecting-IP should work even if the user is using a VPN

    if (!isMacVerified || (!isIpVerified && env.WORKER_ENV !== "local")) {  // Leave IP check here to protect against timing attacks
        return null;
    }

    return { assertedExpiry };
}

async function handleResponseModification(fetchHostname: string, url: URL, request: Request): Promise<Response> {
    // The file chunk would be stored in memory for a very short time, which would use memory. Each worker INSTANCE has
    // a memory limit of 128mb, but there can be multiple instances worldwide, so if each worker could only serve
    // 128 1mb requests concurrently, that would transalte to 10k-100k REQUESTS worldwide, whcih is way more for this case
    // as chunks are NOT that big.
    // see https://community.cloudflare.com/t/worker-exceeded-cpu/36053/26
    const promise = fetch(`https://${fetchHostname}${url.pathname}`, request); 

    const contentDisposition = url.searchParams.get("content-disposition");

     // Request content-disposition seems to be inline by default for types that are supported for in-browser viewing, so to 
     // possibly increase speed for file previews then just return the promise if contentDisposition from backend was inline
    if (contentDisposition?.startsWith("inline")) {
        //@ts-ignore worker-types had conflict
        return promise;
    }

    // Otherwise return file download res with Content-Disposition attachment (cloned res because it's immutable by default)
    // contentDisposition is a RESPONSE header, not a request header, so cloning the request headers doesn't do the job.
    const res = await promise;
    const clonedRes = new Response(res.body as ReadableStream<Uint8Array>, res);

    if (contentDisposition) {
        clonedRes.headers.set("Content-Disposition", contentDisposition);
    }

    return clonedRes;
}