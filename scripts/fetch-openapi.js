#!/usr/bin/env node
/**
 * Refresh the partner specification from the deployed backend, then apply
 * reviewed documentation. No API key or database access is required.
 *
 * npm run fetch-openapi                         fetch the deployed schema
 * npm run fetch-openapi -- --source path.json   use a local backend export
 * npm run sync-openapi                          publish the committed schema
 *
 * Builds use --sync, so they do not depend on a network request or silently
 * replace a reviewed contract with whatever happens to be deployed.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const SOURCE_URL = 'https://api.satstacker.app/openapi.json';
const SPEC_PATH = path.join(ROOT, 'openapi', 'partner-api.json');
const PUBLIC_PATH = path.join(ROOT, 'static', 'openapi', 'partner-api.json');
const PUBLIC_ALIAS_PATH = path.join(ROOT, 'static', 'partner-api.json');
const OVERLAY_PATH = path.join(ROOT, 'openapi', 'partner-docs-overlay.json');
const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']);

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`OpenAPI fetch returned HTTP ${response.status}`);
  return response.json();
}

function visitRefs(value, callback) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key === '$ref' && typeof child === 'string') callback(child);
    else visitRefs(child, callback);
  }
}

function pointer(root, ref) {
  if (!ref.startsWith('#/')) throw new Error(`Only local OpenAPI references are supported: ${ref}`);
  return ref.slice(2).split('/').reduce(
    (value, key) => value?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], root,
  );
}

function operations(spec) {
  return Object.entries(spec.paths || {}).flatMap(([route, item]) =>
    Object.entries(item).filter(([method]) => METHODS.has(method))
      .map(([method, operation]) => ({ route, method, operation })),
  );
}

function trimSpec(fullSpec) {
  if (!/^3\.1\./.test(fullSpec.openapi || '') || !fullSpec.paths) {
    throw new Error('Expected an OpenAPI 3.1 document with paths (confirmation conditions use JSON Schema 2020-12)');
  }
  const paths = Object.fromEntries(Object.entries(fullSpec.paths).filter(
    ([route]) => route === '/partner/v1' || route.startsWith('/partner/v1/'),
  ));
  if (!Object.keys(paths).length) throw new Error('No /partner/v1 endpoints found');
  const spec = { openapi: fullSpec.openapi, info: {}, paths: structuredClone(paths), components: {} };
  // Keep every referenced component kind, including nested schema dependencies.
  const pending = [];
  visitRefs(spec.paths, (ref) => pending.push(ref));
  const seen = new Set();
  while (pending.length) {
    const ref = pending.pop();
    if (seen.has(ref)) continue;
    seen.add(ref);
    const parts = ref.slice(2).split('/');
    if (!ref.startsWith('#/components/') || parts.length < 3) {
      throw new Error(`Unsupported partner reference: ${ref}`);
    }
    const componentRef = '#/' + parts.slice(0, 3).join('/');
    const component = pointer(fullSpec, componentRef);
    if (component === undefined) throw new Error(`Missing backend component: ${componentRef}`);
    const kind = parts[1].replace(/~1/g, '/').replace(/~0/g, '~');
    const name = parts[2].replace(/~1/g, '/').replace(/~0/g, '~');
    (spec.components[kind] ||= {})[name] = structuredClone(component);
    visitRefs(component, (dependency) => pending.push(dependency));
  }
  return spec;
}

function validateReviewedContract(spec, overlay) {
  for (const [id, expected] of Object.entries(overlay.operations)) {
    const operation = spec.paths?.[expected.path]?.[expected.method];
    if (operation?.operationId !== id) {
      throw new Error(`Backend contract changed or is outdated: expected ${expected.method.toUpperCase()} ${expected.path} (${id}). Review the deployment and documentation overlay before refreshing.`);
    }
  }
  for (const [name, fields] of Object.entries(overlay.fields)) {
    for (const field of Object.keys(fields)) {
      if (!spec.components?.schemas?.[name]?.properties?.[field]) {
        throw new Error(`Backend contract changed or is outdated: missing ${name}.${field}. Review the documentation overlay before refreshing.`);
      }
    }
  }
}

function applyOverlay(spec, overlay) {
  validateReviewedContract(spec, overlay);
  spec.info = structuredClone(overlay.info);
  spec.externalDocs = structuredClone(overlay.externalDocs);
  spec.servers = [{ url: 'https://api.satstacker.app', description: 'Environment selected by sse_test_* or sse_live_* key' }];
  const schemas = spec.components.schemas ||= {};
  for (const [name, schema] of Object.entries(overlay.schemas)) {
    // A new backend response model with the same name needs an explicit review.
    if (schemas[name] && JSON.stringify(schemas[name]) !== JSON.stringify(schema)) {
      throw new Error(`Backend now defines ${name}; review the response documentation overlay`);
    }
    schemas[name] = structuredClone(schema);
  }
  for (const [name, fields] of Object.entries(overlay.fields)) {
    for (const [field, description] of Object.entries(fields)) schemas[name].properties[field].description = description;
  }
  for (const [name, description] of Object.entries(overlay.schemaDescriptions)) schemas[name].description = description;
  for (const [name, rules] of Object.entries(overlay.conditionalRules)) schemas[name].allOf = structuredClone(rules);
  spec.components.securitySchemes = {
    PartnerApiKey: { type: 'http', scheme: 'bearer', bearerFormat: 'SatStacker API key',
      description: 'Use the complete sse_test_* or sse_live_* key. Never send credentials to browser/client-side code.' },
  };
  // No top-level requirement: health stays public; each protected operation opts in.
  delete spec.security;
  for (const { operation } of operations(spec)) {
    const patch = overlay.operations[operation.operationId];
    if (patch?.description) operation.description = patch.description;
    for (const [status, response] of Object.entries(patch?.responses || {})) {
      const existingSchema = operation.responses?.[status]?.content?.['application/json']?.schema;
      const newSchema = response.content?.['application/json']?.schema;
      if (status === '200' && existingSchema && Object.keys(existingSchema).length &&
          JSON.stringify(existingSchema) !== JSON.stringify(newSchema)) {
        throw new Error(`Backend response changed for ${operation.operationId}; review its documentation overlay`);
      }
      (operation.responses ||= {})[status] = structuredClone(response);
    }
    operation.security = operation.operationId === 'health' ? [] : [{ PartnerApiKey: [] }];
    if (Array.isArray(operation.parameters)) {
      operation.parameters = operation.parameters.filter(
        (param) => !(param.in === 'header' && param.name?.toLowerCase() === 'authorization'),
      );
    }
  }
  validateRefs(spec);
  return spec;
}

function validateRefs(spec) {
  visitRefs(spec, (ref) => {
    if (pointer(spec, ref) === undefined) throw new Error(`Unresolved OpenAPI reference: ${ref}`);
  });
}

function writeAtomic(filename, content) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${process.pid}.tmp`;
  try { fs.writeFileSync(temporary, content); fs.renameSync(temporary, filename); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

async function main(args = process.argv.slice(2)) {
  const overlay = JSON.parse(fs.readFileSync(OVERLAY_PATH, 'utf8'));
  let spec;
  let text;
  if (args.length === 1 && args[0] === '--sync') {
    text = fs.readFileSync(SPEC_PATH, 'utf8');
    spec = JSON.parse(text);
    validateReviewedContract(spec, overlay);
    validateRefs(spec);
  } else {
    let fullSpec;
    if (args.length === 2 && args[0] === '--source') {
      fullSpec = JSON.parse(fs.readFileSync(path.resolve(args[1]), 'utf8'));
    } else if (!args.length) {
      console.log(`Fetching ${SOURCE_URL} ...`);
      fullSpec = await fetchJson(SOURCE_URL);
    } else throw new Error('Usage: fetch-openapi.js [--sync | --source path.json]');
    spec = applyOverlay(trimSpec(fullSpec), overlay);
    text = JSON.stringify(spec, null, 2) + '\n';
    // Validate everything before replacing the previously reviewed file.
    writeAtomic(SPEC_PATH, text);
  }
  writeAtomic(PUBLIC_PATH, text);
  // Keep the older public download URL on the same reviewed contract.
  writeAtomic(PUBLIC_ALIAS_PATH, text);
  console.log(`Ready: ${operations(spec).length} partner operations; source openapi/partner-api.json; download /openapi/partner-api.json`);
}

module.exports = { fetchJson, trimSpec, applyOverlay, validateRefs, validateReviewedContract, main };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
