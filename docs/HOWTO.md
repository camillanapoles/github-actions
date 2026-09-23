# HOW TO — qual ramo, como usar, como converter

## Qual ramo?

| Ramo | É código? | Usas para |
| --- | --- | --- |
| **`main`** | **depois do merge do PR #1, sim** | clone, plugin, docs, trampolim YAML |
| `arena/01a01e33-github-actions` | sim (histórico desta sessão) | só se precisares do SHA pré-merge |
| `actos/fs` | **não** | disco L3. Nunca `checkout` para trabalhar |

```bash
git clone https://github.com/camillanapoles/github-actions.git
cd github-actions
git checkout main          # default. Depois do merge tem o kernel + plugin.
npm install
npm test
```

**Não clones `actos/fs`.** Não faças force-push nele.

## Usar ESTE repo (hub)

```bash
npm run seed
npm run dev                # http://localhost:3000  (0.0.0.0)
npx tsx src/cli/agent.ts --goal "smoke"
npm run cdn:export         # .actos-cdn
```

CDN público: https://camillanapoles.github.io/github-actions/

## Termux (Android local)

O `package.json` traz guard `postinstall`: se `process.platform === 'android'`,
instala `@esbuild/android-arm64` na versão do esbuild do lockfile. Sem isto, o
`node_modules` fica com o binário `@esbuild/linux-arm64` (install feito fora do
device ou copiado) e **toda a suite falha com `TransformError`** no import.

```bash
npm install                # postinstall resolve o binário android sozinho
npm test                   # esperado: 38/38 pass
```

- Se usares `--ignore-scripts`, corre à mão:
  `npm i --no-save @esbuild/android-arm64@$(node -p "require('esbuild/package.json').version")`
- **Node local ≠ CI**: os runners usam Node 20; local pode ser ≥22. O `src/test/env.ts`
  já força `ACTOS_FILEDB=1` para expor diferenças de `node:sqlite` entre versões.
- Coleta de cache L1 (equivalente local ao passo do `gc.yml`):
  `gh cache list --key actos-l1- --json id,createdAt` + `gh cache delete <id>`.

## Converter OUTRO repo (sem Docker como CPU)

```bash
bash plugin/actos/install.sh /path/to/alvo
cd /path/to/alvo
git add .actos-plugin .github/workflows/actos-cpu.yml
git commit -m "chore: ACTOS CPU (runner, not docker)"
```

Detalhe: [`CONVERTER.md`](./CONVERTER.md). Skill: [`../harness/skills/convert.md`](../harness/skills/convert.md).

## Próximo agente

Lê [`AGENTE-PROXIMO.md`](./AGENTE-PROXIMO.md). Não apagues `arena/01a01e33-github-actions`.
