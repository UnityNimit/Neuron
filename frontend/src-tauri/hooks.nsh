; frontend/src-tauri/hooks.nsh
; Automatically terminate Neuron backend and main application before uninstall or install
; Guarantees zero "file in use" lockups and 100% clean uninstallation.

!macro customUnInstall
  DetailPrint "Terminating Neuron Background Engine..."
  nsExec::Exec 'taskkill /F /IM neuron-backend.exe /T'
  nsExec::Exec 'taskkill /F /IM neuron-backend-x86_64-pc-windows-msvc.exe /T'
  nsExec::Exec 'taskkill /F /IM neuron.exe /T'
  Sleep 500
!macroend

!macro customInstall
  DetailPrint "Terminating existing Neuron instances..."
  nsExec::Exec 'taskkill /F /IM neuron-backend.exe /T'
  nsExec::Exec 'taskkill /F /IM neuron-backend-x86_64-pc-windows-msvc.exe /T'
  nsExec::Exec 'taskkill /F /IM neuron.exe /T'
  Sleep 500
!macroend
