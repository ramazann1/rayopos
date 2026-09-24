---
name: rayopos-seans-sonu-commit-claude-yapar
description: "RayoPOS'da seans sonu git add/commit/push işini Claude yapar, Ramazan'a komut verilmez."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2b2cb3f2-badb-4bb4-bdfb-6fa2e734f4f7
  modified: 2026-07-31T22:08:08.781Z
---

RayoPOS projesinde seans sonu kaynak kontrolünü (add → commit → push) Claude
kendisi çalıştırır. Ramazan'a "şu komutları çalıştır" diye liste verilmez.

**Why:** 1 Ağu 2026 seansında komutları verdiğimde "sen commit et beni
uğraştırma" dedi. CLAUDE.md'de "Her seans sonunda kullanıcı: git add..."
yazıyor ama pratikte tersini istiyor.

**How to apply:** Seans sonunda doküman güncellemesi bitince doğrudan commit
ve push et, sonucu tek cümleyle bildir. Commit mesajı Türkçe ve sade olsun
(mevcut geçmişe uyacak şekilde).
