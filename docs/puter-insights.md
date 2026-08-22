# Insights do Puter.js → ACTOS

Puter ([HeyPuter/puter](https://github.com/HeyPuter/puter)) é um **Internet OS**: desktop no browser, FS na cloud, KV, hosting, drivers. Não copiamos o GUI. Copiamos a **cisão de camadas**.

## O que o Puter acerta (e nós já cheirávamos)

| Puter | ACTOS |
| --- | --- |
| `puter.fs.write(path, data)` — o cliente fala **path**, não tabela | `Kernel.write` / `ObjectPath` |
| HL operations (mkdir recursivo, UX) vs **LL** (mínimo para um FS) | Kernel (syscalls) vs **GitFs provider** (F2) |
| `FSNodeContext` = inode | `StoredObject` + pattern+id |
| Storage por **UID/UUID** no disco; o path é metadata | git **blob SHA** = conteúdo; path = nome no tree `actos/fs` |
| Providers / mountpoints (PuterFS, local disk, proxy) | L1 cache · L2 artifact · L3 git · L4 Pages |
| `puter.kv` — estado pequeno, não o FS | journal `events` + `proc/stat` + CAS key |
| `puter.hosting.create(subdomain, dir)` — um dir vira URL pública | F5 Pages / tag `actos/obj/{sha}` (CDN) |
| GUI é **vista** do FS, nunca origem | page async lê projecção; CPU = Action/CLI |
| Drivers (AI, FS, KV) | syscalls |
| SDK nunca é o backend | HTTP enqueue ≠ execute |

Issue [#1146](https://github.com/HeyPuter/puter/issues/1146) desenha a stack:

```
Client  →  HL  →  LL  →  Provider  →  storage
```

ACTOS no GitHub:

```
UI/RSC  →  Kernel  →  GitFs (LL)  →  git objects
                ↘ SQLite (inode cache, como FSEntry)
```

## Ideias que valem ouro para nós

1. **Path é o contrato público.** Outros projectos integram `puter.fs.*` sem saber S3. Outros repos integram `/objects/{kind}/{id}` sem saber git.
2. **Blob ≠ inode.** Puter grava ficheiro em `./storage/{uid}`. Nós: blob git + row SQLite. Crash a meio = journal (F1) + tree git (F2).
3. **KV separado do FS.** Não entupir o disco com `/proc`. Refs `refs/actos/runtime/{pid}` são o KV de processos (41 bytes).
4. **Hosting = montar um dir no CDN.** F5 não é “gerar site”: é exportar um prefixo do VFS já redactado pelas regras.
5. **O desktop é um file manager.** `/disco` é o Explorer do `actos/fs`. O Puter ensina: se o FS estiver certo, a UI é barata.
6. **User-pays / metering** — mais tarde, por repo namespace (F6). Não agora.

## O que *não* trazer

- Window manager, wallpaper, apps no iframe.
- Client-side como origem (o Puter.js SDK ainda fala com um backend; nós também).
- WebDAV já — o LL gitfs primeiro.

F2 implementa o **PuterFSProvider** nosso: `src/domain/gitfs.ts`.
