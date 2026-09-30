# Disco Launcher 0.1.0 — İlk Sürüm 🚀

Disco Launcher'ın ilk genel sürümü: XMCL tabanlı, Windows odaklı, Türkçe öncelikli, hafif ve minimalist bir Minecraft launcher'ı.

> **Kurulum:** Aşağıdaki `DiscoLauncher-Setup-0.1.0.exe` dosyasını indir, kur, oyna. SHA-256 doğrulaması için `.sha256` dosyasını kullanabilirsin.

---

## ✨ Öne Çıkanlar

- 🪶 **Hafif** — telemetri, oto-güncelleme, P2P çok oyunculu ve AI asistanı yok
- 🔐 **Microsoft + çevrimdışı hesaplar**
- 🧥 **Yerel kaplamalar & özel pelerin** — çevrimdışı kaplamalar oyunda görünür
- 🧩 **Mod paketi mağazası** — CurseForge (kendi API anahtarınla), Modrinth, FTB
- 🎨 **Prism-minimal tema** — 8 renk seçici; "Başlat" butonu rengi dahil
- 🗂 **Çoklu instance** · 💬 **Discord Rich Presence** · 🖥 **Windows / macOS / Linux**

---

## 🔧 Ne Yapıldı?

### Sadeleştirme ve Hafifletme

Upstream XMCL'den bilinçli çıkarımlar: P2P çok oyunculu sistem, üçüncü parti hesaplar (ely.by, LittleSkin, xmcl.org), AI agent arka ucu, otomatik güncelleme altyapısı ve telemetri ihracatçıları kaldırıldı; haber bölümü ve Minecraft arkadaşları silindi; kullanılmayan 17+ bağımlılık budandı. **Sonuç:** daha az arka plan süreci, daha hızlı başlatma ve çalışma anında daha düşük kaynak tüketimi. 0.1.0 kurulum paketi **94,23 MB**.

### Performans ve Ağ

- V8 disk üstü kod önbelleği ile daha hızlı sıcak başlatma
- undici `bodyTimeout` 10 sn → 60 sn: yavaş CDN'de büyük indirmeler kopmuyor
- Varsayılan `maxSockets` 64 → 16; mağaza trend/son sürüm istekleri sayfa görünürlüğüne bağlandı
- Sessiz günlükler: prod'da undici.log yazımı kapatıldı

### Arayüz: Prism-Minimal Tema

- Ayarlar, Oyun Oluşturma, giriş ve kurulum ekranlarında düz/opak yüzeyler; bulanıklık ve animasyon süsleri kaldırıldı
- **Görünüm > Tema Renkleri:** 8 bağımsız renk seçici + tek tuşla sıfırlama; tema dışa/içe aktarma ve Depoya Kaydet ile kalıcı
- 🆕 **"Başlat" butonu için özel renk:** diğer renklerden bağımsız, yalnızca Başlat butonuna uygulanır; seçilmezse varsayılan yeşil korunur; theme.json'da kalıcı
- Kare switch'ler, alttan açılan yatay renk seçici (512×316), kenar çubuğu her zaman Klasik
- Ana ekranda Başlat pill'i kaldırıldı; tam yükseklikli hızlı eylem paneli sağ kolona taşındı

### Hesap ve Giriş

- Yetki (authority) açılır listesi geri geldi ve hesap türüne göre daraldı: Microsoft'ta parola alanı yok; Çevrimdışı'da yalnız kullanıcı adı + yerel kapsam ipucu
- Kurulum sihirbazına düz arka plan ve offline hesap ipucu (TR/EN)

### Mod Paketi Mağazası

- **CurseForge API anahtarı:** Ayarlar > Ağ > API Anahtarları'na girilen anahtar arama ve kurulum hattına uygulanır; pakete gömülmez
- **FTB:** anahtar kelime boşken tam keşif listesi (`getAllModpacks`)
- Trending karuseli yerine varsayılan keşif ızgarası, tam arama filtreleri

### Kaplama ve Pelerin

- **Yerel Kaplama Dolabı:** PNG/URL/oyuncu adıyla kaplama al, hesap başına giy (Microsoft + çevrimdışı)
- **Özel pelerin:** kendi PNG'n — tamamen makinede, hesap başına; Microsoft hesapları resmi pelerinlerini yanında kullanır
- **Oyunda görünür:** launcher-yerel yggdrasil uç noktası authlib-injector ile çevrimdışı kaplamasını oyuna servis eder; opsiyonel paketli WSkinLoader Fabric modu custom cape'i oyun içi görünür kılar

### Markalaşma

- Kendi Discord uygulaması üzerinden Rich Presence ("{instance} oynuyor")
- Tek kaynak logodan üretilen şeffaf, çok boyutlu uygulama ikonu (16-256 ico/icns/png)
- Kendi installer'ı: `DiscoLauncher-Setup-*.exe`

### Düzeltmeler

- Her açılışta menü çubuğunu çökerten `kUpdateSettings` injection hatası giderildi; açılış konsolu temiz
- OptiFine çözümleyici penceresi sandbox'a alındı; splash animasyonu sabitlendi; .gitignore onarıldı
- Yerel kaplama servisi üçüncü parti hesap sistemlerinin kaldırılmasından sonra askıda kalmaması için sağlamlaştırıldı
- Kısayol oluştururken instance ikonu bozulması giderildi: yerleşik ikonlar `.webp` olduğu için dönüştürme yapılmadan `icon.ico` üzerine ham webp yazılıyordu (paylaşılan `toPngIconUrl` yardımcısı; kırık favicon'da artık takılmıyor)
- CurseForge API anahtarı her ayar değişiminde yeni bir protokol handler kaydediyordu; handler sızıntısı giderildi ve anahtarı temizleme artık gerçekten eski kimlik bilgisini geri çekiyor
- Özel pelerin modunun Java 25 kontrolü "otomatik Java" seçiliyken sessizce atlanıyordu; artık XMCL'nin gerçekten çalıştıracağı Java sürümüne bakılıyor
- Yatay (üst/alt) kenar çubuğunda Ayarlar düğmesi eksikti ve `/setting` yoluna ulaşılamıyordu
- Sağ hızlı eylem panelinden ve gamepad "X" tuşundan başlatma artık giriş uyarısı ile debounce'lu instance düzenleme akışını atlamıyor
- Ölü "Güncelleştirmeyi kontrol et" düğmesi kaldırıldı (güncelleme altyapısı da kaldırılmıştı)
- Pencere başlığına ham rota yolu yazılması kaldırıldı
- `e2e/TESTIDS.md` kayıt defteri yeniden üretildi (236 testid)

---

## 📥 Doğrulama

| Dosya | SHA-256 |
| --- | --- |
| `DiscoLauncher-Setup-0.1.0.exe` (94,23 MB) | `6845ce462083eaaeed92a7dbe419241c55320bc7ab28ce6183aa1bdd003e6eb4` |

**Platformlar:** Windows (NSIS) birincil ve aktif test edilen hedef · macOS (dmg) ve Linux (deb/rpm/AppImage/tar.xz/pacman) hedefleri yapılandırıldı

**Gereksinimler:** Java 8+ (oyun sürümüne göre) — launcher gerekli Java'yı otomatik yönetebilir

---

## 🔗 Bağlantılar

- 📖 [README](../README.md) · 🇬🇧 [English](../README.en.md)
- 🛠 Upstream: [X Minecraft Launcher (XMCL)](https://github.com/Voxelum/x-minecraft-launcher) — MIT lisansıyla tüm temel için teşekkürler

**Tam değişiklik günlüğü ve geliştirme kategorileri için:** [docs/Disco-Launcher-Gelistirme-Sunumu.md](./Disco-Launcher-Gelistirme-Sunumu.md)
