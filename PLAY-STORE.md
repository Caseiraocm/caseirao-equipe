# Caseirão Equipe — versão Android

O projeto já possui identidade Android (`br.com.ocaseirao.equipe`) e configuração do Capacitor.

Antes de gerar o pacote da Play Store, hospede a versão PWA em HTTPS e teste todos os fluxos da equipe. Depois, em um computador com Android Studio e Java configurados:

1. Execute `npm install`.
2. Execute `npx cap add android` uma única vez.
3. Execute `npm run android:sync`.
4. Execute `npm run android:open`.
5. No Android Studio, gere um Android App Bundle assinado (`.aab`).

O `.aab` assinado é o arquivo enviado ao Google Play Console.
