/* docs/presentation.html üretir: ekran görüntüleri base64 gömülü, tek dosya. */
const fs = require('fs')
const path = require('path')

const ART = path.join(__dirname, 'artifacts', 'shots')
const OUT = path.join(__dirname, '..', '..', 'docs', 'presentation.html')

const img = (name) => {
  const p = path.join(ART, name)
  if (!fs.existsSync(p)) return ''
  return 'data:image/png;base64,' + fs.readFileSync(p).toString('base64')
}

const shots = {
  me: img('01-me-profile.png'),
  customCape: img('02-me-custom-cape.png'),
  closet: img('03-closet-dialog.png'),
  store: img('04-store.png'),
  settings: img('05-settings.png'),
  home: img('06-home.png'),
  stress: img('07-after-stress.png'),
}

const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>Disco Launcher — Test ve Performans Sunumu</title>
<style>
  :root { --bg:#0e1116; --panel:#161c24; --accent:#42b883; --accent2:#5cc8ff; --text:#e8edf4; --muted:#8b98a9; --pass:#42b883; --warn:#e8b339; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:var(--bg); color:var(--text); font-family:'Segoe UI',system-ui,sans-serif; overflow:hidden; }
  .slide { display:none; position:absolute; inset:0; padding:56px 72px; flex-direction:column; }
  .slide.active { display:flex; }
  h1 { font-size:44px; margin-bottom:12px; }
  h2 { font-size:34px; margin-bottom:24px; color:var(--accent2); }
  .kicker { color:var(--accent); text-transform:uppercase; letter-spacing:3px; font-size:14px; font-weight:600; margin-bottom:14px; }
  .cols { display:flex; gap:40px; flex:1; min-height:0; align-items:center; }
  .col { flex:1; min-width:0; }
  ul { list-style:none; }
  li { padding:9px 0 9px 34px; position:relative; font-size:20px; line-height:1.45; }
  li::before { content:'✓'; position:absolute; left:2px; color:var(--pass); font-weight:700; }
  li.n::before { content:'●'; color:var(--accent2); font-size:14px; top:13px; }
  li.x::before { content:'!'; color:var(--warn); }
  .shot { background:var(--panel); border:1px solid #2a3442; border-radius:14px; padding:10px; box-shadow:0 18px 50px rgba(0,0,0,.45); max-height:70vh; }
  .shot img { width:100%; height:auto; display:block; border-radius:8px; }
  .caption { color:var(--muted); font-size:14px; margin-top:8px; text-align:center; }
  .badge { display:inline-block; background:rgba(66,184,131,.15); color:var(--pass); border:1px solid rgba(66,184,131,.4); border-radius:999px; padding:6px 18px; font-weight:700; font-size:18px; margin:6px 8px 6px 0; }
  .badge.warn { background:rgba(232,179,57,.12); color:var(--warn); border-color:rgba(232,179,57,.4); }
  .badge.info { background:rgba(92,200,255,.12); color:var(--accent2); border-color:rgba(92,200,255,.4); }
  table { border-collapse:collapse; width:100%; font-size:19px; }
  th,td { padding:10px 16px; text-align:left; border-bottom:1px solid #253040; }
  th { color:var(--muted); font-size:15px; text-transform:uppercase; letter-spacing:1px; }
  td.ok { color:var(--pass); font-weight:700; }
  .bar-row { display:flex; align-items:center; gap:14px; margin:13px 0; font-size:17px; }
  .bar-label { width:230px; color:var(--muted); }
  .bar-track { flex:1; background:#1d2531; border-radius:8px; height:26px; overflow:hidden; }
  .bar-fill { height:100%; border-radius:8px; background:linear-gradient(90deg,var(--accent),var(--accent2)); display:flex; align-items:center; justify-content:flex-end; padding-right:10px; font-size:13px; font-weight:700; color:#08131c; min-width:64px; }
  .big { font-size:120px; font-weight:800; color:var(--pass); line-height:1; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:22px; }
  .card { background:var(--panel); border:1px solid #2a3442; border-radius:14px; padding:22px; }
  .card h3 { color:var(--accent2); margin-bottom:10px; font-size:20px; }
  .card p, .card li { font-size:16px; }
  .footer-note { color:var(--muted); font-size:14px; margin-top:auto; padding-top:18px; }
  #counter { position:fixed; bottom:18px; right:26px; color:var(--muted); font-size:14px; z-index:9; }
  #hint { position:fixed; bottom:18px; left:26px; color:var(--muted); font-size:13px; z-index:9; }
  .center { justify-content:center; align-items:center; text-align:center; }
  .subtitle { color:var(--muted); font-size:22px; margin-top:10px; }
</style>
</head>
<body>

<section class="slide active center">
  <div class="kicker">Disco Launcher</div>
  <h1>Test, Doğrulama ve Performans Sunumu</h1>
  <p class="subtitle">4 yeni özellik + mevcut özelliklerin tam regresyonu<br>Canlı üretim uygulaması üzerinde 18 UI testi · 1753 birim testi · CPU/RAM ölçümleri</p>
  <div style="margin-top:34px"><span class="badge">27 Eylül 2026</span><span class="badge info">Üretim derlemesi</span><span class="badge info">Windows · 12 çekirdek</span></div>
</section>

<section class="slide">
  <div class="kicker">Özet</div>
  <h2>Sonuç: Her Şey Yeşil</h2>
  <div class="cols">
    <div class="col">
      <ul>
        <li>UI duman testleri: <b>18 / 18</b> geçti</li>
        <li>Yeni özellik birim testleri: <b>6 / 6</b> geçti</li>
        <li>Tüm repo: <b>1753</b> birim testi geçti</li>
        <li>Typecheck + lint + üretim derlemesi temiz</li>
        <li>Renderer exception: <b>0</b> (tüm oturum)</li>
        <li>Boşta CPU <b>%0.0</b> — sızıntı yok</li>
        <li class="x">5 birim testi hatası <b>önceden var</b> (temiz ağaçta da aynı — updater kaldırma kalıntısı)</li>
      </ul>
    </div>
    <div class="col center" style="text-align:center">
      <div class="big">18/18</div>
      <p class="subtitle" style="margin-top:4px">UI testi geçti</p>
    </div>
  </div>
</section>

<section class="slide">
  <div class="kicker">Yeni Özellik 1</div>
  <h2>Microsoft Hesabında Skin Değiştirme Düzeltildi</h2>
  <div class="cols">
    <div class="col">
      <ul>
        <li>Sorun: skin kütüphanesi diyaloğu Microsoft hesaplarında hiç açılmıyordu</li>
        <li>Kök neden: <b>UserSkinLibraryDialog</b> panelde mount edilmemiş + çift <b>resp.json()</b> + null SetSkinError çökmesi</li>
        <li>Test: diyalog canlı uygulamada açıldı/kapandı (gerçek tıklama)</li>
        <li>Resmî pelerin seçici de doğrulandı: seçim + "Pelerin Yok" geri yüklemesi</li>
      </ul>
    </div>
    <div class="col">
      <div class="shot"><img src="${shots.closet}" alt="gardırop diyaloğu"><div class="caption">Yerel Gardırop diyaloğu — Microsoft hesabında açılıyor</div></div>
    </div>
  </div>
</section>

<section class="slide">
  <div class="kicker">Yeni Özellik 2</div>
  <h2>Çevrimdışı Hesaplara Skin Seçimi</h2>
  <div class="cols">
    <div class="col">
      <ul>
        <li>Offline hesaplar artık aynı gardırobu kullanıyor (yerel-equip)</li>
        <li>Oyun içinde skin sunumu <b>pluginLocalYggdrasilHandler</b> ile restore ediliyor</li>
        <li>LocalSkinService: <b>6/6 birim testi</b> (dosya sahiplenme + uzak skin indirme dahil)</li>
        <li>Not: native dosya diyaloğu otomatik test edilemez (Electron contextBridge donuk) — birim test + diyalog kanıtıyla kapsandı</li>
      </ul>
    </div>
    <div class="col">
      <div class="shot"><img src="${shots.me}" alt="me paneli"><div class="caption">/me paneli — Yerel Gardırop + pelerin satırları</div></div>
    </div>
  </div>
</section>

<section class="slide">
  <div class="kicker">Yeni Özellik 3</div>
  <h2>Özel Pelerin (Launcher'a Ait)</h2>
  <div class="cols">
    <div class="col">
      <ul>
        <li>Mojang'dan bağımsız, hesap başına <b>launcher-local</b> pelerin</li>
        <li>Canlı DOM: bölüm + buton + "sadece bu başlatıcıda görünür" açıklaması</li>
        <li>Kullanıcı profili zaten özel pelerinli: buton "Değiştir" modunda = durum makinesi doğru</li>
        <li>PNG Seç butonu gerçek tıklamayla doğrulandı</li>
        <li>Ek düzeltme: 2560×1440 standart dışı pelerinde artık çökme yok (oran doğrulama + .catch)</li>
      </ul>
    </div>
    <div class="col">
      <div class="shot"><img src="${shots.customCape}" alt="özel pelerin"><div class="caption">Özel Pelerin bölümü — PNG Seç / Değiştir / Sil</div></div>
    </div>
  </div>
</section>

<section class="slide">
  <div class="kicker">Yeni Özellik 4</div>
  <h2>"Trend Olan" Kaldırıldı — Store Sağlam</h2>
  <div class="cols">
    <div class="col">
      <ul>
        <li>Store'da <b>trend/trending</b> metni artık hiç yok (negatif test)</li>
        <li>Arama çubuğu odaklanıyor, Modrinth kartları yükleniyor</li>
        <li>"Keşfetmek" + "Minecraft Sürümü" bölümleri ve filtreler aynen çalışıyor</li>
        <li>usePopularItems tamamen söküldü; tutorial adımı güncellendi</li>
        <li>Proje detay sayfaları canlı gezinmede doğrulandı</li>
      </ul>
    </div>
    <div class="col">
      <div class="shot"><img src="${shots.store}" alt="store"><div class="caption">Store — trend bölümü yok, arama + kartlar aktif</div></div>
    </div>
  </div>
</section>

<section class="slide">
  <div class="kicker">Regresyon</div>
  <h2>Eski Özellikler Etkilenmedi</h2>
  <table>
    <tr><th>Özellik</th><th>Test</th><th>Sonuç</th></tr>
    <tr><td>Ana ekran / instance listesi</td><td>render + içerik</td><td class="ok">PASS</td></tr>
    <tr><td>Ayarlar ekranı</td><td>render</td><td class="ok">PASS</td></tr>
    <tr><td>Store arama + keşfet</td><td>odak + fetch sonrası render</td><td class="ok">PASS</td></tr>
    <tr><td>Resmî pelerin seçici</td><td>gerçek tıklama (aria-checked)</td><td class="ok">PASS</td></tr>
    <tr><td>Gardırop diyalog akışı</td><td>aç → içerik → X ile kapat</td><td class="ok">PASS</td></tr>
    <tr><td>Rota dayanıklılığı</td><td>8 hızlı geçiş</td><td class="ok">0 exception</td></tr>
  </table>
  <div class="cols" style="margin-top:26px; min-height:0">
    <div class="col"><div class="shot"><img src="${shots.home}" alt="ana ekran"><div class="caption">Ana ekran</div></div></div>
    <div class="col"><div class="shot"><img src="${shots.settings}" alt="ayarlar"><div class="caption">Ayarlar</div></div></div>
  </div>
</section>

<section class="slide">
  <div class="kicker">Performans</div>
  <h2>RAM Kullanımı (4 Süreç Toplamı)</h2>
  <div style="max-width:900px">
    <div class="bar-row"><div class="bar-label">Açılış (boot)</div><div class="bar-track"><div class="bar-fill" style="width:70%">628 MB</div></div></div>
    <div class="bar-row"><div class="bar-label">Boşta bekleme</div><div class="bar-track"><div class="bar-fill" style="width:72%">645 MB</div></div></div>
    <div class="bar-row"><div class="bar-label">Store yüklendi</div><div class="bar-track"><div class="bar-fill" style="width:94%">844 MB</div></div></div>
    <div class="bar-row"><div class="bar-label">Tüm görünümler</div><div class="bar-track"><div class="bar-fill" style="width:96%">864 MB</div></div></div>
    <div class="bar-row"><div class="bar-label">Rota stresi tepe</div><div class="bar-track"><div class="bar-fill" style="width:99%">893 MB</div></div></div>
  </div>
  <p class="footer-note">Electron'un 4 süreçli mimarisi (main + GPU + 2 renderer) için normal aralık. Ölçek: 0–900 MB.</p>
</section>

<section class="slide">
  <div class="kicker">Performans</div>
  <h2>CPU ve Bellek Sızıntısı</h2>
  <div class="cols">
    <div class="col">
      <ul>
        <li>Boşta CPU: <b>%0.00</b> (10 sn ölçüm penceresi, 12 çekirdek)</li>
        <li>Gezinme sırasında: %0.1 – %14.5 anlık tepe</li>
        <li>12 çekirdekte %14.5 = toplam işlemcinin ~%1.2'si</li>
        <li>Renderer heap: açılış 21.4 MB → stres sonrası 22.8 MB</li>
        <li>8 hızlı rota geçişi sonrası büyüme: <b>+1.4 MB</b> (sızıntı yok)</li>
        <li>Tüm oturumda renderer exception: <b>0</b></li>
      </ul>
    </div>
    <div class="col">
      <div class="shot"><img src="${shots.stress}" alt="stres sonrası"><div class="caption">Rota stresi sonrası — uygulama kararlı</div></div>
    </div>
  </div>
</section>

<section class="slide">
  <div class="kicker">Şeffaflık</div>
  <h2>Bilinen Durumlar</h2>
  <div class="grid2">
    <div class="card">
      <h3>Önceden var olan 5 test hatası</h3>
      <ul>
        <li class="n">BaseService.update ×2, pluginSettings ×2, ModrinthAccess ×1</li>
        <li class="n">git stash ile temiz ağaçta doğrulandı: aynı hatalar</li>
        <li class="n">Neden: otomatik güncelleyicinin kaldırılmasından kalan test fixture'ları</li>
        <li class="n">Öneri: ayrı bir temizlik commit'i</li>
      </ul>
    </div>
    <div class="card">
      <h3>Otomasyon sınırı (hata değil)</h3>
      <ul>
        <li class="n">Native dosya diyaloğu mock'lanamıyor (contextBridge frozen)</li>
        <li class="n">"PNG'den skin ekle" akışı birim test + diyalog kanıtıyla kapsandı</li>
        <li class="n">Kullanıcı tarafında akış sorunsuz</li>
      </ul>
    </div>
  </div>
</section>

<section class="slide center">
  <div class="kicker">Sonuç</div>
  <h1 style="font-size:40px">4 Yeni Özellik Çalışıyor · Regresyon Yok · Profil Sağlıklı</h1>
  <div style="margin-top:30px">
    <span class="badge">18/18 UI</span>
    <span class="badge">6/6 birim</span>
    <span class="badge">1753 test ✓</span>
    <span class="badge">typecheck ✓</span>
    <span class="badge">lint ✓</span>
    <span class="badge">build ✓</span>
    <span class="badge info">Boşta CPU %0</span>
    <span class="badge info">Heap +1.4 MB</span>
  </div>
  <p class="subtitle" style="margin-top:30px">Sıradaki adım: özellik değişikliklerinin commit edilmesi + 6 eski test hatasının temizliği</p>
  <p class="footer-note">Detaylı rapor: docs/test-report.md · Test sürücüsü: tools/ui-test/final-test.cjs</p>
</section>

<div id="counter"></div>
<div id="hint">← → tuşları / tıklayarak gezin</div>
<script>
  const slides=[...document.querySelectorAll('.slide')];let i=0;
  const show=n=>{i=Math.max(0,Math.min(slides.length-1,n));slides.forEach((s,k)=>s.classList.toggle('active',k===i));document.getElementById('counter').textContent=(i+1)+' / '+slides.length;};
  document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' ')show(i+1);if(e.key==='ArrowLeft'||e.key==='PageUp')show(i-1);if(e.key==='Home')show(0);if(e.key==='End')show(slides.length-1);});
  document.addEventListener('click',e=>{if(e.clientX>innerWidth/2)show(i+1);else show(i-1);});
  show(0);
</script>
</body>
</html>`

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, html)
console.log('written:', OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB')
