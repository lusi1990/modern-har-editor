export interface HarMetadata {
  version: string;
  creator: {
    name: string;
    version: string;
  };
  browser?: {
    name: string;
    version: string;
  };
  pages?: unknown[];
  comment?: string;
}

export interface HarEntry {
  _id: string; // Internal ID for tracking
  startedDateTime: string;
  time: number;
  request: {
    method: string;
    url: string;
    httpVersion: string;
    cookies: unknown[];
    headers: { name: string; value: string }[];
    queryString: unknown[];
    headersSize: number;
    bodySize: number;
    postData?: {
      mimeType: string;
      text?: string;
      params?: unknown[];
    };
  };
  response: {
    status: number;
    statusText: string;
    httpVersion: string;
    cookies: unknown[];
    headers: { name: string; value: string }[];
    content: {
      size: number;
      mimeType: string;
      text?: string;
      encoding?: string;
    };
    redirectURL: string;
    headersSize: number;
    bodySize: number;
  };
  cache: unknown;
  timings: {
    blocked?: number;
    dns?: number;
    connect?: number;
    send: number;
    wait: number;
    receive: number;
    ssl?: number;
  };
  serverIPAddress?: string;
  connection?: string;
  comment?: string;
}
