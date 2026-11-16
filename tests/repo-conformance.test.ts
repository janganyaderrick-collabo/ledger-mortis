// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf-8').replace(/\r\n/g, '\n');
}

function exists(relativePath: string): boolean {
  return existsSync(resolve(repoRoot, relativePath));
}

interface PackageJson {
  private?: boolean;
  type?: string;
  scripts?: Record<string, string>;
  engines?: { node?: string };
}

function readPackageJson(): PackageJson {
  return JSON.parse(read('package.json')) as PackageJson;
}

const TOKEN_TABLE: Readonly<Record<string, string>> = {
  ink: '#0b0b14',
  fog: '#1b1b2e',
  bone: '#e8e2d0',
  ember: '#ff7a1a',
  ghost: '#7fe3d0',
  blood: '#c0392b',
  'blood-text': '#ff6b5b',
};

function sectionAfterHeading(markdown: string, heading: string): string {
  const start = markdown.indexOf(`\n${heading}\n`);
  if (start === -1) return '';
  const rest = markdown.slice(start + heading.length + 2);
  const next = rest.search(/^## /m);
  return next === -1 ? rest : rest.slice(0, next);
}

// Feature: 00-foundation, Task 7.2: repository conformance checks (config, tokens, index.html, README, folder layout)
describe('repository conformance', () => {
  describe('A. index.html', () => {
    const html = read('index.html');

    it('declares the page language and viewport', () => {
      expect(/<html[^>]*\slang="en"/.test(html), 'index.html <html> is missing lang="en"').toBe(
        true,
      );
      expect(
        /<meta[^>]*name="viewport"/.test(html),
        'index.html is missing a viewport meta tag',
      ).toBe(true);
    });

    it('has the exact title and the root element', () => {
      const title = /<title>([^<]*)<\/title>/.exec(html)?.[1];
      expect(title, 'index.html title is not exactly "Ledger Mortis"').toBe('Ledger Mortis');
      expect(/<div\s+id="root"\s*>/.test(html), 'index.html is missing <div id="root">').toBe(true);
    });

    it('has exactly one module script pointing at /src/main.tsx', () => {
      const scripts = html.match(/<script\b[^>]*>/g) ?? [];
      expect(scripts.length, 'index.html must contain exactly one <script> tag').toBe(1);
      const tag = scripts[0] ?? '';
      expect(
        /\ssrc="\/src\/main\.tsx"/.test(tag),
        'index.html script src is not /src/main.tsx',
      ).toBe(true);
      expect(/\stype="module"/.test(tag), 'index.html script is missing type="module"').toBe(true);
    });

    it('contains no absolute URLs', () => {
      expect(html.includes('http://'), 'index.html contains "http://"').toBe(false);
      expect(html.includes('https://'), 'index.html contains "https://"').toBe(false);
    });
  });

  describe('B. tokens.css', () => {
    const css = read('src/styles/tokens.css');

    it('has the seven token values from the design language', () => {
      for (const [name, expected] of Object.entries(TOKEN_TABLE)) {
        const match = new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(css);
        expect(match, `tokens.css is missing --${name}`).not.toBeNull();
        expect(match?.[1]?.toLowerCase(), `tokens.css --${name} drifted from ${expected}`).toBe(
          expected,
        );
      }
    });

    it('has exactly seven hex colour literals', () => {
      const literals = css.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
      expect(literals.length, 'tokens.css must contain exactly 7 hex colour literals').toBe(7);
    });

    it('declares the Lights-On theme block', () => {
      const block = /:root\[data-theme='lights-on'\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
      expect(block, "tokens.css is missing the :root[data-theme='lights-on'] block").not.toBe('');
      expect(
        /--surface-bg\s*:\s*var\(--bone\)/.test(block),
        'lights-on block does not set --surface-bg: var(--bone)',
      ).toBe(true);
      expect(
        /--surface-text\s*:\s*var\(--ink\)/.test(block),
        'lights-on block does not set --surface-text: var(--ink)',
      ).toBe(true);
    });

    it('keeps !important inside the reduced-motion media block', () => {
      const mediaStart = css.indexOf('@media (prefers-reduced-motion: reduce)');
      expect(
        mediaStart,
        'tokens.css is missing the prefers-reduced-motion media block',
      ).toBeGreaterThan(-1);
      let from = 0;
      for (;;) {
        const index = css.indexOf('!important', from);
        if (index === -1) break;
        expect(
          index,
          `tokens.css has !important at offset ${index} before the reduced-motion block`,
        ).toBeGreaterThan(mediaStart);
        from = index + 1;
      }
    });

    it('has no imports, url() or network references', () => {
      for (const forbidden of ['@import', 'url(', 'http']) {
        expect(css.includes(forbidden), `tokens.css contains "${forbidden}"`).toBe(false);
      }
    });

    it('drift guard: token hex values also appear in the steering doc and contrast test', () => {
      const steering = read('.kiro/steering/design-language.md').toLowerCase();
      const contrastTest = read('src/ui/a11y/contrast.example.test.ts').toLowerCase();
      for (const [name, hex] of Object.entries(TOKEN_TABLE)) {
        expect(steering.includes(hex), `design-language.md is missing ${hex} (${name})`).toBe(true);
        expect(
          contrastTest.includes(hex),
          `contrast.example.test.ts is missing ${hex} (${name})`,
        ).toBe(true);
      }
    });
  });

  describe('C. package.json and tsconfig.app.json', () => {
    const pkg = readPackageJson();

    it('has the exact scripts', () => {
      expect(pkg.scripts, 'package.json scripts drifted').toEqual({
        dev: 'vite',
        build: 'tsc -b && vite build',
        test: 'vitest run',
        lint: 'eslint . --max-warnings 0',
        format: 'prettier --write .',
      });
    });

    it('has the exact engines, module type and private flag', () => {
      expect(pkg.engines?.node, 'package.json engines.node drifted').toBe(
        '^22.12.0 || ^24.0.0 || >=26.0.0',
      );
      expect(pkg.type, 'package.json "type" is not "module"').toBe('module');
      expect(pkg.private, 'package.json "private" is not true').toBe(true);
    });

    it('enables strict mode and includes src and tests', () => {
      const text = read('tsconfig.app.json');
      expect(
        /"strict"\s*:\s*true/.test(text),
        'tsconfig.app.json does not enable "strict": true',
      ).toBe(true);
      const include = /"include"\s*:\s*\[([^\]]*)\]/.exec(text)?.[1] ?? '';
      expect(include.includes('src'), 'tsconfig.app.json include does not mention "src"').toBe(
        true,
      );
      expect(include.includes('tests'), 'tsconfig.app.json include does not mention "tests"').toBe(
        true,
      );
    });
  });

  describe('D. README.md', () => {
    const readme = read('README.md');
    const lines = readme.split('\n');

    it('has the title and all required headings', () => {
      expect(lines.includes('# Ledger Mortis'), 'README is missing "# Ledger Mortis"').toBe(true);
      const headings = [
        '## What it is',
        '## Privacy',
        '## Requirements',
        '## How to run',
        '## Project structure',
        '## Design tokens',
        '## Money convention',
        '## Built with Kiro',
        '## Disclosures',
        '## License',
      ];
      for (const heading of headings) {
        expect(lines.includes(heading), `README is missing the heading "${heading}"`).toBe(true);
      }
    });

    it('states the Node engines range and the money convention', () => {
      const engines = readPackageJson().engines?.node ?? '';
      expect(engines, 'package.json engines.node is empty').not.toBe('');
      expect(
        readme.includes(engines),
        'README does not contain the package.json engines.node',
      ).toBe(true);
      expect(readme.includes('integer'), 'README does not mention "integer"').toBe(true);
      expect(readme.includes('minor units'), 'README does not mention "minor units"').toBe(true);
    });

    it('has the required disclosures', () => {
      const disclosures = sectionAfterHeading(readme, '## Disclosures');
      expect(disclosures, 'README Disclosures section is missing or empty').not.toBe('');
      expect(
        /Kiroween 2026 submission period/i.test(disclosures),
        'Disclosures does not mention the Kiroween 2026 submission period',
      ).toBe(true);
      expect(
        /no pre-existing code/i.test(disclosures),
        'Disclosures does not say no pre-existing code is included',
      ).toBe(true);
    });

    it('contains no absolute URLs', () => {
      expect(readme.includes('http://'), 'README contains "http://"').toBe(false);
      expect(readme.includes('https://'), 'README contains "https://"').toBe(false);
    });

    it('lists only paths that exist in the Project structure block', () => {
      const section = sectionAfterHeading(readme, '## Project structure');
      const block = /```[^\n]*\n([\s\S]*?)\n```/.exec(section)?.[1] ?? '';
      expect(block, 'README Project structure has no fenced code block').not.toBe('');

      const parents: string[] = [];
      let checked = 0;
      for (const line of block.split('\n')) {
        if (line.trim() === '') continue;
        const indent = line.length - line.trimStart().length;
        const name = line.trim().split(/\s+/)[0] ?? '';
        const depth = indent / 2;
        expect(
          Number.isInteger(depth) && depth <= parents.length,
          `README structure line has unexpected indentation: "${line}"`,
        ).toBe(true);
        parents.length = depth;
        const isFolder = name.endsWith('/');
        const fullPath = [...parents, name].join('');
        expect(exists(fullPath), `README lists "${fullPath}" but it does not exist`).toBe(true);
        if (isFolder) parents.push(name);
        checked += 1;
      }
      expect(checked, 'README Project structure block has no entries').toBeGreaterThan(0);
    });
  });

  describe('E. folder layout', () => {
    // Later modules must keep these .gitkeep files or update this test.
    const folders = [
      'src/core/model',
      'src/core/parsers',
      'src/core/analysis',
      'src/ui/graveyard',
      'src/ui/exorcism',
      'src/ui/import',
      'src/ui/a11y',
      'src/samples',
    ];

    for (const folder of folders) {
      it(`${folder} exists and contains .gitkeep`, () => {
        expect(exists(folder), `folder ${folder} does not exist`).toBe(true);
        const entries = readdirSync(resolve(repoRoot, folder));
        expect(entries.includes('.gitkeep'), `${folder} is missing .gitkeep`).toBe(true);
      });
    }
  });

  describe('F. repository hygiene', () => {
    it('has an MIT LICENSE', () => {
      expect(exists('LICENSE'), 'LICENSE is missing').toBe(true);
      expect(
        read('LICENSE').includes('MIT License'),
        'LICENSE does not contain "MIT License"',
      ).toBe(true);
    });

    it('ignores node_modules and dist but not .kiro', () => {
      const gitignore = read('.gitignore');
      expect(/^\/?node_modules\/?$/m.test(gitignore), '.gitignore has no node_modules line').toBe(
        true,
      );
      expect(/^\/?dist\/?$/m.test(gitignore), '.gitignore has no dist line').toBe(true);
      const kiroLines = gitignore.split('\n').filter((line) => /\.kiro/i.test(line));
      expect(kiroLines, '.gitignore must not ignore .kiro').toEqual([]);
    });

    it('has the steering documents and foundation spec files', () => {
      const required = [
        '.kiro/steering/product.md',
        '.kiro/steering/tech.md',
        '.kiro/steering/privacy.md',
        '.kiro/steering/design-language.md',
        '.kiro/specs/00-foundation/requirements.md',
        '.kiro/specs/00-foundation/design.md',
        '.kiro/specs/00-foundation/tasks.md',
      ];
      for (const path of required) {
        expect(exists(path), `${path} is missing`).toBe(true);
      }
    });
  });
});
