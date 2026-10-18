import type { ApiOperation, OpenApiDocument } from '@/lib/openapi';
import { exampleFromSchema, resolveRef } from '@/lib/openapi';

export type CodeLang =
  | 'curl'
  | 'python'
  | 'javascript'
  | 'php'
  | 'go'
  | 'java'
  | 'ruby'
  | 'csharp'
  | 'rust';

export const CODE_LANGS: { id: CodeLang; label: string; highlight: string }[] =
  [
    { id: 'curl', label: 'cURL', highlight: 'bash' },
    { id: 'python', label: 'Python', highlight: 'python' },
    { id: 'javascript', label: 'JavaScript', highlight: 'javascript' },
    { id: 'php', label: 'PHP', highlight: 'php' },
    { id: 'go', label: 'Go', highlight: 'go' },
    { id: 'java', label: 'Java', highlight: 'java' },
    { id: 'ruby', label: 'Ruby', highlight: 'ruby' },
    { id: 'csharp', label: 'C#', highlight: 'csharp' },
    { id: 'rust', label: 'Rust', highlight: 'rust' },
  ];

export type RequestSample = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
};

function fillPath(path: string, values: Record<string, string>): string {
  return path.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const v = values[name];
    return v !== undefined && v !== '' ? encodeURIComponent(v) : `{${name}}`;
  });
}

export function buildRequestUrl(
  path: string,
  pathValues: Record<string, string>,
  queryValues: Record<string, string>,
): string {
  const filled = fillPath(path, pathValues);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(queryValues)) {
    if (value !== '') params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${filled}?${qs}` : filled;
}

function activeHeaders(headers: Record<string, string>): [string, string][] {
  return Object.entries(headers).filter(([, v]) => v !== '');
}

function escapeSingle(value: string): string {
  return value.replace(/'/g, `'\\''`);
}

function jsonLiteral(body: string | undefined): string | null {
  if (!body?.trim()) return null;
  try {
    return JSON.stringify(JSON.parse(body));
  } catch {
    return JSON.stringify(body);
  }
}

export function generateCurl(options: RequestSample): string {
  const lines = [`curl -sS -X ${options.method.toUpperCase()} '${options.url}'`];
  for (const [key, value] of activeHeaders(options.headers)) {
    lines.push(`  -H '${key}: ${escapeSingle(value)}'`);
  }
  if (options.body) {
    lines.push(`  -d '${escapeSingle(options.body)}'`);
  }
  if (lines.length === 1) return lines[0];
  return `${lines[0]} \\\n${lines.slice(1).join(' \\\n')}`;
}

export function generateJavascript(options: RequestSample): string {
  const headers = Object.fromEntries(activeHeaders(options.headers));
  const initLines: string[] = [
    `  method: '${options.method.toUpperCase()}'`,
  ];
  if (Object.keys(headers).length) {
    initLines.push(`  headers: ${JSON.stringify(headers, null, 2).replace(/\n/g, '\n  ')}`);
  }
  if (options.body) {
    initLines.push(`  body: ${JSON.stringify(options.body)}`);
  }

  return [
    'const options = {',
    initLines.join(',\n'),
    '};',
    '',
    `fetch('${options.url}', options)`,
    '  .then(res => res.json())',
    '  .then(json => console.log(json))',
    '  .catch(err => console.error(err));',
  ].join('\n');
}

/** @deprecated use generateJavascript */
export function generateFetch(options: RequestSample): string {
  return generateJavascript(options);
}

export function generatePython(options: RequestSample): string {
  const headers = Object.fromEntries(activeHeaders(options.headers));
  const lines = [
    'import requests',
    '',
    `url = ${JSON.stringify(options.url)}`,
  ];
  if (Object.keys(headers).length) {
    lines.push(`headers = ${JSON.stringify(headers, null, 2)}`);
  }
  const args = [`"${options.method.toUpperCase()}"`, 'url'];
  if (Object.keys(headers).length) args.push('headers=headers');
  const literal = jsonLiteral(options.body);
  if (literal) {
    lines.push(`payload = ${literal}`);
    args.push('json=payload');
  }
  lines.push('');
  lines.push(`response = requests.request(${args.join(', ')})`);
  lines.push('print(response.text)');
  return lines.join('\n');
}

export function generatePhp(options: RequestSample): string {
  const headers = activeHeaders(options.headers).map(
    ([k, v]) => `"${k}: ${v.replace(/"/g, '\\"')}"`,
  );
  const lines = [
    '<?php',
    '$curl = curl_init();',
    '',
    'curl_setopt_array($curl, [',
    `  CURLOPT_URL => ${JSON.stringify(options.url)},`,
    '  CURLOPT_RETURNTRANSFER => true,',
    `  CURLOPT_CUSTOMREQUEST => '${options.method.toUpperCase()}',`,
  ];
  if (headers.length) {
    lines.push(`  CURLOPT_HTTPHEADER => [${headers.join(', ')}],`);
  }
  if (options.body) {
    lines.push(`  CURLOPT_POSTFIELDS => ${JSON.stringify(options.body)},`);
  }
  lines.push(']);');
  lines.push('');
  lines.push('$response = curl_exec($curl);');
  lines.push('curl_close($curl);');
  lines.push('echo $response;');
  return lines.join('\n');
}

export function generateGo(options: RequestSample): string {
  const headers = activeHeaders(options.headers);
  const hasBody = Boolean(options.body);
  const imports = ['"fmt"', '"io"', '"net/http"'];
  if (hasBody) imports.splice(1, 0, '"strings"');

  const lines = [
    'package main',
    '',
    'import (',
    ...imports.map((i) => `  ${i}`),
    ')',
    '',
    'func main() {',
  ];
  if (hasBody) {
    lines.push(`  payload := strings.NewReader(${JSON.stringify(options.body)})`);
  }
  lines.push(
    hasBody
      ? `  req, _ := http.NewRequest("${options.method.toUpperCase()}", ${JSON.stringify(options.url)}, payload)`
      : `  req, _ := http.NewRequest("${options.method.toUpperCase()}", ${JSON.stringify(options.url)}, nil)`,
  );
  for (const [key, value] of headers) {
    lines.push(
      `  req.Header.Add(${JSON.stringify(key)}, ${JSON.stringify(value)})`,
    );
  }
  lines.push('  res, _ := http.DefaultClient.Do(req)');
  lines.push('  defer res.Body.Close()');
  lines.push('  body, _ := io.ReadAll(res.Body)');
  lines.push('  fmt.Println(string(body))');
  lines.push('}');
  return lines.join('\n');
}

export function generateJava(options: RequestSample): string {
  const headers = activeHeaders(options.headers);
  const lines = [
    'OkHttpClient client = new OkHttpClient();',
    '',
  ];
  if (options.body) {
    lines.push(
      `MediaType mediaType = MediaType.parse("application/json");`,
      `RequestBody body = RequestBody.create(${JSON.stringify(options.body)}, mediaType);`,
    );
  }
  lines.push('Request request = new Request.Builder()');
  lines.push(`  .url(${JSON.stringify(options.url)})`);
  if (options.body) {
    lines.push(
      `  .method(${JSON.stringify(options.method.toUpperCase())}, body)`,
    );
  } else {
    lines.push(`  .method(${JSON.stringify(options.method.toUpperCase())}, null)`);
  }
  for (const [key, value] of headers) {
    lines.push(`  .addHeader(${JSON.stringify(key)}, ${JSON.stringify(value)})`);
  }
  lines.push('  .build();');
  lines.push('');
  lines.push('Response response = client.newCall(request).execute();');
  lines.push('System.out.println(response.body().string());');
  return lines.join('\n');
}

export function generateRuby(options: RequestSample): string {
  const headers = activeHeaders(options.headers);
  const method = options.method.toUpperCase();
  const lines = [
    "require 'uri'",
    "require 'net/http'",
    '',
    `url = URI(${JSON.stringify(options.url)})`,
    '',
    'http = Net::HTTP.new(url.host, url.port)',
    'http.use_ssl = url.scheme == \'https\'',
    '',
  ];

  const klass =
    method === 'GET'
      ? 'Net::HTTP::Get'
      : method === 'POST'
        ? 'Net::HTTP::Post'
        : method === 'PUT'
          ? 'Net::HTTP::Put'
          : method === 'PATCH'
            ? 'Net::HTTP::Patch'
            : method === 'DELETE'
              ? 'Net::HTTP::Delete'
              : 'Net::HTTP::Get';

  lines.push(`request = ${klass}.new(url)`);
  for (const [key, value] of headers) {
    lines.push(`request[${JSON.stringify(key)}] = ${JSON.stringify(value)}`);
  }
  if (options.body) {
    lines.push(`request.body = ${JSON.stringify(options.body)}`);
  }
  lines.push('');
  lines.push('response = http.request(request)');
  lines.push('puts response.read_body');
  return lines.join('\n');
}

export function generateCsharp(options: RequestSample): string {
  const headers = activeHeaders(options.headers);
  const lines = [
    'using System.Net.Http;',
    'using System.Text;',
    '',
    'var client = new HttpClient();',
    `var request = new HttpRequestMessage(HttpMethod.${methodToCsharp(options.method)}, ${JSON.stringify(options.url)});`,
  ];
  for (const [key, value] of headers) {
    if (key.toLowerCase() === 'content-type') continue;
    lines.push(
      `request.Headers.TryAddWithoutValidation(${JSON.stringify(key)}, ${JSON.stringify(value)});`,
    );
  }
  if (options.body) {
    const contentType =
      headers.find(([k]) => k.toLowerCase() === 'content-type')?.[1] ??
      'application/json';
    lines.push(
      `request.Content = new StringContent(${JSON.stringify(options.body)}, Encoding.UTF8, ${JSON.stringify(contentType)});`,
    );
  }
  lines.push('');
  lines.push('var response = await client.SendAsync(request);');
  lines.push('var body = await response.Content.ReadAsStringAsync();');
  lines.push('Console.WriteLine(body);');
  return lines.join('\n');
}

function methodToCsharp(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'Get';
    case 'POST':
      return 'Post';
    case 'PUT':
      return 'Put';
    case 'DELETE':
      return 'Delete';
    case 'HEAD':
      return 'Head';
    case 'OPTIONS':
      return 'Options';
    case 'PATCH':
      return 'Patch';
    default:
      return 'Get';
  }
}

export function generateRust(options: RequestSample): string {
  const headers = activeHeaders(options.headers);
  const lines = [
    'use reqwest::header::{HeaderMap, HeaderValue};',
    '',
    '#[tokio::main]',
    'async fn main() -> Result<(), Box<dyn std::error::Error>> {',
    '    let client = reqwest::Client::new();',
    '    let mut headers = HeaderMap::new();',
  ];
  for (const [key, value] of headers) {
    lines.push(
      `    headers.insert(${JSON.stringify(key)}, HeaderValue::from_static(${JSON.stringify(value)}));`,
    );
  }
  lines.push('');
  lines.push(
    `    let mut request = client.request(reqwest::Method::${options.method.toUpperCase()}, ${JSON.stringify(options.url)});`,
  );
  lines.push('    request = request.headers(headers);');
  if (options.body) {
    lines.push(`    request = request.body(${JSON.stringify(options.body)});`);
  }
  lines.push('    let response = request.send().await?;');
  lines.push('    println!("{}", response.text().await?);');
  lines.push('    Ok(())');
  lines.push('}');
  return lines.join('\n');
}

export function generateCode(lang: CodeLang, options: RequestSample): string {
  switch (lang) {
    case 'curl':
      return generateCurl(options);
    case 'python':
      return generatePython(options);
    case 'javascript':
      return generateJavascript(options);
    case 'php':
      return generatePhp(options);
    case 'go':
      return generateGo(options);
    case 'java':
      return generateJava(options);
    case 'ruby':
      return generateRuby(options);
    case 'csharp':
      return generateCsharp(options);
    case 'rust':
      return generateRust(options);
  }
}

export function highlightLangFor(lang: CodeLang): string {
  return CODE_LANGS.find((l) => l.id === lang)?.highlight ?? 'plaintext';
}

export function defaultBodyExample(
  op: ApiOperation,
  doc: OpenApiDocument,
): string {
  const json = op.requestBody?.content?.['application/json'];
  if (!json) return '';
  if (json.example !== undefined) {
    return JSON.stringify(json.example, null, 2);
  }
  const schema = resolveRef(json.schema, doc);
  const example = exampleFromSchema(schema, doc);
  return example ? JSON.stringify(example, null, 2) : '{\n  \n}';
}

export function responseExamples(
  op: ApiOperation,
  doc: OpenApiDocument,
): { status: string; body: string; description?: string }[] {
  return Object.entries(op.responses).map(([status, response]) => {
    const json = response.content?.['application/json'];
    if (json?.example !== undefined) {
      return {
        status,
        body: JSON.stringify(json.example, null, 2),
        description: response.description,
      };
    }
    if (json?.schema) {
      const example = exampleFromSchema(resolveRef(json.schema, doc), doc);
      return {
        status,
        body: JSON.stringify(example ?? { ok: true }, null, 2),
        description: response.description,
      };
    }
    return {
      status,
      body: JSON.stringify(
        { description: response.description || 'Success' },
        null,
        2,
      ),
      description: response.description,
    };
  });
}

export function firstResponseExample(
  op: ApiOperation,
  doc: OpenApiDocument,
): { status: string; body: string } | null {
  const all = responseExamples(op, doc);
  if (!all.length) return null;
  return all.find((r) => r.status.startsWith('2')) ?? all[0];
}
