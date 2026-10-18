import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Official CAPMAS Egypt Population Clock Proxy Endpoint
  app.get('/api/egypt-population', async (_req, res) => {
    try {
      const response = await fetch('https://www.capmas.gov.eg:8080/population-proxy/total', {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/plain, application/json, */*',
          Referer: 'https://www.capmas.gov.eg/',
          Origin: 'https://www.capmas.gov.eg',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (!response.ok) {
        throw new Error(`CAPMAS responded with status ${response.status}`);
      }

      const rawText = (await response.text()).trim();
      const numericPopulation = parseInt(rawText.replace(/[^0-9]/g, ''), 10);

      if (!numericPopulation || isNaN(numericPopulation)) {
        throw new Error('Invalid population payload from CAPMAS');
      }

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      return res.json({
        population: numericPopulation,
        source: 'الجهاز المركزي للتعبئة العامة والإحصاء (CAPMAS)',
        officialUrl: 'https://www.capmas.gov.eg/',
        fetchedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching live CAPMAS population:', error);
      return res.status(502).json({
        error: 'تعذر الاتصال المباشر بخادم الساعة السكانية الرسمي حالياً',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
