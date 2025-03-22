#!/opt/homebrew/bin/fish

nohup /Applications/Tailscale.app/Contents/MacOS/Tailscale serve --https=5173 localhost:5173 >/dev/null 2>&1 &
set tail_pid $last_pid
pnpm exec vite dev
kill $tail_pid
