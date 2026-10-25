#!/usr/bin/env node
import { readFile, mkdir, realpath, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { library, readSnapshot, filesForSkill, resolveSkills, digest, root } from './content.mjs';
import { exists, safeAncestors, readReceipt, validateReceipt, verifyOwned, acquire, transact } from './installation-state.mjs';

const hosts = JSON.parse(await readFile(path.join(root, 'profiles/hosts.json'), 'utf8'));
const help = 'context4-skills <install|update|remove|list> [skill ...] --agent <codex|claude|cursor|hermes|openclaw> [--global] [--lang en|ru] [--dir path] [--source snapshot.json] [--dry-run] [--json]';
function parse(args) {
  const [command, ...rest] = args;
  if (!command || command === '--help') return { command: 'help' };
  if (!['install','update','remove','list'].includes(command)) throw new Error(help);
  const options = { command, selected: [], global: false, dryRun: false, json: false };
  const seen = new Set();
  for (let index = 0; index < rest.length; index++) {
    const flag = rest[index];
    if (!flag.startsWith('--')) { options.selected.push(flag); continue; }
    if (seen.has(flag)) throw new Error(`Duplicate option: ${flag}`);
    seen.add(flag);
    if (flag === '--codex') options.agent = 'codex';
    else if (flag === '--global') options.global = true;
    else if (flag === '--dry-run') options.dryRun = true;
    else if (flag === '--json') options.json = true;
    else if (['--agent','--dir','--lang','--source'].includes(flag)) {
      const value = rest[++index];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
      options[{ '--agent': 'agent', '--dir': 'directory', '--lang': 'language', '--source': 'source' }[flag]] = value;
    } else throw new Error(`Unknown option: ${flag}`);
  }
  if (new Set(options.selected).size !== options.selected.length) throw new Error('Duplicate skill selection');
  if (seen.has('--codex') && seen.has('--agent')) throw new Error('Choose --agent or --codex, not both');
  if (options.language && !['en','ru'].includes(options.language)) throw new Error('Supported languages: en, ru');
  if (options.agent && !Object.hasOwn(hosts, options.agent)) throw new Error(`Unsupported agent: ${options.agent}. For DeepSeek select its actual host, such as codex, or an explicit --dir.`);
  if (options.directory && options.global) throw new Error('Choose --dir or --global, not both');
  return options;
}
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
function desiredEntry(source,id,locale) {
  const skill = source.catalog.find((item) => item.id === id);
  const bytes = filesForSkill(source,id,locale);
  return { version: skill.version, locale, source: { release: source.release, repository: source.repository, digest: source.sourceDigest }, dependencies: { ...skill.dependencies }, files: Object.fromEntries(Object.entries(bytes).map(([name,value]) => [name.slice(id.length+1),digest(value)])) };
}
function planOperation(options,source,previous) {
  const old = previous ?? { schemaVersion: 2, roots: [], host: options.agent ?? 'custom', skills: {} };
  const next = structuredClone(old), replacements = {};
  const selected = options.selected.length ? options.selected : options.command === 'install' ? source.catalog.map((item) => item.id) : old.roots;
  if (options.command !== 'install' && selected.some((id) => !Object.hasOwn(old.skills,id))) throw new Error(`Skill is not installed: ${selected.find((id) => !Object.hasOwn(old.skills,id))}`);
  if (options.command === 'remove') {
    const roots = new Set(old.roots.filter((id) => !selected.includes(id))), needed = new Set();
    function retain(id) { if (needed.has(id)) return; needed.add(id); for (const dependency of Object.keys(old.skills[id].dependencies)) retain(dependency); }
    for (const id of roots) retain(id);
    for (const id of selected) if (needed.has(id)) throw new Error(`Dependency ${id} is required by retained roots: ${[...roots].join(', ')}`);
    next.roots = [...roots].sort();
    for (const id of Object.keys(old.skills)) if (!needed.has(id)) { delete next.skills[id]; replacements[id] = null; }
  } else {
    resolveSkills(source,selected);
    const roots = new Set([...old.roots,...selected]);
    const retained = old.roots.filter((id) => !selected.includes(id));
    const protectedIds = new Set();
    function protect(id) { if (protectedIds.has(id)) return; protectedIds.add(id); for (const dependency of Object.keys(old.skills[id].dependencies)) protect(dependency); }
    for (const id of retained) protect(id);
    const assigned = new Map();
    function assign(id,locale) {
      const candidate = desiredEntry(source,id,locale);
      const installed = old.skills[id];
      if (assigned.has(id)) {
        if (assigned.get(id) !== locale) throw new Error(`Conflicting dependency locale: ${id}`);
        return;
      }
      assigned.set(id,locale);
      if (protectedIds.has(id)) {
        if (!installed || installed.version !== candidate.version || installed.locale !== locale || !same(installed.files,candidate.files) || !same(installed.dependencies,candidate.dependencies)) throw new Error(`Dependency ${id} replacement affects retained roots: ${retained.join(', ')}; select all affected roots explicitly`);
        return;
      }
      // A common dependency with identical content retains its original provenance.
      if (installed && !selected.includes(id) && installed.version === candidate.version && installed.locale === locale && same(installed.files,candidate.files) && same(installed.dependencies,candidate.dependencies)) return;
      next.skills[id] = candidate;
      replacements[id] = Object.fromEntries(Object.entries(filesForSkill(source,id,locale)).map(([name,value]) => [name.slice(id.length+1),value]));
      for (const dependency of Object.keys(candidate.dependencies)) assign(dependency,locale);
    }
    for (const id of selected) assign(id,options.language ?? old.skills[id]?.locale ?? 'en');
    next.roots = [...roots].sort();
    const needed = new Set();
    function retain(id) { if (needed.has(id)) return; needed.add(id); for (const dependency of Object.keys(next.skills[id].dependencies)) retain(dependency); }
    for (const id of roots) retain(id);
    for (const id of Object.keys(next.skills)) if (!needed.has(id)) { delete next.skills[id]; replacements[id] = null; }
  }
  next.host = options.agent ?? old.host;
  validateReceipt(next);
  return { next, replacements, summary: { command: options.command, selected, install: Object.keys(replacements).filter((id) => replacements[id]).sort(), remove: Object.keys(replacements).filter((id) => !replacements[id]).sort(), skills: Object.fromEntries(Object.entries(next.skills).map(([id,s]) => [id,{ version:s.version,locale:s.locale,source:s.source }])) } };
}
export async function run(args,{cwd=process.cwd(),home=os.homedir(),onProgress=()=>{}}={}) {
  const options = parse(args);
  if (options.command === 'help') return help;
  // Removal relies only on local ownership, including skills retired from the current release.
  const source = options.command === 'remove' ? library : options.source ? await readSnapshot(path.resolve(cwd,options.source)) : library;
  if (options.command === 'install' && options.selected.length) resolveSkills(source, options.selected);
  if (options.command === 'list') return JSON.stringify(options.json ? {schemaVersion:1,release:source.release,sourceDigest:source.sourceDigest,skills:source.catalog} : source.catalog.map((s)=>s.id),null,2);
  if (!options.agent && !options.directory) throw new Error('Choose an explicit --agent or --dir');
  const location = hosts[options.agent]?.[options.global ? 'global' : 'project'];
  if (!options.directory && !location) throw new Error(`${options.agent} requires --global or an explicit --dir`);
  const base = await realpath(options.global ? home : cwd);
  const target = options.directory ? path.resolve(base,options.directory) : path.join(base,location);
  await safeAncestors(target);
  if (options.command === 'remove' && !(await exists(target))) return 'No Context4 installation found.';
  if (options.dryRun) {
    const previous = await readReceipt(target); await verifyOwned(target,previous);
    const plan = planOperation(options,source,previous);
    for (const id of Object.keys(plan.replacements)) if (!Object.hasOwn(previous?.skills ?? {},id) && await exists(path.join(target,id))) throw new Error(`Existing skill is not owned by this package: ${id}`);
    return JSON.stringify({...plan.summary,target,dryRun:true},null,2);
  }
  await mkdir(target,{recursive:true});
  const lock = await acquire(target);
  let complete = false;
  try {
    const previous = await readReceipt(target); await verifyOwned(target,previous);
    if (!previous && options.command !== 'install') return 'No Context4 installation found.';
    const plan = planOperation(options,source,previous);
    for (const id of Object.keys(plan.replacements)) if (!Object.hasOwn(previous?.skills ?? {},id) && await exists(path.join(target,id))) throw new Error(`Existing skill is not owned by this package: ${id}`);
    onProgress(`Preparing ${options.command} in ${target}`);
    await transact(target,lock,previous,plan.next,plan.replacements,onProgress);
    complete = true;
    if (options.json) return JSON.stringify({...plan.summary,target},null,2);
    return `Context4 skills ${options.command === 'remove' ? 'removed' : 'installed'} in ${target}. Restart your agent or start a new conversation. MCP authorization is separate.`;
  } finally {
    // Keep recovery material if rollback itself failed; never discard the only backup.
    const journal = path.join(lock,'journal.json');
    if (complete || !(await exists(journal))) await rm(lock,{recursive:true,force:true});
    else {
      const state = JSON.parse(await readFile(journal,'utf8'));
      if (state.rolledBack) await rm(lock,{recursive:true,force:true});
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  run(process.argv.slice(2),{onProgress:(message)=>process.stderr.write(message+'\n')}).then((message)=>console.log(message)).catch((error)=>{console.error(error.message);process.exitCode=1;});
}
