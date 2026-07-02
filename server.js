// Tiny static file server for the Sunset Drift game folder.
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname;
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp',
  '.glb':'model/gltf-binary', '.gltf':'model/gltf+json', '.hdr':'image/vnd.radiance',
  '.wav':'audio/wav', '.mp3':'audio/mpeg', '.ogg':'audio/ogg' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(root, p);
  fs.readFile(fp, (e, data) => {
    if (e) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(4400, () => console.log('Sunset Drift V2 (overhaul) serving on http://localhost:4400'));
