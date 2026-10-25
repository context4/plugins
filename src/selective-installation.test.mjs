import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { run } from "./cli.mjs";
import { contentHash, loadLibrary, root } from "./content.mjs";

async function sandbox(action) {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "ctx4-selected-"));
  try { await action(cwd); } finally { await rm(cwd, {recursive:true,force:true}); }
}
// Real, minimal on-disk libraries exercise the production release loader and installer.
async function release(cwd,version,dependencies={}) {
  const directory = path.join(cwd,version); await mkdir(directory);
  await writeFile(path.join(directory,"package.json"),JSON.stringify({version,repository:{url:"https://github.com/context4/plugins"}}));
  const catalog = ["alpha","beta","shared"].map((id)=>({id,version,files:["SKILL.md"],dependencies:dependencies[id]??{}}));
  await writeFile(path.join(directory,"catalog.json"),JSON.stringify(catalog));
  for (const id of ["alpha","beta","shared"]) for (const locale of ["en","ru"]) {
    const folder = path.join(directory,locale==="en"?"skills":"locales/ru",id);await mkdir(folder,{recursive:true});
    await writeFile(path.join(folder,"SKILL.md"),`---\nname: ${id}\ndescription: ${id} instructions\n---\n${version} ${locale} ${id}\n`);
  }
  const file = path.join(cwd,`${version}.json`);await writeFile(file,JSON.stringify(await loadLibrary(directory)));return file;
}
const receipt = async (cwd)=>JSON.parse(await readFile(path.join(cwd,"installed/.context4-skills.json"),"utf8"));
const execute = (cwd,args)=>run([...args,"--dir","installed"],{cwd});

test("select one skill, retain mixed releases/locales and remove retired IDs offline",async()=>sandbox(async(cwd)=>{
  const one=await release(cwd,"1.0.0"),two=await release(cwd,"2.0.0");
  await execute(cwd,["install","alpha","beta","--source",one]);
  await assert.rejects(access(path.join(cwd,"installed/shared")));
  const before=await readFile(path.join(cwd,"installed/alpha/SKILL.md"));
  await execute(cwd,["update","beta","--source",two,"--lang","ru"]);
  const state=await receipt(cwd);
  assert.equal(state.skills.alpha.version,"1.0.0");assert.equal(state.skills.alpha.locale,"en");
  assert.equal(state.skills.beta.version,"2.0.0");assert.equal(state.skills.beta.locale,"ru");
  assert.notEqual(state.skills.alpha.source.digest,state.skills.beta.source.digest);
  assert.deepEqual(await readFile(path.join(cwd,"installed/alpha/SKILL.md")),before);
  await execute(cwd,["update","beta","--source",one]);
  assert.equal((await receipt(cwd)).skills.beta.locale,"ru");
  await rm(one);await rm(two);
  // alpha/beta do not exist in the production CLI catalog; ownership still permits removal.
  await execute(cwd,["remove","beta","--source","nonexistent.json"]);
  assert.deepEqual((await receipt(cwd)).roots,["alpha"]);
  assert.deepEqual(await readFile(path.join(cwd,"installed/alpha/SKILL.md")),before);
}));

test("dependency closure, protected retained roots and orphan cleanup",async()=>sandbox(async(cwd)=>{
  const one=await release(cwd,"1.0.0",{alpha:{shared:"1.0.0"},beta:{shared:"1.0.0"}});
  const two=await release(cwd,"2.0.0",{alpha:{shared:"2.0.0"},beta:{shared:"2.0.0"}});
  await execute(cwd,["install","alpha","beta","--source",one]);
  const before=await receipt(cwd);
  assert.deepEqual(before.roots,["alpha","beta"]);assert.ok(before.skills.shared);
  await assert.rejects(execute(cwd,["update","beta","--source",two]),/retained roots/);
  assert.deepEqual(await receipt(cwd),before);
  await assert.rejects(execute(cwd,["remove","shared"]),/retained roots/);
  await execute(cwd,["remove","beta"]);assert.ok((await receipt(cwd)).skills.shared);
  await execute(cwd,["remove","alpha"]);
  await assert.rejects(access(path.join(cwd,"installed/shared")));
  await assert.rejects(access(path.join(cwd,"installed/.context4-skills.json")));
}));

test("legacy receipt migration preserves honest provenance and subset ownership",async()=>sandbox(async(cwd)=>{
  const one=await release(cwd,"1.0.0");await execute(cwd,["install","alpha","beta","--source",one]);
  const current=await receipt(cwd),files={};
  for(const [id,skill]of Object.entries(current.skills))for(const [file,hash]of Object.entries(skill.files))files[`${id}/${file}`]=hash;
  await writeFile(path.join(cwd,"installed/.context4-skills.json"),JSON.stringify({schemaVersion:1,language:"en",version:"1.0.0",files}));
  await execute(cwd,["update","beta","--source",one]);
  const migrated=await receipt(cwd);assert.equal(migrated.schemaVersion,2);
  assert.equal(migrated.skills.alpha.source.status,"legacy-unresolved");assert.ok(migrated.skills.beta.source.digest);
  await execute(cwd,["remove","alpha"]);assert.ok((await receipt(cwd)).skills.beta);
}));

test("tampered releases, cycles, missing dependencies and unknown IDs do not replace files",async()=>sandbox(async(cwd)=>{
  const one=await release(cwd,"1.0.0");await execute(cwd,["install","alpha","--source",one]);
  const before=await receipt(cwd),source=JSON.parse(await readFile(one,"utf8"));
  source.files["en/alpha/SKILL.md"]="tampered";await writeFile(one,JSON.stringify(source));
  await assert.rejects(execute(cwd,["update","alpha","--source",one]),/integrity/);
  source.sourceDigest=contentHash(Object.fromEntries(Object.entries(source).filter(([key])=>key!=="sourceDigest")));
  source.catalog[0].dependencies={beta:"1.0.0"};source.catalog[1].dependencies={alpha:"1.0.0"};
  source.sourceDigest=contentHash(Object.fromEntries(Object.entries(source).filter(([key])=>key!=="sourceDigest")));await writeFile(one,JSON.stringify(source));
  await assert.rejects(execute(cwd,["update","alpha","--source",one]),/cycle/);
  source.catalog[0].dependencies={missing:"1.0.0"};source.catalog[1].dependencies={};
  source.sourceDigest=contentHash(Object.fromEntries(Object.entries(source).filter(([key])=>key!=="sourceDigest")));await writeFile(one,JSON.stringify(source));
  await assert.rejects(execute(cwd,["install","alpha","--source",one]),/dependency/);
  await assert.rejects(execute(cwd,["install","unknown"]),/Unknown skill/);
  assert.deepEqual(await receipt(cwd),before);
}));

test("failed transaction restores both skill bytes and the receipt",async()=>sandbox(async(cwd)=>{
  const one=await release(cwd,"1.0.0"),two=await release(cwd,"2.0.0");await execute(cwd,["install","alpha","--source",one]);
  const before=await receipt(cwd),bytes=await readFile(path.join(cwd,"installed/alpha/SKILL.md"));
  await assert.rejects(run(["update","alpha","--dir","installed","--source",two],{cwd,onProgress(message){if(message==="Recording ownership receipt")throw new Error("Observer disconnected");}}),/Observer/);
  assert.deepEqual(await receipt(cwd),before);assert.deepEqual(await readFile(path.join(cwd,"installed/alpha/SKILL.md")),bytes);
  await execute(cwd,["update","alpha","--source",two]);
}));

test("process death during replacement is recovered before the next operation",async()=>sandbox(async(cwd)=>{
  const one=await release(cwd,"1.0.0"),two=await release(cwd,"2.0.0");await execute(cwd,["install","alpha","--source",one]);
  const script=`import {run} from ${JSON.stringify(new URL("./cli.mjs",import.meta.url).href)}; await run(${JSON.stringify(["update","alpha","--dir","installed","--source",two])},{cwd:${JSON.stringify(cwd)},onProgress(message){if(message==='Backing up alpha')process.kill(process.pid,'SIGKILL')}});`;
  const child=spawnSync(process.execPath,["--input-type=module","-e",script]);assert.equal(child.signal,"SIGKILL");
  await execute(cwd,["remove","alpha"]);await assert.rejects(access(path.join(cwd,"installed/alpha")));
}));

test("dry run exposes selection without creating the destination",async()=>sandbox(async(cwd)=>{
  const plan=JSON.parse(await execute(cwd,["install","context4-setup","--dry-run"]));
  assert.deepEqual(plan.install,["context4","context4-setup"]);
  await assert.rejects(access(path.join(cwd,"installed")));
}));
