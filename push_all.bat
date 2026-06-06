@echo off
SET GIT="C:\Program Files\Git\cmd\git.exe"
IF NOT EXIST %GIT% SET GIT="C:\Program Files (x86)\Git\cmd\git.exe"
IF NOT EXIST %GIT% SET GIT=git

cd /d "C:\Users\shan\Downloads\CLAUDE\projects\Yousuf"
echo Working directory: %CD%
echo.
%GIT% add -u
echo.
%GIT% commit -m "Add Excel import support, expand search to address and logon ID"
echo.
%GIT% push origin main
echo.
echo ===== DONE =====
pause
