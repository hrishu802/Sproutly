import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Security & Secrets Protection', () => {
  it('ensures HF_TOKEN and PLANTNET_API_KEY are not exposed with VITE_ prefix', () => {
    const envExamplePath = path.resolve(__dirname, '../.env.example');
    const content = fs.readFileSync(envExamplePath, 'utf-8');

    expect(content).not.toContain('VITE_HF_TOKEN');
    expect(content).not.toContain('VITE_PLANTNET_API_KEY');
    expect(content).toContain('HF_TOKEN=');
  });

  it('ensures frontend source code in src/ never accesses backend API keys directly', () => {
    const srcDir = path.resolve(__dirname, '../src');

    function checkDir(dir: string) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          checkDir(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
          const fileContent = fs.readFileSync(fullPath, 'utf-8');
          expect(fileContent).not.toContain('process.env.HF_TOKEN');
          expect(fileContent).not.toContain('process.env.PLANTNET_API_KEY');
          expect(fileContent).not.toContain('import.meta.env.VITE_HF_TOKEN');
          expect(fileContent).not.toContain('import.meta.env.VITE_PLANTNET_API_KEY');
        }
      }
    }

    checkDir(srcDir);
  });
});
