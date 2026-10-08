# Windows'un yazdırma servisine ham veri gönderme.
#
# Normal yazdırma yolları (Out-Printer, notepad /p) metni kendi biçimlendirip
# yazıcıya öyle veriyor; ESC/POS komutları o dönüşümde bozuluyor. Servise "bunu
# olduğu gibi bas" demenin tek yolu spooler'ın kendi arayüzü, o da PowerShell'de
# doğrudan yok — aşağıdaki köprü sınıfı Windows'un yazdırma kütüphanesini
# çağırıyor. Ek kurulum istemiyor, Windows'un kendi parçası.
#
# Betik köprü açıkken hep çalışır durumda kalıyor. Eskiden her fişte yeniden
# açılıyordu: PowerShell'in açılışı ve aşağıdaki sınıfın derlenmesi fiş başına
# iki saniyeyi geçiyordu. Artık köprü her satıra bir istek yazıyor, betik her
# isteğe bir satır cevap veriyor; derleme yalnız ilk açılışta.
#
# İstek:  {"no":1,"islem":"durum","yazici":"..."}
#         {"no":2,"islem":"bas","yazici":"...","veri":"<base64>"}
# Cevap:  {"no":1,"kurulu":true,"cevrimdisi":false,"hataDurumu":2}
#         {"no":2,"tamam":true}   ya da   {"no":2,"hata":"..."}

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false

Add-Type @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RayoposHamYazdir
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct BELGE
    {
        [MarshalAs(UnmanagedType.LPWStr)] public string Ad;
        [MarshalAs(UnmanagedType.LPWStr)] public string CiktiDosyasi;
        [MarshalAs(UnmanagedType.LPWStr)] public string VeriTuru;
    }

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool OpenPrinter(string ad, out IntPtr tutamak, IntPtr ayar);

    [DllImport("winspool.drv", SetLastError = true)]
    static extern bool ClosePrinter(IntPtr tutamak);

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool StartDocPrinter(IntPtr tutamak, int seviye, ref BELGE belge);

    [DllImport("winspool.drv", SetLastError = true)]
    static extern bool EndDocPrinter(IntPtr tutamak);

    [DllImport("winspool.drv", SetLastError = true)]
    static extern bool StartPagePrinter(IntPtr tutamak);

    [DllImport("winspool.drv", SetLastError = true)]
    static extern bool EndPagePrinter(IntPtr tutamak);

    [DllImport("winspool.drv", SetLastError = true)]
    static extern bool WritePrinter(IntPtr tutamak, IntPtr veri, int uzunluk, out int yazilan);

    public static void Gonder(string yazici, byte[] veri)
    {
        IntPtr tutamak;
        if (!OpenPrinter(yazici, out tutamak, IntPtr.Zero))
            throw new Exception("Yazıcı açılamadı (" + Marshal.GetLastWin32Error() + ")");

        try
        {
            BELGE belge = new BELGE();
            belge.Ad = "RayoPOS fiş";
            // RAW: baytları dönüştürmeden yazıcıya ilet.
            belge.VeriTuru = "RAW";

            if (!StartDocPrinter(tutamak, 1, ref belge))
                throw new Exception("Yazdırma işi açılamadı (" + Marshal.GetLastWin32Error() + ")");

            try
            {
                if (!StartPagePrinter(tutamak))
                    throw new Exception("Sayfa açılamadı (" + Marshal.GetLastWin32Error() + ")");

                IntPtr bellek = Marshal.AllocCoTaskMem(veri.Length);
                try
                {
                    Marshal.Copy(veri, 0, bellek, veri.Length);
                    int yazilan;
                    if (!WritePrinter(tutamak, bellek, veri.Length, out yazilan) || yazilan != veri.Length)
                        throw new Exception("Veri yazıcıya aktarılamadı (" + Marshal.GetLastWin32Error() + ")");
                }
                finally { Marshal.FreeCoTaskMem(bellek); }

                EndPagePrinter(tutamak);
            }
            finally { EndDocPrinter(tutamak); }
        }
        finally { ClosePrinter(tutamak); }
    }
}
"@

function Durum([string]$ad) {
  # Filtre sorgusu kullanılmıyor: paylaşılan yazıcı adındaki ters bölü ve
  # tırnak sorgu dilinde ayrıca kaçırılmak istiyor, liste zaten kısa.
  $yazici = Get-CimInstance Win32_Printer | Where-Object { $_.Name -eq $ad } | Select-Object -First 1
  if (-not $yazici) { return @{ kurulu = $false } }
  @{
    kurulu     = $true
    cevrimdisi = [bool]$yazici.WorkOffline
    hataDurumu = [int]$yazici.DetectedErrorState
  }
}

while ($true) {
  $satir = [Console]::In.ReadLine()
  if ($null -eq $satir) { break }

  $cevap = @{ no = $null }
  try {
    $istek = $satir | ConvertFrom-Json
    $cevap.no = $istek.no
    if ($istek.islem -eq "durum") {
      $cevap += Durum $istek.yazici
    }
    elseif ($istek.islem -eq "bas") {
      [RayoposHamYazdir]::Gonder($istek.yazici, [Convert]::FromBase64String($istek.veri))
      $cevap.tamam = $true
    }
    else {
      $cevap.hata = "Bilinmeyen istek."
    }
  }
  catch {
    # Sınıftan atılan hata PowerShell'in "Exception calling ..." kabuğuyla
    # geliyor; okunacak olan içindeki cümle.
    $hata = $_.Exception
    if ($hata.InnerException) { $hata = $hata.InnerException }
    $cevap.hata = $hata.Message
  }

  [Console]::Out.WriteLine(($cevap | ConvertTo-Json -Compress))
  [Console]::Out.Flush()
}
