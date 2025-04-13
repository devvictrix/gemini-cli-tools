curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyAbYMNO3kywhikFFK4dmDd8-poEu6h32HM" \
-H 'Content-Type: application/json' \
-X POST \
-d '{
"contents": [{
"parts":[{"text": "Explain how AI works"}]
}]
}'

npm start Analyze src/
npm start AddComments src
npm start AddComments src/gemini
npm start AddComments src/inspector

https://appstream2.ap-southeast-1.aws.amazon.com/authenticate?parameters=eyJ0eXBlIjoiRU5EX1VTRVIiLCJleHBpcmVzIjoiMTc0NDQ4MTEzMiIsImF3c0FjY291bnRJZCI6IjY2NzAzOTQwODk4OSIsInVzZXJJZCI6Im5ldyIsImNhdGFsb2dTb3VyY2UiOiJzdGFjay9lQ29tbWVyY2UtU3RhY2siLCJmbGVldFJlZiI6ImZsZWV0L1RydWUtZUNvbW1lcmNlLUZsZWV0IiwiYXBwbGljYXRpb25JZCI6IiIsInVzZXJDb250ZXh0IjoiIiwibWF4VXNlckR1cmF0aW9uSW5TZWNzIjoiNTc2MDAifQ%3D%3D&signature=GzAjpmqHK2gVEg0vR6P0bqgCSgKsEEVoN4gfIvHA%2F1g%3D