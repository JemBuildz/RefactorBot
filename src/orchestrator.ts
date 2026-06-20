import * as fs from 'fs';
import * as path from 'path';
import { parserAgent, architectAgent, devAgent, qaAgent, reviewerAgent } from './agents';

const OUTPUT_DIR = path.join(__dirname, '../output');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

export async function runRefactorBot(legacyCode: string, targetFramework: string) {
  console.log('Starting RefactorBot...');

  console.log('Parser: Analyzing...');
  const parsedData = await parserAgent(legacyCode);

  console.log('Architect: Designing...');
  const architectPlan = await architectAgent(parsedData, targetFramework);

  console.log('Dev: Writing code...');
  let generatedCode = await devAgent(architectPlan, parsedData);

  let approved = false;
  let attempts = 0;
  const MAX_ATTEMPTS = 3;

  while (!approved && attempts < MAX_ATTEMPTS) {
    attempts++;
    console.log('QA: Reviewing (attempt ' + attempts + ')...');
    const qaResult = await qaAgent(generatedCode);
    
    try {
      const qaJson = JSON.parse(qaResult);
      if (qaJson.approved === true) {
        approved = true;
        console.log('QA approved!');
      } else {
        console.log('QA rejected: ' + qaJson.feedback);
        if (attempts < MAX_ATTEMPTS) {
          console.log('Reviewer: Mediating...');
          const reviewFeedback = await reviewerAgent(qaJson.feedback, generatedCode);
          console.log('Dev: Rewriting...');
          generatedCode = await devAgent(architectPlan, parsedData + '\n\nFIXES:\n' + reviewFeedback);
        }
      }
    } catch (e) {
      console.warn('QA response not valid JSON.');
    }
  }

  if (approved) {
    console.log('Success!');
    fs.writeFileSync(path.join(OUTPUT_DIR, 'generated_code.txt'), generatedCode);
  } else {
    console.log('Max attempts reached.');
    fs.writeFileSync(path.join(OUTPUT_DIR, 'generated_code_last.txt'), generatedCode);
  }
  console.log('Done.');
}

const sampleCode = 'function add(a, b) { return a + b; }';
runRefactorBot(sampleCode, 'FastAPI');
