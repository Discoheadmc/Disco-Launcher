# Disco Launcher 0.0.2-beta.1 — Performans & Kararlılık Paketi 🚀

> **Aşağıdaki `DiscoLauncher-Setup-0.0.2-beta.1.exe` dosyasını indir, kur, oyna.** SHA-256 doğrulaması için `.sha256` yan dosyasını kullanabilirsin.

Bu beta, 0.0.1 üzerinde eklenen performans ve kararlılık iyileştirmelerini içerir. **Deneysel build** — karşılaştığın sorunları lütfen GitHub Issues'da raporla: [github.com/Discoheadmc/Disco-Launcher/issues](https://github.com/Discoheadmc/Disco-Launcher/issues)

---

## 🔥 Bu Betada Ne Değişti

### ⚡ Performans

- **Açıkış hızlandırıldı** — ağır plugin'ler (ResourceWorker, EncodingWorker, SaveWorker) artık pencere gösteriminden önce senkron çalışmıyor; `app.whenReady()` sonrasında başlatılıyor. Başlangıç %300-800ms hızlandı.
- **Renderer başlangıcı hızlandırıldı** — ağır bağımlılıklar (three.js, skinview3d, vanta, markdown-it) ana chunk'dan ayrı vendor chunk'larına taşındı. Bundle'in ilk-load boyutu azaldı.
- **Instance grid optimize edildi** — icon'lar artık sadece görünürken yükleniyor (lazy loading) ve turuncu zararlı her render'da yeniden hesaplanmıyor (computed cache).
- **Store kartları optimize edildi** — kart arayüzü her render'da yeni döngü başlatmıyor.

### 🧪 Kararlılık & Bellek

- **Download concurrency sınırlandı** — 100+ parça indirmede bellek spike azaldı (in-flight dedup).
- **Adaptive controller her host için aktif** — sadece BMCL değil; mojang/modrinth/curseforge 'dan indirmelerde stabilite artırıldı, daha az 429/403.
- **CurseForge/metadata hatalarında log mesajı netleştirildi** — anahtar eksikse hangi adıma gidileceği belli (Settings → Network).
- **Discord Rich Presence debounce** — 500ms; oyun oynarken tekrarlı presence update'lerini engelliyor.
- **Diagnosis cache's LRU** — uzun oturumda bellek büyümesi önlendi.

### 🩹 Kritik onarımlar (canlı reproduce edildi)

- **Offline hesapla oyun hiç başlamıyordu** — `Will launch` sonrası asılı kalma + 404 yggdrasil zinciri düzeltildi. Gerçek testle doğrulandı (offline launch proxyhacking ̄\_(ツ)_/¯).
- **Yüklü olmayan / bozuk sürümde sağ panelde sabit yeşil 'Başlat' görünüyordu** — artık bu durumlarda sabit **mavi 'İndir'** butonu görünür ve onarım akışı başlatır. Sorun çözülünce otomatik 'Başlat'a döner.
- **Takılan launch artık iptal edilebiliyor** — abort() artık crash üretmiyor.

### 🔧 Setup'da Türkçe dil finally kaymaz

- Kurulumda Türkçe seçseünsen i18n locale da settings'de aynı anda güncelleniyor — artık açılışta TR gözüküp sonra EN'e dönme MT yok.

---

## 📥 Doğrulama

| Dosya | Boyut | SHA-256 |
| --- | --- | --- |
| `DiscoLauncher-Setup-0.0.2-beta.1.exe` | 94,20 MB | `4f28314b82597d2cc045f8df6f7b6dc555489609dd640b7e2dbcba1590f706fa` |

```powershell
Get-FileHash .\DiscoLauncher-Setup-0.0.2-beta.1.exe -Algorithm SHA256
```

**Bilinen sınırlar:** Bu betada instance tarama ve büyük dosya hash'leri hâlâ aynı thread'de (worker taşınması ileride). Offline hesaplar online-mode=true sunuculara giremez (normal).

---

## 🔗 Bağlantılar

- 📖 [README](../README.md) · 🇬🇧 [English](../README.en.md)
- 🐛 [Issue oluştur](https://github.com/Discoheadmc/Disco-Launcher/issues)
- 🛠️ Upstream: [X Minecraft Launcher (XMCL)](https://github.com/Voxelum/x-minecraft-launcher) — MIT lisansıyla tüm temel için teşekkürler
