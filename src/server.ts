import express from 'express';
import cors from 'cors';
import * as fs from 'fs';
import * as path from 'path';
import { runRefactorBot } from './orchestrator';

const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint (Judges will see this when they visit your URL)
app.get('/', (req, res) => {
  res.send('🤖 RefactorBot Agent Society is live on Alibaba Cloud!');
});

// API endpoint to trigger the agents
app.post('/refactor', async (req, res) => {
  try {
    const { legacyCode, targetFramework } = req.body;
    const codeToRefactor = legacyCode || `function add(a, b) { return a + b; }`;
    const framework = targetFramework || 'FastAPI';

    console.log('🚀 Triggering RefactorBot via API...');
    await runRefactorBot(codeToRefactor, framework);

    const outputPath = path.join(__dirname, '../output/generated_code.txt');
    let generatedCode = 'Output file not found.';
    if (fs.existsSync(outputPath)) {
      generatedCode = fs.readFileSync(outputPath, 'utf-8');
    }

    res.json({
      success: true,
      message: 'RefactorBot completed!',
      generatedCode
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Alibaba Cloud Function Compute listens on port 9000 by default
const PORT = Number(process.env.PORT) || 9000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 RefactorBot server listening on port ${PORT}`);
});
