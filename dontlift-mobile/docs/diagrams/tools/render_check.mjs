/** Real Mermaid parse/render check in headless Chrome. Dependencies live outside the app.
 * node render_check.mjs <temporary-node_modules> <chrome.exe> <output-directory>
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [modules, executablePath, outputArg] = process.argv.slice(2);
if (!modules || !executablePath || !outputArg) throw new Error('Expected node_modules, Chrome executable and output directory.');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(outputArg);
await fs.mkdir(output, { recursive: true });
const { chromium } = await import(pathToFileURL(path.join(modules, 'playwright-core', 'index.mjs')).href);
const dist = path.resolve(modules, 'mermaid', 'dist');
const server = http.createServer(async (req, res) => {
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><html lang="vi"><meta charset="utf-8"><body><main id="preview"></main><script type="module">import mermaid from "/mermaid.esm.min.mjs"; window.mermaid=mermaid; mermaid.initialize({startOnLoad:false,securityLevel:"strict",theme:"default"});</script>');
    return;
  }
  try {
    const target = path.resolve(dist, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!target.startsWith(dist + path.sep)) throw new Error('Invalid path');
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.end(await fs.readFile(target));
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const results = [];
try {
  browser = await chromium.launch({executablePath, headless:true});
  const page = await browser.newPage({viewport:{width:1500,height:1000},deviceScaleFactor:1});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => Boolean(window.mermaid));
  const catalog = JSON.parse(await fs.readFile(path.join(root,'catalog.json'),'utf8'));
  for (const [index,item] of catalog.entries()) {
    const content = await fs.readFile(path.join(root,item.path),'utf8');
    if (item.kind === 'use-case') continue;
    const match = /```mermaid\r?\n([\s\S]*?)\r?\n```/.exec(content);
    if (!match) throw new Error(`Missing Mermaid block: ${item.path}`);
    const result = await page.evaluate(async ({code,id}) => {
      try {
        await window.mermaid.parse(code);
        const {svg} = await window.mermaid.render(id,code);
        document.getElementById('preview').innerHTML=svg;
        const el=document.querySelector('#preview svg');
        const box=el.viewBox.baseVal;
        return {ok:true,svg,width:box.width,height:box.height};
      } catch(error) { return {ok:false,error:String(error)}; }
    },{code:match[1],id:`diagram${index}`});
    const {svg,...metadata}=result;
    results.push({path:item.path,...metadata});
    if (svg) {
      const stem=item.path.replace(/\.md$/,'').replaceAll('/','--');
      await fs.writeFile(path.join(output,stem+'.svg'),svg);
      if (['activity/act-12-ocr.md','erd/erd-02-sqlite-core.md','sequence/seq-16-premium.md','class/cls-02-solo-sensor.md','state-machine/stm-05-phong.md'].includes(item.path)) {
        await page.locator('#preview').screenshot({path:path.join(output,stem+'.png')});
      }
    }
    console.log(`${result.ok?'PASS':'FAIL'} ${item.path}${result.error?' '+result.error:''}`);
  }
  // Use Case SVGs are local standalone artifacts, inspected using the same headless browser.
  for (const item of catalog.filter(x=>x.kind==='use-case')) {
    const svg=await fs.readFile(path.join(root,item.path.replace(/\.md$/,'.svg')),'utf8');
    await page.evaluate(svg=>{document.getElementById('preview').innerHTML=svg;},svg);
    const stem=item.path.replace(/\.md$/,'').replaceAll('/','--');
    await page.locator('#preview').screenshot({path:path.join(output,stem+'.png')});
  }
  await fs.writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));
  const failed=results.filter(x=>!x.ok);
  console.log(`Rendered ${results.length} Mermaid diagrams; ${failed.length} failed.`);
  if(failed.length) process.exitCode=1;
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
