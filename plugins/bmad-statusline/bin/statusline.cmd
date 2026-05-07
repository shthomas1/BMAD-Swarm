@echo off
REM bmad-statusline Windows wrapper. Forwards stdin to node and prints the
REM rendered status line on stdout. Always exits 0 so cmd.exe never breaks
REM the Claude Code status bar.
node "%~dp0statusline.cjs" %*
exit /b 0
