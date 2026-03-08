---
description: Use this skill when generating command line strings to execute since the host OS is Windows using PowerShell
---

# PowerShell Syntax Overrides

The host OS for this project is Windows running PowerShell. Standard bash constructs often fail. 

When generating CLI commands using the `run_command` tool, observe these strict rules:

1. **NO `&&` OPERATOR:** PowerShell does not support the `&&` conditional execution operator. Replace all occurrences of `foo && bar` with `foo ; bar` or run the commands sequentially using multiple tool calls. 

2. **AVOID BASH-ISMS:** Do not use `rm -rf` (use `Remove-Item -Recurse -Force`), `cp` (use `Copy-Item`), or `cat` (use `Get-Content`).

Always format CLI commands assuming `pwsh` or `powershell.exe` as the interpreter.
