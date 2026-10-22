// Outrun Dhaka launcher: unpacks the embedded single-file game and opens it in its own Edge (or Chrome) app window,
// with no tabs or address bar. No runtime to install: Edge ships with Windows 10 and 11.

using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Win32;

static class Launcher
{
    static string Find(params string[] candidates)
    {
        foreach (var c in candidates) if (!string.IsNullOrEmpty(c) && File.Exists(c)) return c;
        return null;
    }

    static string Registered(string exe)
    {
        foreach (var hive in new[] { Registry.LocalMachine, Registry.CurrentUser })
        {
            using (var k = hive.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\" + exe))
            {
                var v = k == null ? null : k.GetValue(null) as string;
                if (!string.IsNullOrEmpty(v) && File.Exists(v)) return v;
            }
        }
        return null;
    }

    [STAThread]
    static void Main()
    {
        var x86 = Environment.GetEnvironmentVariable("ProgramFiles(x86)") ?? "";
        var x64 = Environment.GetEnvironmentVariable("ProgramFiles") ?? "";
        var browser = Registered("msedge.exe")
            ?? Find(Path.Combine(x86, "Microsoft", "Edge", "Application", "msedge.exe"), Path.Combine(x64, "Microsoft", "Edge", "Application", "msedge.exe"))
            ?? Registered("chrome.exe")
            ?? Find(Path.Combine(x64, "Google", "Chrome", "Application", "chrome.exe"), Path.Combine(x86, "Google", "Chrome", "Application", "chrome.exe"));
        if (browser == null)
        {
            MessageBox.Show("Outrun Dhaka needs Microsoft Edge or Google Chrome, and neither was found.", "Outrun Dhaka");
            return;
        }

        var dir = Path.Combine(Path.GetTempPath(), "OutrunDhaka");
        Directory.CreateDirectory(dir);
        var html = Path.Combine(dir, "index.html");
        using (var src = Assembly.GetExecutingAssembly().GetManifestResourceStream("index.html"))
        using (var dst = File.Create(html)) src.CopyTo(dst);

        // its own profile, so closing the window ends the process and settings and best times are kept between runs
        var profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OutrunDhaka", "profile");
        Directory.CreateDirectory(profile);
        var args = "--app=\"" + new Uri(html).AbsoluteUri + "\" --user-data-dir=\"" + profile + "\" --window-size=1600,900"
            + " --autoplay-policy=no-user-gesture-required --no-first-run --no-default-browser-check --disable-features=Translate";
        var p = Process.Start(new ProcessStartInfo(browser, args) { UseShellExecute = false });
        if (p != null) p.WaitForExit();
    }
}
