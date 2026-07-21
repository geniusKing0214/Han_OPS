Set WshShell = WScript.CreateObject("WScript.Shell")
WshShell.AppActivate "cmd"
WScript.Sleep 800
WshShell.SendKeys "{ESCAPE}"
WScript.Sleep 300
WshShell.SendKeys ":wq{ENTER}"
