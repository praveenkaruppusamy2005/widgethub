import { app, BrowserWindow, ipcMain, shell, session, Tray, Menu } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Optimize Memory
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');

console.log("Main process starting... loading main.js");
let mainWindow = null;
let isAppQuitting = false;
let tray = null;
const activeWidgetWindows = new Set();

const APP_ICON_PATH = path.join(__dirname, '../renderer/src/assets/app.ico');

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: APP_ICON_PATH
  });

  const startUrl = app.isPackaged 
    ? `file://${path.join(__dirname, '../dist/index.html')}`
    : process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../renderer/index.html')}`;
    
  mainWindow.loadURL(startUrl);

  mainWindow.on('close', (event) => {
    if (!isAppQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createWidgetWindow(widgetType) {
  let width = 280;
  let height = 340;

  if (widgetType === 'bloom') {
    width = 280;
    height = 300;
  } else if (widgetType === 'buds') {
    width = 280;
    height = 340;
  } else if (widgetType === 'media') {
    width = 360;
    height = 240;
  } else if (widgetType === 'weather') {
    width = 220;
    height = 220;
  } else if (widgetType === 'calendar') {
    width = 240;
    height = 240;
  } else if (widgetType === 'spotify') {
    width = 380;
    height = 200;
  } else if (widgetType === 'battery-circle' || widgetType === 'battery-square') {
    width = 200;
    height = 200;
  } else if (widgetType === 'analog-clock') {
    width = 240;
    height = 240;
  } else if (widgetType === 'photo-frame') {
    width = 300;
    height = 300;
  } else if (widgetType === 'screen-time') {
    width = 200;
    height = 200;
  }

  const isResizable = widgetType === 'photo-frame';

  const widgetWin = new BrowserWindow({
    width,
    height,
    frame: false,
    transparent: true,
    resizable: isResizable,
    skipTaskbar: true, // hides from taskbar so it acts like a true desktop widget
    alwaysOnTop: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: APP_ICON_PATH
  });

  if (widgetType === 'photo-frame') {
    widgetWin.setMinimumSize(150, 150);
    widgetWin.setMaximumSize(600, 600);
  }

  const baseStartUrl = app.isPackaged 
    ? `file://${path.join(__dirname, '../dist/index.html')}`
    : process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../renderer/index.html')}`;

  activeWidgetWindows.add(widgetWin);
  updateTrayMenu();

  widgetWin.loadURL(`${baseStartUrl}#/widget/${widgetType}`);

  widgetWin.on('closed', () => {
    activeWidgetWindows.delete(widgetWin);
    updateTrayMenu();
  });
}

function updateTrayMenu() {
  if (!tray) return;
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show main window',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createMainWindow();
        }
      }
    },
    {
      label: 'Hide widgets for 15 minutes',
      click: () => {
        activeWidgetWindows.forEach(win => {
          if (!win.isDestroyed()) win.hide();
        });
        setTimeout(() => {
          activeWidgetWindows.forEach(win => {
            if (!win.isDestroyed()) win.show();
          });
        }, 15 * 60 * 1000);
      }
    },
    {
      label: `Active widgets (${activeWidgetWindows.size})`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Exit',
      click: () => {
        isAppQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
}

function createTray() {
  tray = new Tray(APP_ICON_PATH);
  tray.setToolTip('Widget Hub');
  updateTrayMenu();
  
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createMainWindow();
    }
  });
}

ipcMain.handle('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

ipcMain.handle('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
      return false;
    } else {
      win.maximize();
      return true;
    }
  }
  return false;
});

ipcMain.handle('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

ipcMain.handle('window-toggle-always-on-top', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    const currentState = win.isAlwaysOnTop();
    win.setAlwaysOnTop(!currentState);
    return !currentState;
  }
  return false;
});

ipcMain.handle('window-get-always-on-top', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win ? win.isAlwaysOnTop() : false;
});

ipcMain.handle('spawn-widget', (event, widgetType) => {
  createWidgetWindow(widgetType);
});

ipcMain.handle('open-bluetooth-settings', async () => {
  // Opens Windows Bluetooth settings page
  await shell.openExternal('ms-settings:bluetooth');
});

// Windows Media Integration IPC
ipcMain.handle('get-media-session', async () => {
  try {
    const psScript = `$ProgressPreference='SilentlyContinue';[void][System.Reflection.Assembly]::LoadWithPartialName("System.Runtime.WindowsRuntime");try{[void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime];[void][Windows.Storage.Streams.IRandomAccessStreamWithContentType,Windows.Storage,ContentType=WindowsRuntime];$a=[System.WindowsRuntimeSystemExtensions].GetMethods()|?{$_.Name-eq'AsTask'-and$_.GetParameters().Count-eq1-and$_.GetParameters()[0].ParameterType.Name-like'*AsyncOperation*'-and$_.GetGenericArguments().Count-eq1};function Aw($t,$r){$g=$a.MakeGenericMethod($r);$n=$g.Invoke($null,@($t));$n.Wait(-1)|Out-Null;return $n.Result};$m=Aw ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]);$s=$m.GetCurrentSession();if($s){$p=Aw ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]);$pb=$s.GetPlaybackInfo();$tl=$s.GetTimelineProperties();$tb="";if($p.Thumbnail){try{$st=Aw ($p.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType]);$as=[System.IO.WindowsRuntimeStreamExtensions].GetMethods()|?{$_.Name-eq'AsStreamForRead'-and$_.GetParameters().Count-eq1};$ns=$as.Invoke($null,@($st));$ms=New-Object System.IO.MemoryStream;$ns.CopyTo($ms);$tb=[Convert]::ToBase64String($ms.ToArray())}catch{}};@{Title=$p.Title;Artist=$p.Artist;AlbumTitle=$p.AlbumTitle;PlaybackStatus=$pb.PlaybackStatus.ToString();Position=$tl.Position.TotalSeconds;EndTime=$tl.EndTime.TotalSeconds;Thumbnail=$tb;SourceAppId=$s.SourceAppUserModelId}|ConvertTo-Json -Depth 2}else{"{}"}}catch{"{}"}`;

    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    const cmd = `powershell -ExecutionPolicy Bypass -EncodedCommand ${encoded}`;
    const { stdout } = await execAsync(cmd);
    if (!stdout.trim()) return null;
    if (stdout.trim().startsWith('{')) {
      return JSON.parse(stdout);
    }
    return null;
  } catch (err) {
    console.error("Error in get-media-session IPC handler:", err);
    return null;
  }
});

ipcMain.handle('open-app', async (event, appId) => {
  try {
    const idLower = (appId || "").toLowerCase();
    if (idLower.includes("spotify")) {
      await shell.openExternal("spotify:");
      return true;
    }
    return false;
  } catch (e) {
    console.error("Failed to open app:", e);
    return false;
  }
});

ipcMain.handle('control-media', async (event, action, value) => {
  try {
    let commandStr = "";
    if (action === 'playpause') {
      commandStr = `$ProgressPreference='SilentlyContinue';[void][System.Reflection.Assembly]::LoadWithPartialName("System.Runtime.WindowsRuntime");try{[void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime];$a=[System.WindowsRuntimeSystemExtensions].GetMethods()|?{$_.Name-eq'AsTask'-and$_.GetParameters().Count-eq1-and$_.GetParameters()[0].ParameterType.Name-like'*AsyncOperation*'-and$_.GetGenericArguments().Count-eq1};function Aw($t,$r){$g=$a.MakeGenericMethod($r);$n=$g.Invoke($null,@($t));$n.Wait(-1)|Out-Null;return $n.Result};$m=Aw ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]);$s=$m.GetCurrentSession();if($s){$pb=$s.GetPlaybackInfo();if($pb.PlaybackStatus-eq'Playing'){[void](Aw ($s.TryPauseAsync()) ([System.Boolean]))}else{[void](Aw ($s.TryPlayAsync()) ([System.Boolean]))}}}catch{}`;
    } else if (action === 'next') {
      commandStr = `$ProgressPreference='SilentlyContinue';[void][System.Reflection.Assembly]::LoadWithPartialName("System.Runtime.WindowsRuntime");try{[void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime];$a=[System.WindowsRuntimeSystemExtensions].GetMethods()|?{$_.Name-eq'AsTask'-and$_.GetParameters().Count-eq1-and$_.GetParameters()[0].ParameterType.Name-like'*AsyncOperation*'-and$_.GetGenericArguments().Count-eq1};function Aw($t,$r){$g=$a.MakeGenericMethod($r);$n=$g.Invoke($null,@($t));$n.Wait(-1)|Out-Null;return $n.Result};$m=Aw ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]);$s=$m.GetCurrentSession();if($s){[void](Aw ($s.TrySkipNextAsync()) ([System.Boolean]))}}catch{}`;
    } else if (action === 'seek') {
      const ticks = Math.round(value * 10000000);
      commandStr = `$ProgressPreference='SilentlyContinue';[void][System.Reflection.Assembly]::LoadWithPartialName("System.Runtime.WindowsRuntime");try{[void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime];$a=[System.WindowsRuntimeSystemExtensions].GetMethods()|?{$_.Name-eq'AsTask'-and$_.GetParameters().Count-eq1-and$_.GetParameters()[0].ParameterType.Name-like'*AsyncOperation*'-and$_.GetGenericArguments().Count-eq1};function Aw($t,$r){$g=$a.MakeGenericMethod($r);$n=$g.Invoke($null,@($t));$n.Wait(-1)|Out-Null;return $n.Result};$m=Aw ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]);$s=$m.GetCurrentSession();if($s){[void](Aw ($s.TryChangePlaybackPositionAsync(${ticks})) ([System.Boolean]))}}catch{}`;
    }

    if (commandStr) {
      const encoded = Buffer.from(commandStr, 'utf16le').toString('base64');
      const cmd = `powershell -ExecutionPolicy Bypass -EncodedCommand ${encoded}`;
      await execAsync(cmd);
      return true;
    }
    return false;
  } catch (err) {
    console.error("Error in control-media IPC handler:", err);
    return false;
  }
});

function getMacAddress(instanceId) {
  if (!instanceId) return null;
  const devMatch = instanceId.match(/DEV_([0-9A-Fa-f]{12})/i);
  if (devMatch) return devMatch[1].toLowerCase();
  const suffixMatch = instanceId.match(/&([0-9A-Fa-f]{12})_/i);
  if (suffixMatch) return suffixMatch[1].toLowerCase();
  const parts = instanceId.split('\\');
  const lastPart = parts[parts.length - 1];
  const generalMatch = lastPart.match(/([0-9A-Fa-f]{12})/);
  if (generalMatch) return generalMatch[1].toLowerCase();
  return null;
}

ipcMain.handle('get-system-uptime', () => {
  return os.uptime();
});

ipcMain.handle('get-bluetooth-devices', async () => {
  console.log("get-bluetooth-devices handler invoked!");
  try {
    const psScript = `$ProgressPreference = 'SilentlyContinue'
$btDevices = Get-PnpDevice -Class Bluetooth | Where-Object { $_.Present -eq $true } | Select-Object FriendlyName, InstanceId, Present, Class, Status
$activeEndpoints = Get-PnpDevice -Class AudioEndpoint | Where-Object { $_.Present -eq $true -and $_.Status -eq 'OK' } | Select-Object -ExpandProperty FriendlyName
$connectedMacs = @()
foreach ($d in $btDevices) {
    $nameLower = $d.FriendlyName.ToLower()
    $isConnected = $false
    foreach ($ae in $activeEndpoints) {
        $aeLower = $ae.ToLower()
        if ($aeLower.Contains($nameLower) -or $nameLower.Contains($aeLower)) {
            $isConnected = $true
            break
        }
    }
    if ($isConnected -and ($d.InstanceId -match 'DEV_([0-9A-Fa-f]{12})')) {
        $connectedMacs += $Matches[1]
    }
}
$connectedMacs = $connectedMacs | Select-Object -Unique
$batteries = @()
if ($connectedMacs.Count -gt 0) {
    $filters = @()
    foreach ($mac in $connectedMacs) {
        $filters += "*111E*$mac*"
        $filters += "*180F*$mac*"
    }
    $batteries = Get-PnpDevice -InstanceId $filters -ErrorAction SilentlyContinue | Get-PnpDeviceProperty -KeyName '{104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2' -ErrorAction SilentlyContinue | Where-Object { $_.Data -ne $null } | Select-Object InstanceId, Data
}
@{ devices = $btDevices; endpoints = Get-PnpDevice -Class AudioEndpoint | Select-Object FriendlyName, InstanceId, Present, Class, Status; batteries = $batteries } | ConvertTo-Json -Depth 5`;

    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    const cmd = `powershell -ExecutionPolicy Bypass -EncodedCommand ${encoded}`;

    const { stdout } = await execAsync(cmd);
    if (!stdout.trim()) return [];

    const result = JSON.parse(stdout);
    const rawDevices = Array.isArray(result.devices) ? result.devices : (result.devices ? [result.devices] : []);
    const rawEndpoints = Array.isArray(result.endpoints) ? result.endpoints : (result.endpoints ? [result.endpoints] : []);
    const rawBatteries = Array.isArray(result.batteries) ? result.batteries : (result.batteries ? [result.batteries] : []);

    const batteryMap = {};
    for (const b of rawBatteries) {
      const mac = getMacAddress(b.InstanceId);
      if (mac && b.Data !== undefined && b.Data !== null) {
        batteryMap[mac] = b.Data;
      }
    }

    const activeAudioEndpoints = [];
    for (const ae of rawEndpoints) {
      if (ae.FriendlyName && ae.Present === true && ae.Status === 'OK') {
        activeAudioEndpoints.push(ae.FriendlyName.toLowerCase());
      }
    }

    const systemKeywords = [
      'enumerator', 'adapter', 'service', 'protocol', 'microsoft',
      'intel', 'realtek', 'mediatek', 'bluetooth device', 'hands-free',
      'avrcp', 'gatt', 'hfp', 'obex', 'device identification'
    ];

    const bluetoothDevices = [];
    const processedNames = new Set();

    for (const d of rawDevices) {
      if (!d.FriendlyName || !d.InstanceId) continue;
      const name = d.FriendlyName;
      const nameLower = name.toLowerCase();

      // Filter out system hardware profiles
      if (systemKeywords.some(kw => nameLower.includes(kw))) continue;
      if (processedNames.has(nameLower)) continue;
      processedNames.add(nameLower);

      const mac = getMacAddress(d.InstanceId);
      const batteryLevel = mac && batteryMap[mac] !== undefined ? batteryMap[mac] : null;

      const isConnected = activeAudioEndpoints.some(ae => ae.includes(nameLower) || nameLower.includes(ae));

      bluetoothDevices.push({
        name,
        connected: isConnected,
        batteryLevel
      });
    }

    console.log("get-bluetooth-devices resolved: ", JSON.stringify(bluetoothDevices, null, 2));
    return bluetoothDevices;
  } catch (err) {
    console.error("Error fetching Bluetooth devices:", err);
    return [];
  }
});

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'geolocation') {
      callback(true);
    } else {
      callback(false);
    }
  });

  createMainWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isAppQuitting) {
    app.quit();
  }
});