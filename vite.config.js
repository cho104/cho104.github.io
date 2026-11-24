import { defineConfig } from 'vite';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReadme } from './src/content/parse.js';

const root = dirname(fileURLToPath(import.meta.url));
const README = resolve(root, 'README.md');
const ID = 'virtual:content';

// README.md → `import content from 'virtual:content'`. Editing README reloads the page in dev.
function readmeContent() {
  return {
    name: 'readme-content',
    resolveId: (id) => (id === ID ? '\0' + ID : null),
    load(id) {
      if (id !== '\0' + ID) return null;
      this.addWatchFile(README);
      const exists = (p) => existsSync(resolve(root, p));
      return `export default ${JSON.stringify(parseReadme(readFileSync(README, 'utf8'), { exists }))};`;
    },
    configureServer(server) {
      server.watcher.add(README);
      server.watcher.on('change', (file) => {
        if (file !== README) return;
        const mod = server.moduleGraph.getModuleById('\0' + ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

export default defineConfig({
  plugins: [readmeContent()],
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
