# Disco Launcher — Geliştirme Sunumu

> **Proje:** Disco Launcher — XMCL (X Minecraft Launcher) tabanlı, Windows odaklı, Türkçe öncelikli, hafif ve minimalist bir Minecraft launcher'ı.
>
> **Bu sunum neyi kapsıyor?** Upstream XMCL'den çatallanma noktasından bugüne yapılan **13 commit** ve son dönemdeki **commit'lenmemiş geliştirme turu** (75 dosya, +1.193 / −2.098 satır). Tüm maddeler git geçmişi ve çalışma dizini diff'leriyle doğrulanmıştır.
>
> **Toplam:** 8 kategori altında **30+ geliştirme** — 28.000'den fazla satır temizlendi, kurulum boyutu 93,85 → 91,30 MB, başlatma hızlandırıldı, arayüz Prism-minimal temaya geçirildi.

---

## 1. Sadeleştirme ve Hafifletme

Kullanıcı kararlarıyla gereksiz servisler ve arayüzler kökünden kaldırıldı; amaç daha küçük, daha hızlı ve daha öngörülebilir bir launcher.

- **P2P çok oyunculu sisteminin kaldırılması** — `46fd6ee7`
  PeerService, WebRTC host/provider/controller, çok oyunculu ön yükleme pencereleri, ağ teşhis ekranları ve node-datachannel / wrtc-multiplayer / multiplayer-core / nat-api bağımlılıklarının tamamı silindi.
  *Önce:* Launcher içinde sohbet/arkadaş/oyuncu listesi uçları. *Sonra:* Tek amaçlı, tek oyunculu akışa odaklı launcher.
  *(Bu commit aynı zamanda üçüncü parti hesapları, AI agent arka ucunu ve otomatik güncellemeyi de kaldırdı — aşağıda.)*

- **Üçüncü parti hesap sistemlerinin kaldırılması** — `46fd6ee7`
  ely.by, LittleSkin, xmcl.org hesapları, yggdrasil sunucu barındırma ve harici kimlik bilgisi yaşam döngüsü çıkarıldı; Microsoft kimlik doğrulama ve çevrimdışı giriş korundu.

- **AI agent (yapay zekâ asistanı) arka ucunun kaldırılması** — `46fd6ee7`
  AgentService, sohbet paneli, çökme AI ipucu ve ayarları silindi; komut paleti korundu (agent modu sıyrıldı).

- **Otomatik güncelleme altyapısının kaldırılması** — `46fd6ee7`
  pluginAutoUpdate, ElectronUpdater, DeskGap updater ve tepsi/güncelleme menü girdileri kaldırıldı; `BaseService.update` API'si no-op updater ile korundu. Güncellemeler artık tamamen kullanıcı kontrolünde.

- **Telemetri ihracatçılarının kaldırılması** — `46fd6ee7`
  Azure/OTel exporter eklentileri silindi; çekirdek `@opentelemetry/api` görev (task) izleme için bırakıldı.

- **Haber bölümü ve Minecraft arkadaşlarının kaldırılması** — `5cdb8aca`
  Haber karuseli, `launcherNews`/`mojangNews` composables'ları (açılışta yapılan ağ istekleriyle birlikte) ve arkadaş sistemi (arkadaş satırı, ekleme düğmesi, arka plan yoklaması, servis + testleri) tamamen kaldırıldı.

- **Kullanılmayan bağımlılıkların budanması** — `46a018e1`
  electron-app'tan 8 paket (builtin-modules, fast-xml-parser, file-type, node-abi, semver, stun-client…), keystone-ui'dan 5 agent artığı paket ve çalışma alanından 4 öksüz çok oyunculu paketi silindi. +317 / −8.243 satır.

## 2. Performans ve Ağ

Başlatma süresi, ağ davranışı ve kaynak kullanımı üzerine ölçülebilir iyileştirmeler.

- **V8 disk üstü kod önbelleği** — `69d0567e`
  `v8-cache-options: none → code`: paketlenmiş JS sıcak başlatmalarda daha hızlı ayrıştırılıyor (kullanıcı, küçük bellek farkına karşı başlatma hızını seçti).

- **OptiFine çözümleyici penceresinin izolasyonu** — `69d0567e`
  Üçüncü parti bir CMS sayfasına karşı preload çalıştıran BrowserWindow artık `contextIsolation + sandbox` ile çalışıyor.

- **Mağaza "trend/son sürüm" isteklerinin görünürlüğe bağlanması** — `db8e4f49`
  4 öne çıkan/son arama, sadece filtresiz keşif sayfası gerçekten görünürken tetikleniyor; artık her Mağaza açılışında kullanıcının aramasıyla yarışmıyor. Tekrar ziyaretlerde localStorage önbelleği ağ trafiğini sıfıra indiriyor.

- **Muhafazakâr ağ varsayılanları** — `8ef5c213`
  undici `bodyTimeout` 10 sn → 60 sn: yavaş CDN duraklamaları artık büyük indirmeleri yolun ortasında öldürmüyor. Varsayılan `maxSockets` 64 → 16; mevcut kullanıcı ayarı korunuyor ve alan düzenlenebilir kalıyor.

- **Sessiz günlük (log) hijyeni** — `89029f22`
  undici teşhis TRACE logger'ı yalnızca geliştirme derlemelerine kısıtlandı (prod artık her istekte undici.log yazmıyor); ProjectMappingService hata sonrası 60 sn geri çekilip uyarıyı yığın başına bir kez yazıyor.

## 3. Arayüz ve Tema (Prism-Minimal)

Tutarlı bir düz/minimalist görsel dil ve kullanıcıya tema kontrolü.

- **Prism-minimal Ayarlar ve Oyun Oluşturma ekranları** — `1cb6cae1`
  Opak düz yüzeyler, minimal gölge, cam bulanıklığı yok; 4px düz köşeli düğme/toggle'lar, ince düşük kontrastlı ayırıcılar, %8 primary tonlu sessiz outline mod yükleyici kartları, düz raylı switch'ler.
  *Önce:* Cam efektli, bulanık yüzeyler. *Sonra:* Düz, hızlı çizilen, tutarlı yüzeyler.

- **Düz kurulum arka planı ve minimal giriş akışı** — `cf9baeef`
  Hareketli mood arka planı/surface (sürüklenen grid, ışık süpürmesi, parlama, yükselme animasyonu) düz nötr yüzeylerle değiştirildi; kurulum adımları sadeleştirildi; giriş formu çevrimdışı hesap ipucu kazandı (en/tr) ve blur/glow süslemeleri kaldırıldı. −181 satır stil.

- **Görünüm > Tema Renkleri panelinin geri getirilmesi** *(commit'lenmemiş)*
  7 bağımsız renk seçici (Uygulama Çubuğu, Kenar Çubuğu, Birincil, Kart, Arka Plan, Uyarı, Hata) + tek tuşla **Sıfırla**; renkler mevcut tema dışa/içe aktarma ve Depoya Kaydet hattından akar.

- **"Başlat" butonuna özel renk seçici** *(commit'lenmemiş)*
  Görünüm > Tema Renkleri'ne 8. seçici olarak eklendi; diğer renklerden bağımsız ve **yalnızca** instance panelindeki Başlat düğmesine uygulanıyor — Oluştur butonu ve diğer vurgu renkli öğeler etkilenmiyor.
  *Önce:* Düğme rengi panel CSS'ine gömülü sabit yeşil. *Sonra:* Kullanıcı seçimi; boşsa tamamen eski sabit yeşil davranış.
  Tam şeffaf (alfa-00) seçim "temizlendi" sayılır; theme.json'a kalıcı yazılır, Temayı Dışa Aktar/İçe Aktar ve Depoya Kaydet otomatik kapsar.

- **Renk seçici iyileştirmeleri** *(commit'lenmemiş)*
  Picker artık topacın altında açılıyor, yatay/dikdörtgen düzen (canvas + kontroller solda, palet sağda; Vuetify'ın 300px hardcoded genişliği aşılıyor).

- **Kare (Prism) switch'leri** *(commit'lenmemiş)*
  Global `border-radius: 3px` ile tüm switch'ler ve 2px thumb düz görünüme oturdu.

- **Başlat pill'inin kaldırılması ve sağ panelin tam yüksekliğe taşınması** *(commit'lenmemiş)*
  Ana ekrandaki büyük Başlat pill'i (ve gömülü dişliyi) kaldırıldı; InstanceActionsPanel HomeLayout'a tek sağ kolon olarak taşındı; başlatma/durdurma eylemleri aynı kLaunchButton işleyicisini paylaşıyor.

- **Kenar çubuğu her zaman Klasik** *(commit'lenmemiş)*
  Kenar çubuğu stili ayarı kaldırıldı; Klasik stil tek görünüm.

- **Minecraft tarzı pixel font** *(commit'lenmemiş)*
  3B kaplan önizlemesindeki isim etiketleri artık paketle gelen pixel fontla boyanıyor (serif yedek yerine).

## 4. Hesap ve Giriş

- **Yetki açılır listesinin geri getirilmesi ve forma hesap türüne göre daraltma** — `a41b9aa8`
  `getSupportedAuthorityMetadata` üçüncü parti eklenti yokken yggdrasil sistemini beklemeyi bıraktı (IPC çağrısı artık kilitlenmiyor, liste boş kalmıyor); Microsoft ve Çevrimdışı seçenekleri daima listenin tepesinde.
  *Önce:* Giriş formu hesap türü ne olursa olsun aynı alanları gösteriyordu. *Sonra:* Microsoft'ta parola alanı yok; Çevrimdışı'da yalnız kullanıcı adı + yerel kapsam ipucu, ağ isteği yok.

- **Çevrimdışı hesap ipucu** — `cf9baeef` (en + tr çeviri ile)

## 5. Mod Paketi Mağazası ve Sağlayıcılar

- **CurseForge kullanıcı API anahtarı desteği** *(commit'lenmemiş)*
  Ayarlar > Ağ > API Anahtarları'na girilen anahtar; hem arama hem kurulum hattındaki `CurseforgeV1Client` başlıklarına uygulanıyor. Anahtar pakete gömülmüyor; derleme zamanı `CURSEFORGE_API_KEY` yalnızca kullanıcı anahtarı girilene dek yedek. Canlı doğrulandı (anahtar kaydı, arama, kurulum).

- **FTB "tüm mod paketleri" listesi** *(commit'lenmemiş)*
  Anahtar kelime boşken `getAllModpacks()` çağrısı: keşif listesi artık yazmadan önce de doluyor.

- **Mod paketi mağaza sıralaması ve yerelleştirilmiş popülerlik** — `9b20a5b8`

- **Öksüz dosyaların temizliği** *(commit'lenmemiş)*
  `usePopularItems` silindi; mağaza composables'ları görünürlük kapılı `enabled` anahtar modeline geçti.

---

## 6. Markalaşma

- **Disco Launcher Discord Rich Presence** — `5cdb8aca` + `7c2258d1`
  Presence detayları daima "Disco Launcher", durum etkinliği gösteriyor ("{instance} oynuyor" — tr/en yerelleştirilmiş); büyük görsel etiketi launcher adını taşıyor. Ardından upstream XMCL client id'si, kullanıcının kendi Disco Launcher Discord uygulamasıyla değiştirildi (`7c2258d1`) — profil paneli markası arayüzle uyumlu.

- **Uygulama ikonunun yeniden üretilmesi** — `8ef5c213`
  Tek kaynak logodan (build/icon-source.png) damalı arka planı şeffaf yapılmış, kare kırpılmış, çok boyutlu (16-256).ico + PNG-sıkıştırılmış icns; `pnpm run icons` ile yeniden üretilebilir; kalan logo.webp referansları (splash, about, tarayıcı kartı) logo.png'ye çevrildi.

- **README'nin Disco Launcher'a uyarlanması** — `9d23a57d`
  Upstream XMCL içeriği (winget/flathub, sponsor rozetleri) kaldırıldı; özellik seti, XMCL'den bilinçli farklar (telemetri/oto-güncelleme/çok oyunculu/üçüncü parti hesap kaldırımı, yerel kaplama düzeltmeleri, özel pelerin, mağaza temizliği) ve doğrulanmış derleme talimatları yazıldı.

## 7. Kaplama ve Pelerin (Kimlik Görselleri) *(commit'lenmemiş)*

- **Özel pelerin (custom cape) sistemi**
  Hesap anahtarı başına (`userId:gameProfileId`) launcher'a özel "custom cape" PNG deposu: Mojang'ın resmi pelerin sisteminden tamamen bağımsız, Mojang'a hiç ağ isteği yapılmıyor. LocalCapeService (runtime + runtime-api), CustomCapeDialog (UI) ve userCape composable'ı eklendi.

- **Oyun içi pelerin enjeksiyonu (WSkinLoader, opsiyonel)**
  Paketle gelen Fabric istemci modu (wskinloader-1.6.2.jar + fabric-api) ile launcher-yerel pelerin oyunda görünür hale geliyor; yükleme çıkarılabilir/opsiyonel.

- **Kaplamaların üçüncü parti sistemlerden bağımsızlaştırılması**
  LocalSkinService yggdrasil kaydına artık opsiyonel bakıyor: üçüncü parti hesap sistemi kaldırılan bu derlemede zor DI bağımlılığı `getOrCreate`'i sonsuz askıda bırakıyordu (sembol anahtarları hızlı başarısız olmaz) — düzeltildi.

- **Kaplama/pelerin önizleme tutarlılığı**
  3B önizleme, etkin profili kaplamasını (launcher-yerel override dahil) gösteriyor; skinview3d ad etiketi için Minecraft pixel fontu pakete eklendi.

## 8. Hata Düzeltmeleri ve Sağlamlaştırma

- **Uygulama açılışındaki bileşen çökmesi giderildi** *(commit'lenmemiş)*
  Backup-cleanup commit'i `Setting.vue`'dan `kUpdateSettings` provide'sını silmiş ama aynı commit'te eklenen AppMenuBar hâlâ inject ediyordu: menü çubuğu her açılışta "Cannot find Symbol(UpdateSettings) to inject" ile çöküyordu. Provide uygulama köküne (App.vue) taşındı; açılış konsolu tamamen hatasız.
  *Önce:* Her açılışta yakalanmayan injection hatası. *Sonra:* 0 hata.

- **Kurulum karşılama (splash) animasyonunun durdurulması** — `89029f22`
  Logo pulse animasyonu kaldırıldı: sabit, temiz açılış ekranı.

- **.gitignore onarımı** — `89029f22`
  Birleştirilmiş satır hatası düzeltildi; meta.json yeniden yok sayılıyor.

- **OptiFine kazıyıcı penceresi sandbox'ı** — `69d0567e` (bkz. Performans)

- **EXDEV ve atomik kalıcılık** — `d20b01f6` (upstream hattından devralınan düzeltmeler; kurulum sırasında çapraz cihaz taşıma hataları ele alınıyor)

## Ek: Doğrulama ve Test Altyapısı *(commit'lenmemiş)*

- **tools/ui-test/** altında 20+ CDP tabanlı canlı E2E/teşhis sürücüsü: renk değişimi + kalıcılık (`color-change-e2e`), Başlat butonu rengi (13 kontrollük `launch-color-e2e`, 11/11 PASS), CurseForge kurulum akışı, pelerin servis uçları, kaplama dolabı teşhisi, konsol/router probe'ları.

- **Sürekli doğrulama disiplini:** her madde için vue-tsc tip kontrolü, oxlint, i18n lint, renderer + installer derlemesi, paketten başlatma dumanı testi; kritik akışlarda canlı CDP doğrulaması.

---

## Sürüm Notu

| Dönem | Kapsam |
|---|---|
| `059ccc95` → `9d23a57d` (13 commit) | Sadeleştirme, performans, Prism tema, markalaşma, README |
| Çalışma dizini (75 dosya, +1.193/−2.098) | Mağaza sağlayıcıları, Başlat butonu rengi, özel pelerin, hata düzeltmeleri, tema paneli geri dönüşü |

*Sunum, git geçmişi (`git log 059ccc95~1..HEAD`) ve çalışma dizini diff'leriyle (`git status`, `git diff HEAD`) birebir eşleşecek şekilde hazırlanmıştır. Emin olunmayan hiçbir commit listeye eklenmemiştir.*
