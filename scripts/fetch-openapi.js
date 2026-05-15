#!/usr/bin/env node
/**
 * Fetches the live openapi.json from api.satstacker.app and strips it down
 * to only the /partner/v1/* endpoints + their referenced schemas.
 *
 * Usage:
 *   node scripts/fetch-openapi.js
 *
 * Run this whenever the partner API changes and commit the result.
 */

import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_URL = 'https://api.satstacker.app/openapi.json';
const OUTPUT_PATH = path.join(__dirname, '..', 'openapi', 'partner-api.json');
const PATH_PREFIX = '/partner/v1';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
        }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

function collectSchemaRefs(obj, refs = new Set()) {
  if (!obj || typeof obj !== 'object') return refs;
  if (Array.isArray(obj)) {
    obj.forEach((item) => collectSchemaRefs(item, refs));
    return refs;
  }
  for (const [key, value] of Object.entries(obj)) {
    if (key === '$ref' && typeof value === 'string') {
      const match = value.match(/^#\/components\/schemas\/(.+)$/);
      if (match) refs.add(match[1]);
    } else {
      collectSchemaRefs(value, refs);
    }
  }
  return refs;
}

async function main() {
  console.log(`Fetching ${SOURCE_URL} ...`);
  const fullSpec = await fetchJson(SOURCE_URL);

  // Filter paths to partner-only
  const filteredPaths = {};
  for (const [pathKey, pathValue] of Object.entries(fullSpec.paths || {})) {
    if (pathKey.startsWith(PATH_PREFIX)) {
      filteredPaths[pathKey] = pathValue;
    }
  }

  // Collect schema refs transitively
  const usedSchemas = collectSchemaRefs(filteredPaths);
  const allSchemas = (fullSpec.components && fullSpec.components.schemas) || {};

  // Walk schema dependencies until stable
  let added = true;
  while (added) {
    added = false;
    for (const schemaName of [...usedSchemas]) {
      const schema = allSchemas[schemaName];
      if (!schema) continue;
      const innerRefs = collectSchemaRefs(schema);
      for (const ref of innerRefs) {
        if (!usedSchemas.has(ref)) {
          usedSchemas.add(ref);
          added = true;
        }
      }
    }
  }

  const filteredSchemas = {};
  for (const name of usedSchemas) {
    if (allSchemas[name]) filteredSchemas[name] = allSchemas[name];
  }

  // Build the trimmed spec
  const trimmed = {
    openapi: fullSpec.openapi,
    info: {
      title: 'SatStacker Engine Partner API',
      version: '1.0.0',
      description:
        'Embed Smart Timing into your own DCA experience while keeping the customer relationship, custody, funding, and execution on your platform.',
    },
    servers: [
      { url: 'https://api.satstacker.app', description: 'Production' },
    ],
    paths: filteredPaths,
    components: {
      schemas: filteredSchemas,
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description:
            'Bearer token authentication. Use your `sse_test_*` or `sse_live_*` API key.',
        },
      },
    },
    security: [{ BearerAuth: [] }],
  };

  // Add the Bearer security scheme to every operation that requires it
  // (everything except /health, which is public).
  for (const [pathKey, pathValue] of Object.entries(trimmed.paths)) {
    if (pathKey === '/partner/v1/health') continue;
    for (const method of Object.keys(pathValue)) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
        pathValue[method].security = [{ BearerAuth: [] }];
        // Remove the redundant Authorization header parameter that FastAPI
        // adds; the security scheme handles it.
        if (Array.isArray(pathValue[method].parameters)) {
          pathValue[method].parameters = pathValue[method].parameters.filter(
            (p) => !(p.name === 'Authorization' && p.in === 'header')
          );
        }
      }
    }
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(trimmed, null, 2) + '\n');

  const endpointCount = Object.keys(filteredPaths).length;
  const schemaCount = Object.keys(filteredSchemas).length;
  console.log(
    `Wrote ${OUTPUT_PATH}\n` +
      `  ${endpointCount} partner endpoints, ${schemaCount} schemas`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
