; NSIS installer hooks for Desktop Calendar

!macro NSIS_HOOK_POSTINSTALL
  ; 설치 후 자동시작 레지스트리 등록
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "DesktopCalendar" '"$INSTDIR\Desktop Calendar.exe"'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; 제거 시 자동시작 레지스트리 삭제
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "DesktopCalendar"
!macroend
