@echo off
cd /d "C:\Users\shan\Downloads\CLAUDE\projects\Yousuf"
git add src/app/(yousuf)/customers/page.tsx
git commit -m "Expand search to include address and logon ID (notes field)"
git push origin main
echo.
echo Done! Press any key to close.
pause
