#!/bin/bash
# Fix: Remove the address bar URL from the browser mockup in DemoLandingPage

FILE="src/ui/web/homepage/DemoLandingPage/index.tsx"

# Remove lines 266-270 (the URL bar div and one closing div)
# Then insert the correct closing tag for the flex container
awk '
NR == 262 { print; next }
NR == 263 { print; next }
NR == 264 { print; next }
NR == 265 { print; next }
NR == 266 { print; next }
NR == 267 { print; next }
NR == 268 { print; next }
NR == 269 { print; next }
NR == 270 { print; next }
NR == 271 {
  # Replace with just the flex container closing div
  print "          </div>"
  next
}
{ print }
' "$FILE" > "$FILE.tmp" && mv "$FILE.tmp" "$FILE"
