@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Private Session - Free Windows source build (experimental)
cd /d "%~dp0"

echo ===============================================================
echo  PRIVATE SESSION - LOCAL EXPERIMENTAL BUILD (NOT SECURE RELEASE)
echo  Uses this computer; GitHub Actions minutes NOT consumed.
echo  Passwords and account identity files are NOT uploaded to GitHub.
echo ===============================================================
echo.
echo Warning: Real encrypted Mac/Windows calls, USB security and ALL
echo screenshot/recording restrictions are NOT hardware-verified.
echo Never use this experimental app for confidential conversations.
echo.
set "BUILDLOG=%CD%\LOCAL_WINDOWS_BUILD_LOG.txt"
echo Start: %DATE% %TIME% > "%BUILDLOG%"
where node >nul 2>&1
if errorlevel 1 goto missingnode
where npm >nul 2>&1
if errorlevel 1 goto missingnode
echo Node detected:
node --version
call npm --version
echo.

echo [1/6] Installing Windows application dependencies...
call npm install --no-audit --no-fund >> "%BUILDLOG%" 2>&1
if errorlevel 1 goto fail

echo [2/6] Running application and session-security tests...
call npm test >> "%BUILDLOG%" 2>&1
if errorlevel 1 goto fail

echo [3/6] Installing and testing restricted relay (needed by crypto suite)...
pushd relay-service
call npm install --no-audit --no-fund >> "%BUILDLOG%" 2>&1
if errorlevel 1 goto backfail
call npm test >> "%BUILDLOG%" 2>&1
if errorlevel 1 goto backfail
popd

echo [4/6] Installing Noise E2EE integration dependencies...
pushd crypto-probe
call npm install --no-audit --no-fund >> "%BUILDLOG%" 2>&1
if errorlevel 1 goto backfail

echo [5/6] Testing E2EE, authenticated Seen and restricted relay...
call npm test >> "%BUILDLOG%" 2>&1
if errorlevel 1 goto backfail
popd

echo [6/6] Packaging unsigned Windows test executable...
set "CSC_IDENTITY_AUTO_DISCOVERY=false"
call npm run build:win >> "%BUILDLOG%" 2>&1
if errorlevel 1 goto fail
if not exist "dist\PrivateSession-Dummy-x64.exe" goto fail

echo.
echo ===============================================================
echo  BUILD SUCCEEDED: dist\PrivateSession-Dummy-x64.exe
echo  This is EXPERIMENTAL and NOT verified safe for private use.
echo  Build log: LOCAL_WINDOWS_BUILD_LOG.txt
echo ===============================================================
echo.
pause
exit /b 0

:backfail
popd
goto fail

:missingnode
echo Node.js is missing. Install Node.js 22 from https://nodejs.org/
echo Restart this window and run BUILD_WINDOWS_FREE.cmd again.
echo IMPORTANT: Do not install Node from untrusted third-party sites.
pause
exit /b 1

:fail
echo.
echo ===============================================================
echo  BUILD OR TEST FAILED. NO APP HAS BEEN APPROVED FOR USE.
echo  Read the last lines of LOCAL_WINDOWS_BUILD_LOG.txt
echo  Do not bypass the failed test or turn off Windows Defender.
echo ===============================================================
echo.
powershell -NoProfile -Command "Get-Content -LiteralPath 'LOCAL_WINDOWS_BUILD_LOG.txt' -Tail 25" 2>nul
pause
exit /b 1
