curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyAbYMNO3kywhikFFK4dmDd8-poEu6h32HM" \
-H 'Content-Type: application/json' \
-X POST \
-d '{
"contents": [{
"parts":[{"text": "Explain how AI works"}]
}]
}'

npm start AddComments src/gemini
npm start AddComments src/inspector