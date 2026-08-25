# Hostinger - despliegue recomendado

## Plataforma
Usar Hostinger Node.js Web App en Business o Cloud. El proyecto esta preparado para un unico despliegue Next.js full-stack.

## Configuracion
- Node.js: 22.x
- Framework: Next.js (autodetectado)
- Install: `npm ci`
- Build: `npm run build`
- Start: `npm start`
- Output: `.next` si hPanel lo solicita
- Base de datos: MySQL administrada de Hostinger o MySQL externo compatible

## Flujo GitHub
1. hPanel -> Websites -> Add Website -> Deploy Web App.
2. Import Git Repository.
3. Autorizar GitHub y seleccionar repo privado.
4. Confirmar Node 22 y comandos.
5. Cargar variables de entorno en hPanel.
6. Deploy.
7. Verificar SSL, health, DB, logs y smoke test.
8. Activar redeploy automatico desde `main`.

## Variables minimas
- DATABASE_URL
- APP_URL
- SESSION_SECRET
- PROVIDER_MODE=MOCK|UAT|PROD
- KODEXA_BASE_URL
- KODEXA_CLIENT_ID
- KODEXA_CLIENT_SECRET
- LOG_LEVEL

## Importante
No subir secretos a GitHub. En modo showcase usar `PROVIDER_MODE=MOCK`. Al pasar a UAT/PROD solo cambia el adapter/configuracion, no el frontend.
