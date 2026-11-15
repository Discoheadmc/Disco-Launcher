# Disco Launcher 0.0.1 — Day-0 Düzeltme Paketi 🩹

> **Aşağıdaki `DiscoLauncher-Setup-0.0.1.exe` dosyasını indir, kur, oyna.** SHA-256 doğrulaması için `.sha256` yan dosyasını kullanabilirsin.

0.1.0'daki `DiscoLauncher-Setup` paketi yeniden düzenlenmiş değildir — sürüm 0.0.1'e geri çekilerek kritik düzeltmelerle yayınlanıyor. **Herkesin bu sürüme geçmesi önerilir.**

---

## 🔥 Kritik Düzeltmeler

- **Çevrimdışı hesapta oyun hiç başlamıyordu** — `Will launch` sonrası launch zinciri sessizce asılı kalıyordu. Kök neden: üçüncü-parti hesap sisteminin kaldırılmasıyla `kYggdrasilSeriveRegistry` hiçbir yerde kayıtlı değildi ve `registry.get()` sonsuz bekliyordu. Ayrıca yerel yggdrasil ucu yalnızca `http` şemasına kayıtlıydı; launcher'ın yerel Node sunucusu istekleri `xmcl://launcher` olarak çevirir — authlib-injector 404 alıyor, oyun çıkış kodu 1 ile kapanıyordu. İkisi de düzeltildi; offline hesapla launch + oturum/skin zinciri canlı testle doğrulandı.
- **Yüklü olmayan / bozuk sürümde sağ panelde "Başlat" görünüyordu** — artık sabit **mavi "İndir"** butonu görünür (özel Başlat rengi bu durumu boyamaz), tıklayınca eksik sürüm/Java/kütüphane/asset onarım akışını çalıştırır; sorun çözülünce otomatik olarak "Başlat"a döner.
- **Takılan launch artık iptal edilebiliyor** — başka bir instance'a geçip İptal'e basmak `TypeError` üretiyor ve İptal hiç çalışmıyordu. Guard'lı token seçimiyle düzeltildi.
- **Ağ/indirme**: launcher artık Türkiye'de ve genelde `localhost` IPv4/İpv6'ya göre kendini yanlışlıkla Çin (GFW) saymıyor — `google.com` erişebiliyorsa doğrudan resmî kaynaklara gidiyor. BMCL sürprizi bitti.
- **CurseForge metadata 401** artık açık mesajlı log uyarısı üretir (Ayarlar → Ağ → CF API anahtarı). Bozuk "project mapping" veritabanı kendi kendini iyileştirir.
- **"Yardım" menüsü yenilendi** — GitHub Deposu, İndirmeler ve Hata Bildir bağlantıları (Discoheadmc/Disco-Launcher) · upstream XMCL linkleri düzeltildi · geri bildirim penceresindeki terk edilmiş OpenAI kartı GitHub Issues kanalına dönüştü.

## 🧹 Temizlik

- Kalan 6 birim-test kalıntısı temizlendi (otomatik güncelleme / settings fixture / modrinth / deskgap pwsh-skip) — **1760/1760 test geçiyor** (0 hata).
- `en.yaml`'dan kullanılmayan 98 i18n anahtarı çıkarıldı (agent / xmclAccount / multiplayer / presence kalıntıları).
- Kalan uyarı/diyagnostik logları üretim build'inden geri alındı.

---

## 📥 Doğrulama

| Dosya | Boyut | SHA-256 |
| --- | --- | --- |
| `DiscoLauncher-Setup-0.0.1.exe` | 94,23 MB | `e9499d4b67f4a6757753289d012c18e1e637006b7dedfcecd9491d5d41833130` |

```powershell
Get-FileHash .\DiscoLauncher-Setup-0.0.1.exe -Algorithm SHA256
```

**Bilinen sınır:** Çevrimdışı hesaplar online-mode açık sunuculara giremez (normal); tek oyunculu dünyalar, LAN ve online-mode=false sunucular çalışır. CurseForge market, sizin girdiğiniz bir CF API anahtarı gerektirir (Ayarlar → Ağ).

---

## 🔗 Bağlantılar

- 📖 [README](../README.md) · 🇬🇧 [English](../README.en.md)
- 🧭 [Geliştirme Sunumu](./Disco-Launcher-Gelistirme-Sunumu.md)
- 🛠 Upstream: [X Minecraft Launcher (XMCL)](https://github.com/Voxelum/x-minecraft-launcher) — MIT lisansıyla tüm temel için teşekkürler
