---
name: rayopos-hafiza-depoya-kopyalanir
description: Hafıza dosyaları projedeki claude-hafizasi/ klasörüne aynalanıyor; seans sonunda tazele.
metadata:
  node_type: memory
  type: project
  originSessionId: f700f08c-6570-44e0-84d7-0827ad413695
  modified: 2026-09-24T01:16:45.180Z
---

Ramazan projede iki bilgisayardan çalışıyor (24 Eyl 2026 kararı). Hafıza
dosyaları `~/.claude/projects/...` altında durduğu ve git ile taşınmadığı için
projenin içindeki **`claude-hafizasi/`** klasörüne kopyalanıyorlar.

**Why:** Sohbet geçmişi makineler arasında taşınmıyor. Çalışma kuralları da
taşınmazsa öteki bilgisayarda her şeyi baştan söylemesi gerekir.

**How to apply:** Seans sonu commit'inden önce hafıza klasöründeki `.md`
dosyalarını `claude-hafizasi/` içine yeniden kopyala — yeni ya da değişmiş
kural varsa ayna eskimiş olur. Klasördeki `NASIL-KULLANILIR.md` kopyalamanın
hedef yolunu anlatıyor, o dosya aynalamaya dahil değil.
[[rayopos-seans-sonu-commit-claude-yapar]]
