---
name: rayopos-tur-denetimi-tsc-b
description: "RayoPOS'ta tür denetimi `npx.cmd tsc -b` ile yapılır; `tsc --noEmit -p .` hiçbir dosyayı denetlemiyor."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 774adad3-2a97-49ec-b2df-418fb646f9f7
  modified: 2026-09-25T00:34:53.183Z
---

Kök tsconfig.json `"files": []` + `references` yapısında. `tsc --noEmit -p .` bu yüzden hiçbir dosyayı derlemeden "temiz" döner. Doğrusu `npx.cmd tsc -b` (build betiği de `tsc -b && vite build`).

**Why:** 25 Eyl 2026'da bütün seans boyunca `-p .` ile "tür denetimi temiz" denildi; eksik import (`Percent`, `Ipucu`) yüzünden Kârlılık sekmesi beyaz sayfa verdi, ancak tarayıcıda görüldü.

**How to apply:** her değişiklikten sonra `npx.cmd tsc -b`; push öncesi yine `npm.cmd run build` ([[rayopos-gondermeden-once-build]]).
