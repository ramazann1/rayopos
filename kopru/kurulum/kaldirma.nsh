; Kurulum penceresi ekran büyütmesini bildiğini söylüyor. Söylemezse Windows
; %125-%150 büyütmede pencereyi resim gibi büyütüyor ve yazılar bulanıklaşıyor.
!macro customHeader
  ManifestDPIAware true
!macroend

; Kaldırma sırasında ayar dosyasının akıbeti soruluyor. Program silinince
; giriş bilgileri ve yazıcı seçimi de gitsin isteniyorsa evet; yeni sürüm
; kurmak için kaldırılıyorsa hayır — kasa yeniden eşleştirilmek zorunda kalmaz.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION "Kayıtlı giriş bilgileri ve yazıcı ayarları da silinsin mi?$\n$\nYeni sürüm kuracaksanız Hayır deyin." /SD IDNO IDNO ayarlarKalsin
      ; Electron ayarları buraya yazıyor: %APPDATA%\<program adı>\ayarlar.json
      RMDir /r "$APPDATA\RayoPOS Kasa Köprüsü"
      RMDir /r "$APPDATA\Garso Kasa Köprüsü"
    ayarlarKalsin:
  ${endIf}
!macroend
