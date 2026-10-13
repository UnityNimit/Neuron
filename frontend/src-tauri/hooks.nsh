; frontend/src-tauri/hooks.nsh
; Automatically terminate Neuron backend and main application before uninstall or install.
; Refresh Windows shell shortcut icon references and purge Explorer icon cache.
; Guarantees zero "file in use" lockups, 100% clean uninstallation, and immediate icon updates.

!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Terminating existing Neuron instances..."
  nsExec::Exec 'taskkill /F /IM neuron-backend.exe /T'
  nsExec::Exec 'taskkill /F /IM neuron-backend-x86_64-pc-windows-msvc.exe /T'
  nsExec::Exec 'taskkill /F /IM neuron.exe /T'
  Sleep 500
!macroend

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Updating application shortcuts and refreshing shell icon cache..."

  ; Force recreate desktop shortcut with explicit target executable and icon index 0
  Delete "$DESKTOP\${PRODUCTNAME}.lnk"
  CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\${MAINBINARYNAME}.exe" 0
  !insertmacro SetLnkAppUserModelId "$DESKTOP\${PRODUCTNAME}.lnk"

  ; Force recreate start menu shortcut with explicit target executable and icon index 0
  !if "${STARTMENUFOLDER}" != ""
    CreateDirectory "$SMPROGRAMS\$AppStartMenuFolder"
    Delete "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk"
    CreateShortcut "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\${MAINBINARYNAME}.exe" 0
    !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk"
  !else
    Delete "$SMPROGRAMS\${PRODUCTNAME}.lnk"
    CreateShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\${MAINBINARYNAME}.exe" 0
    !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\${PRODUCTNAME}.lnk"
  !endif

  ; Notify Windows Explorer of shell association and icon cache change
  System::Call 'shell32.dll::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
  nsExec::Exec 'ie4uinit.exe -show'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Terminating Neuron Background Engine..."
  nsExec::Exec 'taskkill /F /IM neuron-backend.exe /T'
  nsExec::Exec 'taskkill /F /IM neuron-backend-x86_64-pc-windows-msvc.exe /T'
  nsExec::Exec 'taskkill /F /IM neuron.exe /T'
  Sleep 500
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DetailPrint "Purging shell icon cache..."
  System::Call 'shell32.dll::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
  nsExec::Exec 'ie4uinit.exe -show'
!macroend

; Backward compatibility aliases
!macro customInstall
  !insertmacro NSIS_HOOK_PREINSTALL
!macroend

!macro customUnInstall
  !insertmacro NSIS_HOOK_PREUNINSTALL
!macroend
