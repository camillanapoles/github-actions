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
