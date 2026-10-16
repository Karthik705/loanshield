// Inlines core.js, data.js and app.js into one self-contained index.html
const fs = require('fs');
const path = require('path');
const dir = __dirname;
let html = fs.readFileSync(path.join(dir, 'index.src.html'), 'utf8');
const put = (tag, file) => { html = html.replace(tag, () => fs.readFileSync(path.join(dir, file), 'utf8').replace(/<\/script>/gi, '<\\/script>')); };
put('/*@CORE@*/', 'core.js');
put('/*@DATA@*/', 'data.js');
put('/*@APP@*/', 'app.js');
fs.mkdirSync(path.join(dir, 'site', 'downloads'), { recursive: true });
fs.writeFileSync(path.join(dir, 'site', 'index.html'), html);
console.log('built site/index.html', html.length, 'bytes');
// Artifact variant: the host adds doctype/head/body, so ship the content only.
const title = (html.match(/<title>[\s\S]*?<\/title>/) || [''])[0];
const style = (html.match(/<style>[\s\S]*?<\/style>/) || [''])[0];
const body = html.split(/<body>/)[1].split(/<\/body>/)[0];
fs.mkdirSync(path.join(dir, 'artifact', 'downloads'), { recursive: true });
fs.writeFileSync(path.join(dir, 'artifact', 'index.html'), title + '\n' + style + '\n' + body);
console.log('built artifact/index.html');
