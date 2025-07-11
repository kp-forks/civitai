import Clavata, { type EvaluateRequest, StreamError } from '@clavata/sdk';
import { env } from '~/env/server';

export const clavataSDK = env.CLAVATA_TOKEN
  ? new Clavata({ apiKey: env.CLAVATA_TOKEN }) // , server: env.CLAVATA_ENDPOINT // TODO this gives a name resolution error
  : undefined;

export const clavataEvaluate = async function* (
  request: EvaluateRequest,
  confidenceThreshold = 0.5
) {
  if (!clavataSDK) throw new Error('Clavata SDK not initialized');

  const stream = clavataSDK.evaluate(request);

  for await (const item of stream) {
    if (item instanceof StreamError) throw item;
    // console.log(JSON.stringify(item, null, 4));

    const { metadata, report, jobUuid, result, score, matches } = item;

    const reports = report?.sectionReports;

    const tags = reports
      ?.map((r) => ({
        tag: r.name,
        confidence: Math.round((r.score ?? 0) * 100),
        outcome: r.result,
        message: r.message,
      }))
      .filter((t) => t.confidence > confidenceThreshold * 100)
      .sort((a, b) => b.confidence - a.confidence);

    // TODO other data?

    yield { externalId: jobUuid, tags, result, metadata, score, matches };
  }
};

// clavata-api-client.ts
export interface ClavataApiClientOptions {
  /** https://api.clavata.ai, etc. (no trailing slash) */
  baseUrl: string;
  /** API token (Bearer <token>) */
  token: string;
  /** Default policy when none is supplied per call */
  policyId?: string;
  /** Default confidence threshold */
  confidenceThreshold?: number;
}

export interface ClavataTag {
  tag: string;
  confidence: number; // 0-100
  outcome?: string;
}

export class ClavataApiClient {
  private readonly fetchFn: typeof fetch;
  private readonly opts: Required<
    Pick<ClavataApiClientOptions, 'baseUrl' | 'token' | 'policyId' | 'confidenceThreshold'>
  >;

  constructor(
    fetchFn: typeof fetch = fetch,
    { baseUrl, token, policyId = '', confidenceThreshold = 0 }: ClavataApiClientOptions
  ) {
    if (!baseUrl) throw new Error('baseUrl is required');
    if (!token) throw new Error('token is required');

    this.fetchFn = fetchFn;
    this.opts = { baseUrl, token, policyId, confidenceThreshold };
  }

  /** Accepts either a base-64 string (or data URI) *or* an image URL */
  async runJobAsync(
    image: string,
    policyId?: string,
    signal?: AbortSignal
  ): Promise<{ externalId: string; tags: ReadonlyArray<ClavataTag> }> {
    const base64 =
      image.startsWith('data:') || /^[A-Za-z0-9+/]+=*$/.test(image)
        ? image
        : await this.imageUrlToBase64(image, signal);

    return this.runJobWithBase64(base64, policyId, signal);
  }

  /* ---------- private helpers ---------- */

  private async imageUrlToBase64(url: string, signal?: AbortSignal): Promise<string> {
    const res = await this.fetchFn(url, { signal });
    if (!res.ok) {
      throw new Error(`Failed to download image (${res.status} ${res.statusText})`);
    }
    const buffer = await res.arrayBuffer();
    return typeof Buffer !== 'undefined'
      ? Buffer.from(buffer).toString('base64')
      : btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }

  // TODO switch to API
  private async runJobWithBase64(
    base64Image: string,
    policyId?: string,
    signal?: AbortSignal
  ): Promise<{ externalId: string; tags: ReadonlyArray<ClavataTag> }> {
    const body = {
      contentData: [{ image: base64Image }],
      policyId: policyId ?? this.opts.policyId,
      waitForCompletion: true,
      threshold: this.opts.confidenceThreshold,
    };

    const res = await this.fetchFn(`${this.opts.baseUrl}/v1/jobs/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.opts.token}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Clavata request failed (${res.status} ${res.statusText}): ${text}`);
    }

    const json = (await res.json()) as any;
    const externalId: string | undefined = json?.result?.jobUuid;
    if (!externalId) {
      throw new Error('Expected JSON with result.jobUuid');
    }

    const sectionReports = json.result.policyEvaluationReport?.sectionEvaluationReports ?? [];

    const tags: ClavataTag[] = sectionReports
      .map((r: any) => ({
        tag: r.name as string,
        confidence: Math.round((r.reviewResult?.score ?? 0) * 100),
        outcome: r.reviewResult?.outcome,
      }))
      .filter((t: ClavataTag) => t.tag && t.confidence > this.opts.confidenceThreshold * 100)
      .sort((a: ClavataTag, b: ClavataTag) => b.confidence - a.confidence);

    return { externalId, tags };
  }
}

export const clavata =
  env.CLAVATA_ENDPOINT && env.CLAVATA_TOKEN
    ? new ClavataApiClient(fetch, {
        baseUrl: env.CLAVATA_ENDPOINT,
        token: env.CLAVATA_TOKEN,
        policyId: env.CLAVATA_POLICY,
        confidenceThreshold: 0.5,
      })
    : undefined;
