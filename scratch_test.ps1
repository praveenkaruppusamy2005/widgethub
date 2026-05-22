$ProgressPreference='SilentlyContinue'
[void][System.Reflection.Assembly]::LoadWithPartialName("System.Runtime.WindowsRuntime")
try{
[void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
[void][Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage, ContentType = WindowsRuntime]
$a=([System.WindowsRuntimeSystemExtensions].GetMethods()|?{$_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'})[0]
function Aw($t,$r){
$g=$a.MakeGenericMethod($r)
$n=$g.Invoke($null,@($t))
$n.Wait(-1)|Out-Null
return $n.Result
}
$m=Aw ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$s=$m.GetCurrentSession()
if($s){
$p=Aw ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
$pb=$s.GetPlaybackInfo()
$tl=$s.GetTimelineProperties()
$tb=""
if($p.Thumbnail){
try{
$st=Aw ($p.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
$as=([System.IO.WindowsRuntimeStreamExtensions].GetMethods()|?{$_.Name -eq 'AsStreamForRead' -and $_.GetParameters().Count -eq 1})[0]
$ns=$as.Invoke($null,@($st))
$ms=New-Object System.IO.MemoryStream
$ns.CopyTo($ms)
$tb=[Convert]::ToBase64String($ms.ToArray())
}catch{}
}
@{
Title=$p.Title
Artist=$p.Artist
AlbumTitle=$p.AlbumTitle
PlaybackStatus=$pb.PlaybackStatus.ToString()
Position=$tl.Position.TotalSeconds
EndTime=$tl.EndTime.TotalSeconds
Thumbnail=$tb
SourceAppId=$s.SourceAppId
}|ConvertTo-Json -Depth 2
}else{"{}"}
}catch{"{}"}
